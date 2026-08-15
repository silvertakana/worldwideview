# Performance Baseline

> [!CAUTION]
> **The 8,339 MB peak-RSS figure below is WRONG. The measurement method was broken.**
> The original script summed RSS across *every* `node|next-` process on the host, not
> just the build's. A corrected run recorded **7,479 MB of pre-existing node processes**
> (33 PIDs — Claude Code itself, claude-desktop, a stray `next-server`) that were being
> counted as build memory.
>
> **The build's true peak is 3,575 MB** — comfortably under the 6,144 MB heap cap, not
> straining against it. Every conclusion drawn from "the build needs 8.3 GB" was wrong,
> including the inference that the `cpus: 2` pin was load-bearing OOM mitigation.
>
> Re-measured post-merge on 2026-08-15 at `4998e400` (Next 16.3.0). See
> **Post-merge results** below for current numbers; the tables further down are the
> superseded pre-merge run, kept for the record.

**Measured:** 2026-08-15, ~00:50 SGT
**Commit:** `115e94ce` on `fork/optimization-baseline`
**Host:** 12 cores · 15 GiB RAM · **0 B swap** · quiet machine (~8 GiB free at start)

Phase 39's exit artifact. Every number here was **measured**, not estimated.
Anything not measured is marked **UNMEASURED** rather than guessed. Phase 41
optimization claims must be validated against this file.

Reproduce with `scratchpad/measure-build.sh` (samples peak RSS across the
process tree; `/usr/bin/time` is **not installed** on this host).

---

## Post-merge results (current)

Measured at `4998e400`, Next **16.3.0**, after merging 9 upstream commits.
Method corrected to exclude pre-existing node PIDs.

| Metric | Pre-merge (16.2.11) | Post-merge (16.3.0) | Δ |
|---|---:|---:|---|
| Exit code | 0 | **0** | build succeeds |
| Wall clock | 371 s | **418 s** | +47 s (+12.7%) |
| Peak build RSS | ~~8,339 MB~~ *(bad method)* | **3,575 MB** | method fixed |
| Peak system used | 11,328 MB | 12,294 MB | +966 MB |
| Available RAM at start | ~8,000 MB | **4,616 MB** | harsher run |
| Client JS total | 8.1 MB | **8.1 MB** | unchanged |
| Chunk count | 103 | **102** | −1 |
| Largest chunk (Cesium+Draco) | 3,944.3 KB | **3,944.0 KB** | −0.3 KB |

**The Cesium prediction held exactly.** `cesium ^1.143.0`, `zustand ^5.0.14` and webpack
were untouched by the merge, so the dominant chunk was predicted to survive intact — it
moved by 0.3 KB. Next 16.3.0, react 19.2.8, resium 1.24.0 and lucide-react's five-minor
jump did **not** measurably move the bundle.

**The +47 s is not cleanly attributable.** The post-merge run had 4,616 MB available
versus ~8,000 MB for the baseline, so machine load is confounded with the Next upgrade.
Isolating it needs both runs on an equally quiet host.

**Still UNMEASURED: per-route First Load JS.** Next 16.3.0 emits only a
`Route (app) Revalidate Expire` header to a non-TTY log — no size columns. The
gap recorded pre-merge survives the upgrade; a TTY run or bundle analyzer is still
required.

---

## Build (pre-merge, superseded)

| Metric | Value |
|---|---|
| Command | `pnpm build` (`next build --webpack`) |
| `NODE_OPTIONS` | `--max-old-space-size=6144` |
| **Exit code** | **0 — success** |
| **Wall clock** | **371 s** (6 m 11 s) |
| **Peak Node RSS** | **8,339 MB** |
| **Peak system used** | **11,328 MB** |
| `.next` before | 3.2 GB |
| `.next` after | 3.8 GB |

### The OOM did not reproduce

`PHASE3_SUMMARY.md` recorded: "Next.js full build (webpack) not tested — Build
process triggered OOM on this machine." **It completed successfully here.**

Peak Node RSS (8,339 MB) exceeds the 6,144 MB heap cap because the cap bounds
V8 old-space only — native memory, buffers and multiple worker processes sum
above it. Peak system usage of 11.3 GB against 15 GiB total with **0 B swap**
leaves ~3.7 GiB headroom, so the earlier OOM is entirely plausible under heavier
concurrent load. *(inferred: not reproduced, so the original report is neither
confirmed nor refuted — only shown to be non-deterministic.)*

**Implication for `next.config.ts`:** `experimental.cpus: 2` on a 12-core host,
alongside `memoryBasedWorkersCount: true` (both confirmed active in build
output), is a plausible OOM mitigation. Raising it is a **memory/time trade-off
to be measured against this file**, not a free win.

