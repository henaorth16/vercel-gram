# Vercel Telegram Bot 🚀

A modern, multi-user Telegram bot written in Node.js & TypeScript that lets developers track, monitor, and manage their Vercel projects, deployments, build logs, and analytics directly from Telegram.

---

## Features

* 🔒 **Secure by Design**:
  * **100% Open Source**: Full transparency—inspect every line of code or self-host your own instance.
  * **AES-256-GCM Encryption**: Vercel access tokens are encrypted at rest with unique initialization vectors and authentication tags.
  * **Chat History Protection**: The bot automatically deletes incoming `/connect <token>` messages to prevent sensitive credentials from lingering in your chat history.
  * **Instant Disconnection (`/disconnect`)**: Permanently wipe your user record and encrypted token from the database with a single command.
* 📦 **Project & Deployment Tracking**:
  * `/projects`: Browse projects with live status badges (🟢 Ready, 🔴 Failed, 🟡 Building, ⚪ Queued).
  * `/deployments <project>`: View last 5 builds with target environment, git branch, author, and commit message.
  * `📄 View Build Logs`: Inspect terminal error traces directly in Telegram when a build fails.
  * `🔄 Redeploy`: Trigger instant redeployments with confirmation.
* 📊 **Web Analytics**:
  * `/analytics <project>`: View 24-hour and 7-day page views and unique visitors.
* 🏢 **Multi-Workspace & Team Support**:
  * `/team`: Seamlessly toggle between your Personal account and team workspaces.
* 🗄️ **Turso (libSQL) Distributed SQLite**:
  * Zero-latency distributed database storage that works flawlessly on Vercel Serverless Functions.
* 📡 **Dual Deployment Mode**:
  * **Vercel Serverless**: Runs via API routes (`/api/telegram`, `/api/vercel`, `/api/health`).
  * **Self-Hosted / VPS / Local**: Fastify server with concurrent long-polling runner.

---

## Quickstart

### 1. Prerequisites
* Node.js v20+ or v22+
* Telegram Bot Token from [@BotFather](https://t.me/BotFather)
* Vercel Account
* Turso Database (`libsql://...` and Auth Token)

### 2. Installation
```bash
git clone <your-repo-url>
cd vercel-telegram-bot
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env
```

Generate a secure 32-byte encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Fill in your `.env` values:
```env
BOT_TOKEN=your_telegram_bot_token_from_botfather
ENCRYPTION_KEY=your_generated_64_character_hex_key
PORT=3000
HOST=0.0.0.0

# Turso Database Configuration
TURSO_DATABASE_URL="libsql://vercel-gram-henaorth.aws-eu-central-1.turso.io"
TURSO_AUTH_TOKEN=your_turso_auth_token_here

# Vercel Webhook Secret (Optional)
VERCEL_WEBHOOK_SECRET=your_optional_webhook_secret
```

### 4. Push Schema to Turso Database
Once you have pasted your `TURSO_AUTH_TOKEN` in `.env`:
```bash
npm run db:turso:push
```

---

## Deploying to Vercel

### Step 1: Deploy to Vercel
You can deploy using GitHub or the Vercel CLI:
```bash
vercel
```

In your Vercel Project Settings ➔ **Environment Variables**, configure:
* `BOT_TOKEN`
* `ENCRYPTION_KEY`
* `TURSO_DATABASE_URL` (`libsql://vercel-gram-henaorth.aws-eu-central-1.turso.io`)
* `TURSO_AUTH_TOKEN`
* `VERCEL_WEBHOOK_SECRET` (optional)

### Step 2: Set the Telegram Webhook
Once deployed to Vercel, register your Telegram bot webhook URL with one command:
```bash
npm run telegram:webhook -- https://your-deployment.vercel.app
```
*(Telegram will now send all user commands to `https://your-deployment.vercel.app/api/telegram`!)*

### Step 3: Configure Vercel Webhook (Optional for Live Push Alerts)
In your Vercel Account Settings (or Team Settings) ➔ **Webhooks**:
* **URL**: `https://your-deployment.vercel.app/api/vercel`
* **Events**: `deployment.succeeded`, `deployment.error`, `deployment.created`
* **Secret**: The secret matching `VERCEL_WEBHOOK_SECRET`

---

## Telegram Commands

| Command | Description |
| :--- | :--- |
| `/start` | Welcome onboarding and security overview |
| `/privacy` | View full privacy and encryption guarantees |
| `/connect <token>` | Connect and encrypt your Vercel Access Token |
| `/team` | Switch active workspace (Personal vs Team) |
| `/projects` | Browse projects and deployment statuses |
| `/deployments <project>` | View recent builds and error logs |
| `/disconnect` | Permanently purge your credentials and disconnect |

---

## Documentation
* [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) — Detailed technical architecture and business logic.
* [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) — Security safeguards, token handling, and data privacy.
* [plan.md](./plan.md) — Project milestones and task execution roadmap.

---

## License
MIT License. Open source and free for personal and commercial use.
