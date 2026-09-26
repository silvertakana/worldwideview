#!/usr/bin/env node
/**
 * Decides whether a Dependabot pull request may be auto-merged.
 *
 * The rule is deliberately narrow and fails closed: only a pull request whose every
 * parsed version bump is a patch or a minor, in the npm or docker ecosystem, and which
 * touches no workflow file, may have auto-merge enabled. Anything unparsed, unknown,
 * mixed, or major is skipped and reported - never guessed at.
 *
 * Two entry points:
 *   --self-test                       assert the rule table (no network)
 *   --audit                           report the verdict for every open Dependabot PR
 *   --pr <number>                     print the verdict for one PR (used by the workflow)
 */
import { execFileSync } from "node:child_process";

const ALLOWED_ECOSYSTEMS = new Set(["npm", "docker"]);

const WORKFLOW_FILE = /(^|\/)\.github\/workflows\//;
const NPM_FILE = /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/;
const DOCKER_FILE = /(^|\/)(Dockerfile[^\/]*|docker-compose[^\/]*\.ya?ml)$/;

/** Classify one from/to pair. Returns "major" | "minor" | "patch" | "unknown". */
export function classifyBump(from, to) {
  const nums = (value) => {
    const core = String(value).trim().replace(/^[v=^~]+/, "").split(/[-+]/)[0];
    const parts = core.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
    return parts.length ? parts : [NaN];
  };
  const a = nums(from);
  const b = nums(to);
  if (!Number.isFinite(a[0]) || !Number.isFinite(b[0])) return "unknown";
  if (a[0] !== b[0]) return "major";
  if (!Number.isFinite(a[1]) || !Number.isFinite(b[1])) return "unknown";
  if (a[1] !== b[1]) return "minor";
  if (!Number.isFinite(a[2]) || !Number.isFinite(b[2])) return "patch";
  return a[2] === b[2] ? "patch" : "patch";
}

