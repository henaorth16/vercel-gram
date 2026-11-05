import Fastify, { FastifyInstance } from 'fastify';
import rawBody from 'fastify-raw-body';
import { Bot } from 'grammy';
import { BotContext } from '../bot/types.js';
import { getBot } from '../bot/index.js';
import { registerVercelWebhookRoute } from './routes/vercel-webhook.js';
import { registerTelegramWebhookRoute } from './routes/telegram-webhook.js';

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

  // Custom JSON parser supporting both untouched stream and pre-parsed req.body
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      const rawReq = req.raw as any;
      // 1. If upstream runtime (e.g. Vercel) already parsed req.body
      if (rawReq.body && typeof rawReq.body === 'object') {
        return done(null, rawReq.body);
      }
      // 2. If body buffer is empty
      if (!body || body.length === 0) {
        if (rawReq.body && typeof rawReq.body === 'string') {
          try {
            return done(null, JSON.parse(rawReq.body));
          } catch (e: any) {
            return done(e, undefined);
          }
        }
        return done(null, {});
      }
      // 3. Parse buffer
      try {
        const json = JSON.parse(body.toString('utf-8'));
        done(null, json);
      } catch (err: any) {
        done(err, undefined);
      }
    }
  );

  // Health check endpoints
  const healthHandler = async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
  server.get('/health', healthHandler);
  server.get('/api/health', healthHandler);

  // Register routes
  registerTelegramWebhookRoute(server, bot);
  registerVercelWebhookRoute(server, bot);

  return server;
}

let cachedApp: FastifyInstance | null = null;
let appPromise: Promise<FastifyInstance> | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (cachedApp) return cachedApp;
  if (!appPromise) {
    appPromise = (async () => {
      const bot = getBot();
      const server = await createServer(bot);
      await server.ready();
      cachedApp = server;
      return server;
    })().catch((err) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}
