import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const CHECKER = path.join(REPO_ROOT, "scripts", "check-doc-references.mjs");

// The checker exits non-zero on a dead reference, so a run that cannot fail has to be
// distinguishable from a run that found nothing: both the exit code and the text matter.
const run = (files: string[] = []) => {
  try {
    return { ok: true, output: execFileSync("node", [CHECKER, ...files], { cwd: REPO_ROOT, encoding: "utf8" }) };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, output: (failure.stdout ?? "") + (failure.stderr ?? "") };
  }
};

const fixture = (name: string, body: string) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), "wwv-doc-references-")), name);
  writeFileSync(file, body);
  return file;
};

describe("documentation references", () => {
  it("resolves every reference this repository publishes", () => {
    expect(existsSync(CHECKER)).toBe(true);
    const result = run();
    // The checker's own output is the message: a bare "expected false to be true" here would
    // hide which reference broke.
    expect(result.ok, result.output).toBe(true);
    expect(result.output).toContain("all resolve");
    // A pass is only meaningful if the check actually read the repository.
    const checked = Number(/doc references: (\d+) files/.exec(result.output)?.[1] ?? 0);
    expect(checked).toBeGreaterThan(100);
  });

  it("fails on a pointer to internal maintainer material", () => {
    // Composed rather than written out: a literal dead reference in this file would make
    // this file the first thing the repository-wide check reports.
    const target = [".agents", "research", "some-review.md"].join("/");
    const file = fixture("internal.md", `Notes live in \`${target}\`.\n`);
    const result = run([file]);
    expect(result.ok).toBe(false);
    expect(result.output).toContain(target);
    expect(result.output).toContain("internal maintainer material");
  });

  it("fails on a pointer to a file this repository does not have", () => {
    const target = [".agents", "rules", "does-not-exist.md"].join("/");
    const file = fixture("missing.md", `See \`${target}\` for the rules.\n`);
    const result = run([file]);
    expect(result.ok).toBe(false);
    expect(result.output).toContain(target);
  });

  it("fails on a relative markdown link to a path that is gone", () => {
    const file = fixture("link.md", "See [the guide](docs/guide-that-moved.md) for details.\n");
    const result = run([file]);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("docs/guide-that-moved.md");
  });

  it("accepts a pointer that says the material is not shipped", () => {
    const file = fixture("disclaimer.md", "Internal maintainer notes (`.agents/context/`, not shipped in this repo).\n");
    expect(run([file]).ok).toBe(true);
  });
});
