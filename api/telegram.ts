import { webhookCallback } from 'grammy';
import { createBot } from '../src/bot/index.js';

const bot = createBot();

// Vercel Serverless Function handler for Telegram Webhooks
export default webhookCallback(bot, 'node:http');
