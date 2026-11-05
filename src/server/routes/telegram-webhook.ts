import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Bot, webhookCallback } from 'grammy';
import { BotContext } from '../../bot/types.js';
import { config } from '../../config/index.js';

export function registerTelegramWebhookRoute(
  server: FastifyInstance,
  bot: Bot<BotContext>
): void {
  // Official grammY webhook callback for Fastify
  const grammyCallback = webhookCallback(bot, 'fastify', {
    secretToken: config.TELEGRAM_WEBHOOK_SECRET,
    timeoutMilliseconds: 15_000,
  });

  const webhookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    // Stage 1: Incoming webhook request
    const hasSecretHeader = Boolean(
      request.headers['x-telegram-bot-api-secret-token']
    );
    request.log.info({
      stage: '1_INCOMING_REQUEST',
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      hasSecretHeader,
      contentLength: request.headers['content-length'],
      timestamp: new Date().toISOString(),
    });

    // Stage 2: Secret validation
    if (config.TELEGRAM_WEBHOOK_SECRET) {
      const receivedSecret = request.headers['x-telegram-bot-api-secret-token'];
      if (!receivedSecret || receivedSecret !== config.TELEGRAM_WEBHOOK_SECRET) {
        request.log.warn({
          stage: '2_SECRET_VALIDATION',
          status: 'rejected',
          reason: receivedSecret ? 'Secret token mismatch' : 'Missing secret token header',
          timestamp: new Date().toISOString(),
        });
        return reply.code(401).send({ error: 'Invalid webhook secret' });
      }
      request.log.info({
        stage: '2_SECRET_VALIDATION',
        status: 'verified',
        timestamp: new Date().toISOString(),
      });
    } else {
      request.log.info({
        stage: '2_SECRET_VALIDATION',
        status: 'skipped',
        reason: 'No TELEGRAM_WEBHOOK_SECRET configured',
        timestamp: new Date().toISOString(),
      });
    }

    // Stage 3: Telegram update parsing
    const body = request.body as any;
    if (!body || typeof body !== 'object' || typeof body.update_id !== 'number') {
      request.log.error({
        stage: '3_UPDATE_PARSING',
        status: 'error',
        error: 'Missing or malformed update_id in request body',
        timestamp: new Date().toISOString(),
      });
      return reply.code(400).send({ error: 'Invalid Telegram update payload' });
    }

    const updateType =
      Object.keys(body).find((k) => k !== 'update_id') || 'unknown';
    const fromUser = body.message?.from || body.callback_query?.from;
    const chat = body.message?.chat || body.callback_query?.message?.chat;

    request.log.info({
      stage: '3_UPDATE_PARSING',
      status: 'success',
      updateId: body.update_id,
      updateType,
      fromUserId: fromUser?.id,
      chatId: chat?.id,
      timestamp: new Date().toISOString(),
    });

    // Delegate update processing to grammY's official Fastify adapter
    try {
      await grammyCallback(request, reply);
    } catch (err: any) {
      request.log.error({
        stage: '4_MIDDLEWARE_EXECUTION',
        status: 'error',
        updateId: body.update_id,
        errorMessage: err?.message,
        stack: err?.stack,
        timestamp: new Date().toISOString(),
      });
      if (!reply.sent) {
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  };

  // Register on both /api/telegram and /telegram for flexibility
  server.post('/api/telegram', webhookHandler);
  server.post('/telegram', webhookHandler);

  // Stage 6: Response completion hook
  server.addHook('onResponse', async (request, reply) => {
    if (
      request.url.startsWith('/api/telegram') ||
      request.url.startsWith('/telegram')
    ) {
      request.log.info({
        stage: '6_RESPONSE_COMPLETION',
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
