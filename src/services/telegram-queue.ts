import { z } from 'zod';
import { Bot } from 'grammy';
import { BotContext } from '../bot/types.js';
import { prisma } from '../db/client.js';
import { extractUpdateMetadata } from '../logging/metadata.js';
import { createUpdateLogger, logger } from '../logging/logger.js';

export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Zod schema to safely validate incoming Telegram update requests.
 * Requires `update_id` to be an integer and permits standard update fields.
 */
export const telegramUpdateSchema = z
  .object({
    update_id: z.number().int({ message: 'update_id must be an integer' }),
    message: z.record(z.string(), z.unknown()).optional(),
    edited_message: z.record(z.string(), z.unknown()).optional(),
    channel_post: z.record(z.string(), z.unknown()).optional(),
    edited_channel_post: z.record(z.string(), z.unknown()).optional(),
    callback_query: z.record(z.string(), z.unknown()).optional(),
    my_chat_member: z.record(z.string(), z.unknown()).optional(),
    chat_member: z.record(z.string(), z.unknown()).optional(),
    chat_join_request: z.record(z.string(), z.unknown()).optional(),
    inline_query: z.record(z.string(), z.unknown()).optional(),
    chosen_inline_result: z.record(z.string(), z.unknown()).optional(),
    poll: z.record(z.string(), z.unknown()).optional(),
    poll_answer: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type ValidTelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export type EnqueueResult =
  | { status: 'enqueued'; recordId: string; isDuplicate: boolean }
  | { status: 'duplicate_completed'; recordId: string; isDuplicate: true }
  | { status: 'duplicate_in_flight'; recordId: string; isDuplicate: true }
  | { status: 'max_attempts_exceeded'; recordId: string; isDuplicate: true };

/**
 * Ingests and stores a Telegram update into the database for idempotency & decoupled processing.
 */
export async function enqueueTelegramUpdate(
  rawPayload: unknown
): Promise<{ success: true; result: EnqueueResult } | { success: false; error: string }> {
  const parsed = telegramUpdateSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid Telegram update payload: ' + parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const update = parsed.data;
  const updateId = BigInt(update.update_id);
  const meta = extractUpdateMetadata(update);
  const stepLogger = createUpdateLogger({ ...meta, processing_step: 'enqueue_update' });

  try {
    // 1. Check for existing update (Idempotency check)
    const existing = await prisma.telegramUpdate.findUnique({
      where: { updateId },
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        stepLogger.info(
          {
            status: 'COMPLETED',
            attempts: existing.attempts,
          },
          'Update already completed; ignoring duplicate'
        );
        return {
          success: true,
          result: {
            status: 'duplicate_completed',
            recordId: existing.id,
            isDuplicate: true,
          },
        };
      }

      // If processing currently, check if stuck (> 60 seconds timeout)
      if (existing.status === 'PROCESSING') {
        const elapsedSinceUpdate = Date.now() - new Date(existing.updatedAt).getTime();
        if (elapsedSinceUpdate < 60_000) {
          stepLogger.info(
            {
              status: 'PROCESSING',
              elapsedMs: elapsedSinceUpdate,
            },
            'Update currently in flight; skipping duplicate delivery'
          );
          return {
            success: true,
            result: {
              status: 'duplicate_in_flight',
              recordId: existing.id,
              isDuplicate: true,
            },
          };
        }
        stepLogger.warn(
          {
            status: 'PROCESSING',
            elapsedMs: elapsedSinceUpdate,
          },
          'Update was stuck in PROCESSING; allowing re-enqueuing'
        );
      }

      if (existing.status === 'FAILED' && existing.attempts >= MAX_RETRY_ATTEMPTS) {
        stepLogger.warn(
          {
            status: 'FAILED',
            attempts: existing.attempts,
          },
          'Update reached max attempts; ignoring repeated delivery'
        );
        return {
          success: true,
          result: {
            status: 'max_attempts_exceeded',
            recordId: existing.id,
            isDuplicate: true,
          },
        };
      }

      // Existing pending or retryable update
      return {
        success: true,
        result: {
          status: 'enqueued',
          recordId: existing.id,
          isDuplicate: true,
        },
      };
    }

    // 2. Persist new update with status PENDING
    const record = await prisma.telegramUpdate.create({
      data: {
        updateId,
        payload: update as any,
        status: 'PENDING',
        attempts: 0,
      },
    });

    stepLogger.info(
      {
        record_id: record.id,
        status: 'PENDING',
      },
      'Telegram update persisted to queue'
    );

    return {
      success: true,
      result: {
        status: 'enqueued',
        recordId: record.id,
        isDuplicate: false,
      },
    };
  } catch (err: any) {
    // Check if unique constraint collision occurred due to concurrent requests
    if (err?.code === 'P2002' || err?.message?.includes('UNIQUE constraint failed')) {
      stepLogger.info('Concurrent duplicate insertion caught via unique constraint');
      const existing = await prisma.telegramUpdate.findUnique({
        where: { updateId },
      });
      return {
        success: true,
        result: {
          status: existing?.status === 'COMPLETED' ? 'duplicate_completed' : 'duplicate_in_flight',
          recordId: existing?.id || '',
          isDuplicate: true,
        },
      };
    }

    stepLogger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Failed to persist Telegram update to database'
    );
    throw err;
  }
}

/**
 * Asynchronously processes a queued Telegram update with retry management and structured logging.
 */
export async function processQueuedUpdate(
  recordId: string,
  bot: Bot<BotContext>,
  options?: { maxAttempts?: number }
): Promise<void> {
  const maxAttempts = options?.maxAttempts ?? MAX_RETRY_ATTEMPTS;

  const record = await prisma.telegramUpdate.findUnique({
    where: { id: recordId },
  });

  if (!record || record.status === 'COMPLETED') {
    return;
  }

  const currentAttempts = record.attempts + 1;

  // Transition to PROCESSING
  await prisma.telegramUpdate.update({
    where: { id: recordId },
    data: {
      status: 'PROCESSING',
      attempts: currentAttempts,
    },
  });

  const meta = extractUpdateMetadata(record.payload);
  const stepLogger = createUpdateLogger({
    ...meta,
    processing_step: 'execute_update',
  });

  const startTime = Date.now();

  try {
    // Ensure grammY bot is initialized with botInfo before processing updates
    if (typeof bot.isInited === 'function' && !bot.isInited()) {
      await bot.init();
    }

    // Execute bot logic via grammY
    await bot.handleUpdate(record.payload as any);

    const durationMs = Date.now() - startTime;

    await prisma.telegramUpdate.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        lastError: null,
      },
    });

    stepLogger.info(
      {
        duration_ms: durationMs,
        attempts: currentAttempts,
        status: 'COMPLETED',
      },
      'Telegram update executed successfully'
    );
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const nextStatus = currentAttempts >= maxAttempts ? 'FAILED' : 'PENDING';

    await prisma.telegramUpdate.update({
      where: { id: recordId },
      data: {
        status: nextStatus,
        lastError: errorMessage,
      },
    });

    stepLogger.error(
      {
        duration_ms: durationMs,
        attempts: currentAttempts,
        status: nextStatus,
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      },
      'Telegram update execution failed'
    );
  }
}

/**
 * Processes batch of pending updates from the queue.
 */
export async function processPendingUpdates(
  bot: Bot<BotContext>,
  limit: number = 10
): Promise<number> {
  const pending = await prisma.telegramUpdate.findMany({
    where: {
      status: 'PENDING',
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  for (const item of pending) {
    await processQueuedUpdate(item.id, bot);
  }

  return pending.length;
}
