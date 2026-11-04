import type { IncomingMessage, ServerResponse } from 'http';
import { createBot } from '../src/bot/index.js';
import { config } from '../src/config/index.js';
import { verifyWebhookSignature } from '../src/security/crypto.js';
import { processVercelWebhook, VercelWebhookEvent } from '../src/services/vercel-webhook.js';

const bot = createBot();

async function getRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const rawBodyBuffer = await getRawBody(req);
    const signature = req.headers['x-vercel-signature'] as string | undefined;

    // Signature verification (if configured)
    if (config.VERCEL_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        rawBodyBuffer,
        signature,
        config.VERCEL_WEBHOOK_SECRET
      );

      if (!isValid) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid webhook signature' }));
        return;
      }
    }

    const payloadText = rawBodyBuffer.toString('utf8');
    const event = JSON.parse(payloadText) as VercelWebhookEvent;

    const { dispatchedCount } = await processVercelWebhook(event, bot);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: true,
        eventId: event.id,
        dispatched: dispatchedCount,
      })
    );
  } catch (err) {
    console.error('Error handling Vercel webhook:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal processing error' }));
  }
}
