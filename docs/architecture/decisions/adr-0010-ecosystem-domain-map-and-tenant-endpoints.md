# ADR-0010: Ecosystem Domain Map & Per-Tenant MCP Endpoints

## Status
Accepted *(owner-approved 2026-09-25; this ADR and its doc edits land with the code change in the same PR)*

## Date
2026-09-26

## Related
- **Corrects:** ADR-0003 (Shared Identity & Ecosystem Auth Host) — the "Cloud App = `app.worldwideview.dev` (or `[tenant].app.worldwideview.dev`)" host row is wrong: that host does not resolve. ADR-0003's identity decisions (apex `worldwideview.dev` as auth host, parent-domain cookie) are **not** affected.
- **Corrects:** ADR-0005 (Demo Service Account) — the demo host is `demo.worldwideview.dev`; the host it named was a third party's.
- **Constrains:** the "Connect your agent" panel (`src/components/layout/ConnectAgentHelper.tsx`) and `resolveMcpUrl()`, the MCP route (`src/app/api/mcp/route.ts`), and ADR-0009's engine fallback string (`dataenginev2.worldwideview.dev`).

---

## Context

WorldWideView is a multi-product ecosystem, not a single app. Several independent repositories each own one surface, and each surface is reachable at its own host. Until now no document recorded that map as verified fact, so the host names drifted between files, and one of them was not ours at all.

### The problem this ADR closes

The repository's own instruction file, `AGENTS.md` section 1, described this project as follows:

> Design/feature target: `www.worldmonitor.app` ([reference repo](https://github.com/koala73/worldmonitor)).

That single line told every agent that read the file top-down that this repo's design target was **someone else's product**. The mistake propagated along the shortest possible path into shipped code: the cloud branch of `resolveMcpUrl()` fell back to `https://api.worldmonitor.app/api/mcp`, so a signed-in user who generated an API key in the "Keys & Access" panel was handed a third-party domain as their own endpoint.

The damage was reputational and functional, not a crash. The pipeline itself works: a user signed in, created a key, and the token - pointed at the real endpoint - did drive the app (the `orient` tool reported a browser tab attached; `pan_globe` moved the globe to Japan). What the product *advertised* was wrong. This ADR removes the false target at its source and records the real map so the error cannot be re-derived.

### Where the foreign project came from

The domain belongs to **WorldMonitor** (`github.com/koala73/worldmonitor`, a third-party project, live at `www.worldmonitor.app` / `api.worldmonitor.app`). It is **not** a WorldWideView property and never was. It entered this repo as a *reading reference*, and the leftovers of that are still visible today:

- `.gitignore:108` ignores `/worldmonitor/` and `.claudeignore:37` negates that ignore (`!/worldmonitor/`) - both reserve a top-level `worldmonitor/` path, i.e. the foreign repo was once cloned into the tree to be read.
- `tsconfig.json:52` still lists `worldmonitor` in `exclude`.
- `.agents/workflows/researching-plugins/SKILL.md` (tracked) instructs agents to check whether `koala73/worldmonitor` already implements a similar feature before searching the web.

*(The clone inference is just that - an inference from the ignore rules and the exclude entry; the rules themselves are the evidence.)* Reading a reference is legitimate. Letting a reference's **domain** become this repo's stated target is not: it turned "borrow a good idea" into "ship someone else's endpoint". The correction is not to stop learning from other projects - it is that no foreign host may appear in our instructions, code, docs, or UI.

**Rule this ADR establishes:** a reference project may inform a design decision; it may never supply a hostname. Domain names in this repo come only from the table below, and any host that is not ours is a bug wherever it appears.

### Verified domain map

Probed by HTTP HEAD on 2026-09-25 (reproduced independently by the docs pass on 2026-09-26):

| Host | Probe | What it is |
|---|---|---|
| `https://cloud-wwv.dev` | **200** | The live cloud globe app (entry point) |
| `https://worldwideview.dev` | **200** | The hub: landing, sign-in, sign-up, account/billing |
| `https://demo.worldwideview.dev` | **200** | The public demo globe (anonymous visitors) |
| `https://marketplace.worldwideview.dev` | **200** | The plugin marketplace |
| `https://dataenginev2.worldwideview.dev` | **404 on root** | The geospatial data engine. Expected: it serves `/api/<layer>` and `/stream`, not a root page |
| `https://app.worldwideview.dev` | **DNS does not resolve** | Named by ADR-0003 as the cloud app host. **It is not live and must not be used.** |
| `https://api.worldmonitor.app` | 200 | **NOT OURS.** A third party's API. Must never appear in any WorldWideView surface. |

The `app.worldwideview.dev` result is the important correction: ADR-0003 chose it in 2026-05-22 as the Cloud App host, and it was never deployed under that name. The auth-host decision ADR-0003 actually argued for (apex `worldwideview.dev` owns login) still stands and is unchanged.

---

## Decision

### ADR-010A: Canonical hosts

| Surface | Canonical host | Notes |
|---|---|---|
| **Cloud globe app** | `https://<name>.cloud-wwv.dev` | One subdomain per tenant. `https://cloud-wwv.dev` is the live entry point today. |
| **MCP endpoint** | `https://<name>.cloud-wwv.dev/api/mcp` | The instance's **own origin** + `/api/mcp`. |
| Local / self-hosted app | `http://localhost:<port>` | MCP at `http://localhost:<port>/api/mcp`. |
| Hub (landing + auth) | `https://worldwideview.dev` | Unchanged from ADR-0003 (ADR-003C). |
| Public demo globe | `https://demo.worldwideview.dev` | Corrects ADR-0005. |
| Plugin marketplace | `https://marketplace.worldwideview.dev` | Unchanged from ADR-0001/ADR-0003. |
| Data engine | `https://dataenginev2.worldwideview.dev` | Serves `/api/<layer>` and `/stream`; root 404 is by design. |

**The cloud app host is `<name>.cloud-wwv.dev`, and the MCP host is the same host as the page the user is on.** `app.worldwideview.dev` is retired - it was never live - and must not be reintroduced as a placeholder in code, docs, or config. *(Owner decision, 2026-09-25.)*

### ADR-010B: Per-tenant subdomain pattern

Cloud instances live at **`https://<name>.cloud-wwv.dev`** - one subdomain per tenant, not one shared app that switches by cookie or path. The practical consequences:

- A tenant's instance is addressable on its own, so a tenant's users, keys, and data are scoped by the origin they are actually on.
- Adding a tenant does not change any other tenant's URL.
- Any surface that needs to name "the cloud app" generically must write the **pattern** (`https://<name>.cloud-wwv.dev`), never a concrete guess like `cloud-wwv.dev` or `app.worldwideview.dev`.

### ADR-010C: The MCP endpoint is derived from the page origin, never baked in

A user's MCP endpoint is **whatever origin they are currently on, plus `/api/mcp`**:

```
local edition : http://localhost:<port>/api/mcp
cloud edition : https://<name>.cloud-wwv.dev/api/mcp
```

Resolution lives in exactly one place - `src/lib/mcp/endpoint.ts` (`resolveMcpEndpoint`, pure; the browser origin is passed in by `readBrowserOrigin`, so the resolver never touches the DOM and is trivially testable). The precedence is fixed:

1. `NEXT_PUBLIC_MCP_API_URL`, when it is an absolute `http(s)` URL - an explicit operator override;
2. **page origin + `/api/mcp`** - proven from the browser, never guessed;
3. an explicit **`undetected`** result that explains why and prints the expected shape for the edition. The panel says it cannot detect the URL rather than inventing a host.

The invariant this buys:

- **No edition may fall back to a host this project does not own.** A missing, unset, or malformed env var is never a reason to advertise someone else's domain - it is a reason to admit the URL could not be detected.
- A tenant, a self-hoster on a custom domain, and a developer on an unusual port all see their own correct URL in the "Connect your agent" panel with no configuration.
- A typo'd override is surfaced as an error rather than quietly replaced by the page origin, so the misconfiguration is visible instead of hidden behind a working-looking URL.

### ADR-010D: The foreign domain is barred from every surface

`www.worldmonitor.app`, `api.worldmonitor.app`, `demo.worldmonitor.app`, and `github.com/koala73/worldmonitor` must not appear in this repository's agent instructions, documentation, UI strings, component fallbacks, or configuration. Exactly two kinds of mention are permitted:

1. The **historical note in this ADR**, which exists so a future reader understands why the rule exists.
2. A **negative assertion in a test** that the endpoint never resolves to that host (`src/lib/mcp/endpoint.test.ts`, `tests/mcp-connect-flow.spec.ts`). A guard test must be able to name the string it forbids - that is what makes it a guard.

Consequence for auditing: **counting the string is not a compliance check.** A `grep` for it must be read, not merely tallied, because the guard tests above are hits that must stay.

### ADR-010E: A setup link is built from the tenant's own subdomain (2026-09-24)

`NEXT_PUBLIC_APP_URL` names one host. On the shared cloud container that host is no tenant's
address, so a setup link built from it pointed at the wrong place - and with the variable unset,
at a bare relative `/setup?token=...`. Both provisioning routes now call
`resolveInstanceBaseUrl()` (`src/lib/instanceUrl.ts`), which prefers
`<subdomain>.<NEXT_PUBLIC_WWV_TENANT_DOMAIN>`, then `NEXT_PUBLIC_APP_URL`, then the
proxy-reported host, then the request's own origin. A setup link is therefore always absolute
and, on cloud, always the tenant's. The hub's `NEXT_PUBLIC_INSTANCE_URL_PATTERN` fallback
still works but is no longer load-bearing.

**Live reproduction of the defect this ADR closes.** On the deployed pre-fix build
(`SOURCE_COMMIT 891d94e4`), a real signed-in cloud instance's Connect panel filled its copy
fields with `https://api.worldmonitor.app/api/mcp` while that instance's own working endpoint
was `https://wwv-verify.cloud-wwv.dev/api/mcp`. An agent given the panel's config block would
have dialled the foreign host. The fixed panel derives the page origin; the live cloud still
runs the pre-fix build, so this reproduction stays visible there until a merge and redeploy.

**Doc drift found by the same pass.** `.env.example` described the tenant-suffix default as
`.app.worldwideview.dev`, a host ADR-010A records as not live; corrected to `.cloud-wwv.dev`.

---

## Consequences

**Positive**
- The stated design target now matches the product. An agent reading `AGENTS.md` top-down learns the real ecosystem (globe app + headless MCP server, cloud instances at `<name>.cloud-wwv.dev`) and has a table of canonical hosts to check any hostname against.
- A user who generates an API key is handed their **own** endpoint, in every edition and on any port or custom domain, with no configuration step.
- The one broken host in the map (`app.worldwideview.dev`) is now recorded as not-live, so the next reader does not chase it.
- Future doc drift is detectable: any host outside ADR-010A's table is a defect by definition.

**Negative / accepted tradeoffs**
- The domain map is a point-in-time observation. Hosts get added; ADR-010A is the single place to update, and stale entries are worse than none.
- Fixing the instruction file does not by itself fix the propagated copies. The remaining `worldmonitor` references outside this ADR are tracked separately (see References) and `worldmonitor`-shaped leftovers (`.gitignore`, `.claudeignore`, `tsconfig.json` exclude) are harmless-but-confusing residue that should be swept in a follow-up.

**Why the existing guardrail did not catch this**

- `scripts/lint-urls.mjs` is the repo's hardcoded-URL linter, and it passed both before and after this bug shipped. Its domain list is `['worldwideview.dev']` and its file allow-list skips `.md`, so a *foreign* domain was never a candidate for it to flag; the offending line also carried `??`, which its `LINE_ALLOW` list treats as an acceptable env fallback. **The linter passing was therefore never evidence that the advertised endpoint was ours.** Widening it to a denylist of known-foreign hosts is a candidate follow-up.

**Open follow-up (identified here, NOT decided here)**
- ADR-0003/ADR-0004 scope the shared Supabase session cookie to the parent registrable domain `.worldwideview.dev`. `cloud-wwv.dev` is a **different registrable domain**, so that cookie is not sent to `*.cloud-wwv.dev` - browsers scope cookies per registrable domain. Cross-product single sign-on between `worldwideview.dev` and `*.cloud-wwv.dev` therefore needs its own decision (a separate cookie for the cloud domain, an OAuth-style handoff, or a different host layout). **This ADR records the gap; it does not resolve it**, and nothing in the current map should be read as having solved it.

---

## References
- Corrected records: ADR-0003 (auth host - Cloud App row only), ADR-0005 (demo host), ADR-0009 (engine host, unchanged and confirmed live)
- Instruction file corrected by this ADR: `AGENTS.md` section 1
- Docs corrected by this ADR: `docs/mcp-quickstart.md` (cloud section + endpoint derivation)
- Known remaining references at the time of writing, by category:
  - **Permitted guard assertions (must stay):** `src/lib/mcp/endpoint.test.ts`, `tests/mcp-connect-flow.spec.ts` - each asserts the endpoint does *not* contain the foreign host
  - **Fixed in the same PR:** `src/components/layout/ConnectAgentHelper.tsx` - the hardcoded cloud fallback is gone; the endpoint is now resolved by `src/lib/mcp/endpoint.ts`
  - **Outside this ADR's write scope and still naming the project (needs a follow-up sweep):** `.agents/workflows/researching-plugins/SKILL.md` (a tracked skill instructing agents to mine the foreign repo first - the *second* driver of this bug's behaviour, and the most likely way it comes back), `.gitignore:108`, `.claudeignore:37`, `tsconfig.json:52` (dead path reservations for a clone that is no longer there)
