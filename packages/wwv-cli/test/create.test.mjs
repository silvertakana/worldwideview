// Integration tests for `wwv create`.
//
// These spawn the *built* CLI (dist/index.js) into a throwaway temp directory
// and assert the generated file tree. No mocking — this is the real scaffold
// path agents and humans use. Run with: `node --test test/` (the CLI must be
// built first; the cli.yml workflow runs `pnpm build` before this).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve(import.meta.dirname, '..', 'dist', 'index.js');

function freshDir() {
  return mkdtempSync(join(tmpdir(), 'wwv-cli-test-'));
}

function runCreate(cwd, args) {
  const res = spawnSync(process.execPath, [CLI, 'create', ...args], {
    cwd,
    encoding: 'utf8',
    // Empty stdin so a stray prompt (a bug) fails fast instead of hanging CI.
    input: '',
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function readPkg(dir, ...segments) {
  return JSON.parse(readFileSync(join(dir, ...segments), 'utf8'));
}

function readText(dir, ...segments) {
  return readFileSync(join(dir, ...segments), 'utf8');
}

// --- Happy-path plugin types -------------------------------------------------

test('polling plugin: frontend only, no seeder, no streamUrl, has fetch()', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'poll-test', '-n', 'Poll Test', '-d', 'A polling plugin',
      '--category', 'custom', '--architecture', 'polling', '--render-style', 'point', '--yes',
    ]);
    assert.equal(r.status, 0, r.stderr);

    const pkg = readPkg(dir, 'local-plugins', 'wwv-plugin-poll-test', 'package.json');
    assert.equal(pkg.name, '@worldwideview/wwv-plugin-poll-test');
    assert.equal(pkg.worldwideview.pluginId, 'poll-test');
    assert.equal(pkg.worldwideview.category, 'custom');
    assert.equal(pkg.worldwideview.streamUrl, undefined, 'polling plugin must not declare streamUrl');

    const idx = readText(dir, 'local-plugins', 'wwv-plugin-poll-test', 'src', 'index.ts');
    assert.match(idx, /id = 'poll-test'/);
    assert.match(idx, /getPollingInterval\(\): number \{\s*return 10000/);
    assert.match(idx, /async fetch\(/);
    assert.match(idx, /type: 'point'/);

    assert.ok(!existsSync(join(dir, 'local-seeders')), 'polling plugin must not scaffold a seeder');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('websocket + community + billboard: seeder under community/packages, streamUrl, Plane icon', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'ws-comm', '-n', 'WS Comm', '-d', 'desc',
      '--category', 'aviation', '--architecture', 'websocket', '--seeder-tier', 'community',
      '--render-style', 'billboard', '--yes',
    ]);
    assert.equal(r.status, 0, r.stderr);

    const pkg = readPkg(dir, 'local-plugins', 'wwv-plugin-ws-comm', 'package.json');
    assert.equal(pkg.worldwideview.icon, 'Plane');
    assert.ok(pkg.worldwideview.streamUrl, 'websocket plugin must declare a streamUrl');

    const seederBase = join(dir, 'local-seeders', 'community', 'packages', 'ws-comm');
    assert.ok(existsSync(join(seederBase, 'package.json')), 'seeder package.json missing');
    assert.ok(existsSync(join(seederBase, 'tsup.config.ts')), 'seeder tsup.config.ts missing');

    const seederPkg = readPkg(dir, 'local-seeders', 'community', 'packages', 'ws-comm', 'package.json');
    assert.equal(seederPkg.name, '@wwv-seeders/ws-comm');
    assert.equal(seederPkg.main, 'dist/index.mjs');

    const seederIdx = readText(dir, 'local-seeders', 'community', 'packages', 'ws-comm', 'src', 'index.ts');
    assert.match(seederIdx, /name: 'ws-comm'/, "seeder name must equal the plugin id (ADR-0002)");
    assert.match(seederIdx, /cron:/);

    const idx = readText(dir, 'local-plugins', 'wwv-plugin-ws-comm', 'src', 'index.ts');
    assert.match(idx, /getPollingInterval\(\): number \{\s*return 0;/);
    assert.match(idx, /type: 'billboard'/);
    assert.doesNotMatch(idx, /async fetch\(/, 'websocket plugin should not generate a fetch() stub');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('websocket + private + model: seeder under private/packages, Satellite icon, model render', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'ws-priv', '-n', 'WS Priv', '-d', 'desc',
      '--category', 'space', '--architecture', 'websocket', '--seeder-tier', 'private',
      '--render-style', 'model', '--yes',
    ]);
    assert.equal(r.status, 0, r.stderr);

    assert.ok(
      existsSync(join(dir, 'local-seeders', 'private', 'packages', 'ws-priv', 'src', 'index.ts')),
      'private seeder must land under local-seeders/private/packages/',
    );
    const pkg = readPkg(dir, 'local-plugins', 'wwv-plugin-ws-priv', 'package.json');
    assert.equal(pkg.worldwideview.icon, 'Satellite');

    const idx = readText(dir, 'local-plugins', 'wwv-plugin-ws-priv', 'src', 'index.ts');
    assert.match(idx, /modelUrl/, 'model render style should reference modelUrl');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--core flag scaffolds into packages/ instead of local-plugins/', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'core-test', '--core', '-n', 'Core', '-d', 'desc',
      '--category', 'custom', '--architecture', 'polling', '--render-style', 'point', '--yes',
    ]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'packages', 'wwv-plugin-core-test', 'package.json')));
    assert.ok(!existsSync(join(dir, 'local-plugins', 'wwv-plugin-core-test')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('multi-word id: kebab id preserved, class and seeder fn names strip dashes', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'multi-word-plugin', '-n', 'Multi Word', '-d', 'desc',
      '--category', 'custom', '--architecture', 'websocket', '--seeder-tier', 'community',
      '--render-style', 'point', '--yes',
    ]);
    assert.equal(r.status, 0, r.stderr);

    const idx = readText(dir, 'local-plugins', 'wwv-plugin-multi-word-plugin', 'src', 'index.ts');
    assert.match(idx, /class multiwordpluginPlugin/);
    assert.match(idx, /id = 'multi-word-plugin'/);

    const seederIdx = readText(dir, 'local-seeders', 'community', 'packages', 'multi-word-plugin', 'src', 'index.ts');
    assert.match(seederIdx, /name: 'multi-word-plugin'/);
    assert.match(seederIdx, /function seedmultiwordplugin\(/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('category icon mapping: maritime -> Ship, weather -> Cloud', () => {
  const dir = freshDir();
  try {
    const base = ['-d', 'desc', '--architecture', 'polling', '--render-style', 'point', '--yes'];
    assert.equal(runCreate(dir, ['sea', '-n', 'Sea', '--category', 'maritime', ...base]).status, 0);
    assert.equal(runCreate(dir, ['sky', '-n', 'Sky', '--category', 'weather', ...base]).status, 0);

    assert.equal(readPkg(dir, 'local-plugins', 'wwv-plugin-sea', 'package.json').worldwideview.icon, 'Ship');
    assert.equal(readPkg(dir, 'local-plugins', 'wwv-plugin-sky', 'package.json').worldwideview.icon, 'Cloud');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Failure / guard cases ---------------------------------------------------

test('--yes with a missing required value exits non-zero and creates nothing', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, ['fail-test', '--architecture', 'websocket', '--yes']);
    assert.notEqual(r.status, 0, 'should fail when required values are missing');
    assert.match(r.stderr, /missing/i);
    assert.ok(!existsSync(join(dir, 'local-plugins', 'wwv-plugin-fail-test')), 'must not create a partial scaffold');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid --category exits non-zero with a clear message', () => {
  const dir = freshDir();
  try {
    const r = runCreate(dir, [
      'bad-cat', '-n', 'x', '-d', 'y', '--category', 'nonsense',
      '--architecture', 'polling', '--render-style', 'point', '--yes',
    ]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /invalid --category/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('creating into an existing plugin directory exits non-zero', () => {
  const dir = freshDir();
  try {
    const args = [
      'dup-test', '-n', 'x', '-d', 'y', '--category', 'custom',
      '--architecture', 'polling', '--render-style', 'point', '--yes',
    ];
    assert.equal(runCreate(dir, args).status, 0);
    const second = runCreate(dir, args);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /already exists/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
