import { Bot } from 'grammy';
import { BotContext } from './types.js';
import { config } from '../config/index.js';
import { authMiddleware } from './middleware/auth.js';
import { extractUpdateMetadata } from '../logging/metadata.js';
import { createUpdateLogger, logger } from '../logging/logger.js';
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

  // Structured logging & Context enrichment middleware
  bot.use(async (ctx, next) => {
    const start = Date.now();
    const meta = extractUpdateMetadata(ctx.update);
    const botLogger = createUpdateLogger({
      ...meta,
      processing_step: 'bot_pipeline',
    });

    ctx.updateMeta = meta;
    ctx.logger = botLogger;

    botLogger.info(
      {
        event: 'start',
        update_type: meta.update_type,
        user_id: meta.user_id,
      },
      'Bot middleware pipeline started'
    );

    try {
      await next();
      const durationMs = Date.now() - start;
      botLogger.info(
        {
          event: 'complete',
          duration_ms: durationMs,
        },
        'Bot middleware pipeline completed'
      );
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : String(err);
      botLogger.error(
        {
          event: 'error',
          duration_ms: durationMs,
          error: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        },
        'Error during bot pipeline execution'
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
    const meta = extractUpdateMetadata(err.ctx?.update);
    logger.error(
      {
        update_id: meta.update_id !== undefined ? String(meta.update_id) : undefined,
        chat_id: meta.chat_id,
        command: meta.command,
        processing_step: 'unhandled_bot_error',
        error: err.message,
        stack: err.stack,
      },
      'Unhandled error in bot runner'
    );
  });

  return bot;
}
