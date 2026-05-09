---
name: data-engine-cli
description: Instructions for using the wwv-data-engine CLI wrapper
---

# Workflow: Data Engine CLI (`/data-engine-cli`)

The user has invoked the `/data-engine-cli` command to interact directly with the Fastify API or seeders.

## Action Protocol
1. **Analyze Requirements:** Understand if the user wants to start the engine, ping its health, or debug a backend error. 
2. **Execute Wrapper:** 
   - A wrapper script is present in the root folder at `scripts/data-engine.mjs`.
   - Run `node scripts/data-engine.mjs health` to fetch the status of the `/health` endpoint if running.
   - Run `node scripts/data-engine.mjs dev` to isolate the `wwv-data-engine` start logs inside your terminal.

## Restrictions
> [!CAUTION]
> - Do not guess endpoints. Always verify with `/health` or check the `routes` directory inside `packages/wwv-data-engine/src`.
