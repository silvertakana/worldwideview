---
trigger: model_decision
description: Human-centered design principles, stakeholder map, and decision matrix.
---

# Stakeholders & Human-Centered Design


> [!IMPORTANT]
> **This document is mandatory reading before any feature, UI, API, or architectural decision.**
> Every line of code in this project ultimately serves a human being. The AI agent MUST identify which stakeholder(s) a change affects and design the solution around their needs, abilities, and constraints — not the other way around.

---

## Why This Document Exists

Software that doesn't consider its humans fails. Not technically — socially. A plugin API that's elegant internally but hostile to external developers will die with zero third-party plugins. A monetization tier that ignores what users actually value will generate zero revenue. A contribution process that assumes PhD-level Cesium knowledge will attract zero contributors.

**The directive is simple:** Before you write code, ask *"Who is this for, what do they need, and what will they actually experience?"*

---

## The Stakeholder Universe

WorldWideView is not a single-user tool. It is a **platform ecosystem** with at least nine distinct human roles, each with different goals, different technical abilities, different emotional states when they interact with the product, and different definitions of "success."

```
                    ┌──────────────────┐
                    │   Owner / Founder │
                    │   (silvertakana)  │
                    └────────┬─────────┘
                             │ vision, architecture, deployment
         ┌───────────────────┼───────────────────┐
         │                   │                   │
  ┌──────┴──────┐   ┌───────┴───────┐   ┌───────┴───────┐
  │  Core Devs  │   │ Contributors  │   │  Plugin Devs  │
  │  (team)     │   │ (community)   │   │ (3rd party)   │
  └──────┬──────┘   └───────┬───────┘   └───────┬───────┘
         │                   │                   │
         └───────────┬───────┘                   │
                     │ build the product          │ extend the product
         ┌───────────┴────────────────────────────┘
         │
  ┌──────┴──────────────────────────────────┐
  │            The Application              │
  │  ┌────────┐  ┌────────┐  ┌───────────┐ │
  │  │ Demo   │  │ Local  │  │  Cloud    │ │
  │  │Instance│  │Instance│  │ Instance  │ │
  │  └───┬────┘  └───┬────┘  └─────┬─────┘ │
  └──────┼───────────┼─────────────┼────────┘
         │           │             │
  ┌──────┴──┐  ┌─────┴────┐  ┌────┴─────┐
  │Casual   │  │Power User│  │Paying    │
  │Visitor  │  │(self-host)│  │Customer  │
  └─────────┘  └──────────┘  └────┬─────┘
                                   │
                          ┌────────┴────────┐
                          │  Advertisers    │
                          │  (demo edition) │
                          └─────────────────┘
```

---

## Stakeholder Profiles

### 1. Owner / Founder (silvertakana)

| Attribute | Description |
|---|---|
| **Role** | Solo founder, architect, deployer, and operator of the entire ecosystem |
| **Goal** | Build a sustainable, revenue-generating geospatial intelligence platform that rivals WorldMonitor |
| **Motivations** | Technical excellence, creative ownership, financial independence, community building |
| **Technical Ability** | Expert — TypeScript, Next.js, CesiumJS, Docker, infrastructure, Prisma, AI-assisted development |
| **Emotional State** | Ambitious but resource-constrained; every wasted hour counts double |
| **Definition of Success** | Growing user base, marketplace with active plugin developers, recurring revenue, industry recognition |
| **Pain Points** | Single point of failure for ops, deployment, and architecture decisions; time pressure; hosting cost sensitivity ($0/mo target) |
| **Interaction Surface** | `.agents/` rules, ROADMAP.md, Coolify dashboard, code reviews, AI pair-programming sessions |

**Design implications:**
- Automation is critical — CI/CD, self-healing databases, zero-config setup
- AI agent rules must preserve the owner's vision even when the owner isn't in the conversation
- Cost-efficient architecture (PostgreSQL, ThinkPad server, free-tier services) is a feature, not a compromise
- Every architectural decision must consider the owner's ability to maintain it solo

---

### 2. Core Development Team (WWV Devs)

