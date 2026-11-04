import { Bot } from 'grammy';
import { BotContext } from '../bot/types.js';
import { InlineKeyboard } from 'grammy';
import { prisma } from '../db/client.js';

export interface VercelWebhookEvent {
  id: string;
  type: string;
  createdAt: number;
  region?: string;
  payload: {
    deployment?: {
      id: string;
      url?: string;
      name?: string;
      target?: 'production' | 'staging' | null;
      meta?: {
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
      };
    };
    project?: {
      id: string;
      name: string;
    };
    team?: {
      id: string;
    };
    user?: {
      id: string;
    };
    [key: string]: unknown;
  };
}

export async function processVercelWebhook(
  event: VercelWebhookEvent,
  bot: Bot<BotContext>,
  queryTelegramId?: string
): Promise<{ dispatchedCount: number }> {
  const vercelUserId = event.payload?.user?.id;
  const vercelTeamId = event.payload?.team?.id;

  // 1. Find target Telegram users to notify
  let targetUsers: Array<{
    telegramId: string;
    notifyOnSuccess: boolean;
    notifyOnError: boolean;
    notifyOnCreated: boolean;
    mutePreviewBuilds: boolean;
  }> = [];

  if (queryTelegramId) {
    const user = await prisma.user.findUnique({
      where: { telegramId: queryTelegramId },
    });
    if (user) targetUsers = [user];
  } else if (vercelUserId || vercelTeamId) {
    targetUsers = await prisma.user.findMany({
      where: {
        OR: [
          ...(vercelUserId ? [{ vercelUserId }] : []),
          ...(vercelTeamId ? [{ defaultTeamId: vercelTeamId }] : []),
        ],
      },
    });
  }

  if (targetUsers.length === 0) {
    return { dispatchedCount: 0 };
  }

  const { type, payload } = event;
  const deployment = payload.deployment;
  const projectName = payload.project?.name || deployment?.name || 'Vercel Project';
  const isProd = deployment?.target === 'production';
  const branch = deployment?.meta?.githubCommitRef || (isProd ? 'main' : 'preview');
  const author = deployment?.meta?.githubCommitAuthorName || 'Unknown';
  const commitMsg = deployment?.meta?.githubCommitMessage
    ? deployment.meta.githubCommitMessage.split('\n')[0].slice(0, 60)
    : undefined;

  let message = '';
  let keyboard = new InlineKeyboard();
  let eventCategory: 'created' | 'success' | 'error' | 'other' = 'other';

  switch (type) {
    case 'deployment.created':
      eventCategory = 'created';
      message = `🚀 *Deployment Started — ${projectName}*\n\n`;
      message += `• Target: \`${isProd ? 'Production' : 'Preview'}\` (${branch})\n`;
      if (commitMsg) message += `• Commit: _"${commitMsg}"_ by ${author}\n`;
      if (deployment?.id) message += `• ID: \`${deployment.id}\`\n`;
      break;

    case 'deployment.succeeded':
      eventCategory = 'success';
      message = `✅ *Deployment Succeeded — ${projectName}*\n\n`;
      message += `• Target: \`${isProd ? 'Production' : 'Preview'}\` (${branch})\n`;
      if (commitMsg) message += `• Commit: _"${commitMsg}"_ by ${author}\n`;
      if (deployment?.url) {
        message += `• Live URL: https://${deployment.url}\n`;
        keyboard.url('🌐 Open Live URL', `https://${deployment.url}`).row();
      }
      keyboard
        .text('📜 Deployments', `deployments:${projectName}`)
        .text('📊 Analytics', `analytics:${projectName}`)
        .row();
      break;

    case 'deployment.error':
      eventCategory = 'error';
      message = `🔴 *Deployment Failed — ${projectName}*\n\n`;
      message += `• Target: \`${isProd ? 'Production' : 'Preview'}\` (${branch})\n`;
      if (commitMsg) message += `• Commit: _"${commitMsg}"_ by ${author}\n`;
      if (deployment?.id) {
        message += `• ID: \`${deployment.id}\`\n`;
        keyboard.text('📄 View Build Error Logs', `logs:${deployment.id}`).row();
        keyboard.text(
          '🔄 Redeploy',
          `redeploy_prompt:${projectName}:${deployment.id}`
        );
      }
      break;

    case 'deployment.canceled':
      message = `⚪ *Deployment Canceled — ${projectName}*\n\n`;
      message += `• Target: \`${isProd ? 'Production' : 'Preview'}\` (${branch})\n`;
      break;

    case 'project.created':
      message = `📁 *New Vercel Project Created: ${projectName}*\n`;
      keyboard.text('📂 View in /projects', 'projects_refresh');
      break;

    case 'project.removed':
      message = `🗑️ *Vercel Project Removed: ${projectName}*\n`;
      break;

    default:
      message = `ℹ️ *Vercel Event: ${type}*\nProject: *${projectName}*`;
      break;
  }

  let dispatchedCount = 0;

  for (const user of targetUsers) {
    // Respect user notification preferences
    if (eventCategory === 'created' && !user.notifyOnCreated) continue;
    if (eventCategory === 'success' && !user.notifyOnSuccess) continue;
    if (eventCategory === 'error' && !user.notifyOnError) continue;
    if (!isProd && user.mutePreviewBuilds) continue;

    try {
      await bot.api.sendMessage(user.telegramId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : undefined,
        link_preview_options: { is_disabled: true },
      });
      dispatchedCount++;
    } catch (sendErr) {
      console.error(
        `Failed to send notification to Telegram user ${user.telegramId}:`,
        sendErr
      );
    }
  }

  return { dispatchedCount };
}
