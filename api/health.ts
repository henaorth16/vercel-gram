import type { IncomingMessage, ServerResponse } from 'http';
import { getApp } from '../src/server/app.js';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const app = await getApp();
  await new Promise<void>((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    app.server.emit('request', req, res);
  });
}
