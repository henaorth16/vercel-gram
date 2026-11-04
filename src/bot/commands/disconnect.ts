import { BotContext } from '../types.js';
import { prisma } from '../../db/client.js';

export async function handleDisconnect(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  const existing = await prisma.user.findUnique({
    where: { telegramId: String(telegramUserId) },
  });

  if (!existing) {
    await ctx.reply('ℹ️ You are not connected to any Vercel account.');
    return;
  }

  await prisma.user.delete({
    where: { telegramId: String(telegramUserId) },
  });

  ctx.dbUser = null;

  await ctx.reply(
    '🗑️ *Account Disconnected*\n\n' +
      'All your stored data, encrypted credentials, and preferences have been permanently purged from our database.\n\n' +
      'To connect again in the future, run `/start`.',
    { parse_mode: 'Markdown' }
  );
}
