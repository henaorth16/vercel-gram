# Vercel Telegram Bot — Project Overview

## 1. Project Introduction
**Vercel Telegram Bot** is a multi-user Node.js application that enables developers and software teams to track, monitor, and manage their Vercel projects directly within Telegram. 

Instead of opening the Vercel dashboard or checking email alerts, developers can check deployment statuses, inspect failed build logs, view visitor analytics, trigger redeployments, and receive real-time build notifications in a single Telegram chat or group.

---

## 2. Business Logic & User Flows

### 2.1 Multi-User Onboarding & Authentication
1. **Connection**:
   - A user opens a private chat with the bot and runs `/start`.
   - The user provides their Vercel Personal Access Token via `/connect <token>`.
   - The bot immediately deletes the user's message to keep the token out of Telegram chat history.
2. **Validation & Account Linking**:
   - The bot verifies the token against the Vercel REST API (`GET /v2/user`).
   - If valid, the token is encrypted using AES-256-GCM and stored in the database tied to the user's unique Telegram ID.
3. **Workspace / Team Selection**:
   - The bot fetches all teams the user belongs to (`GET /v2/teams`).
   - The user selects their default active workspace (Personal Account or a specific Team) via inline buttons.
   - Users can switch workspaces at any time using `/team`.

### 2.2 Project Monitoring & Status
- **List Projects (`/projects`)**:
  - Displays all projects in the active workspace with live status indicators:
    - 🟢 **Ready**: Latest production deployment is live and healthy.
    - 🔴 **Error**: Latest build failed.
    - 🟡 **Building**: Deployment currently compiling or deploying.
    - ⚪ **Canceled / Queued**: Build was stopped or is waiting.
- **Project Detail Card**:
  - Displays project framework (e.g. Next.js, Remix, Astro), domains, Git repository branch, and last deployment timestamp.
  - Interactive actions: `[📜 Deployments]`, `[📊 Analytics]`, `[🔄 Redeploy]`, `[🌐 Open Site]`.

### 2.3 Deployment Management & Build Logs
- **Deployment History (`/deployments [projectName]`)**:
  - Shows the last 5 deployments with branch names, commit authors, commit messages, and deployment URLs.
- **Instant Error Logs (`/logs [deploymentId]`)**:
  - When a deployment fails (🔴), an inline **`[📄 View Build Logs]`** button allows the user to view the terminal build error trace directly in Telegram without logging into Vercel.
- **One-Click Redeploy (`/redeploy [deploymentId]`)**:
  - Allows developers to trigger an immediate rebuild/redeploy directly from Telegram with a single tap.

### 2.4 Web Analytics & Metrics
- **Traffic Overview (`/analytics [projectName]`)**:
  - Queries Vercel Web Analytics API for the project.
  - Provides concise metrics:
    - Total Page Views (last 24 hours & last 7 days).
    - Unique Visitors (last 24 hours & last 7 days).
    - Top referrers / devices (if enabled on the Vercel project).

### 2.5 Real-Time Notifications (Webhooks)
- In addition to on-demand REST API queries, the bot exposes a webhook endpoint (`/api/webhook/vercel`).
- Delivers instant rich push messages when:
  - A deployment succeeds (`deployment.succeeded`).
  - A deployment fails with an error (`deployment.error`).
  - A project or domain is created/removed.
- Users can toggle alert preferences (e.g., mute preview builds and only notify on production).

---

## 3. Technical Architecture

### 3.1 Technology Stack
* **Runtime**: Node.js (v22+)
* **Language**: TypeScript
* **Telegram Framework**: [grammY](https://grammy.dev/) (modern, typesafe, high-performance bot framework)
* **Database & ORM**: Prisma ORM with SQLite (zero-config, portable; easily migratable to PostgreSQL/Supabase)
* **HTTP Server**: Fastify (lightweight HTTP server for incoming Vercel webhooks and health checks)
* **API Client**: Native `fetch` / Axios with typed Vercel REST API wrappers
* **Security**: Node.js native `crypto` module (AES-256-GCM for token encryption, HMAC-SHA1 for webhook verification)

### 3.2 System Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                    Telegram Client                     │
│               (Private Chat or Team Group)             │
└───────────────────────────┬────────────────────────────┘
                            │
              Telegram API  │  Bot Commands & Callbacks
                            ▼
┌────────────────────────────────────────────────────────┐
│                   grammY Bot Layer                     │
│  - /start, /connect, /team, /projects, /deployments    │
│  - Inline keyboards, callbacks, menu navigation        │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
               ▼                           ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│       Security & DB           │ │   Vercel REST API    │
│  - AES-256-GCM Token Crypto   │ │  - /v2/user          │
│  - Prisma Client (SQLite)     │ │  - /v9/projects      │
│  - User & Workspace Storage   │ │  - /v6/deployments   │
└───────────────────────────────┘ │  - /v2/.../events    │
                                  │  - /v1/.../analytics │
                                  └──────────────────────┘
                                             ▲
                                             │ HTTP POST
┌──────────────────────────────────────┐     │ Webhook Events
│            Fastify Server            │     │
│  - POST /api/webhook/vercel ─────────┴─────┘
│  - HMAC-SHA1 Signature Verification
│  - Notification Dispatcher
└──────────────────────────────────────┘
```

---

## 4. Security Architecture

1. **Token Encryption at Rest**:
   - Vercel tokens are encrypted using **AES-256-GCM** before database storage.
   - Each record stores a unique 12-byte initialization vector (`iv`), 16-byte authentication `tag`, and the `ciphertext`.
   - A dedicated server secret (`ENCRYPTION_KEY`) is required to decrypt tokens in memory.
2. **Chat Hygiene**:
   - The bot deletes incoming `/connect <token>` messages immediately after receipt, protecting tokens against shoulder-surfing and shared device chat logs.
3. **Webhook Verification**:
   - Incoming Vercel webhook requests are validated against the `x-vercel-signature` header using HMAC-SHA1 and the webhook secret.
4. **Access Control**:
   - An optional `ALLOWED_TELEGRAM_USERS` environment variable allows restricting bot access to designated Telegram user IDs.
