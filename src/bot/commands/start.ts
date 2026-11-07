import { BotContext } from '../types.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const isConnected = Boolean(ctx.dbUser?.encryptedToken);
  const username = ctx.dbUser?.vercelUsername;

  let message = `👋 *Welcome to Vercel Tracker Bot!*\n\n`;
  message += `Manage, monitor, and track your Vercel projects, deployments, build logs, and analytics right from Telegram.\n\n`;

  if (isConnected) {
    message += `✅ *Status: Connected* as *${username}*\n\n`;
    message += `*Available Commands:*\n`;
    message += `• /projects — Browse projects and deployment statuses\n`;
    message += `• /team — Switch between Personal and Team workspaces\n`;
    message += `• /privacy — View our detailed Privacy & Security Policy\n`;
    message += `• /disconnect — Purge all credentials and disconnect\n`;
  } else {
    message += `✨ *Features:*\n`;
    message += `• View projects, deployments, and build logs directly in chat\n`;
    message += `• Switch between personal and team workspaces easily\n`;
    message += `• Simple and fast monitoring\n\n`;

    message += `🚀 *How to Connect:*\n`;
    message += `1. Go to your Vercel account settings.\n`;
    message += `2. Navigate to *Tokens* (or click [here](https://vercel.com/account/tokens)).\n`;
    message += `3. Click *Create* to generate a new Personal Access Token.\n`;
    message += `4. Copy the token and send it to me using the format:\n`;
    message += `   \`/connect <YOUR_TOKEN>\`\n\n`;
    message += `_Tip: You can create a restricted token with custom expiration or specific project permissions._\n\n`;
    message += `🔒 *Privacy & Security*\n`;
    message += `For information on how we securely handle your token and data, please see /privacy.`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
  });
}