### Caveat that materially affects comparisons

`typescript.ignoreBuildErrors: true` means **this build skipped type-checking**.
371 s is *not* comparable to a type-checked build. Phase 40 removes that flag
and must re-baseline.

---

## Client bundle

| Metric | Value |
|---|---|
| Total client JS (`.next/static/chunks`) | **8.1 MB** across **103 files** |
| Cesium public assets (`public/cesium`) | **7.8 MB** |

### Largest chunks

| Size | Chunk |
|---:|---|
| **3,944.3 KB** | `6360.5719be70b00caaf1.js` |
| 848.5 KB | `7429-129f1f71ed556e5b.js` |
| 499.9 KB | `e217e3ef.5a2d8a58f84d70cb.js` |
| 366.8 KB | `6784.747543a4737bea61.js` |
| 235.9 KB | `597f971b.ae6b557e841f6996.js` |
| 217.7 KB | `8562-5527eecb01242f2e.js` |
| 195.2 KB | `a3376982-664228901b562df5.js` |
| 185.2 KB | `framework-9be85304083d3450.js` |
| 180.1 KB | `app/page-2c48a2b380d89ac3.js` |
| 134.8 KB | `main-0ea4dda63b4acab6.js` |
| 110.0 KB | `polyfills-42372ed130431b0a.js` |
| 97.3 KB | `3df8d95d-89604513e4ef3207.js` |

**One chunk is 48% of all client JS.** Content markers in
`6360.5719be70b00caaf1.js`: `Cesium` ×87, `draco` ×87, `Ion` ×8,
`CesiumWidget` ×1 — CesiumJS plus the Draco decoder.

That chunk is referenced from `app/page-*.js`. **UNMEASURED:** whether it loads
eagerly on first paint or is an async/dynamic chunk. A grep cannot distinguish
those, and the distinction decides whether this is the top Phase 41 target or a
non-issue. **Establish this before acting on it.**

---

## Tests

| Metric | Value |
|---|---|
| Suite (pre-merge) | 1,207 tests · 121 files |
| Suite (post-merge) | **1,212 tests · 121 files** (+5 from upstream) |
| Wall clock (quiet machine) | ~18–20 s warm, ~39 s cold |
| Wall clock (loaded machine) | **81 s — and 2 tests fail** |

### Flakiness root cause — RESOLVED

Phase 39 left this **OPEN**: 7 green runs on a quiet machine, 2 failures under load,
error text never captured. Parallelism was tested and **refuted**.

Reproduced on 2026-08-15 immediately after a `pnpm install` + `tsc` run, i.e. on a
loaded machine, with the error text finally captured:

```
FAIL  src/lib/better-auth.test.ts > Better Auth instance > exports an auth instance
Error: Hook timed out in 10000ms.
 ❯ src/lib/better-auth.test.ts:79:1   (beforeEach)
```

**Cause: a fixed 10,000 ms `hookTimeout` (vitest's default), not a logic defect.**
The `beforeEach` at [better-auth.test.ts:79](../src/lib/better-auth.test.ts) took
40,362 ms under load. `src/app/api/mcp/transport-spike.test.ts` fails the same way.
Note `environment 336.66 s` in that run versus a 71 s total — environment setup, not
test logic, is what dilates. This confirms the Phase 39 load-dependent timing
hypothesis and supplies the mechanism it lacked.

**Fix:** raise `hookTimeout` in `vitest.config.ts`, or make that `beforeEach` cheaper.
Until then **any CI gate on this suite will flake on a busy runner** — and the two
affected files are precisely the auth-adjacent ones Phase 39 fingered.

---

## UNMEASURED — gaps in this baseline

Recorded so nobody mistakes absence for zero:

1. **Per-route First Load JS.** Next.js 16 emitted no size table to a non-TTY
   log (`grep -c 'kB|MB'` = 0). The chunk sizes above are the emitted-artifact
   substitute, not Next's per-route attribution. Re-run in a TTY, or use a
   bundle analyzer, for true per-route numbers.
2. **Whether the 3.9 MB Cesium chunk is eager or lazy.** Decides its priority.
3. **Runtime performance.** No frame timings, no live-data profiling, no
   DataBus → Zustand → render measurements. Every Phase 41 runtime hypothesis is
   currently *inferred from reading code*.
4. **Cold-cache build.** 371 s was measured with a warm 3.2 GB `.next`.
5. **Dev-server boot time.**
6. **Type-checked build time** (blocked on Phase 40).
