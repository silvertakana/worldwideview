# Cloud Hosting & Plans — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform WorldWideView from a local-only SQLite app into a multi-tenant cloud platform with `[user].app.worldwideview.dev` subdomains, PostgreSQL RLS isolation, Supabase Auth, cryptographic license keys, and Stripe billing.

**Architecture:** Single Docker container serves all tenants. nginx wildcard routes `*.app.worldwideview.dev` → Next.js. Middleware reads subdomain → sets `tenant_id` → PostgreSQL RLS scopes all queries. Same codebase, three editions (`local`/`cloud`/`demo`), adapter pattern for DB/auth/storage/tenant.

**Tech Stack:** Next.js 16, Prisma (multi-provider), PostgreSQL + RLS, Supabase Auth, Supabase Storage, RSA-signed JWTs (license keys), Stripe Checkout + Webhooks, nginx wildcard SSL.

---

## Current State Summary

| Component | Status |
|---|---|
| Edition system (`edition.ts`) | ✅ `local`/`cloud`/`demo` flags exist |
| Auth (`src/lib/auth.ts`) | ✅ Credentials provider (bcrypt + SQLite) |
| Database (`src/lib/db.ts`) | ⚠️ Hardcoded to `better-sqlite3` adapter |
| Prisma schema | ⚠️ `provider = "sqlite"` only |
| Tenant isolation | ❌ Not implemented |
| Cloud auth (Supabase) | ❌ Not implemented |
| License keys | ❌ Not implemented |
| Storage adapter | ❌ Not implemented |
| Stripe billing | ❌ Not implemented |
| Cloud deployment repo | ❌ Not created |

---

## Phase Breakdown

Each phase is a self-contained deliverable. Phases 1–3 are foundational. Phases 4–6 add monetization.

| Phase | File | What It Builds | Depends On |
|---|---|---|---|
| 1 | [01-database-adapter.md](./01-database-adapter.md) | Prisma multi-provider (SQLite + PostgreSQL) | Nothing |
| 2 | [02-tenant-system.md](./02-tenant-system.md) | RLS isolation, middleware, tenant context | Phase 1 |
| 3 | [03-auth-upgrade.md](./03-auth-upgrade.md) | Supabase Auth provider for cloud edition | Phase 1 |
| 4 | [04-license-keys.md](./04-license-keys.md) | RSA-signed JWT license keys, tier gating | Phase 1 |
| 5 | [05-cloud-deployment.md](./05-cloud-deployment.md) | `worldwideview-cloud` repo, nginx, Docker Compose | Phases 1–3 |
| 6 | [06-stripe-billing.md](./06-stripe-billing.md) | Stripe Checkout, webhooks, subscription management | Phases 3–4 |

---

## Key Design Decisions

1. **Adapter pattern** — Three thin files (`src/core/adapters/db.ts`, `auth.ts`, `storage.ts`, `tenant.ts`) branch on `edition`. Everything else is edition-unaware.
2. **Prisma multi-provider** — Use a build-time script to swap the provider in `schema.prisma` before generating the client if building for cloud. One schema, two providers.
3. **RLS over application-level filtering** — PostgreSQL physically refuses cross-tenant data. Even bugs can't leak.
4. **License keys are RSA JWTs** — Marketplace signs with private key; app verifies with hardcoded public key. No phone-home required.
5. **Stripe is the only payment processor** — Checkout Sessions for signup, Webhooks for lifecycle events.
