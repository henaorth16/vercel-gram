import { NextFunction } from 'grammy';
import { BotContext } from '../types.js';
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { decryptToken } from '../../security/crypto.js';

export async function authMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const telegramUserId = ctx.from?.id;

  if (!telegramUserId) {
    return next();
  }

  // 1. Whitelist Access Check (if configured)
  if (
    config.allowedUserIds.length > 0 &&
    !config.allowedUserIds.includes(telegramUserId)
  ) {
    await ctx.reply(
      '⛔ *Access Denied*\n\nYour Telegram account is not authorized to use this bot.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // 2. Fetch User Record from Database safely (Stage 5 Database Operations)
  const dbStart = Date.now();
  console.log(
    JSON.stringify({
      stage: '5_DATABASE_OPERATION',
      operation: 'findUniqueUser',
      telegramId: String(telegramUserId),
      event: 'start',
      timestamp: new Date().toISOString(),
    })
  );

  try {
    const dbUser = await prisma.user.findUnique({
      where: { telegramId: String(telegramUserId) },
    });
    console.log(
      JSON.stringify({
        stage: '5_DATABASE_OPERATION',
        operation: 'findUniqueUser',
        telegramId: String(telegramUserId),
        event: 'complete',
        found: Boolean(dbUser),
        durationMs: Date.now() - dbStart,
        timestamp: new Date().toISOString(),
      })
    );
    ctx.dbUser = dbUser;
  } catch (dbErr: any) {
    console.error(
      JSON.stringify({
        stage: '5_DATABASE_OPERATION',
        operation: 'findUniqueUser',
        telegramId: String(telegramUserId),
        event: 'error',
        errorMessage: dbErr?.message,
        errorCode: dbErr?.code,
        durationMs: Date.now() - dbStart,
        timestamp: new Date().toISOString(),
      })
    );
    ctx.dbUser = null;
  }

  // 3. Attach safe token decryption helper
  ctx.getVercelToken = () => {
    if (!ctx.dbUser) return null;
    try {
      return decryptToken(
        ctx.dbUser.encryptedToken,
        ctx.dbUser.tokenIv,
        ctx.dbUser.tokenTag
      );
    } catch (err) {
      console.error('Failed to decrypt Vercel token for user:', telegramUserId, err);
      return null;
    }
  };

  await next();
}