/** Pull every (name, from, to) triple out of a Dependabot body, in either body shape. */
export function parseBumps(body) {
  const text = String(body ?? "");
  const found = [];
  const sentence = /Bumps? \[?([^\]\n(]+?)\]?(?:\([^)]*\))?\s+from\s+`?([\w.\-+]+)`?\s+to\s+`?([\w.\-+]+)`?/g;
  for (const m of text.matchAll(sentence)) found.push({ name: m[1].trim(), from: m[2], to: m[3] });
  const table = /^\|\s*\[?([^\]|\n]+?)\]?\([^)]*\)?\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/gm;
  for (const m of text.matchAll(table)) found.push({ name: m[1].trim(), from: m[2], to: m[3] });
  const seen = new Set();
  return found.filter((b) => {
    const key = b.name + "|" + b.from + "|" + b.to;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The decision. Reason strings are written to be readable in a workflow log. */
export function decide({ body, files = [] }) {
  const paths = files.map((f) => (typeof f === "string" ? f : f.path));
  const touchesWorkflow = paths.some((p) => WORKFLOW_FILE.test(p));
  const ecosystem = paths.some((p) => NPM_FILE.test(p))
    ? "npm"
    : paths.some((p) => DOCKER_FILE.test(p))
      ? "docker"
      : touchesWorkflow
        ? "github-actions"
        : "unknown";

  if (!ALLOWED_ECOSYSTEMS.has(ecosystem)) {
    return {
      action: "skip",
      ecosystem,
      reason: ecosystem === "github-actions"
        ? "only workflow files change: an action bump edits the CI that judges it, so it is reviewed by hand"
        : "ecosystem not auto-merged (" + ecosystem + ")",
    };
  }
  if (touchesWorkflow) {
    return { action: "skip", ecosystem, reason: "also edits .github/workflows, which is never auto-merged" };
  }
  const bumps = parseBumps(body);
  if (bumps.length === 0) {
    return { action: "skip", ecosystem, reason: "no version bump could be parsed from the pull request body" };
  }
  const bad = bumps.find((b) => !["patch", "minor"].includes(classifyBump(b.from, b.to)));
  if (bad) {
    return {
      action: "skip",
      ecosystem,
      reason: bad.name + " " + bad.from + " to " + bad.to + " is a " + classifyBump(bad.from, bad.to) + " change",
    };
  }
  return { action: "enable", ecosystem, reason: bumps.length + " update(s), all patch or minor" };
}

/**
 * The gate. decide() answers "is this update safe in principle"; gate() answers "what should
 * happen to this pull request right now", and it is stricter on purpose: auto-merge is only
 * enabled once EVERY check has completed green, not merely the required ones.
 *
 * That distinction is not theoretical. A 41-update dependency group passed every required
 * check while a security scan on the same pull request failed, and the browser tests -
 * which do not run on every pull request, so they cannot be made required - were the checks
 * that caught the regression in an earlier attempt at that same group. Waiting only for
 * required checks would have merged it.
 */
export function gate(pr) {
  if (!(pr.author?.login ?? "").includes("dependabot")) {
    return { action: "leave", reason: "not a Dependabot pull request" };
  }
  if (pr.isDraft) return { action: "wait", reason: "still a draft" };
  const checks = pr.statusCheckRollup ?? [];
  const failing = checks.filter((c) => FAILING.has(state(c)));
  const pending = checks.filter((c) => ["", "PENDING", "IN_PROGRESS", "QUEUED", "WAITING", "EXPECTED"].includes(state(c)));
  const autoOn = (pr.autoMergeRequest ?? null) !== null;
  const withdraw = (reason) => (autoOn ? { action: "withdraw", reason } : { action: "leave", reason });
  const verdict = decide({ body: pr.body, files: pr.files ?? [] });
  if (verdict.action !== "enable") return withdraw(verdict.reason);
  if (failing.length) return withdraw("failing checks: " + failing.map(label).join(", "));
  if (checks.length === 0) return { action: "leave", reason: "no checks have reported yet" };
  if (pending.length) return { action: "wait", reason: pending.length + " check(s) still running" };
  if (pr.mergeable !== "MERGEABLE") return { action: "leave", reason: "not mergeable right now (" + pr.mergeable + ")" };
  return { action: "enable", reason: "every bump is patch or minor and every check has completed green" };
}

function selfTest() {
  const cases = [
    ["single patch npm", { body: "Bumps [left-pad](https://x) from 1.2.3 to 1.2.4.", files: ["package.json"] }, "enable"],
    ["single minor npm", { body: "Bumps [zod](https://x) from 3.25.0 to 3.26.0.", files: ["package.json"] }, "enable"],
    ["single major npm", { body: "Bumps [@vitest/coverage-v8](https://x) from 4.1.10 to 5.0.1.", files: ["package.json"] }, "skip"],
    ["node-fetch major", { body: "Bumps [node-fetch](https://x) from 2.7.0 to 3.3.2.", files: ["package.json"] }, "skip"],
    ["docker minor", { body: "Bumps node from 22.1.0 to 22.2.0.", files: ["Dockerfile"] }, "enable"],
    ["action bump only", { body: "Bumps [actions/checkout](https://x) from 4.1.0 to 4.2.0.", files: [".github/workflows/ci.yml"] }, "skip"],
    ["npm plus workflow edit", { body: "Bumps [zod](https://x) from 3.25.0 to 3.26.0.", files: ["package.json", ".github/workflows/ci.yml"] }, "skip"],
    ["group all minor", { body: "Bumps the dependencies group with 2 updates:\n\n| Package | From | To |\n| --- | --- | --- |\n| [a](https://x) | `1.2.3` | `1.3.0` |\n| [b](https://x) | `2.0.0` | `2.0.5` |\n", files: ["package.json"] }, "enable"],
    ["group hiding a major", { body: "Bumps the dependencies group with 2 updates:\n\n| Package | From | To |\n| --- | --- | --- |\n| [a](https://x) | `1.2.3` | `1.3.0` |\n| [b](https://x) | `2.0.0` | `3.0.0` |\n", files: ["package.json"] }, "skip"],
    ["unparseable body", { body: "Dependabot could not describe this update.", files: ["package.json"] }, "skip"],
    ["unknown ecosystem", { body: "Bumps foo from 1.0.0 to 1.0.1.", files: ["Cargo.toml"] }, "skip"],
  ];
  let failures = 0;
  for (const [label, input, expected] of cases) {
    const got = decide(input).action;
    const ok = got === expected;
    if (!ok) failures += 1;
    console.log((ok ? "ok   " : "FAIL ") + label.padEnd(26) + " expected " + expected + ", got " + got);
  }
  const bumps = [["4.1.10", "5.0.1", "major"], ["2.7.0", "3.3.2", "major"], ["1.2.3", "1.2.4", "patch"], ["3.25.0", "3.26.0", "minor"]];
  for (const [from, to, expected] of bumps) {
    const got = classifyBump(from, to);
    const ok = got === expected;
    if (!ok) failures += 1;
    console.log((ok ? "ok   " : "FAIL ") + ("classify " + from + "->" + to).padEnd(26) + " expected " + expected + ", got " + got);
  }
  const ok = (s) => ({ status: "COMPLETED", conclusion: s });
  const dep = { login: "app/dependabot" };
  const patchBody = "Bumps [left-pad](https://x) from 1.2.3 to 1.2.4.";
  const majorBody = "Bumps [@vitest/coverage-v8](https://x) from 4.1.10 to 5.0.1.";
  const gates = [
    ["gate: all green", { author: dep, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [ok("SUCCESS"), ok("SKIPPED")] }, "enable"],
    ["gate: non-required check failing", { author: dep, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [ok("SUCCESS"), { name: "security/snyk", status: "COMPLETED", conclusion: "FAILURE" }] }, "leave"],
    ["gate: failing while auto-merge on", { author: dep, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", autoMergeRequest: { enabledAt: "x" }, statusCheckRollup: [{ name: "Playwright Tests", status: "COMPLETED", conclusion: "FAILURE" }] }, "withdraw"],
    ["gate: major", { author: dep, body: majorBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [ok("SUCCESS")] }, "leave"],
    ["gate: major while auto-merge on", { author: dep, body: majorBody, files: ["package.json"], mergeable: "MERGEABLE", autoMergeRequest: {}, statusCheckRollup: [ok("SUCCESS")] }, "withdraw"],
    ["gate: checks still running", { author: dep, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [ok("SUCCESS"), { name: "Unit Tests", status: "IN_PROGRESS" }] }, "wait"],
    ["gate: no checks at all", { author: dep, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [] }, "leave"],
    ["gate: conflicting", { author: dep, body: patchBody, files: ["package.json"], mergeable: "CONFLICTING", statusCheckRollup: [ok("SUCCESS")] }, "leave"],
    ["gate: a person's pull request", { author: { login: "someone" }, body: patchBody, files: ["package.json"], mergeable: "MERGEABLE", statusCheckRollup: [ok("SUCCESS")] }, "leave"],
  ];
  for (const [lbl, input, expected] of gates) {
    const got = gate(input).action;
    const good = got === expected;
    if (!good) failures += 1;
    console.log((good ? "ok   " : "FAIL ") + lbl.padEnd(34) + " expected " + expected + ", got " + got);
  }
  console.log(failures === 0 ? "self-test: " + (cases.length + bumps.length + gates.length) + " cases, all pass" : "self-test: " + failures + " FAILURES");
  return failures === 0 ? 0 : 1;
}

const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8", env: process.env }));

const label = (c) => c.name ?? c.context ?? "unnamed check";
const state = (c) => (c.conclusion ?? c.state ?? "").toUpperCase();
const FAILING = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "ACTION_REQUIRED", "ERROR"]);

/**
 * Weekly report: a table for every open Dependabot pull request, then a NEEDS_ATTENTION
 * block naming the ones a person should look at. The marker must stay on its own line -
 * the digest workflow greps for it.
 */
function digest() {
  const prs = gh(["pr", "list", "--state", "open", "--limit", "50", "--json", "number,title,body,files,mergeable,createdAt,statusCheckRollup,url,author"]);
  const dep = prs.filter((p) => (p.author?.login ?? "").includes("dependabot"));
  const now = Date.now();
  const attention = [];
  console.log("| PR | Age | Verdict | Mergeable | Checks |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const pr of dep) {
    const ageDays = (now - Date.parse(pr.createdAt)) / 86400000;
    const checks = pr.statusCheckRollup ?? [];
    const failing = checks.filter((c) => FAILING.has(state(c)));
    const running = checks.filter((c) => ["", "PENDING", "IN_PROGRESS", "QUEUED"].includes(state(c)));
    const verdict = decide({ body: pr.body, files: pr.files ?? [] });
    console.log("| #" + pr.number + " | " + ageDays.toFixed(1) + "d | " + verdict.action + " | " + pr.mergeable + " | " + (failing.length ? failing.length + " failing" : running.length ? running.length + " running" : checks.length + " passed") + " |");
    const flags = [];
    if (failing.length) flags.push("failing checks: " + failing.map(label).join(", "));
    if (pr.mergeable === "CONFLICTING") flags.push("conflicts with the base branch");
    if (ageDays > 7) flags.push("open " + ageDays.toFixed(1) + " days");
    if (ageDays > 7 && !failing.length && !running.length && pr.mergeable === "MERGEABLE" && verdict.action === "enable") {
      flags.push("mergeable and green but never merged - a required check may never have reported");
    }
    if (flags.length) {
      attention.push("- [#" + pr.number + "](" + pr.url + ") " + pr.title + "\n" + flags.map((f) => "  - " + f).join("\n") + "\n  - decision: " + verdict.action + " (" + verdict.reason + ")");
    }
  }
  if (dep.length === 0) console.log("| (none) | | | | |");
  console.log("");
  if (attention.length) {
    console.log("NEEDS_ATTENTION");
    console.log("");
    console.log(attention.join("\n"));
  } else {
    console.log("Nothing needs attention: every open Dependabot pull request is inside its merge window or already moving.");
  }
  return 0;
}

function audit() {
  const prs = gh(["pr", "list", "--state", "open", "--limit", "50", "--json", "number,title,body,files,mergeable,author"]);
  const dep = prs.filter((p) => (p.author?.login ?? "").includes("dependabot"));
  let flagged = 0;
  for (const pr of dep) {
    const verdict = decide({ body: pr.body, files: pr.files ?? [] });
    const line = "  #" + String(pr.number).padEnd(5) + verdict.action.toUpperCase().padEnd(7) + pr.mergeable.padEnd(12) + verdict.reason;
    console.log(line);
    if (verdict.action === "skip") flagged += 1;
  }
  if (dep.length === 0) console.log("  (no open Dependabot pull requests)");
  return 0;
}

const argv = process.argv.slice(2);
if (argv.includes("--self-test")) process.exit(selfTest());
if (argv.includes("--audit")) process.exit(audit());
if (argv.includes("--digest")) process.exit(digest());
const gi = argv.indexOf("--gate");
if (gi >= 0) {
  const pr = gh(["pr", "view", String(argv[gi + 1]), "--json", "number,author,isDraft,body,files,mergeable,statusCheckRollup,autoMergeRequest"]);
  const r = gate(pr);
  console.log(r.action.toUpperCase() + "|" + r.reason);
  process.exit(0);
}
const at = argv.indexOf("--pr");
if (at >= 0) {
  const pr = gh(["pr", "view", String(argv[at + 1]), "--json", "number,title,body,files,mergeable"]);
  const verdict = decide({ body: pr.body, files: pr.files ?? [] });
  console.log(verdict.action.toUpperCase() + " - " + verdict.reason);
  process.exit(0);
}
console.log("usage: --self-test | --audit | --digest | --pr <number>");
