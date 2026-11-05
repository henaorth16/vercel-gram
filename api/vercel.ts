import type { IncomingMessage, ServerResponse } from 'http';
import { getApp } from '../src/server/app.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getApp();
  app.server.emit('request', req, res);
}
