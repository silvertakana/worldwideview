---
name: local-dev
description: Instructions for checking, starting, and troubleshooting local dev
---

# Workflow: Local Development (`/local-dev`)

The user has invoked the `/local-dev` command to start the unified local development environment or troubleshoot backend issues.

## 1. Action Protocol
1. **Analyze Requirements:** Understand if the user wants to start everything (Frontend and all Backends) or just debug specific issues.
2. **Setup DB:** If they just cloned or encountered schema mismatch, run `pnpm run db:reset`.
3. **Start Servers:** 
   - You can start everything using `pnpm run dev:all`. 
   - Note: The VS Code `tasks.json` has this set up if the user prefers attaching a graphical debugger! Let them know.

## 2. Troubleshooting Backend Connectivity
- If the data engine is not responding, check running process status using `node scripts/data-engine.mjs health`
- You may also verify if Prisma or SQLite files are locked by stopping the server and clearing `.next` (`pnpm run clean`).

## 3. General Debugging Tips
- Next.js Client errors are best handled using the VSCode Chrome Debugger.
- Fastify backend (Data Engine) errors can be caught via VS Code `WWV Data Engine: debug` launch config.
