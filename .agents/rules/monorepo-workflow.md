---
trigger: model_decision
description: Strict rules for operating within the pnpm monorepo workspace environment structure across frontend and backend services.
globs: ""
---

# Monorepo Workflow Guidelines

## Purpose
Strict rules for operating within the `pnpm` monorepo workspace environment structure across frontend and backend services.

## Directory Isolation

- The Next.js frontend is located at root `.`.
- Individual standalone plugins are located at `packages/wwv-plugin-[name]`.
- For heavy plugin processing, data engine seeders are located at `local-seeders/community/[name]` or `local-seeders/private/[name]`.

## Critical Workspace Rule

> [!IMPORTANT]
> Because plugins use internal workspace references, you MUST strictly use `"workspace:*"` instead of `"*"` in `package.json` dependencies (e.g. `"@worldwideview/wwv-plugin-sdk": "workspace:*"`). Using `"*"` can cause pnpm to eagerly resolve cached registry versions instead of strictly linking your local code, resulting in opaque TypeScript and compilation errors.
> **Whenever you add a new plugin package or adjust the SDK, you MUST run `pnpm install` then `pnpm build` from the project ROOT directory to propagate TS types properly.**

## Start/Exec Flow

Running `pnpm dev:all` from the project root employs `docker-compose` to spin up the data engine runner and your local seeders alongside the Next.js frontend. 

## Next.js Monorepo Exceptions

When modifying `next.config.ts`, if new UI components or plugins are added that require SSR/transpilation, ensure they are appended to the `transpilePackages: []` array, or they will throw Next-Router unresolved import errors on production build.
