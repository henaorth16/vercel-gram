import { Bot } from 'grammy';
import { BotContext } from './types.js';
import { config } from '../config/index.js';
import { authMiddleware } from './middleware/auth.js';
import { handleStart } from './commands/start.js';
import { handlePrivacy } from './commands/privacy.js';
import { handleConnect } from './commands/connect.js';
import { handleDisconnect } from './commands/disconnect.js';
import { handleTeam } from './commands/team.js';
import { handleProjects } from './commands/projects.js';
import { handleDeployments } from './commands/deployments.js';
import {
  handleTeamSelection,
  handleTeamsRefresh,
} from './callbacks/team-selection.js';
import {
  handleProjectDetail,
  handleProjectsPage,
  handleProjectsRefresh,
  handleDeploymentsCallback,
  handleLogsCallback,
  handleAnalyticsCallback,
  handleRedeployPrompt,
  handleRedeployExec,
} from './callbacks/project-actions.js';

let cachedBot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (!cachedBot) {
    cachedBot = createBot();
  }
  return cachedBot;
}

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

  // Stage 4: grammY middleware execution logging
  bot.use(async (ctx, next) => {
    const start = Date.now();
    const updateId = ctx.update.update_id;
    const updateType =
      Object.keys(ctx.update).find((k) => k !== 'update_id') || 'unknown';
    const command = ctx.message?.text?.startsWith('/')
      ? ctx.message.text.split(' ')[0]
      : undefined;
    const fromUserId = ctx.from?.id;

    console.log(
      JSON.stringify({
        stage: '4_MIDDLEWARE_EXECUTION',
        event: 'start',
        updateId,
        updateType,
        command,
        fromUserId,
        timestamp: new Date().toISOString(),
      })
    );

    try {
      await next();
      console.log(
        JSON.stringify({
          stage: '4_MIDDLEWARE_EXECUTION',
          event: 'complete',
          updateId,
          updateType,
          command,
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err: any) {
      console.error(
        JSON.stringify({
          stage: '4_MIDDLEWARE_EXECUTION',
          event: 'error',
          updateId,
          updateType,
          command,
          durationMs: Date.now() - start,
          errorName: err?.name,
          errorMessage: err?.message,
          stack: err?.stack,
          timestamp: new Date().toISOString(),
        })
      );
      throw err;
    }
  });

  // Global Auth & DB context middleware
  bot.use(authMiddleware);

  // Command Handlers
  bot.command('start', handleStart);
  bot.command('help', handleStart);
  bot.command('privacy', handlePrivacy);
  bot.command('connect', handleConnect);
  bot.command('disconnect', handleDisconnect);
  bot.command('team', handleTeam);
  bot.command('projects', handleProjects);
  bot.command('deployments', handleDeployments);

  // Callback Query Handlers
  bot.callbackQuery(/^switch_team:/, handleTeamSelection);
  bot.callbackQuery('teams_refresh', handleTeamsRefresh);
  bot.callbackQuery(/^project:/, handleProjectDetail);
  bot.callbackQuery(/^projects_page:/, handleProjectsPage);
  bot.callbackQuery('projects_refresh', handleProjectsRefresh);
  bot.callbackQuery(/^deployments:/, handleDeploymentsCallback);
  bot.callbackQuery(/^logs:/, handleLogsCallback);
  bot.callbackQuery(/^analytics:/, handleAnalyticsCallback);
  bot.callbackQuery(/^redeploy_prompt:/, handleRedeployPrompt);
  bot.callbackQuery(/^redeploy_exec:/, handleRedeployExec);

  // Error boundary
  bot.catch((err) => {
    console.error(
      JSON.stringify({
        stage: '4_MIDDLEWARE_EXECUTION',
        event: 'unhandled_error',
        updateId: err.ctx?.update?.update_id,
        errorName: err.name,
        errorMessage: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      })
    );
  });

  return bot;
}
