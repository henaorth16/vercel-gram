import { BotContext } from '../types.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const isConnected = Boolean(ctx.dbUser?.encryptedToken);
  const username = ctx.dbUser?.vercelUsername;

  let message = `👋 *Welcome to Vercel Tracker Bot!*\n\n`;
  message += `Manage, monitor, and track your Vercel projects, deployments, build logs, and analytics right from Telegram.\n\n`;

  message += `🔒 *Is it safe to send my Vercel token?*\n`;
  message += `• *100% Open Source*: Every line of code is open source on GitHub. You can inspect the implementation, verify security practices, or self-host your own instance.\n`;
  message += `• *Bank-Grade AES-256-GCM Encryption*: Your token is never stored in plain text. It is encrypted at rest using unique IVs and cryptographic authentication tags.\n`;
  message += `• *Instant Message Auto-Deletion*: The moment you send \`/connect <token>\`, this bot deletes your message immediately to protect your device chat history.\n`;
  message += `• *Full Control*: You can permanently purge all stored data anytime using \`/disconnect\`.\n\n`;

  if (isConnected) {
    message += `✅ *Status: Connected* as *${username}*\n\n`;
    message += `*Available Commands:*\n`;
    message += `• /projects — Browse projects and deployment statuses\n`;
    message += `• /team — Switch between Personal and Team workspaces\n`;
    message += `• /privacy — View our detailed Privacy & Security Policy\n`;
    message += `• /disconnect — Purge all credentials and disconnect\n`;
  } else {
    message += `🚀 *Get Started:*\n`;
    message += `1. Generate a Personal Access Token at [vercel.com/account/tokens](https://vercel.com/account/tokens).\n`;
    message += `2. Send: \`/connect <YOUR_TOKEN>\`\n\n`;
    message += `_Tip: You can create a restricted token with custom expiration or specific project permissions._\n\n`;
    message += `• /privacy — Read full privacy and encryption guarantees`;
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
  });
}
