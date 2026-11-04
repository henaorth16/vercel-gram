import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Bot } from 'grammy';
import { BotContext } from '../../bot/types.js';
import { config } from '../../config/index.js';
import { verifyWebhookSignature } from '../../security/crypto.js';
import { processVercelWebhook, VercelWebhookEvent } from '../../services/vercel-webhook.js';

interface WebhookQuery {
  telegramId?: string;
  secret?: string;
}

export function registerVercelWebhookRoute(
  server: FastifyInstance,
  bot: Bot<BotContext>
): void {
  server.post(
    '/api/webhook/vercel',
    async (
      request: FastifyRequest<{ Querystring: WebhookQuery; Body: VercelWebhookEvent }>,
      reply: FastifyReply
    ) => {
      const signature = request.headers['x-vercel-signature'] as string | undefined;
      const configuredSecret = request.query.secret || config.VERCEL_WEBHOOK_SECRET;

      // 1. Signature Verification (if secret is configured or signature is provided)
      if (configuredSecret) {
        const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;

        if (!rawBody) {
          request.log.error('Raw body unavailable for signature verification');
          return reply.status(400).send({ error: 'Missing raw body' });
        }

        const isValid = verifyWebhookSignature(rawBody, signature, configuredSecret);
        if (!isValid) {
          request.log.warn({ signature }, 'Invalid Vercel webhook signature');
          return reply.status(401).send({ error: 'Invalid webhook signature' });
        }
      }

      // 2. Process event payload and dispatch Telegram notifications
      const event = request.body;
      const queryTelegramId = request.query.telegramId;

      try {
        const { dispatchedCount } = await processVercelWebhook(
          event,
          bot,
          queryTelegramId
        );

        request.log.info(
          { eventType: event.type, eventId: event.id, dispatchedCount },
          'Processed Vercel webhook'
        );

        return reply.status(200).send({
          success: true,
          eventId: event.id,
          dispatched: dispatchedCount,
        });
      } catch (err) {
        request.log.error(err, 'Failed to process Vercel webhook');
        return reply.status(500).send({ error: 'Internal processing error' });
      }
    }
  );
}
