import { BotContext } from '../types.js';

export async function handlePrivacy(ctx: BotContext): Promise<void> {
  const policy =
    `🛡️ *Privacy & Security Policy*\n\n` +
    `*1. Open Source & Verifiable*\n` +
    `This bot is open source. You can audit the codebase on GitHub, inspect how tokens are encrypted, and verify that no credentials ever leave your designated runtime.\n\n` +
    `*2. Self-Hostable*\n` +
    `You are free to clone the repository and run your own private bot on your own server or Vercel account.\n\n` +
    `*3. AES-256-GCM Token Encryption*\n` +
    `Your Vercel Personal Access Token is encrypted before being saved into the database using AES-256-GCM with a 12-byte initialization vector (IV) and 16-byte authentication tag. It is only decrypted in memory during active API calls.\n\n` +
    `*4. Chat History Protection*\n` +
    `When you submit your token via \`/connect\`, your message is automatically deleted within milliseconds to ensure tokens cannot be viewed by unauthorized persons looking at your device.\n\n` +
    `*5. Instant Data Revocation*\n` +
    `You can run \`/disconnect\` at any moment to permanently erase your user profile, Telegram ID, and encrypted token from our database.\n\n` +
    `_Full policy details are available in the repository's PRIVACY_POLICY.md file._`;

  await ctx.reply(policy, {
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
  });
}
