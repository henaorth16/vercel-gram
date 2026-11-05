import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const botToken = process.env.BOT_TOKEN;

  if (!botToken || botToken.includes('placeholder')) {
    console.error('❌ Error: BOT_TOKEN is missing or invalid in .env.');
    process.exit(1);
  }

  const response = await axios.post(
    `https://api.telegram.org/bot${botToken}/deleteWebhook`
  );

  console.log('🗑️ Telegram Webhook Deleted:', response.data);
}

main().catch((err) => {
  console.error('Failed to delete Telegram webhook:', err.response?.data || err.message);
  process.exit(1);
});
