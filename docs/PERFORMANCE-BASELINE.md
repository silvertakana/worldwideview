# Performance Baseline

**Measured:** 2026-08-15, ~00:50 SGT
**Commit:** `115e94ce` on `fork/optimization-baseline`
**Host:** 12 cores · 15 GiB RAM · **0 B swap** · quiet machine (~8 GiB free at start)

Phase 39's exit artifact. Every number here was **measured**, not estimated.
Anything not measured is marked **UNMEASURED** rather than guessed. Phase 41
optimization claims must be validated against this file.

Reproduce with `scratchpad/measure-build.sh` (samples peak RSS across the
process tree; `/usr/bin/time` is **not installed** on this host).

---

## Build

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
| Suite | 1,207 tests · 121 files |
| Wall clock (warm) | ~18–20 s |
| Wall clock (cold) | ~39 s |
| Determinism | **NOT deterministic** — see [PROJECT-HISTORY](PROJECT-HISTORY.md) defect 8 |

7 consecutive green runs (3 sequential + 4 parallel) on a quiet machine.
Earlier, under load, 2 runs failed in auth-adjacent suites. Parallelism was
tested and **refuted** as the cause. Root cause remains **OPEN**.

**Any CI gate built on this suite is unreliable until that is resolved.**

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
