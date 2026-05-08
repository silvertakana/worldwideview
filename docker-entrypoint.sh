#!/bin/sh
# ─── Docker Entrypoint ───────────────────────────────────────
# Ensures the SQLite database exists and is migrated before
# starting the application. On first run with a fresh volume
# the DB file won't exist yet, so we run prisma migrate deploy.

set -e

mkdir -p ./data
echo "[entrypoint] Running database migrations..."
npx -y prisma migrate deploy
echo "[entrypoint] Migrations complete."

# Generate self-signed SSL certificates for local HTTPS bridging if they don't exist
if [ ! -f "./data/localhost.crt" ] || [ ! -f "./data/localhost.key" ]; then
  echo "[entrypoint] Generating self-signed SSL certificates for port 3001..."
  openssl req -nodes -new -x509 -keyout ./data/localhost.key -out ./data/localhost.crt -days 365 -subj "/CN=localhost" 2>/dev/null
fi

# Start the HTTPS proxy in the background
if [ -f "./scripts/https-proxy.mjs" ]; then
  node ./scripts/https-proxy.mjs &
fi

exec node server.js
