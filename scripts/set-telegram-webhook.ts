import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const botToken = process.env.BOT_TOKEN;
  const baseUrl = process.argv[2]?.trim();

  if (!botToken || botToken.includes('placeholder')) {
    console.error('❌ Error: BOT_TOKEN is missing or invalid in .env.');
    process.exit(1);
  }

  if (!baseUrl) {
    console.error(
      '❌ Error: Please provide your public Vercel URL.\nUsage: npm run telegram:webhook -- https://your-app.vercel.app'
    );
    process.exit(1);
  }

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const webhookUrl = `${cleanUrl}/api/telegram`;

  console.log(`Setting Telegram webhook to: ${webhookUrl}...`);

  const response = await axios.post(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      url: webhookUrl,
    }
  );

  console.log('✅ Telegram Webhook Response:', response.data);
}

main().catch((err) => {
  console.error('Failed to set Telegram webhook:', err.response?.data || err.message);
  process.exit(1);
});
