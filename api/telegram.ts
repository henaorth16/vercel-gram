import type { IncomingMessage, ServerResponse } from 'http';
import { createBot } from '../src/bot/index.js';
import { config } from '../src/config/index.js';

const bot = createBot();

// Cache bot initialization across warm serverless invocations
let initPromise: Promise<void> | null = null;
function ensureBotInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = bot.init().catch((err) => {
      initPromise = null; // Reset on failure so subsequent requests can retry
      throw err;
    });
  }
  return initPromise;
}

// Vercel Serverless Function handler for Telegram Webhooks
export default async function handler(
  req: IncomingMessage & { body?: any },
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Optional: Verify Telegram webhook secret token
  if (config.TELEGRAM_WEBHOOK_SECRET) {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (secretHeader !== config.TELEGRAM_WEBHOOK_SECRET) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid secret token' }));
      return;
    }
  }

  try {
    // 1. Ensure the bot is initialized with Telegram API
    await ensureBotInitialized();

    // 2. Extract update: Vercel may have already pre-parsed `req.body`
    let update = req.body;

    if (!update) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim()) {
        update = JSON.parse(raw);
      }
    } else if (typeof update === 'string') {
      update = JSON.parse(update);
    }

    if (!update) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'No update payload received' }));
      return;
    }

    // 3. Process update with grammY bot
    await bot.handleUpdate(update);

    // 4. Return success
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err: any) {
    console.error('❌ Error handling Telegram webhook update:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
  }
}