| Attribute | Description |
|---|---|
| **Role** | Trusted developers with direct commit access to the monorepo |
| **Goal** | Ship features quickly without breaking existing functionality |
| **Motivations** | Clean code, clear architecture, fast iteration, not getting paged at 2am |
| **Technical Ability** | High — comfortable with TypeScript, Next.js App Router, Zustand, pnpm workspaces |
| **Emotional State** | Productive when patterns are clear; frustrated by undocumented gotchas |
| **Definition of Success** | PRs merged cleanly, features work on first deploy, zero regressions |
| **Pain Points** | File bloat (>150 lines), implicit state dependencies, CesiumJS rendering quirks, Docker build complexity |
| **Interaction Surface** | `src/core/`, `src/components/`, `packages/`, PR reviews, `pnpm dev` |

**Design implications:**
- 150-line file limit is sacred — enforce it in every code change
- Clear slice boundaries in Zustand store prevent cross-team conflicts
- `AGENTS.md` and `.agents/` context must always be current so that AI-augmented devs have accurate context
- Rendering rules (billboard vs. point, never mix properties) must be enforced systematically
- Docker gotchas documented in `06-dev-workflows.md` prevent time-sink debugging

---

### 3. Open Source Contributors

| Attribute | Description |
|---|---|
| **Role** | External developers who fork, fix bugs, add features, or create plugins via PRs |
| **Goal** | Contribute meaningfully without needing to understand the entire 50-package monorepo |
| **Motivations** | Portfolio building, learning CesiumJS/geospatial tech, improving a tool they use, open source goodwill |
| **Technical Ability** | **Variable** — ranges from junior devs submitting typo fixes to senior engineers contributing optimizations |
| **Emotional State** | Enthusiastic but easily discouraged by onboarding friction; will abandon contribution if setup takes >15 minutes |
| **Definition of Success** | PR accepted and merged; their name in the contributors list; feature actually ships |
| **Pain Points** | Complex monorepo, CesiumJS learning curve, Elastic License 2.0 implications, unclear "where to start" |
| **Interaction Surface** | `CONTRIBUTING.md`, `docs/SETUP.md`, `docs/PLUGIN_GUIDE.md`, GitHub Issues, PR templates |

**Design implications:**
- **One-command setup** (`pnpm run setup && pnpm dev:all`) is non-negotiable — if it breaks, contributors leave
- `CONTRIBUTING.md` must use `pnpm` (currently shows `npm` in places — this is a bug)
- "Good first issue" labels on GitHub attract newcomers
- Plugin creation is the #1 entry point for contributors — the scaffold script and Plugin Guide must be flawless
- The Elastic License 2.0 must be clearly communicated (it's NOT fully open source — contributors need to understand what they're signing up for)

---

### 4. Third-Party Plugin Developers

| Attribute | Description |
|---|---|
| **Role** | External developers who build and publish plugins to the WorldWideView Marketplace |
| **Goal** | Create a plugin that integrates their data source, potentially monetize it |
| **Motivations** | Revenue (marketplace cut), reach (installed on many WWV instances), reputation, data evangelism |
| **Technical Ability** | **Mid-to-high** — comfortable with TypeScript and npm, but NOT Cesium experts. They should never need to learn Cesium internals. |
| **Emotional State** | Evaluating whether the platform is worth investing development time in. Extremely sensitive to DX friction. |
| **Definition of Success** | Plugin published, visible in marketplace, installed by users, data renders correctly, optional revenue stream |
| **Pain Points** | (1) Backend hosting burden — they need a VPS for active plugins (the "VPS Problem"), (2) No distributable mini-engine yet, (3) SDK docs may not cover edge cases, (4) Rendering bugs with billboard/point property mixing |
| **Interaction Surface** | `@worldwideview/wwv-plugin-sdk`, `docs/PLUGIN_GUIDE.md`, `docs/creating-a-plugin.md`, marketplace submission UI, npm publishing |

**Design implications:**
- The Plugin SDK is the **#1 most important public API surface** — it must be impeccably documented, versioned, and stable
- `WorldPlugin` interface changes are breaking changes that affect real people with real published packages
- Three plugin formats (Declarative, Static, Code Bundle) exist specifically to lower the barrier:
  - **Declarative** = zero code (JSON only) — anyone with a data URL can create a plugin
  - **Static** = GeoJSON file + manifest — data analysts who aren't developers
  - **Code Bundle** = full TypeScript — professional developers
- The future **Mini-Engine Docker image** (§3 of `03-plugin-system.md`) is critical for reducing the VPS burden
- Rendering must be abstracted — plugin devs define `renderEntity()`, and the engine handles GPU batching
- Error messages from the plugin lifecycle must be clear, not cryptic Cesium stack traces
- Marketplace analytics (install counts, usage) are what keep plugin developers motivated

