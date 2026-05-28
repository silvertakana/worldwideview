# Phase 4 Coolify Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the production WorldWideView data engine from "auth disabled" (`WWV_SKIP_WS_AUTH=true`) to "auth enforced" (`JWKS_URL` set + ticket-auth plugin allowlist enumerated) in a single atomic redeploy window, with smoke tests proving every plugin still works.

**Architecture:** Pure ops change — no source code modifications. Two Coolify services receive env-var updates (`wwv-data-engine` and `wwv` frontend), both are redeployed near-simultaneously, smoke-tested through the live UI. Rollback is a single env-var revert + redeploy.

**Tech Stack:** Coolify CLI (context `wwv` pre-configured), `curl` for registry/JWKS probing, optional SSH to the host for low-level diagnostics. No code, no tests, no commits — only env config + deploy actions.

---

## Context — why this plan exists

Phase 4 of the Northstar Sequence shipped the data engine's WebSocket JWT enforcement code (engine-side: PR #10 merged on `wwv-data-engine`; frontend ticket-issuance and PKCE flow merged earlier in worldwideview/marketplace). The enforcement is currently **dormant** in production because the Coolify env still has `WWV_SKIP_WS_AUTH=true`, which the engine reads at boot to bypass first-message auth.

Local end-to-end testing in the prior session proved the full chain works:
- PKCE → marketplace API key (encrypted in `MarketplaceCredential`)
- `/api/auth/ticket` → 5-min EdDSA JWT signed by marketplace
- WebSocket first frame: `{type:"auth", v:1, token}` → engine validates against marketplace JWKS → `welcome` → subscribe → data flows

The pre-mortem identified four tigers blocking the cutover. The companion plan (`joyful-napping-gizmo.md`) addresses three via CI hardening and the `BaseIncidentPlugin` payload fix. **This plan handles the remaining tiger (T3 — production JWKS reachability never verified) and the elephants (E1 — plugin enumeration never done, E2 — current Coolify state unknown), then performs the actual flip.**

**Prerequisites — the companion plan must be fully landed:**
- PR1 `feat/ci-coverage-phase4` merged on `wwv-data-engine` main (CI guards live)
- PR2 `test/base-incident-plugin-payload` merged on `worldwideview` main (test guards live)
- PR3 `fix/base-incident-plugin-payload` merged on `worldwideview` main (earthquakes data fix live)
- Worldwideview Coolify service has redeployed since PR3 landed (so the new frontend bundle contains the `mapWebsocketPayload` fix)

Without PR3 deployed, enabling Earthquakes in the cutover allowlist will show an empty layer — the test we ran locally would re-occur in production.

---

## File Structure

This plan modifies **zero source files**. All changes are Coolify env-var updates plus the documents created during audit:

| Path | Role | Lifecycle |
|---|---|---|
| `C:\Users\silve\.claude\plans\coolify-baseline-<timestamp>.md` | Captured baseline of current Coolify env state (rollback reference) | created in Task 3 |
| `C:\Users\silve\.claude\plans\coolify-cutover-allowlist-<timestamp>.md` | Computed plugin allowlist (CSV + rationale) | created in Task 4 |
| `worldwideview/docs/architecture/decisions/adr-0001b-status.md` *(optional)* | ADR-001B status update — Proposed → Accepted | Task 13 (post-success only) |

The Coolify services touched:
- **`wwv-data-engine`** — set `JWKS_URL`, remove `WWV_SKIP_WS_AUTH`
- **`wwv`** (the worldwideview frontend) — set `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS`

---

## Task 1: Confirm prerequisites are live in production

**Files:** none. Read-only verification.

- [ ] **Step 1: Verify all three companion-plan PRs are merged**

```powershell
gh pr list --repo silvertakana/wwv-data-engine --state merged --limit 5
gh pr list --repo silvertakana/worldwideview --state merged --limit 5
```

Expected: see merged PRs titled `test(auth): Phase 4 WebSocket auth + port-contract CI guards` (wwv-data-engine), `test(incidents): guard BaseIncidentPlugin WebSocket payload contract` and `fix(incidents): add mapWebsocketPayload default to BaseIncidentPlugin` (worldwideview). If any is missing, STOP — return to the companion plan.

