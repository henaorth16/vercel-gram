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

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.BOT_TOKEN);

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
    console.error('Unhandled error in Telegram Bot update:', err);
  });

  return bot;
}
