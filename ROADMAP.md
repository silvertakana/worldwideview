# WorldWideView — Implementation Roadmap

Each stage is **self-contained and demo-able**. Any stage can be shipped independently.

---

## Stage 1: Plugin SDK & Manifest Schema ✅
**Demo:** "Here's the schema that defines a plugin. Our existing aviation plugin has a manifest file."

- [x] `plugin.json` manifest files for each existing plugin
- [x] Manifest validation logic (`validateManifest()`)
- [x] `type` field on `WorldPlugin` interface (`"data-layer" | "extension"`)
- [x] `capabilities` field on `WorldPlugin` interface
- [x] `@worldwideview/wwv-plugin-sdk` npm package — shared types published to npm

---

## Stage 2: Marketplace Browse UI (Static Catalog) ✅
**Demo:** "Open the marketplace, see all available plugins with categories and search."

- [x] `worldwideview-marketplace` repo (Next.js)
- [x] Browse page — grid of plugin cards with icons, descriptions, categories
- [x] Search + category filter
- [x] Plugin detail page (readme, version history, install count)

---

## Stage 3: Prisma ORM & Local Database ✅
**Demo:** "Run `pnpm run dev` on a fresh clone. SQLite auto-creates. App works with zero config."

- [x] Prisma (`prisma` + `@prisma/client`)
- [x] Schema: `InstalledPlugin`, `Setting`, `User`, `AviationHistory`, `NpmCache`
- [x] SQLite default: `DATABASE_URL=file:./data/wwv.db`
- [x] `predev` script: `prisma migrate deploy`
- [x] DB auto-creates on first run — zero manual setup

---

## Stage 4: Bridge API & One-Click Install ✅
**Demo:** "Click 'Install' on marketplace → plugin appears in your local WWV instance."

- [x] `GET /api/marketplace/install-redirect` — session-based redirect install flow
- [x] `GET /api/marketplace/grant-token` — issues marketplace JWT without install
- [x] `GET /api/marketplace/status` — list installed plugins (session or JWT auth)
- [x] `POST /api/marketplace/uninstall` — delete installed plugin record
- [x] `GET /api/marketplace/load` — serve valid manifests to client at startup
- [x] `GET /api/auth/setup-status` — CORS-enabled connection test endpoint
- [x] `src/lib/marketplace/marketplaceToken.ts` — `issueMarketplaceToken()` / `verifyMarketplaceToken()`
- [x] `src/lib/marketplace/auth.ts` — `validateMarketplaceAuth()` (session → JWT → legacy token)
- [x] `src/lib/marketplace/registryClient.ts` — Ed25519 registry verification + 5-min cache
- [x] Marketplace: `InstanceConfig`, `InstallButton`, `useInstalledPlugins`, `InstalledPluginCard`, Manage page
- [x] NPM-driven submission: Admin enters package name → marketplace fetches + parses `"worldwideview"` block from `package.json`
- [x] `NpmCache` table — decouples marketplace from live NPM registry

---

## Stage 5: AI & Sharing Features (Immediate User Value)
**Demo:** "Chat with the AI to explore the globe, record a narrated briefing, and share the view via a URL."

- [ ] Unified Data Format schema (WWVDocument) with snapshot radius bounding
- [ ] Base64url view link sharing (`#v=...`)
- [ ] Shared `ActionExecutor` core for Animation & Copilot
- [ ] Animation Engine (TrackScheduler, Player, overlays, TTS voice)
- [ ] MCP Server (tools wrapping the action vocabulary)
- [ ] Hybrid Spatial Awareness (Pre-computed summaries + MCP spatial query tools)

---

## Stage 6: Publisher Workflow
**Demo:** "A plugin author submits their plugin. After review, it appears in the catalog."

- [ ] Marketplace user accounts (Supabase Auth — email/password + GitHub OAuth)
- [ ] Publisher submission form (upload bundle, fill metadata, declare capabilities)
- [ ] Admin review queue (approve/reject with notes)
- [ ] Version management (semver, changelogs)
- [ ] Publisher dashboard (install counts, download analytics)
- [ ] Publisher namespaces (`publisher.plugin-name`)

---

## Stage 7: Cloud Platform & Accounts
**Demo:** "User registers, gets [user].app.worldwideview.dev, installs plugins from marketplace."

