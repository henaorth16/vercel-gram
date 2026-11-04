import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createServer } from '../app.js';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/types.js';
import { prisma } from '../../db/client.js';

describe('Fastify Server & Webhook Endpoints', () => {
  const secret = 'test_secret_abc123';
  let mockBot: Bot<BotContext>;

  beforeEach(() => {
    mockBot = {
      api: {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 123 }),
      },
    } as unknown as Bot<BotContext>;
  });

  it('GET /health should return 200 ok', async () => {
    const server = await createServer(mockBot);
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeDefined();
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
