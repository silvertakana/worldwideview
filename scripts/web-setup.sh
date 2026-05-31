#!/usr/bin/env bash
#
# Setup script for Claude Code on the web (and any fresh CI/container clone).
#
# Point your remote environment's "setup script" at this file, e.g.:
#     bash scripts/web-setup.sh
#
# It is idempotent and safe to re-run. It resolves the repo root from its own
# location, so it works no matter which directory the environment invokes it
# from — fixing the `npm error path /home/user/package.json` failure caused by
# running a package manager from the wrong working directory.
set -euo pipefail

# Resolve the repo root relative to this script, not the caller's CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "[web-setup] Repo root: $REPO_ROOT"

# This is a pnpm monorepo (see pnpm-workspace.yaml). Never use npm/npm ci here.
# Corepack ships with Node 20+; activate the pinned pnpm from package.json's
# `packageManager` field if pnpm isn't already on PATH.
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[web-setup] pnpm not found on PATH; enabling via corepack"
  corepack enable
  corepack prepare pnpm@9.15.4 --activate
fi

echo "[web-setup] Using pnpm $(pnpm -v) / node $(node -v)"

# Install workspace dependencies. Use `install` (not `--frozen-lockfile`) so the
# container's dependency cache is reused across sessions for faster startup.
pnpm install

# Generate the Prisma client so TypeScript, ESLint and Vitest can resolve
# @prisma/client types. `prisma generate` reads prisma/schema.prisma only and
# does NOT require a live database connection.
pnpm exec prisma generate

echo "[web-setup] Setup complete — dependencies installed and Prisma client generated."
