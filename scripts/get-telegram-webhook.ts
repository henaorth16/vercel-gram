import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const botToken = process.env.BOT_TOKEN;

  if (!botToken || botToken.includes('placeholder')) {
    console.error('❌ Error: BOT_TOKEN is missing or invalid in .env.');
    process.exit(1);
  }

  const response = await axios.get(
    `https://api.telegram.org/bot${botToken}/getWebhookInfo`
  );

  console.log('📡 Telegram Webhook Info:');
  console.log(JSON.stringify(response.data, null, 2));
}

main().catch((err) => {
  console.error('Failed to get Telegram webhook info:', err.response?.data || err.message);
  process.exit(1);
});
