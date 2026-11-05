import type { IncomingMessage, ServerResponse } from 'http';
import { getApp } from '../src/server/app.js';

// Disable Vercel's default body parser so Fastify manages the stream & parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Vercel Serverless Function entry point bridging to Fastify
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getApp();
  app.server.emit('request', req, res);
}
