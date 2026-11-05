import { NextFunction } from 'grammy';
import { BotContext } from '../types.js';
import { config } from '../../config/index.js';
import { prisma } from '../../db/client.js';
import { decryptToken } from '../../security/crypto.js';
import { logger } from '../../logging/logger.js';

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
    if (ctx.chat) {
      await ctx.reply(
        '⛔ *Access Denied*\n\nYour Telegram account is not authorized to use this bot.',
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }

  // 2. Fetch User Record from Database safely
  const dbStart = Date.now();
  const log = ctx.logger || logger;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { telegramId: String(telegramUserId) },
    });
    const durationMs = Date.now() - dbStart;
    log.info(
      {
        processing_step: 'auth_lookup',
        telegram_user_id: String(telegramUserId),
        found: Boolean(dbUser),
        duration_ms: durationMs,
      },
      'User lookup completed'
    );
    ctx.dbUser = dbUser;
  } catch (dbErr: any) {
    const durationMs = Date.now() - dbStart;
    log.error(
      {
        processing_step: 'auth_lookup',
        telegram_user_id: String(telegramUserId),
        duration_ms: durationMs,
        error: dbErr?.message,
        stack: dbErr?.stack,
      },
      'Database error during user auth lookup'
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
      log.error(
        {
          processing_step: 'token_decrypt',
          error: err instanceof Error ? err.message : String(err),
        },
        'Failed to decrypt Vercel token for user'
      );
      return null;
    }
  };

  await next();
}
