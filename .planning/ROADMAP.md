# ROADMAP: WorldWideView v1.3 -- Data Source Compliance

**Milestone:** v1.3  
**Worktree:** feat/data-source-compliance  
**Core Value:** Legally clean, resilient data pipelines that can swap providers at config time without code changes.  
**Phase range:** 22-24 (continues from v1.2 which used phases 16-21)

---

## Phases

- [ ] **Phase 22: Market-Tracker Provider Abstraction** - Refactor the market-tracker seeder to select provider via env var, with yahoo as no-key default and finnhub/polygon activating on API key; gate searchable tickers on paid provider
- [ ] **Phase 23: Aviation Seeder Migration to adsb.lol** - Replace the broken OpenSky seeder (IP banned, non-commercial) with adsb.lol free tier, deleting ~250 lines of credential pool/OAuth/proxy code
- [ ] **Phase 24: Undersea Cables Static Asset Swap** - Delete the live submarinecablemap.com proxy API route and serve cables from a static TeleGeography CC BY 4.0 GeoJSON bundled in /public

---

## Phase Details

### Phase 22: Market-Tracker Provider Abstraction
**Goal**: The market-tracker seeder selects its quote provider via a single env var, with yahoo working out-of-the-box and finnhub/polygon activating when their respective API keys are present; searchable ticker functionality is gated behind a paid provider key with graceful degradation.  
**Depends on**: Nothing (self-contained seeder change)  
**Requirements**: MKTK-01, MKTK-02, MKTK-03, MKTK-04, MKTK-05  
**Key files**:
- `local-seeders/community/packages/market-tracker/src/providers/yahoo.ts` (extract from current impl)
- `local-seeders/community/packages/market-tracker/src/providers/finnhub.ts` (new, key-gated)
- `local-seeders/community/packages/market-tracker/src/providers/polygon.ts` (new, key-gated)
- `local-seeders/community/packages/market-tracker/src/providers/index.ts` (factory, reads MARKET_PROVIDER env)

**Success Criteria** (what must be TRUE):
  1. Running the seeder with no env vars set uses the yahoo provider and streams quotes without error
  2. Setting `MARKET_PROVIDER=finnhub` and `FINNHUB_API_KEY=<key>` causes the seeder to fetch from Finnhub and stream quotes
  3. Setting `MARKET_PROVIDER=polygon` and `POLYGON_API_KEY=<key>` causes the seeder to fetch from Polygon and stream quotes
  4. Requesting a ticker search without a paid provider key returns an empty list or a clear degradation message -- never an unhandled error
  5. `pnpm test` passes across all provider configurations

**Plans**: 2 plans
Plans:
- [ ] 22-01-PLAN.md -- Define MarketProvider interface + implement all three provider modules (yahoo, finnhub, polygon)
- [ ] 22-02-PLAN.md -- Create provider factory (providers/index.ts), refactor src/index.ts, update tests

### Phase 23: Aviation Seeder Migration to adsb.lol
**Goal**: The aviation seeder fetches live aircraft positions from adsb.lol /v2/aircraft with no authentication, the OpenSky credential pool and all associated proxy/OAuth code is deleted, and the frontend aviation plugin displays live aircraft unchanged.  
**Depends on**: Nothing (self-contained seeder change, Redis key and frontend plugin untouched)  
**Requirements**: AVIA-01, AVIA-02, AVIA-03, AVIA-04, AVIA-05  
**Key files**:
- `local-seeders/community/packages/aviation/src/index.ts` (full rewrite, ~324 lines -> ~80 lines)
- `local-seeders/community/packages/military-aviation/src/index.ts` (reference template -- already uses adsb.lol /v2/mil)

**Success Criteria** (what must be TRUE):
  1. The aviation seeder starts and fetches successfully from `https://api.adsb.lol/v2/aircraft` with no credentials configured
  2. The Redis key `aviation` is populated with aircraft records that match the existing snapshot shape (icao24, lat, lon, alt, speed, heading)
  3. The frontend aviation plugin displays live aircraft on the globe with no code changes to the plugin itself
  4. A 429 response from adsb.lol logs a warning and backs off instead of crashing the seeder
  5. No OpenSky credential pool, OAuth rotation, or Cloudflare proxy code remains in the seeder source

**Plans**: 1 plan
Plans:
- [ ] 23-01-PLAN.md -- Rewrite aviation seeder to fetch from adsb.lol, delete OpenSky credential pool

### Phase 24: Undersea Cables Static Asset Swap
**Goal**: The undersea cables plugin loads cable geometry from a static GeoJSON file bundled in /public, the live submarinecablemap.com proxy API route is deleted, and TeleGeography attribution is visible in the plugin UI.  
**Depends on**: Nothing (self-contained plugin + static asset change)  
**Requirements**: CABL-01, CABL-02, CABL-03, CABL-04  
**Key files**:
- `src/app/api/undersea-cables/route.ts` (DELETE)
- `local-plugins/wwv-plugin-undersea-cables/src/index.tsx` (change fetch URL to `/data/undersea-cables.geojson`)
- `public/data/undersea-cables.geojson` (CREATE from TeleGeography GitHub, CC BY 4.0)

**Success Criteria** (what must be TRUE):
  1. The undersea cables plugin loads and renders cable polylines on the globe by fetching `/data/undersea-cables.geojson` directly from the Next.js static asset server
  2. A request to `/api/undersea-cables` returns 404 (route file is gone)
  3. The attribution text "Cable data: TeleGeography, CC BY 4.0" is visible in the plugin description or info display
  4. No outbound request to submarinecablemap.com is made at runtime

**Plans**: 1 plan
Plans:
- [x] 24-01-PLAN.md -- Download TeleGeography GeoJSON, delete proxy route, update plugin URL and attribution

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Market-Tracker Provider Abstraction | 2/2 | COMPLETE | 2026-05-30 |
| 23. Aviation Seeder Migration to adsb.lol | 1/1 | COMPLETE | 2026-05-30 |
| 24. Undersea Cables Static Asset Swap | 1/1 | COMPLETE | 2026-05-30 |

---

## Coverage

**v1 requirements:** 14 total  
**Mapped:** 14/14  
**Unmapped:** 0

| Requirement | Phase |
|-------------|-------|
| MKTK-01 | Phase 22 |
| MKTK-02 | Phase 22 |
| MKTK-03 | Phase 22 |
| MKTK-04 | Phase 22 |
| MKTK-05 | Phase 22 |
| AVIA-01 | Phase 23 |
| AVIA-02 | Phase 23 |
| AVIA-03 | Phase 23 |
| AVIA-04 | Phase 23 |
| AVIA-05 | Phase 23 |
| CABL-01 | Phase 24 |
| CABL-02 | Phase 24 |
| CABL-03 | Phase 24 |
| CABL-04 | Phase 24 |

---

*Created: 2026-05-30*  
*Milestone: v1.3 Data Source Compliance*