- [ ] `app.worldwideview.dev` — auth/register/dashboard
- [ ] Auto-provisioning on signup (tenant DB row → instance live immediately)
- [ ] RLS tenant isolation in PostgreSQL
- [ ] Cloud edition adapters (`auth.ts`, `storage.ts`, `tenant.ts`)
- [ ] Runtime settings store + setup wizard
- [ ] License key validation with RSA public key
- [ ] Tier gating (free/pro/enterprise feature flags)
- [ ] Cloudflare Turnstile + nginx rate limiting for bot prevention
- [ ] SSO: marketplace redirects to `app.worldwideview.dev` for login

---

## Stage 8: Built-In Data Services
**Demo:** "Aviation and maritime data with full history, served from api.worldwideview.dev."

- [ ] `api.worldwideview.dev` — aviation/maritime polling + persistence
- [ ] Redesign aviation as declarative plugin pointing to `api.worldwideview.dev`
- [ ] Redesign maritime the same way
- [ ] History/timeline with `%t` parameter substitution
- [ ] Snapshot capture (pro tier — counts toward storage quota)
- [ ] API key proxy with per-tenant-per-plugin rate limiting and response caching

---

## Stage 9: Trust Tiers, Extensions & Polish
**Demo:** "Install a verified extension plugin that adds cockpit view to aviation."

- [x] Ed25519-signed plugin registry (`GET /api/registry` on marketplace)
- [x] Server-side trust stamping at install time
- [x] Trust tier badges (`TrustBadge` component — Official / Verified / Unverified)
- [x] Unverified plugin warning dialog (`UnverifiedPluginDialog` + `useMarketplaceSync`)
- [ ] Extension plugin type support in `PluginManager`
- [ ] Activation events and contribution points
- [ ] Capability enforcement at runtime (`PluginPermissionError`)
- [ ] Web Worker sandboxing for unverified plugins (`comlink`)
- [ ] Reviews & ratings system
- [ ] Extension packs (bundles of related plugins)
- [ ] Auto-update mechanism (local: manual opt-in; cloud: automatic CDN swap)
- [ ] Plausible/Umami self-hosted analytics

---

## Stage 10: Infrastructure & Monetization
**Demo:** "Buy Pro, paste license key, unlock snapshot history and higher rate limits."

- [ ] Coolify on ThinkPad T480s — deploy all services
- [ ] Uptime Kuma monitoring (all subdomains)
- [ ] Stripe Checkout for license purchase
- [ ] Storage quota enforcement (cloud only)
- [ ] Stripe Connect for marketplace revenue split on paid plugins
- [ ] Cloudflare R2 as CDN for plugin bundles (`cdn.worldwideview.dev`)

---

## Resolved Architectural Decisions

| Decision | Resolution |
|---|---|
| **License** | EL2.0 for WorldWideView core; Open Source for marketplace |
| **Shared types** | `@worldwideview/plugin-sdk` npm package (MIT) |
| **Hosting** | Coolify (ThinkPad T480s). Landing page on Vercel (static export) |
| **Database** | Supabase PostgreSQL (cloud), SQLite (local), Prisma ORM |
| **Tenant isolation** | Row-Level Security (RLS) in shared PostgreSQL |
| **User settings** | Runtime settings store in DB, not `.env` |
| **Bot prevention** | Email verification + Cloudflare Turnstile + rate limiting |
| **Plugin execution** | Client-side (browser), not server-side |
| **Plugin architecture** | VS Code model — activation events, contribution points, namespaces |
| **Server-side compute** | Not supported — third-party backends handle compute |
| **Auth** | Auth.js on `app.worldwideview.dev`. `Credentials` (local), `@auth/supabase-adapter` (cloud). Marketplace uses SSO redirect |
| **Instance provisioning** | Auto-provision on signup — just a DB row insert |
| **API proxy** | `apikey` plugins routed through cached proxy, per-tenant-per-plugin rate limits |
| **History** | Third-party `historyUrl` with `%t` (all tiers), WWV snapshot capture (pro only) |
| **Built-in data** | Aviation/maritime → declarative plugins → `api.worldwideview.dev` |
| **CI/CD** | GitHub Actions → GHCR → Coolify webhook |
| **Plugin trust registry** | Ed25519-signed JSON, public key hardcoded in WWV, trust stamped server-side at install |
| **Package manager** | pnpm workspaces (migrated from npm) |
| **NPM submission flow** | Admin enters package name → marketplace infers manifest from `"worldwideview"` block in `package.json` |
| **NPM caching** | `NpmCache` table decouples marketplace from live NPM registry |
