import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/types.js';
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { extractUpdateMetadata } from '../../logging/metadata.js';
import { createUpdateLogger, logger } from '../../logging/logger.js';
import {
  enqueueTelegramUpdate,
  processQueuedUpdate,
} from '../../services/telegram-queue.js';
import { safeWaitUntil } from '../../utils/wait-until.js';

export function registerTelegramWebhookRoute(
  server: FastifyInstance,
  bot: Bot<BotContext>
): void {
  const webhookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const rawBody = request.body;
    const meta = extractUpdateMetadata(rawBody);
    const updateLogger = createUpdateLogger(meta);

    // 1. Validate Secret Token (if configured)
    if (config.TELEGRAM_WEBHOOK_SECRET) {
      const receivedSecret = request.headers['x-telegram-bot-api-secret-token'];
      if (!receivedSecret || receivedSecret !== config.TELEGRAM_WEBHOOK_SECRET) {
        updateLogger.warn(
          {
            processing_step: 'secret_validation',
            status: 'rejected',
            reason: receivedSecret ? 'Secret token mismatch' : 'Missing secret token header',
          },
          'Unauthorized webhook request rejected'
        );
        return reply.code(401).send({ ok: false, error: 'Invalid webhook secret' });
      }
    }

    // 2. Enqueue update & verify idempotency
    const enqueueStart = Date.now();
    let enqueueResult;
    try {
      enqueueResult = await enqueueTelegramUpdate(rawBody);
    } catch (err: any) {
      const durationMs = Date.now() - enqueueStart;
      updateLogger.error(
        {
          processing_step: 'enqueue_update',
          duration_ms: durationMs,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        'Database error while enqueuing Telegram update'
      );
      // Return 500 so Telegram will retry the update after failure
      return reply.code(500).send({ ok: false, error: 'Database queue error' });
    }

    if (!enqueueResult.success) {
      updateLogger.error(
        {
          processing_step: 'validate_payload',
          error: enqueueResult.error,
        },
        'Invalid Telegram update payload received'
      );
      return reply.code(400).send({ ok: false, error: 'Invalid Telegram update payload' });
    }

    const { result } = enqueueResult;

    // 3. Handle duplicates
    if (result.isDuplicate) {
      updateLogger.info(
        {
          processing_step: 'idempotency_check',
          status: result.status,
          record_id: result.recordId,
        },
        'Duplicate Telegram update recognized; returning HTTP 200'
      );
      return reply.code(200).send({ ok: true, duplicate: true, status: result.status });
    }

    // 4. Return HTTP 200 immediately to Telegram to prevent retry loops
    reply.code(200).send({ ok: true, queued: true });

    // 5. Asynchronously process the update in the background (via Vercel waitUntil or worker)
    const backgroundTask = processQueuedUpdate(result.recordId, bot);
    safeWaitUntil(backgroundTask);

    // Attach for testing if needed
    (request.raw as any).__backgroundTask = backgroundTask;
  };

  // Register endpoints
  server.post('/api/telegram', webhookHandler);
  server.post('/telegram', webhookHandler);

  // Queue status endpoint
  server.get('/api/telegram/queue', async () => {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.telegramUpdate.count({ where: { status: 'PENDING' } }),
      prisma.telegramUpdate.count({ where: { status: 'PROCESSING' } }),
      prisma.telegramUpdate.count({ where: { status: 'COMPLETED' } }),
      prisma.telegramUpdate.count({ where: { status: 'FAILED' } }),
    ]);
    return { pending, processing, completed, failed };
  });
}
