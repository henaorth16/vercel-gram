import { config } from './config/index.js';
import { getBot } from './bot/index.js';
import { getApp } from './server/app.js';
import { run } from '@grammyjs/runner';
import { disconnectDb } from './db/client.js';

async function bootstrap() {
  console.log('🚀 Initializing Vercel Telegram Bot (Local Development)...');

  // 1. Initialize Telegram Bot
  const bot = getBot();

  // In local mode, remove any existing webhook so long polling receives updates
  try {
    const webhookInfo = await bot.api.getWebhookInfo();
    if (webhookInfo.url) {
      console.log(
        `ℹ️ Webhook is currently active (${webhookInfo.url}). Deleting webhook for local long polling...`
      );
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      console.log('✅ Webhook deleted. Switched to local polling mode.');
    }
  } catch (err: any) {
    console.warn('⚠️ Note: Could not check webhook info:', err?.message);
  }

  // 2. Initialize Fastify HTTP server
  const server = await getApp();

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
  console.log('🤖 Telegram Bot runner is ACTIVE and listening for updates!');
  console.log('👉 Open your Telegram app and send /start to test your bot.');

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