---

### 5. Casual Visitors (Demo Users)

| Attribute | Description |
|---|---|
| **Role** | Anonymous visitors who land on `demo.worldwideview.dev` — no account, no setup |
| **Goal** | Explore the globe, see cool real-time data, understand what WorldWideView is |
| **Motivations** | Curiosity, news events (war, natural disasters, flight tracking), linked from social media or Reddit |
| **Technical Ability** | **Low to none** — they don't know what ADS-B or GeoJSON means. They just want to see planes on a globe. |
| **Emotional State** | Impatient. They will leave within 10 seconds if the globe doesn't load or the UI is confusing.  |
| **Definition of Success** | "Whoa, this is cool" → bookmark/share → return later → potentially convert to self-host or cloud user |
| **Pain Points** | Slow boot time (Cesium asset loading), confusing UX, data not loading (API rate limits), ads disrupting experience |
| **Interaction Surface** | Boot overlay, 3D globe, layer toggle panel, entity hover/click, info cards, timeline, ad strip |

**Design implications:**
- **First 5 seconds are everything** — the boot overlay must feel cinematic, not broken
- Pre-activate compelling default layers (aviation is the universal crowd-pleaser)
- Globe interaction must work without instructions — left-click drag, scroll zoom, click entity
- The "Why ads?" banner (`DemoAdStrip`) is a trust-building honesty moment — keep it human and transparent
- Mobile layout must be flawless — many demo visitors come from social media on phones
- No login walls, no setup wizards, no configuration prompts — demo is zero-friction
- Performance on commodity hardware (integrated GPUs, 2017 laptops) must be acceptable
- Error states must be invisible — if OpenSky is down, the layer just shows fewer planes, not an error dialog

---

### 6. Self-Hosted Power Users (Local Edition)

| Attribute | Description |
|---|---|
| **Role** | Technical users who run WorldWideView on their own hardware (Raspberry Pi, home server, VPS) |
| **Goal** | Full control over their own geospatial intelligence dashboard, no cloud dependency |
| **Motivations** | Privacy, customization, data sovereignty, OSINT hobbyism, professional intelligence work |
| **Technical Ability** | **High** — comfortable with Docker, environment variables, CLI tools, possibly contributing plugins |
| **Emotional State** | Empowered but demanding. They chose self-hosting for a reason — they expect it to work without phoning home. |
| **Definition of Success** | Instance running 24/7, plugins installed and polling reliably, data persisted locally, zero external dependencies |
| **Pain Points** | Docker build complexity, PostgreSQL connection pooling issues, Cesium token setup, Prisma migration gotchas, plugin data not loading |
| **Interaction Surface** | `docker-compose.yml`, `.env.local`, Setup Wizard, Layers Panel, Config Panel, Marketplace Bridge, `pnpm run dev:all` |

**Design implications:**
- **Zero-config first run** — `pnpm run setup && pnpm dev` or `docker-compose up` must "just work"
- The Setup Wizard (Cesium token prompt) is the ONLY mandatory configuration step — minimize it
- PostgreSQL must handle concurrent reads from the app + data engine efficiently
- Self-hosted users are the most likely to become contributors — treat their issues as high-priority
- Data engine self-healing (fallback seeds) ensures restarts don't lose data
- Offline capability is a differentiator — cached entities in IndexedDB survive network outages
- `NEXT_PUBLIC_WWV_EDITION=local` must be the default, most-tested path

---

### 7. Paying Customers (Cloud Pro/Enterprise)

| Attribute | Description |
|---|---|
| **Role** | Users or organizations paying for `[user].app.worldwideview.dev` — the revenue engine |
| **Goal** | Reliable, always-on geospatial intelligence with history, higher rate limits, and team access |
| **Motivations** | Professional OSINT, military/defense analysis, logistics monitoring, journalism, corporate security |
| **Technical Ability** | **Variable** — from journalists who just need a globe to security analysts who want API access |
| **Emotional State** | **Paying customers have the lowest tolerance for bugs.** They expect enterprise-grade uptime and support. |
| **Definition of Success** | Data is live, history works, team members can access, exports work, it doesn't go down |
| **Pain Points** | Downtime, stale data, missing features compared to competitors, unclear what "Pro" actually gives them |
| **Interaction Surface** | Cloud dashboard, license key input, plugin marketplace, support channels, billing UI |

