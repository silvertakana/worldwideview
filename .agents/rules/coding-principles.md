# Coding Principles

You are about to write or modify code. **Read this file first.** It exists to prevent accumulated coupling and band-aids that turn a clean codebase into a fragile one.

## The Hard Rule

> **Always interface-based, extensible, composable, modular. Never band-aids on band-aids.**

If you find yourself adding a flag, an `if`-check, or a special case to make a problem go away, you are probably band-aiding. Stop and find the seam where the abstraction broke. Fix it there.

## Core Principles

### 1. Interfaces before implementations
Define the contract first. Public functions accept the interface, not the concrete type.
```ts
// Yes
function attachSource(source: DataSource) { ... }
// No
function attachPostgresSource(pg: PostgresInstance) { ... }
```
When a pattern repeats across two modules, refactor it into an interface immediately. Don't wait for the third copy.

### 2. Loose coupling through explicit contracts
Components communicate through well-defined contracts (typed signatures, events, registries). Pick one and make it the only path.
Components do **not** communicate through:
- Direct imports of each other's internal modules
- Shared mutable state outside the contract
- "Just this once" backdoors
If you are tempted to write `import { internalThing } from '../other-module/internal'`, you are doing it wrong. Propose adding it to the public contract or solve it elsewhere.

### 3. Domain boundaries are sacred
Each domain owns its own state and surface. Cross-domain access is **explicit, gated, and audited**.
**Forbidden:**
- Reading another domain's storage directly
- Calling another domain's private functions
- Hardcoded `if (tenant === 'X')` branches in shared code
**Allowed:**
- Calling a documented API on the other domain
- A configuration field driving strategy
Rule of thumb: If removing a domain requires code archaeology in other domains to untangle internals, the boundary is violated.

### 4. Don't bend architecture to fit dependencies
Use libraries where they fit cleanly; build natively where they don't.
- **Library handles:** The specific problem it's good at, in the shape it expects.
- **Your code owns:** Your domain, lifecycle invariants, and integration seams.
If you find yourself bending your design to fit a library convenience, stop and build it natively or find the correct hook.

### 5. Data lifetimes are deliberate
Different data has different lifetimes. Get this wrong and you'll retain garbage or delete user data.
- **Operational telemetry** (logs, metrics) — short rolling window.
- **User content** — **permanent unless explicitly deleted.** Never swept by telemetry prunes.
- **Resumable session state** — bounded window; archived rather than deleted.
Write explicit retention policies for each category separately.

### 6. Optional features must be truly removable
Optional features declare their surface explicitly and communicate via standard contracts. No optional feature reaches into another's internals.
Test: **If removing this feature should break the system, it's core. Otherwise it's optional and must be cleanly removable without leaving residue.**

### 7. Put code where it belongs
When a feature spans layers, resist the urge to fold it all into one place "for convenience." Routing across layers is the job — not collapsing them. If a feature needs to write durable state, it extends the layer that owns that state.

## Antipatterns to Refuse
These are common failure modes that calcify a codebase. Refuse them:

| Antipattern | Better answer |
|---|---|
| Adding a new flag to an existing function | Extract a strategy interface |
| Patching around a bug at the call site | Find the seam where abstraction broke; fix it there |
| Direct database access from a feature module | Go through the layer that owns the data |
| Hardcoded paths/IDs in business logic | Use configuration or registries |
| `if (tenant === 'X')` in shared code | Strategy pattern or per-tenant config |
| Inheriting one layer's concerns into another | Cross the boundary through a documented contract |
| Inline coupling between layers ("it works") | Draw the contract or merge them honestly |
| Adding defensive `try/catch` to swallow errors| Find root cause; gate cleanly at the boundary |
| Comment explaining *what* code does | Rename and refactor so the code reads itself |
| Copying snippets to "avoid dependency" | Move to a shared module or accept duplicate drift |

## Debugging Discipline
1. **Reproduce it.** Don't trust intuition about what's failing.
2. **Find the seam.** Where did the abstraction break? Which contract was violated?
3. **Fix at the seam.** Not at the call site. Not at the consumer.
4. **If you can't find the seam, surface it.** Tell the user: "this is a design gap; the right fix needs an architectural decision, not a patch."
If a fix doesn't work, **don't add another guard on top.** Stacked defensive layers ruin maintainability.

## Lifecycle Invariants and Mutating Operations
To prevent silent corruption and orphan rows:
1. **Name the invariant.** E.g., "Closed sessions don't accept work." Write it down.
2. **Throw a typed error at the seam.** The function that enforces the invariant must throw a specific typed error, not a silent skip or generic `Error`.
3. **Pre-check at every mutating call site *before* reaching the seam.** Pre-check is hygiene; the seam check is correctness. Both are required.
4. **Validate, then mutate.** Resolve all inputs/permissions before touching durable state. A validation failure must leave nothing half-applied.
5. **Unsafe APIs are still unsafe.** Documenting "don't use when X" is a foot-gun. Make it safe (drain, throw) or remove it.

## Definition of Done (Checklist)
Every code change must satisfy these checklists before merge.

### Adding a new function
- [ ] Belongs strictly in this module.
- [ ] Fulfills an existing interface or explicitly adds a new one.
- [ ] Has a doc-comment header (purpose, params, returns, throws).
- [ ] Has at least one test targeting the contract, not implementation details.
- [ ] Communicates via public contracts only (no cross-module internal imports).
- [ ] Does not touch storage owned by another component.

### Updating an existing function
- [ ] Reason for change is clear (bug fix, refactor, spec change).
- [ ] Doc-comments and tests are updated to reflect the change.
- [ ] Fix is applied at the seam, not as a symptom patch.
- [ ] No new flags or special cases were added instead of extracting a strategy.

### Refusal Triggers (STOP)
- Adding `if (tenant === 'X')` to shared code.
- Adding a flag to make a problem go away.
- Direct DB/filesystem access from a feature module.
- `try/catch` swallowing an error without gating cleanly.
- Skipping tests ("it's trivial") or headers ("it's obvious").
- Adding "just another guard" when a guard failed.
If any trigger is met, surface it to the user. Do not paper over.

## Code-Style Minimums

### Comments & Tests
- **Doc-comments:** Every function gets a header (purpose, params, returns, throws). Inline comments explain WHY, not WHAT.
- **Tests:** Every function ships with at least one contract test. Storage code must use a real temporary DB instance, not a mock.

### Logging
Log every non-happy-path branch with structured loggers and module-scoped children.
- **info**: Expected but noteworthy (e.g., privilege bypass).
- **warn**: Rare, worth investigating (e.g., orphan row caught).
- **error**: Operator action required (e.g., crash, integration failure).
- **debug**: High-volume state changes (include `module` field to filter).
Use structured fields (`logger.warn({ id, state }, "msg")`), not interpolated strings.

### Structure & Dependencies
- Keep modules under ~500 lines. Prefer explicit composition over implicit DI.
- **Always check registry versions before adding/updating a dependency.** Never use "latest" blindly. Active deprecations are real; pin behind if needed and document why.

### Doc-vs-Spec Discipline
Specs are **functional**, not narrative. They require:
- Concrete data structures (schemas, DDL).
- Concrete function/API signatures (input/output types).
- Concrete event payloads.
- Explicit invariants and failure modes.

## When in Doubt
Ask the user explicitly:
- "I don't see a clean seam; options are A or B. Which fits?"
- "This needs a new contract. Draft it first?"
- "I'm about to add a special case. Extract abstraction instead?"

Don't ship band-aids and ask forgiveness later.
