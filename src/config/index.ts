import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  VERCEL_WEBHOOK_SECRET: z.string().optional(),
  ALLOWED_TELEGRAM_USERS: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration error:', parsed.error.format());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  allowedUserIds: parsed.data.ALLOWED_TELEGRAM_USERS
    ? parsed.data.ALLOWED_TELEGRAM_USERS.split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .map(Number)
    : [],
};
