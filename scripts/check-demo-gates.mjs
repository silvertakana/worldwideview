#!/usr/bin/env node
/**
 * check-demo-gates.mjs
 *
 * Static CI guardrail: every mutating API route (POST/PUT/PATCH/DELETE) must
 * carry demo/edition-aware protection, or the check fails.
 *
 * Why this exists
 * ---------------
 * The demo edition is public-by-default (src/proxy.ts short-circuits
 * `isDemo` to `NextResponse.next()`), so each API route must self-guard. If a
 * developer adds a new mutating route without thinking about demo access, CI
 * fails and the author is forced to add a gate (or document an intentional
 * opt-out). This is a pragmatic static scan, not a perfect analysis — it looks
 * for the presence of known gate primitives, it does not prove they are wired
 * to the right handler.
 *
 * Accepted gate evidence (any ONE is sufficient):
 *   - `// demo-gate: allow` inline opt-out comment
 *   - `isDemo` from @/core/edition used in a guard
 *   - `validateMarketplaceAuth` (marketplace JWT)
 *   - `crossServiceAuth` (HMAC cross-service)
 *   - `process.env.NODE_ENV !== "development"` (dev-only routes)
 *   - `isPluginInstallEnabled`
 *   - `getServerSession` / `requireSession` (session check)
 *
 * Rate limiting alone is NOT sufficient — a mutating route must ALSO have one
 * of the above, or be in the ALLOWLIST. A rate limit throttles abuse; it does
 * not authorise the caller.
 *
 * Usage:
 *   node scripts/check-demo-gates.mjs          # run from repo root
 * Exit code 0 when no violations, 1 otherwise.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

// Refuse to run unless we are at the repo root (package.json present). This
// prevents a bogus pass when invoked from a subdirectory with no api routes.
if (!existsSync(join(ROOT, "package.json"))) {
    console.error(
        "check-demo-gates: package.json not found at cwd — run from the repo root",
    );
    process.exit(1);
}

const API_DIR = join(ROOT, "src", "app", "api");

// Files excluded from the method-scan entirely. The Better Auth catch-all is
// gated by the whole auth stack, not per-handler; it is exported as
// `export const POST = wrapHandler(...)` and its gate lives in auth config.
const SKIP_FILES = new Set([
    "src/app/api/ba/[...all]/route.ts",
]);

/**
 * Allowlist for known-safe mutating routes that do not need a demo gate.
 * Prefer adding a `// demo-gate: allow` comment in the source file instead —
 * the comment travels with the route and forces a fresh decision when the
 * route is edited. Use this map ONLY when a route cannot carry an inline
 * comment (e.g. generated files). Entries are `relativePath -> reason`.
 */
const ALLOWLIST = new Map([
    // Example:
    // ["src/app/api/example/route.ts", "read-only stats collector, no state mutation"],
]);

// Gate-evidence markers. Deliberately does NOT include rate limiting
// (rateLimit / Limiter): rate limiting throttles but does not authorise.
const EVIDENCE_PATTERNS = [
    { name: "isDemo", regex: /\bisDemo\b/ },
    { name: "validateMarketplaceAuth", regex: /\bvalidateMarketplaceAuth\b/ },
    { name: "crossServiceAuth", regex: /\bcrossServiceAuth\b/ },
    {
        name: "NODE_ENV !== \"development\"",
        regex: /process\.env\.NODE_ENV\s*!==\s*["']development["']/,
    },
    { name: "isPluginInstallEnabled", regex: /\bisPluginInstallEnabled\b/ },
    { name: "getServerSession", regex: /\bgetServerSession\b/ },
    { name: "requireSession", regex: /\brequireSession\b/ },
];

const OPT_OUT_COMMENT = /\/\/\s*demo-gate:\s*allow\b/;

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const METHOD_RE = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
// Non-async / arrow-const export forms (e.g. `export const POST = wrapHandler(...)`).
const METHOD_CONST_RE = /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/g;

/** Recursively collect route.ts files under a directory. */
function walk(dir, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full, out);
        else if (entry.endsWith("route.ts")) out.push(full);
    }
    return out;
}

/** Detect HTTP methods exported by a route module. */
function detectMethods(source) {
    const methods = new Set();
    for (const m of source.matchAll(METHOD_RE)) methods.add(m[1]);
    for (const m of source.matchAll(METHOD_CONST_RE)) methods.add(m[1]);
    return methods;
}

/** True when the source carries acceptable demo-gate evidence. */
function hasDemoGate(source, relPath) {
    if (OPT_OUT_COMMENT.test(source)) return true;
    if (ALLOWLIST.has(relPath)) return true;
    return EVIDENCE_PATTERNS.some(({ regex }) => regex.test(source));
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

const routeFiles = walk(API_DIR);
const results = []; // { rel, methods, ok }
let passed = 0;
let failed = 0;

for (const file of routeFiles) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (SKIP_FILES.has(rel)) continue;

    const source = readFileSync(file, "utf8");
    const methods = detectMethods(source);
    const mutating = [...methods].filter((m) => MUTATING_METHODS.has(m));

    if (mutating.length === 0) {
        passed += 1;
        results.push({ rel, methods, ok: true });
        continue;
    }

    const ok = hasDemoGate(source, rel);
    if (ok) passed += 1;
    else failed += 1;
    results.push({ rel, methods: mutating, ok });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

for (const r of results) {
    if (r.ok) continue;
    console.error(
        `FAIL ${r.rel} (exports ${r.methods.join("/")} but has no demo gate)`,
    );
}

console.log(`Demo-gate check: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
