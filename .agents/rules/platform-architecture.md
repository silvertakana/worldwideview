---
trigger: model_decision
description: High-level platform goals, product vision, business model, multi-repository layout, and the Edition System.
---

# WorldWideView — Platform Architecture


> **This folder is the canonical source of truth for the project. It is NOT committed to git.**
> It contains live architectural decisions, future plans, and operational knowledge.

---

> [!TIP]
> **For the fundamental system architecture, component layout, and data pipelines, please read [`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md) first.**
> This file focuses strictly on the advanced business vision, multi-repository layout, and the Edition System.

## Product Vision & Business Model

WorldWideView operates on a **VS Code distribution model**. It is a visualization platform, not a compute provider. Plugin authors bring their own backends to display real-time geospatial intelligence.

---

## Repository Structure

Five repositories, modelled after the n8n pattern:

| Repo | License | Purpose |
|---|---|---|
| `silvertakana/worldwideview` | Elastic License 2.0 | Core 3D globe app (Next.js + CesiumJS + Prisma) |
| `silvertakana/wwv-data-engine` | Open Source | Generic runner (Fastify + Redis + WS) |
| `silvertakana/wwv-seeders-community` | Open Source | Open-source community seeders |
| `silvertakana/wwv-seeders-private` | **Private** | Proprietary seeder scripts (aviation, maritime, etc.) |
| `silvertakana/worldwideview-marketplace` | Open Source | Plugin catalog, signed registry, admin UI |
| `silvertakana/worldwideview-plugins` | Open Source | Published plugin frontend source |
| `silvertakana/worldwideview-web` | Open Source | Landing page, docs, static content |
| `silvertakana/worldwideview-cloud` | **Private** | Cloud deployment config — Docker Compose, nginx, provisioning scripts |
| `silvertakana/plugin-sdk` | MIT | `@worldwideview/plugin-sdk` — shared types for repos + 3rd-party authors |

**n8n Parallel:**
| n8n | WorldWideView |
|---|---|
| `n8n-io/n8n` | `silvertakana/worldwideview` |
| `n8n-io/n8n-cloud` (private) | `silvertakana/worldwideview-cloud` (private) |
| `n8n.io` landing | `worldwideview.dev` (static on Vercel) |
| `app.n8n.cloud` dashboard | `app.worldwideview.dev` |
| `[user].app.n8n.cloud` | `[user].app.worldwideview.dev` |
| `@n8n/workflow` npm | `@worldwideview/plugin-sdk` npm |

---

## Domain Architecture

| URL | What | Stack |
|---|---|---|
| `worldwideview.dev` | Static marketing/landing | Next.js (static export) on Vercel |
| `app.worldwideview.dev` | Auth, accounts, dashboard | Next.js + Supabase Auth |
| `[user].app.worldwideview.dev` | User's cloud WWV instance | Next.js (multi-tenant, RLS) |
| `marketplace.worldwideview.dev` | Plugin catalog, publishing, install | Next.js (SSO via WorldWideView auth) |
| `demo.worldwideview.dev` | Public demo — pre-configured, read-only | Next.js (WWV app) |
| `docs.worldwideview.dev` | Documentation | TBD (Mintlify/Nextra) |
| `status.worldwideview.dev` | Uptime / incident | Uptime Kuma |
| `api.worldwideview.dev` | Built-in data services (aviation, maritime) | Next.js API routes or standalone |
| `cdn.worldwideview.dev` | Plugin bundle storage | Cloudflare R2 |

**Reserved subdomains:** `www`, `app`, `api`, `demo`, `marketplace`, `docs`, `status`, `admin`, `cdn`, `blog`, `changelog`

---

## Infrastructure

All on **Coolify** running on a repurposed **ThinkPad T480s** (i5-8350U, 16GB RAM, 256GB NVMe, Ubuntu). Zero monthly hosting cost.

```
ThinkPad T480s (home server, $0/mo)             Supabase (hosted)
├── Coolify                               ──→   ├── PostgreSQL (cloud DB)
│   ├── worldwideview.dev (landing, Vercel)     ├── Auth (GoTrue)
│   ├── app.worldwideview.dev (auth/dashboard)  └── Storage (file uploads)
│   ├── WWV Cloud App (Docker)
│   ├── Marketplace App (Docker)            Cloudflare (free)
│   ├── Demo Instance (Docker)              ├── DNS + wildcard routing
│   ├── api.worldwideview.dev               ├── CDN caching
│   ├── Uptime Kuma                         ├── DDoS protection
│   └── Plausible Analytics                 └── R2 (plugin bundle CDN)
└── Ubuntu Server
```

**CI/CD:** Push to `silvertakana/worldwideview` → GitHub Actions builds Docker image → pushes to `ghcr.io/silvertakana/worldwideview:latest` → Coolify webhook triggers rolling restart.

**Monitoring:** Uptime Kuma (all subdomains), Plausible/Umami analytics.

---

## Business Model

**Distribution platform, not compute provider.** Plugin authors handle their own backends.

| Revenue Stream | How |
|---|---|
| **Cloud hosting** | `[user].app.worldwideview.dev` — free/pro/enterprise tiers |
| **Marketplace cut** | % of paid plugin subscriptions via Stripe Connect |
| **Verified tier** | Plugin authors pay for review + verified badge |
| **Pro/Enterprise license** | More quota, faster cache TTL, advanced features |
| **Extension packs** | Curated bundles of related plugins |

Plugin authors can monetize independently (VS Code + GitHub Copilot model). Selling through the marketplace is **incentivized** (managed billing, featured placement, analytics) but not mandatory.

---

## Editions

Three editions; same codebase, gated by `NEXT_PUBLIC_WWV_EDITION`:

| Edition | Value | Database | Auth | Plugin Install |
|---|---|---|---|---|
| **Local** | `local` | PostgreSQL | Auth.js Credentials | Yes |
| **Cloud** | `cloud` | PostgreSQL (Supabase) | Auth.js + Supabase | Yes |
| **Demo** | `demo` | PostgreSQL (read-only) | Disabled | No |

Three thin adapter files handle edition differences: `src/core/auth.ts`, `src/core/storage.ts`, `src/core/tenant.ts`. Everything else is edition-unaware.
