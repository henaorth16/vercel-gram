import { BotContext } from '../types.js';
import { encryptToken } from '../../security/crypto.js';
import { verifyUser, getTeams } from '../../services/vercel-api.js';
import { prisma } from '../../db/client.js';
import { makeTeamsKeyboard } from '../helpers/keyboards.js';

export async function handleConnect(ctx: BotContext): Promise<void> {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  // 1. Immediately delete the user's message containing the token to protect chat history
  try {
    await ctx.deleteMessage();
  } catch {
    // Non-fatal if bot lacks delete permissions in certain group contexts
  }

  const text = ctx.message?.text || '';
  const parts = text.trim().split(/\s+/);
  const token = parts[1]?.trim();

  if (!token) {
    await ctx.reply(
      '⚠️ *Missing Token*\n\nPlease provide your token: `/connect <VERCEL_TOKEN>`\n\n' +
        'Generate a token at: [vercel.com/account/tokens](https://vercel.com/account/tokens)',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const statusMsg = await ctx.reply('⏳ *Validating your Vercel token...*', {
    parse_mode: 'Markdown',
  });

  try {
    // 2. Validate token against Vercel REST API
    const vercelUser = await verifyUser(token);

    // 3. Encrypt token using AES-256-GCM
    const { encrypted, iv, tag } = encryptToken(token);

    // 4. Save to Database
    const dbUser = await prisma.user.upsert({
      where: { telegramId: String(telegramUserId) },
      create: {
        telegramId: String(telegramUserId),
        telegramUsername: ctx.from?.username || null,
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        vercelUserId: vercelUser.id,
        vercelUsername: vercelUser.username,
        vercelEmail: vercelUser.email,
        defaultTeamId: null, // Default to personal account initially
      },
      update: {
        telegramUsername: ctx.from?.username || null,
        encryptedToken: encrypted,
        tokenIv: iv,
        tokenTag: tag,
        vercelUserId: vercelUser.id,
        vercelUsername: vercelUser.username,
        vercelEmail: vercelUser.email,
      },
    });

    ctx.dbUser = dbUser;

    // 5. Fetch available teams
    const teams = await getTeams(token);

    let successMsg = `✅ *Connected successfully!*\n\n`;
    successMsg += `• Vercel User: *${vercelUser.username}* (\`${vercelUser.email}\`)\n`;
    successMsg += `• Encryption: *AES-256-GCM* (secured at rest)\n\n`;

    if (teams.length > 0) {
      successMsg += `You belong to *${teams.length}* team(s). Select your active workspace:`;
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        successMsg,
        {
          parse_mode: 'Markdown',
          reply_markup: makeTeamsKeyboard(teams, null),
        }
      );
    } else {
      successMsg += `Active Workspace: *Personal Account*\n\n`;
      successMsg += `Run \`/projects\` to view your deployments!`;
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        successMsg,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    const errorMsg = (err as Error).message || 'Invalid Vercel token';
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ *Connection Failed*\n\n${errorMsg}\n\nPlease generate a new token at [vercel.com/account/tokens](https://vercel.com/account/tokens) and try again.`,
      { parse_mode: 'Markdown' }
    );
  }
}
