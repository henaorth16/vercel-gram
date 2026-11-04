import { BotContext } from '../types.js';
import { getProjects } from '../../services/vercel-api.js';
import { formatStatusBadge } from '../helpers/formatters.js';
import { makeProjectsKeyboard } from '../helpers/keyboards.js';

export async function handleProjects(ctx: BotContext): Promise<void> {
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;

  if (!token || !ctx.dbUser) {
    await ctx.reply(
      '⚠️ You must connect your Vercel account first using `/connect <token>`.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const teamId = ctx.dbUser.defaultTeamId;
  const statusMsg = await ctx.reply('⏳ *Fetching projects from Vercel...*', {
    parse_mode: 'Markdown',
  });

  try {
    const res = await getProjects(token, teamId, 50);
    const projects = res.projects || [];

    if (projects.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        '📁 *No Projects Found*\n\nThere are no projects in this workspace.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let text = `📂 *Vercel Projects (${projects.length})*\n`;
    text += `_Active Workspace: ${teamId ? 'Team' : 'Personal' }_\n\n`;

    // Preview top 5 projects
    const topProjects = projects.slice(0, 5);
    for (const p of topProjects) {
      const latest = p.targets?.production || p.latestDeployments?.[0];
      const status = formatStatusBadge(latest?.readyState);
      text += `• *${p.name}* — ${status}\n`;
    }

    if (projects.length > 5) {
      text += `\n_Select a project below to view full details:_`;
    }

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      text,
      {
        parse_mode: 'Markdown',
        reply_markup: makeProjectsKeyboard(projects, 0, 5),
      }
    );
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ Failed to fetch projects: ${(err as Error).message}`
    );
  }
}
