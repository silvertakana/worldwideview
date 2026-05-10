#!/bin/sh
# ─── Docker Entrypoint ───────────────────────────────────────
# Ensures the PostgreSQL database is migrated before starting
# the application. DATABASE_URL must point to a PostgreSQL
# instance (Supabase, self-hosted, etc).

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "────────────────────────────────────────────────────────────────"
  echo "🚨 CRITICAL: DATABASE_URL IS NOT SET"
  echo "────────────────────────────────────────────────────────────────"
  echo "WorldWideView has migrated to PostgreSQL. If you are an old user,"
  echo "please update your docker-compose.yml to include a Postgres service."
  echo ""
  echo "To migrate your legacy data after setting up Postgres, run:"
  echo "docker exec -it <container_name> node scripts/migrate-legacy.mjs"
  echo "────────────────────────────────────────────────────────────────"
  
  # If dev.db exists, we know they are upgrading. Don't crash, just wait for config.
  if [ -f "prisma/dev.db" ]; then
    echo "[entrypoint] Legacy data detected. Waiting for DATABASE_URL to be configured..."
    # We don't exit here, we'll let the app try to start or just sleep.
    # For now, let's just let it proceed so they can see the setup page error.
  else
    echo "[entrypoint] Exiting. Please provide a DATABASE_URL."
    exit 1
  fi
fi

echo "[entrypoint] Running database migrations..."
prisma migrate deploy
echo "[entrypoint] Migrations complete."

# Generate self-signed SSL certificates for local HTTPS bridging if they don't exist
if [ ! -f "./data/localhost.crt" ] || [ ! -f "./data/localhost.key" ]; then
  echo "[entrypoint] Generating self-signed SSL certificates for port 3001..."
  mkdir -p ./data
  openssl req -nodes -new -x509 -keyout ./data/localhost.key -out ./data/localhost.crt -days 365 -subj "/CN=localhost" 2>/dev/null || echo "[entrypoint] Warning: Failed to generate SSL certs"
fi

# Start the HTTPS proxy in the background
if [ -f "./scripts/https-proxy.mjs" ]; then
  node ./scripts/https-proxy.mjs &
fi

exec node server.js
