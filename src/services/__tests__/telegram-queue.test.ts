import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../../db/client.js';
import { extractUpdateMetadata } from '../../logging/metadata.js';
import {
  enqueueTelegramUpdate,
  processQueuedUpdate,
  MAX_RETRY_ATTEMPTS,
} from '../telegram-queue.js';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/types.js';

describe('Telegram Metadata Extraction', () => {
  it('safely extracts metadata from message with command', () => {
    const meta = extractUpdateMetadata({
      update_id: 101,
      message: {
        chat: { id: 12345 },
        from: { id: 67890 },
        text: '/projects arg1',
      },
    });

    expect(meta.update_id).toBe(101);
    expect(meta.update_type).toBe('message');
    expect(meta.chat_id).toBe('12345');
    expect(meta.user_id).toBe('67890');
    expect(meta.command).toBe('/projects');
  });

  it('safely extracts metadata from callback_query', () => {
    const meta = extractUpdateMetadata({
      update_id: 102,
      callback_query: {
        message: { chat: { id: 54321 } },
        from: { id: 98765 },
        data: 'switch_team:personal',
      },
    });

    expect(meta.update_id).toBe(102);
    expect(meta.update_type).toBe('callback_query');
    expect(meta.chat_id).toBe('54321');
    expect(meta.user_id).toBe('98765');
    expect(meta.command).toBe('callback:switch_team');
  });

  it('safely extracts metadata from channel_post', () => {
    const meta = extractUpdateMetadata({
      update_id: 103,
      channel_post: {
        chat: { id: -100123456789 },
        text: '/deployments project-a',
      },
    });

    expect(meta.update_id).toBe(103);
    expect(meta.update_type).toBe('channel_post');
    expect(meta.chat_id).toBe('-100123456789');
    expect(meta.command).toBe('/deployments');
  });

  it('safely extracts metadata from my_chat_member', () => {
    const meta = extractUpdateMetadata({
      update_id: 104,
      my_chat_member: {
        chat: { id: 77777 },
        from: { id: 88888 },
        new_chat_member: { status: 'kicked' },
      },
    });

    expect(meta.update_id).toBe(104);
    expect(meta.update_type).toBe('my_chat_member');
    expect(meta.chat_id).toBe('77777');
    expect(meta.user_id).toBe('88888');
    expect(meta.command).toBe('chat_member_status_change');
  });

  it('safely handles non-object or malformed input without throwing', () => {
    expect(extractUpdateMetadata(null).update_type).toBe('unknown');
    expect(extractUpdateMetadata(undefined).update_type).toBe('unknown');
    expect(extractUpdateMetadata('not-an-object').update_type).toBe('unknown');
  });
});

describe('Telegram Update Queue & Idempotency', () => {
  const testUpdateId = 9999901;

  beforeEach(async () => {
    // Clean up test records
    await prisma.telegramUpdate.deleteMany({
      where: {
        updateId: {
          in: [
            BigInt(testUpdateId),
            BigInt(testUpdateId + 1),
            BigInt(testUpdateId + 2),
          ],
        },
      },
    });
  });

  it('rejects invalid payload with error', async () => {
    const res = await enqueueTelegramUpdate({ notAnUpdate: true });
    expect(res.success).toBe(false);
  });

  it('persists a new update with status PENDING', async () => {
    const res = await enqueueTelegramUpdate({
      update_id: testUpdateId,
      message: { chat: { id: 1 }, text: 'hello' },
    });

    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.result.status).toBe('enqueued');
    expect(res.result.isDuplicate).toBe(false);

    const saved = await prisma.telegramUpdate.findUnique({
      where: { updateId: BigInt(testUpdateId) },
    });
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe('PENDING');
  });

  it('identifies duplicate completed update and does not re-enqueue', async () => {
    // 1. Initial enqueue
    const res1 = await enqueueTelegramUpdate({
      update_id: testUpdateId,
      message: { chat: { id: 1 }, text: 'hello' },
    });
    expect(res1.success).toBe(true);
    if (!res1.success) return;

    // Mark as COMPLETED in DB
    await prisma.telegramUpdate.update({
      where: { id: res1.result.recordId },
      data: { status: 'COMPLETED' },
    });

    // 2. Second delivery of same update
    const res2 = await enqueueTelegramUpdate({
      update_id: testUpdateId,
      message: { chat: { id: 1 }, text: 'hello' },
    });

    expect(res2.success).toBe(true);
    if (!res2.success) return;
    expect(res2.result.status).toBe('duplicate_completed');
    expect(res2.result.isDuplicate).toBe(true);
  });

  it('processes queued update and transitions status to COMPLETED', async () => {
    const res = await enqueueTelegramUpdate({
      update_id: testUpdateId + 1,
      message: { chat: { id: 1 }, text: 'hello' },
    });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const mockBot = {
      isInited: vi.fn().mockReturnValue(true),
      init: vi.fn().mockResolvedValue(undefined),
      handleUpdate: vi.fn().mockResolvedValue(undefined),
    } as unknown as Bot<BotContext>;

    await processQueuedUpdate(res.result.recordId, mockBot);

    expect(mockBot.handleUpdate).toHaveBeenCalledTimes(1);

    const updated = await prisma.telegramUpdate.findUnique({
      where: { id: res.result.recordId },
    });
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBeNull();
  });

  it('records error, increments attempts, and transitions to FAILED on max retries', async () => {
    const res = await enqueueTelegramUpdate({
      update_id: testUpdateId + 2,
      message: { chat: { id: 1 }, text: 'hello' },
    });
    expect(res.success).toBe(true);
    if (!res.success) return;

    const mockBot = {
      isInited: vi.fn().mockReturnValue(true),
      init: vi.fn().mockResolvedValue(undefined),
      handleUpdate: vi.fn().mockRejectedValue(new Error('Vercel API 500 error')),
    } as unknown as Bot<BotContext>;

    // Attempt 1 with maxAttempts = 2
    await processQueuedUpdate(res.result.recordId, mockBot, { maxAttempts: 2 });
    let record = await prisma.telegramUpdate.findUnique({
      where: { id: res.result.recordId },
    });
    expect(record?.status).toBe('PENDING'); // Can still retry
    expect(record?.attempts).toBe(1);
    expect(record?.lastError).toContain('Vercel API 500 error');

    // Attempt 2 (reaches maxAttempts = 2)
    await processQueuedUpdate(res.result.recordId, mockBot, { maxAttempts: 2 });
    record = await prisma.telegramUpdate.findUnique({
      where: { id: res.result.recordId },
    });
    expect(record?.status).toBe('FAILED');
    expect(record?.attempts).toBe(2);
  });
});
