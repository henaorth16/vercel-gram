import Fastify, { FastifyInstance } from 'fastify';
import rawBody from 'fastify-raw-body';
import { Bot } from 'grammy';
import { BotContext } from '../bot/types.js';
import { registerVercelWebhookRoute } from './routes/vercel-webhook.js';

export async function createServer(bot: Bot<BotContext>): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
  });

  // Enable raw body capture for HMAC signature verification
  await server.register(rawBody, {
    field: 'rawBody',
    global: true,
    encoding: 'utf8',
    runFirst: true,
  });

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  });

  // Register Vercel webhook endpoint
  registerVercelWebhookRoute(server, bot);

  return server;
}