**Design implications:**
- **Uptime is king** — Uptime Kuma monitoring, error alerting, and rollback procedures exist for this reason
- Tier differentiation must be clear and valuable:
  - Free: 3 users, 500MB, 24h history
  - Pro: 20 users, 5GB, full history, snapshot capture
  - Enterprise: unlimited, 50GB+, custom domains
- License key verification (RSA-signed JWT) prevents forgery but must not be onerous UX
- RLS tenant isolation is non-negotiable — data leaks between tenants are existential
- Response caching at the API proxy layer makes the $0/mo server viable for multiple tenants
- The cloud edition must feel **identical** to local — same UI, same plugins, same experience

---

### 8. Advertisers (Demo Edition Revenue)

| Attribute | Description |
|---|---|
| **Role** | Google AdSense (programmatic) — automated ad placement on the demo instance |
| **Goal** | Display relevant ads to engaged visitors, generate clicks/impressions |
| **Motivations** | ROI on ad spend; relevant audience targeting |
| **Technical Ability** | N/A — they interact through Google's ad platform, not with WWV directly |
| **Emotional State** | N/A — algorithmic. But their platform (AdSense) has strict technical requirements. |
| **Definition of Success** | Ads render correctly, non-intrusively, on viewable screen real estate |
| **Pain Points** | AdSense script crashes on resize, ads failing to fill on localhost/tunnels, ads overlapping interactive content |
| **Interaction Surface** | `DemoAdStrip.tsx`, `AdUnit.tsx`, Google AdSense publisher dashboard |

**Design implications:**
- Ad strip is a **structurally separate sibling container** — never overlaps the globe viewport
- Fixed-position elements (header, timeline, sidebars) use `--ad-strip-inset` CSS variable to avoid overlap
- AdSense `push()` errors on resize are handled by fully unmounting ad units below 850px height
- Ads are **demo edition only** — they never appear in local or cloud editions
- The "Why ads?" banner is a conscious UX choice that builds trust with users and is dismissible
- Ad revenue is a temporary bridge to sustainability, not the long-term business model

---

### 9. Data Source Providers (Upstream APIs)

| Attribute | Description |
|---|---|
| **Role** | External services that provide the raw data: OpenSky, AIS providers, NASA FIRMS, ACLED, CelesTrak, GPSJam, etc. |
| **Goal** | Serve data within their rate limits and terms of service |
| **Motivations** | Open data mission (NASA, CelesTrak), freemium conversion (OpenSky), research community |
| **Technical Ability** | N/A — they expose APIs; WWV consumes them |
| **Emotional State** | Hostile if rate-limited. Neutral if respected. |
| **Definition of Success** | API consumers stay within rate limits, attribute correctly, and don't DDOS their endpoints |
| **Pain Points** | Credential rotation failures (OpenSky), rate limit exhaustion, unattributed scraping |
| **Interaction Surface** | Data Engine seeders, API route proxies, `OPENSKY_CREDENTIALS` rotation, `pollingIntervalMs` settings |

**Design implications:**
- **Respect upstream rate limits** — this is an ethical and practical obligation
- Credential rotation (`OPENSKY_CREDENTIALS` comma-separated pairs) prevents per-key throttling
- The Data Engine's 5-minute Redis throttle (`setLiveSnapshot`) is specifically designed to stay within Upstash free-tier limits
- API proxy caching (1000 users → 1 upstream request) is architecturally essential
- Attribution (e.g., "Data: OpenSky Network") should be visible in entity detail panels
- Graceful degradation when APIs go down — show cached data, not error modals

---

## The Stakeholder Decision Matrix

When making any decision, use this matrix to identify impact:

