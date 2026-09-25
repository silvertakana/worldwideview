import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Regression guard for scripts/boot-db.mjs startup failure paths.
//
// Before PR #524 the script reported a guessed diagnosis and exited 0 when it
// could not start PostgreSQL, so `pnpm dev` only failed later, against a dead
// port, with no hint about the real cause. These tests pin the exit code (that
// is the regression) and the diagnostic, and pin the WWV_SKIP_LOCAL_DB escape
// hatch so the fix cannot be "repaired" by breaking the opt-out.
//
// The script rewrites `.env` in its CURRENT WORKING DIRECTORY, so every run
// happens in a throwaway temp dir holding a copy of .env.example. Never run it
// with cwd inside the repository.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
);
const BOOT_DB = path.join(REPO_ROOT, "scripts", "boot-db.mjs");

/** Written to stderr by the failing-docker shim, and quoted back by the script. */
const CLI_ERROR = "docker-shim: docker is not usable on this host";
/** Written to stderr by the compose-failing shim. */
const COMPOSE_ERROR = "docker-shim: compose could not start the database";

/** Parent env minus anything that would change the script's control flow. */
const BASE_ENV: NodeJS.ProcessEnv = { ...process.env };
delete BASE_ENV.WWV_SKIP_LOCAL_DB;
// Belt and braces: the shims below are what makes docker fail, but if one were ever
// bypassed, `docker compose up` must still abort on a missing file instead of
// touching this machine's containers.
BASE_ENV.COMPOSE_FILE = path.join(os.tmpdir(), "wwv-boot-db-no-compose-file.yml");

const tempDirs: string[] = [];

afterAll(() => {
    for (const dir of tempDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

/** A scratch cwd holding only .env.example, so .env is created by the script. */
function makeWorkdir(label: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wwv-boot-db-${label}-`));
    fs.copyFileSync(
        path.join(REPO_ROOT, ".env.example"),
        path.join(dir, ".env.example"),
    );
    tempDirs.push(dir);
    return dir;
}

/**
 * Install a fake `docker` ahead of the real one on PATH.
 *
 * Preferring a shim over "the machine may or may not have Docker" keeps the
 * test deterministic on a developer box and on CI alike.
 */
function writeDockerShim(dir: string, opts: { versionOk: boolean }): string {
    const shimDir = path.join(dir, "shim");
    fs.mkdirSync(shimDir, { recursive: true });

    if (process.platform === "win32") {
        const lines = opts.versionOk
            ? [
                  "@echo off",
                  'if "%~1"=="--version" (',
                  "  echo Docker version 99.0.0-shim",
                  "  exit /b 0",
                  ")",
                  `echo ${COMPOSE_ERROR} 1>&2`,
                  "exit /b 1",
              ]
            : ["@echo off", `echo ${CLI_ERROR} 1>&2`, "exit /b 127"];
        fs.writeFileSync(
            path.join(shimDir, "docker.cmd"),
            lines.join("\r\n") + "\r\n",
            "utf8",
        );
    } else {
        const body = opts.versionOk
            ? [
                  "#!/bin/sh",
                  'if [ "$1" = "--version" ]; then',
                  '  echo "Docker version 99.0.0-shim"',
                  "  exit 0",
                  "fi",
                  `echo "${COMPOSE_ERROR}" >&2`,
                  "exit 1",
                  "",
              ].join("\n")
            : ["#!/bin/sh", `echo "${CLI_ERROR}" >&2`, "exit 127", ""].join(
                  "\n",
              );
        const shimPath = path.join(shimDir, "docker");
        fs.writeFileSync(shimPath, body, "utf8");
        fs.chmodSync(shimPath, 0o755);
    }

    return shimDir;
}

/** The shim dir first on PATH; every other inherited variable is preserved. */
function envWithShim(shimDir: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...BASE_ENV };
    const value = `${shimDir}${path.delimiter}${BASE_ENV.PATH ?? BASE_ENV.Path ?? ""}`;
    // Windows env names are case-insensitive, so set both spellings and let the
    // child resolve whichever one it prefers.
    env.PATH = value;
    env.Path = value;
    return env;
}

function runBootDb(cwd: string, env: NodeJS.ProcessEnv) {
    const result = spawnSync(process.execPath, [BOOT_DB], {
        cwd,
        env,
        encoding: "utf8",
    });
    return {
        status: result.status,
        output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
}

describe("scripts/boot-db.mjs startup failure paths", () => {
    it("exits 1 and quotes the real error when the docker CLI cannot run", () => {
        const dir = makeWorkdir("cli-unusable");
        const { status, output } = runBootDb(
            dir,
            envWithShim(writeDockerShim(dir, { versionOk: false })),
        );

        // The regression: pre-#524 this path logged a guess and exited 0.
        expect(status).toBe(1);
        expect(output).toContain("Docker is unreachable");
        // ...and it must quote the error it actually got, not guess at a cause.
        expect(output).toContain(CLI_ERROR);
        // The old wrong diagnosis must not come back.
        expect(output).not.toContain("Skipping local database startup");
    });

    it("exits 1 and prints guidance when docker runs but the database cannot start", () => {
        const dir = makeWorkdir("compose-fails");
        const { status, output } = runBootDb(
            dir,
            envWithShim(writeDockerShim(dir, { versionOk: true })),
        );

        // The second half of the regression: the old outer catch fell through
        // to exit 0 after `docker compose up` failed.
        expect(status).toBe(1);
        expect(output).toContain("Failed to start");
        expect(output).toContain("Ensure that docker is running and try again");
        expect(output).toContain("WWV_SKIP_LOCAL_DB=true");
        expect(output).not.toContain("Local PostgreSQL database is ready");
    });

    for (const value of ["true", "1"]) {
        it(`control: WWV_SKIP_LOCAL_DB=${value} exits 0 and starts nothing`, () => {
            const dir = makeWorkdir("skip");
            const { status, output } = runBootDb(dir, {
                ...envWithShim(writeDockerShim(dir, { versionOk: false })),
                WWV_SKIP_LOCAL_DB: value,
            });

            expect(status).toBe(0);
            expect(output).toContain("Skipping local PostgreSQL startup");
            // The escape hatch must short-circuit before the port assignment,
            // the .env rewrite, and any docker call.
            expect(output).not.toContain("Assigned deterministic database port");
            expect(output).not.toContain("Checking local PostgreSQL database");
            expect(output).not.toContain(CLI_ERROR);
            expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
        });
    }
});
