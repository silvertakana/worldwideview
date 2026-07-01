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
set +e
MIGRATE_OUT=$(prisma migrate deploy 2>&1)
MIGRATE_CODE=$?
set -e

if [ $MIGRATE_CODE -eq 0 ]; then
  echo "[entrypoint] Migrations complete."
elif echo "$MIGRATE_OUT" | grep -q "P3005"; then
  # P3005: schema exists but _prisma_migrations has no history.
  # Happens when 'prisma db push' (pnpm dev) ran before 'prisma migrate deploy' (docker).
  # Safe to auto-baseline only if there is zero schema drift.
  echo "[entrypoint] P3005: schema exists without migration history."
  echo "[entrypoint] Verifying schema matches migrations before auto-baselining..."
  set +e
  DIFF_OUT=$(prisma migrate diff \
    --from-url "$DATABASE_URL" \
    --to-schema-datamodel prisma/schema.prisma \
    --script 2>&1)
  DIFF_CODE=$?
  set -e
  if [ $DIFF_CODE -ne 0 ]; then
    echo "[entrypoint] Could not verify schema state — aborting." >&2
    echo "$DIFF_OUT" >&2
    exit 1
  fi
  # Positive-match for DDL keywords: any real drift emits at least one of these.
  # Checking for presence is safer than checking for absence of content.
  if echo "$DIFF_OUT" | grep -qiE "^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)"; then
    echo "[entrypoint] Schema drift detected — cannot auto-baseline." >&2
    echo "[entrypoint] Run 'pnpm db:reset' to wipe and re-migrate, or resolve drift manually." >&2
    echo "$MIGRATE_OUT" >&2
    exit 1
  fi
  echo "[entrypoint] No drift detected. Baselining existing schema..."
  for migration_dir in prisma/migrations/*/; do
    if [ -f "${migration_dir}migration.sql" ]; then
      migration_name=$(basename "$migration_dir")
      echo "[entrypoint] Marking as applied: $migration_name"
      set +e
      prisma migrate resolve --applied "$migration_name"
      RESOLVE_CODE=$?
      set -e
      if [ $RESOLVE_CODE -ne 0 ]; then
        echo "[entrypoint] Failed to baseline $migration_name — aborting." >&2
        exit 1
      fi
    fi
  done
  prisma migrate deploy
  echo "[entrypoint] Migrations complete."
else
  echo "$MIGRATE_OUT" >&2
  exit $MIGRATE_CODE
fi

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

exec pm2-runtime server.js -i max
