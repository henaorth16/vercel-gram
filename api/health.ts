import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      status: 'ok',
      runtime: 'vercel-serverless',
      uptime: process.uptime(),
      timestamp: Date.now(),
    })
  );
}