| Decision Area | Owner | Core Devs | Contributors | Plugin Devs | Casual Visitors | Power Users | Paying Customers | Advertisers | Data Providers |
|---|---|---|---|---|---|---|---|---|---|
| **Plugin SDK change** | ⚠️ | ⚠️ | ⬜ | 🔴 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **UI/UX redesign** | ⚠️ | ⬜ | ⬜ | ⬜ | 🔴 | ⚠️ | 🔴 | ⚠️ | ⬜ |
| **Rendering pipeline change** | ⚠️ | 🔴 | ⬜ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⬜ | ⬜ |
| **Database schema migration** | ⚠️ | ⚠️ | ⬜ | ⬜ | ⬜ | 🔴 | 🔴 | ⬜ | ⬜ |
| **New data source plugin** | ✅ | ⬜ | ✅ | ⬜ | ✅ | ✅ | ✅ | ⬜ | ⚠️ |
| **Pricing/tier change** | 🔴 | ⬜ | ⬜ | ⚠️ | ⬜ | ⚠️ | 🔴 | ⬜ | ⬜ |
| **Ad placement change** | ⚠️ | ⬜ | ⬜ | ⬜ | ⚠️ | ⬜ | ⬜ | 🔴 | ⬜ |
| **API rate limit adjustment** | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⚠️ | ⬜ | 🔴 |
| **Marketplace policy** | 🔴 | ⬜ | ⬜ | 🔴 | ⬜ | ⬜ | ⚠️ | ⬜ | ⬜ |
| **Docker/deployment change** | 🔴 | ⚠️ | ⬜ | ⬜ | ⬜ | 🔴 | ⚠️ | ⬜ | ⬜ |
| **License change** | 🔴 | ⚠️ | 🔴 | 🔴 | ⬜ | ⚠️ | ⬜ | ⬜ | ⬜ |

**Legend:** 🔴 = Primary impact (design for this person) | ⚠️ = Secondary impact (consider carefully) | ✅ = Positive impact | ⬜ = Minimal/no impact

---

## The Golden Rules

### 1. Every Feature Has a Human

Before writing a single line of code, the AI agent MUST answer:
- **WHO** is this for? (Name the stakeholder)
- **WHY** do they need it? (What problem does it solve for them?)
- **HOW** will they discover/use it? (What's their journey?)
- **WHAT** happens when it breaks? (Graceful degradation plan)

### 2. Reduce Friction, Not Features

The most dangerous failure mode is building powerful systems with hostile interfaces. Apply the **Principle of Least Effort**:
- Contributors: one-command setup, not a wiki page of prerequisites
- Plugin devs: `renderEntity()` returns an object, not a Cesium Primitive
- Casual visitors: zero onboarding, zero configuration
- Power users: sensible defaults, optional configuration
- Paying customers: it just works, always

### 3. Design for the Least Technical User in Each Cohort

| Cohort | Least Technical Member | Design Target |
|---|---|---|
| Plugin Developers | Data analyst who can write JSON | Declarative plugin format |
| Contributors | Junior dev on their first open source PR | Scaffold scripts + clear CONTRIBUTING.md |
| Casual Visitors | Non-technical person who followed a Twitter link | Auto-loading layers, intuitive globe controls |
| Power Users | Sysadmin who can `docker-compose up` but doesn't know Next.js | Pre-built Docker images, `.env` only config |
| Paying Customers | Journalist tracking a conflict | Clear UI, no jargon, exportable data |

### 4. Protect the Ecosystem Trust

The trust hierarchy is cryptographically enforced (Ed25519 signed registry), but trust is also social:
- **Built-in plugins** must always work — they're the first impression
- **Verified plugins** carry WorldWideView's reputation — review them seriously
- **Unverified plugins** get a warning dialog — users make informed decisions
- **Plugin developers** who see installs and analytics stay motivated
- **Data providers** who aren't rate-limit abused will keep serving data

### 5. Revenue Serves Sustainability, Not Extraction

The business model exists to keep the project alive:
- Ads on demo = temporary hosting cost recovery (transparent "Why ads?" banner)
- Cloud Pro = value exchange (history, higher limits, team access)
- Marketplace cut = sustainable ecosystem (Stripe Connect revenue split)
- Plugin developer monetization = VS Code model (developers set their own prices)

Never design a feature that extracts value from users without returning it. The demo must always be useful, not crippled.

---

## Applying This Document

### For the AI Agent

When the agent is asked to implement a feature, modify architecture, or solve a bug, it MUST:

1. **Identify affected stakeholders** from the list above
2. **Consider the least-technical user** in each affected cohort
3. **Check the decision matrix** for impact severity
4. **Apply the golden rules** to the implementation approach
5. **Document stakeholder considerations** in PR descriptions and implementation plans

### For Human Developers

When reviewing PRs or proposing features, ask:
- "Did we consider how this affects plugin developers?"
- "Will a first-time contributor understand this?"
- "Does this work on the demo without configuration?"
- "Will this survive a Docker restart on the ThinkPad?"

---

## Version History

| Date | Change |
|---|---|
| 2026-04-05 | Initial stakeholder map created from comprehensive project research |
