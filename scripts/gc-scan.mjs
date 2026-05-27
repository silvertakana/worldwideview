#!/usr/bin/env node
// gc-scan.mjs — deterministic garbage detection for the GC bot
// Zero npm dependencies. Emits gc-findings.json consumed by the garbage-collector agent.
//
// Usage: node scripts/gc-scan.mjs [--out <path>] [--days-branch=90] [--days-comment=180]

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = process.cwd();

// Parse CLI args: --out <path>, --days-branch=N, --days-comment=N
const ARGS = Object.fromEntries(
  process.argv.slice(2).flatMap(a => {
    const m = a.match(/^--([\w-]+)=(.+)$/);
    return m ? [[m[1], m[2]]] : [];
  })
);
const outIdx = process.argv.indexOf('--out');
const OUT              = outIdx !== -1 ? process.argv[outIdx + 1] : (ARGS['out'] ?? 'gc-findings.json');
const STALE_BRANCH_DAYS  = Number(ARGS['days-branch']  ?? 90);
const STALE_COMMENT_DAYS = Number(ARGS['days-comment'] ?? 180);

/** @type {Array<Record<string, unknown>>} */
const findings = [];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function add(finding) {
  findings.push(finding);
}

function daysAgo(isoDate) {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 86_400_000;
}

// ─── Detector 1: Stale branches ──────────────────────────────────────────────
function detectStaleBranches() {
  const out = run(
    'git for-each-ref --sort=committerdate refs/remotes/origin ' +
    '--format=%(refname:short)|%(committerdate:iso8601)|%(authorname)|%(subject)'
  );
  for (const line of out.split('\n').filter(Boolean)) {
    const [ref, date, author, subject] = line.split('|');
    const branch = ref.replace('origin/', '');
    if (['HEAD', 'main', 'master', 'develop'].includes(branch)) continue;
    const age = daysAgo(date);
    if (age < STALE_BRANCH_DAYS) continue;
    const mergeBase = run(`git merge-base origin/main "${ref}" 2>/dev/null`);
    const branchHead = run(`git rev-parse "${ref}"`);
    const isMerged = mergeBase === branchHead;
    add({
      type: 'stale-branch',
      tier: 'B',
      branch,
      author,
      lastCommitDate: date?.trim(),
      ageDays: Math.floor(age),
      isMerged,
      lastSubject: subject,
      description: `Branch '${branch}' is ${Math.floor(age)} days old${isMerged ? ' and fully merged into main — safe to delete' : ' with no recent activity'}`,
    });
  }
}

