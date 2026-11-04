import { BotContext } from '../types.js';
import { getTeams } from '../../services/vercel-api.js';
import { makeTeamsKeyboard } from '../helpers/keyboards.js';

export async function handleTeam(ctx: BotContext): Promise<void> {
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;

  if (!token || !ctx.dbUser) {
    await ctx.reply(
      '⚠️ You must connect your Vercel account first using `/connect <token>`.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    const teams = await getTeams(token);
    const activeTeamId = ctx.dbUser.defaultTeamId;

    let text = `🏢 *Workspace & Team Switcher*\n\n`;
    text += `Choose which workspace you want to track:\n`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      reply_markup: makeTeamsKeyboard(teams, activeTeamId),
    });
  } catch (err) {
    await ctx.reply(`❌ Failed to retrieve teams: ${(err as Error).message}`);
  }
}
