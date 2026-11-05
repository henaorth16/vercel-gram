import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createServer } from '../app.js';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/types.js';
import { prisma } from '../../db/client.js';
import { config } from '../../config/index.js';

describe('Fastify Server & Webhook Endpoints', () => {
  const secret = 'test_secret_abc123';
  let mockBot: Bot<BotContext>;

  beforeEach(async () => {
    mockBot = {
      isRunning: vi.fn().mockReturnValue(false),
      start: vi.fn(),
      init: vi.fn().mockResolvedValue(undefined),
      handleUpdate: vi.fn().mockResolvedValue(undefined),
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
      },
    } as unknown as Bot<BotContext>;

    await prisma.telegramUpdate.deleteMany({
      where: { updateId: BigInt(998877) },
    });
  });

  it('GET /health and GET /api/health should return 200 ok', async () => {
    const server = await createServer(mockBot);

    const res1 = await server.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body).status).toBe('ok');

    const res2 = await server.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.body).status).toBe('ok');

    await server.close();
  });

  it('POST /api/telegram should reject malformed payloads with 400', async () => {
    const server = await createServer(mockBot);

    const response = await server.inject({
      method: 'POST',
      url: '/api/telegram',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ notAnUpdate: true }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Invalid Telegram update payload');
    await server.close();
  });

  it('POST /api/telegram should reject invalid secret token with 401 when configured', async () => {
    const originalSecret = config.TELEGRAM_WEBHOOK_SECRET;
    // Set a test secret
    (config as any).TELEGRAM_WEBHOOK_SECRET = 'my_expected_secret';

    const server = await createServer(mockBot);

    const response = await server.inject({
      method: 'POST',
      url: '/api/telegram',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong_secret',
      },
      payload: JSON.stringify({ update_id: 12345 }),
    });

    expect(response.statusCode).toBe(401);
    await server.close();

    // Restore
    (config as any).TELEGRAM_WEBHOOK_SECRET = originalSecret;
  });

  it('POST /api/telegram should accept valid update and delegate to grammY', async () => {
    const originalSecret = config.TELEGRAM_WEBHOOK_SECRET;
    (config as any).TELEGRAM_WEBHOOK_SECRET = 'correct_secret';

    const server = await createServer(mockBot);

    const updatePayload = {
      update_id: 998877,
      message: {
        message_id: 1,
        date: 1700000000,
        chat: { id: 111, type: 'private' },
        from: { id: 111, is_bot: false, first_name: 'Tester' },
        text: '/start',
      },
    };

    const response = await server.inject({
      method: 'POST',
      url: '/api/telegram',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'correct_secret',
      },
      payload: JSON.stringify(updatePayload),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);

    await vi.waitFor(() => {
      expect(mockBot.handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ update_id: 998877 })
      );
    });

    // Verify duplicate delivery is deduplicated
    const duplicateResponse = await server.inject({
      method: 'POST',
      url: '/api/telegram',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'correct_secret',
      },
      payload: JSON.stringify(updatePayload),
    });

    expect(duplicateResponse.statusCode).toBe(200);
    expect(JSON.parse(duplicateResponse.body).duplicate).toBe(true);
    // Should NOT have called handleUpdate a second time
    expect(mockBot.handleUpdate).toHaveBeenCalledTimes(1);

    await server.close();
    (config as any).TELEGRAM_WEBHOOK_SECRET = originalSecret;
  });

  it('GET /api/telegram/queue should return queue metrics', async () => {
    const server = await createServer(mockBot);

    const response = await server.inject({
      method: 'GET',
      url: '/api/telegram/queue',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('pending');
    expect(body).toHaveProperty('processing');
    expect(body).toHaveProperty('completed');
    expect(body).toHaveProperty('failed');

    await server.close();
  });

  it('POST /api/webhook/vercel should reject invalid signature with 401', async () => {
    const server = await createServer(mockBot);
    const payload = JSON.stringify({
      id: 'evt_1',
      type: 'deployment.succeeded',
      payload: { project: { name: 'my-project' } },
    });

    const response = await server.inject({
      method: 'POST',
      url: `/api/webhook/vercel?secret=${secret}`,
      headers: {
        'content-type': 'application/json',
        'x-vercel-signature': 'invalid_signature_hex_123',
      },
      payload,
    });

    expect(response.statusCode).toBe(401);
    await server.close();
  });

  it('POST /api/webhook/vercel should accept valid signature and dispatch notification', async () => {
    const server = await createServer(mockBot);
    const payloadObj = {
      id: 'evt_2',
      type: 'deployment.succeeded',
      createdAt: Date.now(),
      payload: {
        deployment: {
          id: 'dpl_123',
          name: 'my-site',
          url: 'my-site.vercel.app',
          target: 'production',
          meta: {
            githubCommitRef: 'main',
            githubCommitMessage: 'feat: add payment button',
            githubCommitAuthorName: 'Alice',
          },
        },
        project: {
          id: 'prj_1',
          name: 'my-site',
        },
        user: {
          id: 'usr_mock_1',
        },
      },
    };

    const payload = JSON.stringify(payloadObj);
    const signature = crypto
      .createHmac('sha1', secret)
      .update(payload)
      .digest('hex');

    // Mock Prisma user query
    vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
      {
        id: 'usr_db_1',
        telegramId: '987654321',
        telegramUsername: 'alice',
        encryptedToken: 'enc',
        tokenIv: 'iv',
        tokenTag: 'tag',
        vercelUserId: 'usr_mock_1',
        vercelUsername: 'alice',
        vercelEmail: 'alice@example.com',
        defaultTeamId: null,
        notifyOnSuccess: true,
        notifyOnError: true,
        notifyOnCreated: false,
        mutePreviewBuilds: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const response = await server.inject({
      method: 'POST',
      url: `/api/webhook/vercel?secret=${secret}`,
      headers: {
        'content-type': 'application/json',
        'x-vercel-signature': signature,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const resBody = JSON.parse(response.body);
    expect(resBody.success).toBe(true);
    expect(resBody.dispatched).toBe(1);

    expect(mockBot.api.sendMessage).toHaveBeenCalledWith(
      '987654321',
      expect.stringContaining('Deployment Succeeded — my-site'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );

    await server.close();
  });
});