- [ ] **Step 2: Verify the worldwideview Coolify deploy includes PR3**

```powershell
coolify deploy status wwv
```

Expected: `last deploy` timestamp is AFTER PR3 merge. If older, trigger a redeploy first:

```powershell
coolify deploy trigger wwv
```

Wait for completion (`coolify deploy status wwv --watch`). The cutover later will trigger this again, but verifying the fix is deployed BEFORE the cutover ensures we can isolate any failure to env vs. code.

- [ ] **Step 3: Confirm the data engine code already has Phase 4 (PR #10)**

```powershell
curl https://dataenginev2.worldwideview.dev/health
```

Expected: JSON with `version: "1.7.3"` (or newer if CI tests bumped further). If `1.7.1` or earlier, PR #10 is not deployed — STOP.

---

## Task 2: Verify the marketplace JWKS endpoint is reachable from the public internet

**Files:** none.

- [ ] **Step 1: Curl from the local workstation**

```powershell
curl -v https://marketplace.worldwideview.dev/api/auth/jwks
```

Expected: HTTP 200, body is JSON like `{"keys":[{"kty":"OKP","crv":"Ed25519","x":"...","kid":"marketplace-key-v1","alg":"EdDSA"}]}`. If 404/500/timeout → STOP, fix the marketplace before continuing.

- [ ] **Step 2: Validate the JWK shape**

The response must include at least one key with `kty: "OKP"`, `crv: "Ed25519"`, `alg: "EdDSA"`, and a non-empty `kid`. If any of those are missing, the engine's `verifyEngineToken` will reject every token with "no applicable key found" — same symptom as our local test isolation bug. STOP if shape is wrong.

---

## Task 3: Capture Coolify baseline (rollback reference)

**Files:**
- Create: `C:\Users\silve\.claude\plans\coolify-baseline-<YYYYMMDD-HHMMSS>.md`

- [ ] **Step 1: Dump current data engine env vars**

```powershell
coolify env list wwv-data-engine
```

- [ ] **Step 2: Dump current frontend env vars**

```powershell
coolify env list wwv
```

- [ ] **Step 3: Save baseline to file**

Create `C:\Users\silve\.claude\plans\coolify-baseline-<YYYYMMDD-HHMMSS>.md` with the exact current values of these keys (copy from the `coolify env list` output):

```markdown
# Coolify baseline — captured <ISO timestamp>

## wwv-data-engine
- JWKS_URL: <current value or "(unset)">
- WWV_SKIP_WS_AUTH: <current value or "(unset)">
- ENGINE_ID: <current value or "(unset)">
- REDIS_URL: <redacted — confirm present>
- SENTRY_DSN: <redacted — confirm present>

## wwv (frontend)
- NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS: <current value or "(unset)">
- NEXT_PUBLIC_WWV_PLUGIN_DATA_ENGINE_URL: <current value>
- NEXT_PUBLIC_WWV_MARKETPLACE_URL: <current value>
- NEXT_PUBLIC_WWV_EDITION: <current value>

## Rollback procedure
If anything breaks during/after cutover:
1. coolify env set wwv-data-engine WWV_SKIP_WS_AUTH=true
2. coolify env unset wwv-data-engine JWKS_URL (or set to "(unset)" value above)
3. coolify env unset wwv NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS (or restore "(unset)" value above)
4. coolify deploy trigger wwv-data-engine
5. coolify deploy trigger wwv
6. curl https://dataenginev2.worldwideview.dev/health — confirm version unchanged, engine running
```

This file is the **single source of truth** for rollback. Do not skip it.

---

## Task 4: Compute the plugin allowlist from the live data engine manifest

**Files:**
- Create: `C:\Users\silve\.claude\plans\coolify-cutover-allowlist-<YYYYMMDD-HHMMSS>.md`

- [ ] **Step 1: Fetch the live manifest from production**

```powershell
curl https://dataenginev2.worldwideview.dev/manifest
```

Expected: JSON like `{"engine":"wwv-data-engine","version":"1.7.3","plugins":["earthquakes","wildfires","sanctions","conflict-events","gps-jamming","cyber-attacks","civil-unrest","iss","satellites","aviation-history","maritime-history","iranwar-events"],"websocket":"/stream","timestamp":...}`. The exact list will vary — capture whatever is returned.

- [ ] **Step 2: Build the CSV**

Take the `plugins` array from the response and join with commas (no spaces). Example:

```
earthquakes,wildfires,sanctions,conflict-events,gps-jamming,cyber-attacks,civil-unrest,iss,satellites,aviation-history,maritime-history,iranwar-events
```

- [ ] **Step 3: Cross-check against the marketplace verified registry (sanity)**

```powershell
curl https://marketplace.worldwideview.dev/api/registry
```

Compare the engine manifest's plugin IDs against the registry's verified IDs. Note any discrepancies:
- Manifest plugins NOT in registry → in-house seeders not advertised on marketplace (fine, still need auth)
- Registry plugins NOT in manifest → marketplace-only or static plugins (fine, don't need auth)

The **engine manifest is authoritative** for the allowlist — anything that streams from this engine needs to be there.

- [ ] **Step 4: Save the computed allowlist**

Create `C:\Users\silve\.claude\plans\coolify-cutover-allowlist-<YYYYMMDD-HHMMSS>.md`:

```markdown
# Phase 4 Coolify cutover — plugin allowlist

Captured from: https://dataenginev2.worldwideview.dev/manifest at <ISO timestamp>

## Allowlist (CSV form for NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS)

<the CSV from Step 2>

## Per-plugin rationale

| Plugin | In manifest | In registry | Action |
|---|---|---|---|
| earthquakes | yes | yes | include |
| wildfires | yes | yes | include |
| <one row per plugin> | | | |

## Notes
- Engine manifest is authoritative.
- Registry sanity-checked at Step 3 — discrepancies noted above.
```

---

## Task 5: Smoke-test JWKS reachability FROM the production data engine container

**Files:** none.

The engine's startup check (`startup-checks.ts`) verifies JWKS is reachable at boot — but a one-shot check at boot doesn't catch transient network policy issues that appear later. Pre-flight this from inside the actual container to catch firewall/DNS surprises.

- [ ] **Step 1: Exec into the container via Coolify**

```powershell
coolify exec wwv-data-engine -- curl -v https://marketplace.worldwideview.dev/api/auth/jwks
```

If `coolify exec` is not available, fall back to SSH:

```bash
ssh root@<coolify-host>
docker exec -it $(docker ps --filter "name=wwv-data-engine" -q) curl -v https://marketplace.worldwideview.dev/api/auth/jwks
```

The Coolify host IP is in your server-dev memory; if unsure, run `coolify host info`.

- [ ] **Step 2: Verify the response**

Expected: HTTP 200, same JWKS body as Task 2 Step 1. If the local workstation can reach JWKS but the container cannot, you have a Coolify network policy issue (egress firewall, DNS) — STOP and fix the network before continuing.

---

## Task 6: Set the new env vars on Coolify (no redeploy yet)

**Files:** none. Coolify state-only.

Setting env vars in Coolify does NOT trigger a deploy by default — the new values take effect at the next start. We set BOTH services' new env vars first, then trigger redeploys near-simultaneously so the atomic-flip window is small.

- [ ] **Step 1: Set `JWKS_URL` on the data engine**

```powershell
coolify env set wwv-data-engine JWKS_URL=https://marketplace.worldwideview.dev/api/auth/jwks
```

Expected: confirmation message. Verify with `coolify env get wwv-data-engine JWKS_URL`.

- [ ] **Step 2: Remove (or set false) `WWV_SKIP_WS_AUTH` on the data engine**

```powershell
coolify env unset wwv-data-engine WWV_SKIP_WS_AUTH
```

(If `unset` is not supported, use `coolify env set wwv-data-engine WWV_SKIP_WS_AUTH=false` — the engine reads `=== 'true'` so anything else is treated as enforcement-on.)

Verify with `coolify env get wwv-data-engine WWV_SKIP_WS_AUTH` — should return empty/false.

- [ ] **Step 3: Set `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` on the frontend**

Use the CSV from Task 4 Step 2. Example:

```powershell
coolify env set wwv NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS=earthquakes,wildfires,sanctions,conflict-events,gps-jamming,cyber-attacks,civil-unrest,iss,satellites,aviation-history,maritime-history,iranwar-events
```

Verify with `coolify env get wwv NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` — should return the CSV verbatim.

- [ ] **Step 4: Cross-check the saved values against the baseline file**

Open `C:\Users\silve\.claude\plans\coolify-baseline-<...>.md` and confirm the three values you just changed are different from baseline. This is the "I really did change them" sanity check.

---

## Task 7: Trigger redeploys for both services

**Files:** none.

Both redeploys should be triggered as close together as possible (within ~1 minute) so the user-facing flip is single-window. Coolify deploys are non-blocking; we trigger both then watch both.

- [ ] **Step 1: Trigger data engine deploy**

```powershell
coolify deploy trigger wwv-data-engine
```

Capture the deploy ID printed.

- [ ] **Step 2: Trigger frontend deploy**

```powershell
coolify deploy trigger wwv
```

Capture the deploy ID printed.

- [ ] **Step 3: Watch both deploys complete**

In one terminal:
```powershell
coolify deploy status wwv-data-engine --watch
```

In another (parallel):
```powershell
coolify deploy status wwv --watch
```

Expected: both reach `running` state within ~3-5 minutes. The data engine log will show `[Server] JWKS reachable at https://marketplace.worldwideview.dev/api/auth/jwks` — that is the moment enforcement goes live.

- [ ] **Step 4: STOP and rollback if either deploy fails**

If `wwv-data-engine` startup fails with `FATAL: JWKS unreachable at startup`, the network/JWKS smoke (Task 5) gave a false positive. Rollback immediately (Task 12) and investigate before retrying.

If `wwv` build fails, the env var format may be wrong (Coolify can sometimes mangle commas) — check the build log and re-set the env var with proper escaping.

---

## Task 8: Post-deploy smoke — engine endpoints

**Files:** none.

- [ ] **Step 1: Health check**

```powershell
curl https://dataenginev2.worldwideview.dev/health
```

Expected: `{"status":"ok","engine":"wwv-data-engine","timestamp":<recent>,"seeders":{...}}`. The `seeders` object should list every plugin in the manifest with a recent `lastSuccess` timestamp.

- [ ] **Step 2: Manifest check**

```powershell
curl https://dataenginev2.worldwideview.dev/manifest
```

Expected: same plugin list as Task 4 Step 1 (no regression). If a plugin dropped out, a seeder failed to load — investigate before continuing.

---

## Task 9: Post-deploy smoke — WebSocket auth handshake (curl-based)

**Files:** none.

Confirms enforcement is actually ON before testing the UI.

- [ ] **Step 1: Attempt unauthenticated WebSocket connection**

```powershell
# Use websocat or wscat — install via: pnpm dlx wscat
pnpm dlx wscat -c wss://dataenginev2.worldwideview.dev/stream
```

Then send (paste into the open prompt):
```
{"action":"subscribe","pluginId":"earthquakes"}
```

Expected: connection closes immediately with code `4003`. If the connection stays open and you receive data, **enforcement is NOT active** — the env var didn't apply, restart the data engine via `coolify deploy trigger wwv-data-engine` and retry.

---

## Task 10: Post-deploy smoke — UI walkthrough (the real test)

**Files:** none.

- [ ] **Step 1: Open the production app in a browser**

Navigate to `https://worldwideview.dev` (or whatever the production frontend URL is). Sign in if not already.

- [ ] **Step 2: Open browser DevTools — Network tab, filter "WS"**

You'll see WebSocket connections appear as you enable plugins.

- [ ] **Step 3: Enable EACH plugin in the allowlist, one at a time**

For each plugin in the CSV from Task 4:
1. Enable it via the UI control (sidebar, search, etc.)
2. Observe the new `wss://dataenginev2.worldwideview.dev/stream` WebSocket in the Network tab
3. Click it → Messages tab → confirm:
   - First **outbound** message: `{"type":"auth","v":1,"token":"<long EdDSA JWT>"}`
   - First **inbound** message: `{"type":"welcome","engine":"wwv-data-engine","plugins":[...]}`
   - Subsequent inbound: `{"type":"data","pluginId":"<this plugin>","payload":...}`
4. Confirm visible markers/data appear on the globe
5. **If any plugin closes with `4003`** in the Network tab → that plugin is broken under enforcement. Capture the plugin ID, then either:
   - Continue smoke-testing remaining plugins (note all failures)
   - OR rollback immediately if it's a high-traffic plugin (your call)

- [ ] **Step 4: Specific check — Earthquakes**

This is the plugin we expected to break before PR3 landed. Confirm:
- WebSocket connects with auth handshake
- `data` messages arrive
- Earthquake markers appear on the globe (NOT an empty layer)

If markers don't appear but the auth handshake succeeded and `data` messages are arriving, PR3 didn't deploy — re-trigger the worldwideview deploy.

- [ ] **Step 5: Negative smoke — sign out, retry**

Sign out of the app. Try to enable a cloud plugin. Expected: WebSocket either doesn't connect or closes with `4003`/`4001` quickly. The frontend's `/api/auth/ticket` route should return 401 because no NextAuth session exists. If unauthenticated users CAN still get data, the ticket route's session check is broken — file an issue.

---

## Task 11: Decision point — happy path OR rollback

**Files:** none.

- [ ] **Step 1: Evaluate smoke results**

| Outcome | Action |
|---|---|
| All plugins green, all WebSockets auth-handshake-then-data | Skip to Task 13 (mark Phase 4 done) |
| 1-2 minor plugins break (low-traffic, niche) | Document failures, keep enforcement on, file fix issues — Task 13 with caveats |
| Earthquakes or any high-traffic plugin breaks | EXECUTE TASK 12 (rollback), then debug |
| Engine won't stay up (crashloop) | EXECUTE TASK 12 immediately, investigate logs |

The threshold for rollback is qualitative — your call. The intent is enforcement-on by default; rollback should be the exception.

---

## Task 12: Rollback procedure (conditional — only if Task 11 says so)

**Files:** none. Coolify state restoration.

- [ ] **Step 1: Re-enable bypass on the data engine**

```powershell
coolify env set wwv-data-engine WWV_SKIP_WS_AUTH=true
```

- [ ] **Step 2: Restore (or unset) `JWKS_URL` to baseline value**

Open `C:\Users\silve\.claude\plans\coolify-baseline-<...>.md` and use the recorded value:

```powershell
# If baseline value was "(unset)":
coolify env unset wwv-data-engine JWKS_URL

# If baseline had a value:
coolify env set wwv-data-engine JWKS_URL=<baseline value>
```

- [ ] **Step 3: Restore (or unset) `NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS` to baseline value**

```powershell
# If baseline was "(unset)":
coolify env unset wwv NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS

# If baseline had a value:
coolify env set wwv NEXT_PUBLIC_WWV_TICKET_AUTH_PLUGINS=<baseline value>
```

- [ ] **Step 4: Trigger both redeploys**

```powershell
coolify deploy trigger wwv-data-engine
coolify deploy trigger wwv
coolify deploy status wwv-data-engine --watch
coolify deploy status wwv --watch
```

- [ ] **Step 5: Confirm rollback via the same smoke as Task 9**

```powershell
pnpm dlx wscat -c wss://dataenginev2.worldwideview.dev/stream
# Send: {"action":"subscribe","pluginId":"earthquakes"}
```

Expected: connection stays open, data arrives WITHOUT sending an auth message. That's the pre-cutover bypass behavior restored.

- [ ] **Step 6: Document the rollback**

Append to the baseline file:

```markdown
## Rollback executed <ISO timestamp>
- Trigger: <what broke — e.g. "Earthquakes 4003 close in production browser test">
- Plugins broken: <list>
- Next steps: <e.g. "Investigate WsClient auth path for plugin X — file issue">
```

STOP. Do not retry the cutover until the root cause is fixed and re-tested locally.

---

## Task 13: Mark Phase 4 complete (happy path only)

**Files:**
- Modify: `worldwideview/docs/architecture/decisions/adr-0001-decentralized-plugin-auth.md` (or wherever ADR-001B lives)
- Modify: any Northstar Sequence tracker doc (likely in `worldwideview/docs/` or `.agents/context/`)

- [ ] **Step 1: Find the ADR**

```powershell
cd C:\dev\wwv\worldwideview
cymbal search --text "ADR-001B"
# OR
Get-ChildItem -Recurse docs/architecture -Filter "adr-0001*.md"
```

- [ ] **Step 2: Update the ADR status from "Proposed" to "Accepted"**

Edit the relevant ADR — typically there's a status block near the top:

```diff
-Status: Proposed
+Status: Accepted (cutover completed <YYYY-MM-DD>)
```

- [ ] **Step 3: Find and update the Northstar Sequence tracker**

```powershell
cymbal search --text "Northstar Sequence"
# OR
Grep --pattern "Phase 4" docs/
```

Update Phase 4's status from in-progress to complete. Add a one-line note referencing the cutover date.

- [ ] **Step 4: Commit on a new branch**

```powershell
git checkout main
git pull --ff-only origin main
git checkout -b docs/phase4-cutover-complete
git add docs/
git commit -m "docs: mark ADR-001B accepted and Northstar Phase 4 complete

Production data engine cutover completed <YYYY-MM-DD>. WebSocket JWT
enforcement active for: <list from allowlist>. Local + production E2E
verified. Baseline + allowlist files retained in personal notes."
git push -u origin docs/phase4-cutover-complete
gh pr create --title "docs: mark Phase 4 Coolify cutover complete" --body "Status update only — production cutover landed <YYYY-MM-DD>. See plan at .claude/plans/2026-05-24-phase4-coolify-cutover.md."
```

---

## Verification — end-to-end

After Task 13 (or Task 12 if rolled back):

1. **If happy path:** the WebSocket `/stream` endpoint rejects unauthenticated connections with `4003` (proven via wscat in Task 9), accepts authenticated UI sessions (proven in Task 10), shows earthquake markers and every other allowlisted plugin's data on the globe.
2. **If rolled back:** the baseline file documents what broke. A follow-up plan is needed to fix the broken plugin(s) before re-attempting cutover. The system is back to "auth disabled" — same security posture as before this plan started, no production regression.

The Coolify dashboard should show both services healthy and the deploy timestamps should match the cutover window.

---

## Out of scope (separate plans / future work)

- **Port-5000 codification** (engine startup warning + ADR) — purely local DX, not cutover-blocking.
- **`better-sqlite3` → `node:sqlite` refactor of `seeder-sdk`** — Docker prebuilt binaries make this non-urgent for production; local-dev DX only.
- **Silent auth logging fixes** — engine should log `[WS] Closing unauthenticated connection from <ip>: <reason>` and use a more specific close reason than `"Invalid auth message"`. Improves operator UX; track as a small follow-up issue.
- **Plugin `streamUrl` hardcoding sweep** — plugins still hardcode `wss://dataenginev2.worldwideview.dev/stream`; saved today by local-first routing in `resolveEngineUrl.ts`. Worth a sweep, not cutover-blocking.
- **Northstar Sequence Phase 5** — final cutover (link nav, docs, marketing) — starts after Phase 4 is stable in production for ~1 week.
- **Multi-engine audience separation** — currently every JWT has audience `wwv-data-engine` (broadcast). Per-engine audiences are a future ADR-001 follow-up.

---

## Assumptions

1. The Coolify CLI is installed and the `wwv` context is pre-configured (per personal memory). If not, fall back to the Coolify web dashboard for the same actions — the env-set + deploy-trigger workflow is identical, just clicked instead of typed.
2. The production data engine URL is `https://dataenginev2.worldwideview.dev`. If it's something different, substitute throughout.
3. The production marketplace URL is `https://marketplace.worldwideview.dev`. Confirmed in Task 2.
4. The production frontend URL is `https://worldwideview.dev`. If it's `app.worldwideview.dev` or similar, substitute in Task 10.
5. The data engine reads `JWKS_URL` at boot — confirmed via `startup-checks.ts` in PR #10. The cutover redeploy triggers a fresh boot.
6. The frontend reads `NEXT_PUBLIC_*` vars at BUILD time — Coolify's `deploy trigger wwv` does a rebuild, so the new env var is baked into the bundle.
7. The PKCE flow has already been used at least once on the production marketplace by an actual user, so `MarketplaceCredential` rows exist for that user. If you're testing as a fresh user, you'll need to complete `/api/marketplace/connect` once before Task 10 Step 3 — otherwise `/api/auth/ticket` will fail with "no marketplace credential."
8. Coolify deploys complete in under ~5 minutes typical. If much longer, check the Coolify host disk space — per deployment rules, builds silently die when disk fills up.
