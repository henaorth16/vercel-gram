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
* 📡 **Real-Time Push Alerts (Webhooks)**:
  * Fastify server endpoint (`/api/webhook/vercel`) to receive real-time build notifications (`deployment.succeeded`, `deployment.error`, etc.) with HMAC-SHA1 signature verification.

---

## Quickstart

### 1. Prerequisites
* Node.js v20+ or v22+
* Telegram account
* Vercel account

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
DATABASE_URL="file:./dev.db"
VERCEL_WEBHOOK_SECRET=your_optional_webhook_secret
ALLOWED_TELEGRAM_USERS=
```

### 4. Database Setup
Initialize the local SQLite database:
```bash
npm run db:migrate
```

### 5. Start the Application
Run in development mode (hot reload):
```bash
npm run dev
```

Run in production mode:
```bash
npm run build
npm start
```

Run automated tests:
```bash
npm run test
```

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
