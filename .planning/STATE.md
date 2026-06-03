---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: milestone
status: executing
last_updated: "2026-05-30T02:59:00.000Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

**Core Value:** Legally clean, resilient data pipelines that can swap providers at config time without code changes.

**Current Focus:** v1.3 Data Source Compliance -- replace non-compliant/broken data sources and add provider abstraction.

This is an ISOLATED worktree workspace. Its planning state is private to the
`feat/data-source-compliance` worktree and intentionally distinct from the shared root
(C:\dev\wwv\.planning).

Cross-feature docs (ROADMAP, MILESTONES, research) are NOT duplicated here.
See SHARED-DOCS.md for how to reach them.

## Current Position

**Milestone:** v1.3 Data Source Compliance  
**Status:** COMPLETE  
**Active Phase:** -  
**Active Plan:** -  

```
Progress: [##############] 100% (4/4 phases complete)
```

| Phase | Name | Status |
|-------|------|--------|
| 22 | Market-Tracker Provider Abstraction | COMPLETE (2 plans) |
| 23 | Aviation Seeder Migration to adsb.lol | COMPLETE (1 plan) |
| 24 | Undersea Cables Static Asset Swap | COMPLETE (1 plan) |

## Accumulated Context

### Key Decisions

| Decision | Rationale |
|---|---|
| adsb.lol free tier over AviationStack paid | IP ban makes OpenSky non-functional; adsb.lol is free, commercial-OK, same API shape as existing military-aviation seeder |
| Yahoo Finance stays as market-tracker default | No key required, works today; migration path is provider abstraction not immediate swap |
| iranwarlive left as-is | Feed endpoint is intentionally public; no explicit ToS = no contract to breach |
| Bundle TeleGeography GeoJSON statically | Cables update a few times/year; static file eliminates runtime proxy dependency entirely |
| Dropped all OpenSky infrastructure in one pass | No partial migration -- credential pool, OAuth rotation, Cloudflare proxy, node-cron, undici all removed together; adsb.lol requires none of it |
| origin_country and vertical_rate omitted from aviation snapshot | Not available from adsb.lol; frontend aviation plugin handles undefined gracefully |

### Architecture Notes

- Market-tracker providers: extract yahoo.ts from current impl, add finnhub.ts + polygon.ts, factory in providers/index.ts reads MARKET_PROVIDER env
- Aviation: military-aviation seeder (`local-seeders/community/packages/military-aviation/src/index.ts`) is the template -- already uses adsb.lol /v2/mil
- Cables: TeleGeography publishes open dataset on GitHub (CC BY 4.0). Attribution "Cable data: TeleGeography, CC BY 4.0" required in plugin UI
- Redis keys `aviation` and `market-tracker` must be preserved unchanged -- frontend plugins require zero changes

### Blockers

None.

### Todos

- [x] Phase 22 planned (2 plans, verified)
- [x] Execute Phase 22: implement market-tracker provider abstraction
- [x] Execute Phase 23: rewrite aviation seeder (324 lines -> 83 lines, adsb.lol)
- [x] Execute Phase 24: download TeleGeography GeoJSON, delete proxy route, update plugin fetch URL

## Session Continuity

**Next action:** v1.3 milestone complete. Open a PR to merge feat/data-source-compliance into main.

**References:**

- Compliance audit: `C:\dev\wwv\.planning\surveys\SURVEY-data-source-legality-2026-05-30.md`
- ROADMAP: `.planning/ROADMAP.md`
- REQUIREMENTS: `.planning/REQUIREMENTS.md`
- PROJECT: `.planning/PROJECT.md`
