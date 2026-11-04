import { BotContext } from '../types.js';
import {
  getProjects,
  getProject,
  getDeployments,
  getDeploymentLogs,
  getWebAnalytics,
  redeploy,
} from '../../services/vercel-api.js';
import {
  formatProjectSummary,
  formatDeploymentCard,
  formatAnalyticsCard,
  formatStatusBadge,
} from '../helpers/formatters.js';
import {
  makeProjectsKeyboard,
  makeProjectActionKeyboard,
  makeRedeployConfirmKeyboard,
} from '../helpers/keyboards.js';
import { InlineKeyboard } from 'grammy';

export async function handleProjectDetail(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, projectName] = data.split(':');
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) {
    await ctx.answerCallbackQuery({ text: 'Connect with /connect first.' });
    return;
  }

  await ctx.answerCallbackQuery();
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const project = await getProject(token, projectName, teamId);
    const text = formatProjectSummary(project);

    const latest = project.targets?.production || project.latestDeployments?.[0];
    const latestId = latest?.id;
    const liveUrl = latest?.url;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: makeProjectActionKeyboard(projectName, latestId, liveUrl),
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    await ctx.reply(`❌ Error loading project "${projectName}": ${(err as Error).message}`);
  }
}

export async function handleProjectsPage(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, pageStr] = data.split(':');
  const page = parseInt(pageStr, 10) || 0;

  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery();
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const res = await getProjects(token, teamId, 50);
    const projects = res.projects || [];

    let text = `📂 *Vercel Projects (${projects.length})*\n`;
    text += `_Active Workspace: ${teamId ? 'Team' : 'Personal'}_\n\n`;

    const start = page * 5;
    const pageProjects = projects.slice(start, start + 5);
    for (const p of pageProjects) {
      const latest = p.targets?.production || p.latestDeployments?.[0];
      const status = formatStatusBadge(latest?.readyState);
      text += `• *${p.name}* — ${status}\n`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: makeProjectsKeyboard(projects, page, 5),
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${(err as Error).message}`);
  }
}

export async function handleProjectsRefresh(ctx: BotContext): Promise<void> {
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery({ text: 'Refreshed projects!' });
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const res = await getProjects(token, teamId, 50);
    const projects = res.projects || [];

    let text = `📂 *Vercel Projects (${projects.length})*\n`;
    text += `_Active Workspace: ${teamId ? 'Team' : 'Personal'}_\n\n`;

    const pageProjects = projects.slice(0, 5);
    for (const p of pageProjects) {
      const latest = p.targets?.production || p.latestDeployments?.[0];
      const status = formatStatusBadge(latest?.readyState);
      text += `• *${p.name}* — ${status}\n`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: makeProjectsKeyboard(projects, 0, 5),
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${(err as Error).message}`);
  }
}

export async function handleDeploymentsCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, projectName] = data.split(':');
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery();
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const project = await getProject(token, projectName, teamId);
    const deployments = await getDeployments(token, project.id, 5, teamId);

    if (deployments.length === 0) {
      await ctx.editMessageText(`📜 No deployments found for *${projectName}*.`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().text('⬅️ Back', `project:${projectName}`),
      });
      return;
    }

    let msg = `📜 *Recent Deployments — ${projectName}*\n\n`;
    for (const d of deployments) {
      msg += `${formatDeploymentCard(d)}\n`;
    }

    const keyboard = new InlineKeyboard();
    const latest = deployments[0];
    if (latest && (latest.readyState === 'ERROR' || latest.state === 'ERROR')) {
      keyboard.text('📄 View Error Logs', `logs:${latest.uid}`).row();
    }
    keyboard.text('🔄 Refresh', `deployments:${projectName}`);
    keyboard.text('⬅️ Back to Project', `project:${projectName}`);

    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    await ctx.reply(`❌ Failed to fetch deployments: ${(err as Error).message}`);
  }
}

export async function handleLogsCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, deploymentId] = data.split(':');
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery({ text: 'Fetching build logs...' });
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const logs = await getDeploymentLogs(token, deploymentId, teamId, 50);

    let message = `📄 *Build Logs for Deployment* \`${deploymentId}\`:\n\n`;
    message += `\`\`\`\n${logs}\n\`\`\``;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Failed to fetch logs: ${(err as Error).message}`);
  }
}

export async function handleAnalyticsCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, projectName] = data.split(':');
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery({ text: 'Fetching Web Analytics...' });
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const project = await getProject(token, projectName, teamId);
    const analytics = await getWebAnalytics(token, project.id, teamId);
    const text = formatAnalyticsCard(projectName, analytics);

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', `analytics:${projectName}`)
      .text('⬅️ Back to Project', `project:${projectName}`);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    await ctx.reply(`❌ Failed to query analytics: ${(err as Error).message}`);
  }
}

export async function handleRedeployPrompt(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, projectName, deploymentId] = data.split(':');
  await ctx.answerCallbackQuery();

  const text =
    `⚠️ *Redeploy Confirmation*\n\n` +
    `Are you sure you want to trigger a new deployment for *${projectName}* using build \`${deploymentId}\`?`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: makeRedeployConfirmKeyboard(projectName, deploymentId),
  });
}

export async function handleRedeployExec(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [, projectName, deploymentId] = data.split(':');
  const token = ctx.getVercelToken ? ctx.getVercelToken() : null;
  if (!token || !ctx.dbUser) return;

  await ctx.answerCallbackQuery({ text: 'Triggering redeployment...' });
  const teamId = ctx.dbUser.defaultTeamId;

  try {
    const newDep = await redeploy(token, deploymentId, projectName, teamId);

    let text = `🚀 *Redeployment Triggered!*\n\n`;
    text += `• Project: *${projectName}*\n`;
    text += `• Status: 🟡 *${newDep.readyState}*\n`;
    text += `• URL: https://${newDep.url}\n`;
    text += `• New Deployment ID: \`${newDep.id}\`\n`;

    const keyboard = new InlineKeyboard()
      .text('📜 View Deployments', `deployments:${projectName}`)
      .text('⬅️ Back to Project', `project:${projectName}`);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    await ctx.reply(`❌ Failed to redeploy: ${(err as Error).message}`);
  }
}