// ─── Detector 2: Stale TODO/FIXME/HACK comments ──────────────────────────────
function detectStaleTodos() {
  const raw = run(
    'git grep -rn --fixed-strings -e "TODO" -e "FIXME" -e "HACK" -e "XXX" ' +
    '-- "*.ts" "*.tsx" "*.mjs" "*.js"'
  );
  if (!raw) return;

  // Cap at 40 matches to keep git blame calls fast on large repos
  const lines = raw.split('\n').filter(Boolean).slice(0, 40);

  for (const line of lines) {
    const firstColon = line.indexOf(':');
    if (firstColon === -1) continue;
    const afterFile = line.slice(firstColon + 1);
    const secondColon = afterFile.indexOf(':');
    if (secondColon === -1) continue;

    const file = line.slice(0, firstColon);
    const lineNum = afterFile.slice(0, secondColon);
    const content = afterFile.slice(secondColon + 1).trim();

    if (file.startsWith('node_modules/') || file.includes('public/cesium')) continue;

    const blameOut = run(`git blame -L ${lineNum},${lineNum} --porcelain "${file}"`);
    const timeMatch = blameOut.match(/^author-time (\d+)/m);
    if (!timeMatch) continue;

    const ageInDays = (Date.now() - parseInt(timeMatch[1], 10) * 1000) / 86_400_000;
    if (ageInDays < STALE_COMMENT_DAYS) continue;

    const issueMatch = content.match(/#(\d+)/);
    let issueClosed = false;
    if (issueMatch) {
      const state = run(`gh issue view ${issueMatch[1]} --json state -q .state 2>/dev/null`);
      issueClosed = state.toUpperCase() === 'CLOSED';
    }

    add({
      type: 'stale-todo',
      tier: 'A',
      file,
      line: parseInt(lineNum, 10),
      content: content.slice(0, 200),
      ageInDays: Math.round(ageInDays),
      issueClosed,
      linkedIssue: issueMatch ? issueMatch[1] : null,
      description: issueClosed
        ? `TODO references closed issue #${issueMatch[1]} (${Math.round(ageInDays)}d old) — safe to delete`
        : `TODO/comment is ${Math.round(ageInDays)} days old — review and resolve or delete`,
    });
  }
}

// ─── Detector 3: Known anti-patterns ─────────────────────────────────────────
const ANTI_PATTERNS = [
  {
    id: 'mdc-ref',
    tier: 'A',
    globs: ['*.ts', '*.tsx'],
    pattern: '[\'"].*\\.mdc[\'"]',
    excludePrefix: 'scripts/',
    desc: '.mdc file reference — must be .md (project invariant: never .mdc files)',
  },
  {
    id: 'console-log',
    tier: 'A',
    globs: ['*.ts', '*.tsx'],
    pattern: 'console\\.log(',
    excludePrefix: 'scripts/',
    desc: 'stray console.log — remove or replace with structured logging',
  },
  {
    id: 'ts-ignore',
    tier: 'A',
    globs: ['*.ts', '*.tsx'],
    pattern: '@ts-ignore',
    desc: '@ts-ignore suppresses real type errors — remove and fix the underlying type',
  },
  {
    id: 'ts-nocheck',
    tier: 'A',
    globs: ['*.ts', '*.tsx'],
    pattern: '@ts-nocheck',
    desc: '@ts-nocheck disables all type checking for the file — remove and fix types',
  },
  {
    id: 'hardcoded-url',
    tier: 'B',
    globs: ['*.ts', '*.tsx'],
    pattern: 'localhost:500',
    excludePrefix: 'scripts/',
    desc: 'hardcoded engine URL (localhost:5001/5000) — use env var or plugin streamUrl instead',
  },
  {
    id: 'deprecated',
    tier: 'B',
    globs: ['*.ts', '*.tsx'],
    pattern: '@deprecated',
    desc: '@deprecated JSDoc on a symbol — audit whether all callers have migrated',
  },
];

function detectAntiPatterns() {
  for (const { id, tier, globs, pattern, desc, excludePrefix } of ANTI_PATTERNS) {
    const globArgs = globs.map(g => `"${g}"`).join(' ');
    const raw = run(`git grep -En "${pattern}" -- ${globArgs}`);
    if (!raw) continue;

    const hits = raw
      .split('\n')
      .filter(l => l && !(excludePrefix && l.startsWith(excludePrefix)))
      .slice(0, 15);

    for (const line of hits) {
      const m = line.match(/^([^:]+):(\d+):(.*)/);
      if (!m) continue;
      if (m[1].startsWith('node_modules/') || m[1].includes('public/cesium')) continue;
      add({
        type: 'anti-pattern',
        patternId: id,
        tier,
        file: m[1],
        line: parseInt(m[2], 10),
        content: m[3].trim().slice(0, 200),
        description: desc,
      });
    }
  }
}

// ─── Detector 4: Oversized source files ──────────────────────────────────────
function detectOversizedFiles() {
  const fileList = run('git ls-files "*.ts" "*.tsx"').split('\n').filter(Boolean);
  for (const file of fileList) {
    if (file.startsWith('node_modules/') || file.includes('public/cesium') || file.includes('.next/')) continue;
    const fullPath = join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    const lineCount = readFileSync(fullPath, 'utf8').split('\n').length;
    if (lineCount > 350) {
      add({
        type: 'oversized-file',
        tier: 'B',
        file,
        lines: lineCount,
        description: `${lineCount} lines exceeds ~300-line convention — extract helpers, split component, or use hooks`,
      });
    }
  }
}

// ─── Detector 5: Orphaned rule file references ───────────────────────────────
function detectOrphanedRuleRefs() {
  const ruleFiles = run('git ls-files ".agents/rules/"').split('\n').filter(f => f.endsWith('.md'));
  for (const ruleFile of ruleFiles) {
    const fullPath = join(ROOT, ruleFile);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, 'utf8');
    const seen = new Set();
    for (const [, ref] of content.matchAll(
      /`((?:src|packages|local-plugins|local-seeders|\.agents)\/[^`\s]+)`/g
    )) {
      const base = ref.replace(/\/\*\*.*/, '').replace(/\/\*.*/, '').replace(/\{[^}]+\}.*/, '');
      if (!base || seen.has(base)) continue;
      seen.add(base);
      const tracked = run(`git ls-files "${base}" "${base}/" 2>/dev/null`);
      if (!tracked && !existsSync(join(ROOT, base))) {
        add({
          type: 'orphaned-rule-ref',
          tier: 'B',
          file: ruleFile,
          ref: base,
          description: `Rule file references '${base}' which no longer exists — update or remove`,
        });
      }
    }
  }
}

// ─── Detector 6: Orphaned workspace packages ─────────────────────────────────
function detectOrphanedPackages() {
  try {
    const wsInfo = run('pnpm list --recursive --depth=0 --json 2>/dev/null');
    if (!wsInfo) return;
    const pkgs = JSON.parse(wsInfo);
    const allNames = new Set(pkgs.map(p => p.name).filter(Boolean));
    const reverseDepCount = Object.fromEntries([...allNames].map(n => [n, 0]));
    for (const pkg of pkgs) {
      for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
        if (reverseDepCount[dep] !== undefined) reverseDepCount[dep]++;
      }
    }
    for (const [name, count] of Object.entries(reverseDepCount)) {
      const pkg = pkgs.find(p => p.name === name);
      if (!pkg?.path?.includes('/packages/')) continue;
      if (count === 0) {
        add({
          type: 'orphaned-package',
          tier: 'B',
          name,
          path: relative(ROOT, pkg.path),
          description: `Workspace package '${name}' has no reverse dependencies inside the monorepo — consider removing`,
        });
      }
    }
  } catch { /* skip if pnpm unavailable */ }
}

// ─── Detector 7: Old Prisma migrations ───────────────────────────────────────
function detectOldMigrations() {
  const migrationsDir = resolve(ROOT, 'prisma/migrations');
  if (!existsSync(migrationsDir)) return;
  const dirs = run(`ls -1 "${migrationsDir}"`).split('\n').filter(Boolean);
  for (const dir of dirs) {
    const sqlFile = `prisma/migrations/${dir}/migration.sql`;
    const lastTouch = run(`git log -1 --format=%ci -- "${sqlFile}"`);
    if (!lastTouch) continue;
    const age = daysAgo(lastTouch);
    if (age < 365) continue;
    add({
      type: 'old-migration',
      tier: 'B',
      migration: dir,
      ageDays: Math.floor(age),
      lastTouched: lastTouch.trim(),
      description: `Migration '${dir}' is ${Math.floor(age)} days old — verify it is still actively needed`,
    });
  }
}

// ─── Detector 8: Outdated dependencies ───────────────────────────────────────
function detectOutdatedDeps() {
  if (!existsSync(join(ROOT, 'package.json'))) return;
  const raw = run('pnpm outdated --no-color 2>/dev/null || true');
  if (!raw) return;
  const dataLines = raw
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('Package') && !l.startsWith('Legend') && !l.startsWith(' '));
  for (const line of dataLines.slice(0, 12)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 3) continue;
    const [pkg, current, latest] = cols;
    if (!pkg || !current || !latest || current === latest) continue;
    const isMajor = current.replace(/^[^0-9]*/, '').split('.')[0] !== latest.replace(/^[^0-9]*/, '').split('.')[0];
    add({
      type: 'outdated-dep',
      tier: 'B',
      package: pkg,
      current,
      latest,
      isMajor,
      description: `${pkg}: ${current} → ${latest}${isMajor ? ' ⚠ MAJOR bump — review breaking changes before upgrading' : ''}`,
    });
  }
}

// ─── Run all detectors ────────────────────────────────────────────────────────
console.log('WorldWideView GC Scan');
console.log(`Repo:       ${run('git remote get-url origin') || ROOT}`);
console.log(`Commit:     ${run('git rev-parse --short HEAD') || 'unknown'}`);
console.log(`Thresholds: branch=${STALE_BRANCH_DAYS}d  comment=${STALE_COMMENT_DAYS}d`);
console.log('');

detectStaleBranches();
console.log(`  stale-branch       ${findings.filter(f => f.type === 'stale-branch').length}`);

detectStaleTodos();
console.log(`  stale-todo         ${findings.filter(f => f.type === 'stale-todo').length}`);

detectAntiPatterns();
console.log(`  anti-pattern       ${findings.filter(f => f.type === 'anti-pattern').length}`);

detectOversizedFiles();
console.log(`  oversized-file     ${findings.filter(f => f.type === 'oversized-file').length}`);

detectOrphanedRuleRefs();
console.log(`  orphaned-rule-ref  ${findings.filter(f => f.type === 'orphaned-rule-ref').length}`);

detectOrphanedPackages();
console.log(`  orphaned-package   ${findings.filter(f => f.type === 'orphaned-package').length}`);

detectOldMigrations();
console.log(`  old-migration      ${findings.filter(f => f.type === 'old-migration').length}`);

detectOutdatedDeps();
console.log(`  outdated-dep       ${findings.filter(f => f.type === 'outdated-dep').length}`);

// Deduplicate
const seen = new Set();
const deduped = findings.filter(f => {
  const key = [
    f.type,
    f.file ?? f.package ?? f.name ?? f.migration ?? f.branch ?? '',
    f.line ?? f.ref ?? '',
    f.patternId ?? '',
  ].join(':');
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const output = {
  scanDate: new Date().toISOString(),
  thresholds: { STALE_BRANCH_DAYS, STALE_COMMENT_DAYS },
  repo: run('git remote get-url origin') || ROOT,
  commit: run('git rev-parse --short HEAD') || 'unknown',
  summary: {
    total: deduped.length,
    tierA: deduped.filter(f => f.tier === 'A').length,
    tierB: deduped.filter(f => f.tier === 'B').length,
  },
  findings: deduped,
};

writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log('');
console.log(`Total: ${deduped.length} (Tier A: ${output.summary.tierA}, Tier B: ${output.summary.tierB})`);
console.log(`Output: ${OUT}`);
