import { config } from './config/index.js';
import { createBot } from './bot/index.js';
import { createServer } from './server/app.js';
import { run } from '@grammyjs/runner';
import { disconnectDb } from './db/client.js';

async function bootstrap() {
  console.log('🚀 Initializing Vercel Telegram Bot...');

  // 1. Initialize Telegram Bot
  const bot = createBot();

  // 2. Initialize Fastify HTTP server (for webhooks & health checks)
  const server = await createServer(bot);

  await server.listen({
    port: config.PORT,
    host: config.HOST,
  });

  console.log(
    `🌐 Webhook & Health server running at http://${config.HOST}:${config.PORT}`
  );
  console.log(`📡 Vercel Webhook Endpoint: http://${config.HOST}:${config.PORT}/api/webhook/vercel`);
  console.log(`💓 Health Check Endpoint: http://${config.HOST}:${config.PORT}/health`);

  // 3. Start Telegram Bot Runner (Concurrent Long Polling)
  const runner = run(bot);
  console.log('🤖 Telegram Bot runner started successfully.');

  // 4. Graceful Shutdown
  const stop = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    if (runner.isRunning()) {
      await runner.stop();
    }
    await server.close();
    await disconnectDb();
    console.log('👋 Goodbye!');
    process.exit(0);
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
