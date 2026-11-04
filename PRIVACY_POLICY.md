# Privacy Policy & Security Overview

Last updated: November 2026

Your privacy and security are the highest priority of **Vercel Telegram Bot**. This document clearly details how your credentials and information are handled, encrypted, and protected.

---

## 1. 100% Open Source & Self-Hostable
- **Verifiable Codebase**: This project is fully open source under the MIT License. You can inspect every line of code, review all dependencies, and audit the exact API calls made to Telegram and Vercel.
- **Self-Hosting Option**: If you prefer not to use a public or shared instance, you are encouraged to clone the repository and run your own private instance on your own server, VPS, or Vercel account.

---

## 2. What Information We Collect & Store
When you interact with the bot, we only store the bare minimum required to deliver the monitoring services:
* **Telegram User ID & Username**: Used solely to route project notifications and verify access permissions.
* **Vercel Personal Access Token (Encrypted)**: Used exclusively to interact with the official Vercel REST API on your behalf.
* **Active Workspace Selection**: Remembers whether you are currently viewing your Personal account or a specific Vercel Team.
* **Notification Preferences**: Flags for which build statuses trigger Telegram notifications (e.g. success, error).

We **never** collect, inspect, or store your application code, environment variables (`.env` values from Vercel), customer data, or git repository contents.

---

## 3. Bank-Grade Encryption & Token Protection
1. **AES-256-GCM Encryption at Rest**:
   - Your Vercel token is **never stored in plain text**.
   - Every token is encrypted with **AES-256-GCM** using a master server encryption key.
   - A unique 12-byte initialization vector (`iv`) and 16-byte cryptographic authentication tag (`tag`) are generated for each individual user, protecting against replay attacks and tampering.
2. **In-Flight Message Auto-Deletion**:
   - When you send your token via `/connect <token>` in Telegram, the bot **immediately deletes your message** from the chat to ensure your token cannot be read by anyone inspecting your device or chat history.
3. **Restricted Token Scopes**:
   - You can generate a restricted Vercel token that only has access to specific projects or read-only scopes if you prefer not to grant full access.

---

## 4. User Rights & Data Deletion (`/disconnect`)
You retain 100% control over your data:
- **Instant Revocation**: Run `/disconnect` at any time to instantly and permanently wipe your Telegram ID, encrypted credentials, and preferences from our database.
- **Vercel Dashboard Revocation**: You can also delete or revoke your token at any time directly on [vercel.com/account/tokens](https://vercel.com/account/tokens), instantly cutting off all API access.

---

## 5. Contact & Auditing
Have questions, suggestions, or security inquiries? Please open an issue or pull request directly on the GitHub repository.
