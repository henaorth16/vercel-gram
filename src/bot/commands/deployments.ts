import { BotContext } from '../types.js';
import { getDeployments, getProject } from '../../services/vercel-api.js';
import { formatDeploymentCard } from '../helpers/formatters.js';
import { InlineKeyboard } from 'grammy';

export async function handleDeployments(ctx: BotContext): Promise<void> {
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;

  if (!token || !ctx.dbUser) {
    await ctx.reply(
      '⚠️ You must connect your Vercel account first using `/connect <token>`.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const text = ctx.message?.text || '';
  const parts = text.trim().split(/\s+/);
  const projectName = parts[1]?.trim();

  if (!projectName) {
    await ctx.reply(
      'ℹ️ Please specify a project name:\n\n`/deployments <projectName>`\n\nOr click a project under `/projects`.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const teamId = ctx.dbUser.defaultTeamId;
  const statusMsg = await ctx.reply(
    `⏳ *Fetching deployments for ${projectName}...*`,
    { parse_mode: 'Markdown' }
  );

  try {
    const project = await getProject(token, projectName, teamId);
    const deployments = await getDeployments(token, project.id, 5, teamId);

    if (deployments.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        statusMsg.message_id,
        `📜 No deployments found for *${projectName}*.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let msg = `📜 *Recent Deployments — ${projectName}*\n\n`;
    for (const d of deployments) {
      msg += `${formatDeploymentCard(d)}\n`;
    }

    const keyboard = new InlineKeyboard();
    const latest = deployments[0];
    if (latest && (latest.readyState === 'ERROR' || latest.state === 'ERROR')) {
      keyboard.text('📄 View Build Error Logs', `logs:${latest.uid}`).row();
    }
    keyboard.text('🔄 Refresh', `deployments:${projectName}`);
    keyboard.text('⬅️ Back to Project', `project:${projectName}`);

    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      msg,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }
    );
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      statusMsg.message_id,
      `❌ Failed to fetch deployments: ${(err as Error).message}`
    );
  }
}
