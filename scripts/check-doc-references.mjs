#!/usr/bin/env node
/**
 * A published file must not point at something this repository does not publish.
 *
 * The failure this catches is quiet by nature: a documentation cleanup untracks or moves a
 * file, and every pointer to it survives. Nothing else notices, because nothing else
 * resolves those paths - a reader just hits a dead end in a public repository.
 *
 * Two rules:
 *   - a reference to internal maintainer material (.planning/, .agents/context/,
 *     .agents/research/, .agents/plans/) fails, because that material lives in a private
 *     workspace repository and is not shipped here
 *   - a reference to anything else under .agents/ or a relative markdown link fails when
 *     the target does not exist in this repository
 *
 * A line that says out loud the material is not shipped is a disclaimer, not a dead link,
 * and it passes. So do documented naming conventions, template files pointing at the file
 * they are a template for, and paths a reader is expected to create.
 *
 * Run: node scripts/check-doc-references.mjs
 *      node scripts/check-doc-references.mjs <file>...   (check only those; used by the tests)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Defaults to the repository this script lives in. DOC_REFERENCES_ROOT lets the workspace
// run the same rules over the sibling repositories, which share these conventions.
const ROOT = process.env.DOC_REFERENCES_ROOT
  ? path.resolve(process.env.DOC_REFERENCES_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Arguments may be repo-relative or absolute (the tests hand it files outside the repo).
const locate = (file) => (path.isAbsolute(file) ? file : path.join(ROOT, file));
const SCANNED = /\.(md|mdc|mjs|cjs|js|jsx|ts|tsx|json|ya?ml|ps1|sh|txt|example)$/i;
const MARKDOWN = /\.mdc?$/i;
const INTERNAL = ['.planning', '.agents/context', '.agents/research', '.agents/plans'];
const isInternal = (target) => INTERNAL.some((prefix) => target === prefix || target.startsWith(prefix + '/'));
// This file holds the patterns it searches for, so scanning it reports its own pattern list.
const SELF = 'scripts/check-doc-references.mjs';
const AGENT_PATH = /\.agents\/[A-Za-z0-9._/-]*[A-Za-z0-9_-]/g;
const MD_LINK = /\]\(([^)\s]+)\)/g;
const EXTERNAL = /^(https?:|mailto:|#)/;
const PLACEHOLDER = /[<>{}*]|YYYY|XXX|\.\.\./;
// A line that already tells the reader this material is not here is honest, not broken.
const MARKED_INTERNAL = /not shipped|not published|internal (maintainer|only|skill|documentation|note|command)|maintainers? only|private (workspace )?repo|not in this (public )?repo|is not part of this repo|not part of this repo/i;
// Paths that are deliberately absent: gitignored clones and scratch directories a reader
// creates for themselves.
const NOT_PUBLISHED_ON_PURPOSE = ['local-plugins', 'local-seeders', 'node_modules', '.next', '.agents/worktrees'];

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const published = new Set(tracked);

const publishes = (target) => {
  const clean = target.replace(/^\.\//, '').replace(/[#?].*$/, '').replace(/\/+$/, '');
  if (clean === '') return true;
  if (published.has(clean)) return true;
  return tracked.some((file) => file.startsWith(clean + '/'));
};
const onPurpose = (target) => NOT_PUBLISHED_ON_PURPOSE.some((prefix) => target === prefix || target.startsWith(prefix + '/'));

const argv = process.argv.slice(2);
const candidates = argv.length > 0 ? argv : tracked.filter((file) => SCANNED.test(file) && file !== SELF);

// A symlink (CLAUDE.md -> AGENTS.md) is one file with two names; check it once.
const files = [];
const seen = new Set();
for (const file of candidates) {
  const full = locate(file);
  if (!existsSync(full) || !statSync(full).isFile()) continue;
  const real = realpathSync(full);
  if (seen.has(real)) continue;
  seen.add(real);
  files.push(file);
}

const problems = new Set();
let references = 0;

for (const file of files) {
  const lines = readFileSync(locate(file), 'utf8').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (MARKED_INTERNAL.test(line)) continue;
    const where = file + ':' + (index + 1);
    for (const target of line.match(AGENT_PATH) || []) {
      references += 1;
      if (PLACEHOLDER.test(target) || onPurpose(target)) continue;
      // A template pointing at the file it is a template for is correct as written.
      if (file === target + '.example' || target === file.replace(/\.example$/, '')) continue;
      if (isInternal(target)) {
        problems.add(where + '  ->  ' + target + '  (internal maintainer material, not published here)');
      } else if (!publishes(target)) {
        problems.add(where + '  ->  ' + target + '  (this repository does not have that file)');
      }
    }
    if (!MARKDOWN.test(file)) continue;
    for (const match of line.matchAll(MD_LINK)) {
      const raw = match[1];
      if (EXTERNAL.test(raw) || PLACEHOLDER.test(raw)) continue;
      references += 1;
      const target = raw.replace(/[#?].*$/, '');
      const resolved = target.startsWith('/')
        ? target.slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      if (onPurpose(resolved)) continue;
      // A template pointing at the file it is a template for is correct as written.
      if (file === resolved + '.example' || resolved === file.replace(/\.example$/, '')) continue;
      if (!publishes(resolved)) problems.add(where + '  ->  ' + raw + '  (this repository does not have that path)');
    }
  }
}

const list = [...problems].sort();
if (list.length === 0) {
  console.log('doc references: ' + files.length + ' files, ' + references + ' references checked, all resolve');
  process.exit(0);
}
console.error('doc references: ' + list.length + ' dead reference(s) across ' + files.length + ' files');
for (const problem of list) console.error('  - ' + problem);
process.exit(1);
