# Implementation Plan: Vercel Telegram Bot

A step-by-step roadmap for building the Vercel Telegram Bot in Node.js.

---

## Phase 1: Project Setup & Environment Configuration
- [x] Initialize Node.js TypeScript project (`package.json`, `tsconfig.json`).
- [x] Install core dependencies:
  - `grammy` (Telegram bot framework)
  - `@grammyjs/runner` (concurrent updates runner)
  - `prisma` and `@prisma/client` (database ORM)
  - `fastify` (HTTP server for webhooks & health checks)
  - `dotenv` and `zod` (configuration & validation)
- [x] Create `.env.example` with template keys (`BOT_TOKEN`, `ENCRYPTION_KEY`, `PORT`, `DATABASE_URL`).
- [x] Set up build & dev scripts (`npm run dev`, `npm run build`, `npm start`).

---

## Phase 2: Database & Security Layer
- [x] Design Prisma schema (`prisma/schema.prisma`):
  - `User`: Telegram ID, encrypted Vercel token, IV, Auth Tag, Vercel user details, default team ID, notification settings.
  - `TrackedProject`: Optional table for pinned/muted projects per user.
- [x] Run Prisma migration to generate local SQLite database.
- [x] Implement `src/security/crypto.ts`:
  - `encryptToken(plainToken)`: AES-256-GCM encryption returning ciphertext, IV, and auth tag.
  - `decryptToken(ciphertext, iv, tag)`: AES-256-GCM decryption.
  - `verifyWebhookSignature(rawBody, signature, secret)`: HMAC-SHA1 validation.
- [x] Create Telegram authorization middleware to check whitelisted users (if configured).

---

## Phase 3: Vercel REST API Client
- [ ] Implement typed Vercel API client (`src/services/vercel-api.ts`):
  - [ ] `verifyUser(token)`: Validates token & returns user profile (`GET /v2/user`).
  - [ ] `getTeams(token)`: Fetches user's teams (`GET /v2/teams`).
  - [ ] `getProjects(token, teamId?)`: Fetches projects with latest deployment status (`GET /v9/projects`).
  - [ ] `getProject(token, projectId, teamId?)`: Fetches single project details (`GET /v9/projects/:id`).
  - [ ] `getDeployments(token, projectId, limit, teamId?)`: Fetches deployment history (`GET /v6/deployments`).
  - [ ] `getDeploymentLogs(token, deploymentId, teamId?)`: Fetches build & error events (`GET /v2/deployments/:id/events`).
  - [ ] `redeploy(token, deploymentId, teamId?)`: Triggers a redeployment (`POST /v13/deployments`).
  - [ ] `getWebAnalytics(token, projectId, teamId?)`: Queries 24h & 7d page views / visitors (`GET /v1/query/web-analytics/visits/count`).

---

## Phase 4: Telegram Bot Commands & Interactive UI
- [ ] Initialize grammY bot instance (`src/bot/index.ts`).
- [ ] Prepare Privacy Policy document (`PRIVACY_POLICY.md`):
  - Document data collection scope (Telegram user ID, encrypted Vercel token, workspace preferences).
  - Document security safeguards (AES-256-GCM encryption, automatic message deletion).
  - Define user data deletion and account disconnection rights.
  - Expose `/privacy` command and link it within `/start`.
- [ ] Implement `/start` command:
  - Welcome message, privacy policy reference, and token connection instructions.
- [ ] Implement `/connect <token>` command:
  - Deletes user's message immediately for security.
  - Validates token against Vercel API.
  - Encrypts and saves to DB.
  - Prompts team selection if user belongs to teams.
- [ ] Implement `/team` command:
  - Interactive inline keyboard to switch between Personal account and Team scopes.
- [ ] Implement `/projects` command:
  - Lists all projects with status emojis (🟢 Ready, 🔴 Error, 🟡 Building).
  - Displays inline buttons: `[📜 Deployments]`, `[📊 Analytics]`, `[🔄 Redeploy]`.
- [ ] Implement `/deployments <project>` & callback handlers:
  - Lists last 5 deployments with branch, commit, and status.
  - Displays `[📄 View Build Logs]` button for failed builds.
- [ ] Implement `/logs <deploymentId>` callback:
  - Formats terminal error logs directly into Telegram.
- [ ] Implement `/analytics <project>` callback:
  - Formats 24h & 7d page views, visitors, and referrers.
- [ ] Implement `/redeploy <deploymentId>` callback:
  - Triggers redeployment with confirmation prompt.

---

## Phase 5: Webhook Server (Real-Time Notifications)
- [ ] Initialize Fastify HTTP server (`src/server/app.ts`).
- [ ] Implement `POST /api/webhook/vercel`:
  - Validate `x-vercel-signature` via HMAC-SHA1.
  - Parse events: `deployment.created`, `deployment.succeeded`, `deployment.error`, `deployment.canceled`.
  - Look up associated Telegram user in DB.
  - Send formatted notification message to user's Telegram chat with action buttons.
- [ ] Add `GET /health` endpoint for uptime monitoring.

---

## Phase 6: Verification & Testing
- [ ] Add unit tests for AES-256 encryption, decryption, and HMAC signature verification.
- [ ] Test Vercel API client functions with mock responses.
- [ ] Perform end-to-end manual test with Telegram bot and Vercel account.
- [ ] Verify project listing, deployment log retrieval, analytics query, and redeploy actions.
