import { BotContext } from '../types.js';
import { prisma } from '../../db/client.js';
import { getTeams } from '../../services/vercel-api.js';
import { makeTeamsKeyboard } from '../helpers/keyboards.js';

export async function handleTeamSelection(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) {
    await ctx.answerCallbackQuery({
      text: '⚠️ Please connect your account first with /connect.',
    });
    return;
  }

  const [, targetTeamId] = data.split(':');
  const newTeamId = targetTeamId === 'personal' ? null : targetTeamId;

  // Update in SQLite
  const updatedUser = await prisma.user.update({
    where: { id: ctx.dbUser.id },
    data: { defaultTeamId: newTeamId },
  });

  ctx.dbUser = updatedUser;

  const teams = await getTeams(token);
  const activeTeamName = newTeamId
    ? teams.find((t) => t.id === newTeamId)?.name || 'Team'
    : 'Personal Account';

  await ctx.answerCallbackQuery({
    text: `Switched active workspace to: ${activeTeamName}`,
  });

  try {
    await ctx.editMessageReplyMarkup({
      reply_markup: makeTeamsKeyboard(teams, newTeamId),
    });
  } catch {
    // If markup didn't change
  }
}

export async function handleTeamsRefresh(ctx: BotContext): Promise<void> {
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  const teams = await getTeams(token);
  await ctx.answerCallbackQuery({ text: 'Refreshed workspaces!' });

  try {
    await ctx.editMessageReplyMarkup({
      reply_markup: makeTeamsKeyboard(teams, ctx.dbUser.defaultTeamId),
    });
  } catch {
    // Ignore if unchanged
  }
}
