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

# ─── PostgreSQL readiness wait ───────────────────────────────
# Wait for Postgres to accept connections before running `prisma
# migrate deploy`. The shipped compose files gate the app with
# depends_on: condition: service_healthy, but an operator compose
# without that gating can crash-loop: migrate deploy fails while
# Postgres is still starting, the entrypoint hard-exits, and
# restart: unless-stopped retries forever.
#
# The runner image (node:26-alpine) has no pg_isready, so the
# probe is a minimal Node Postgres handshake (SSLRequest +
# StartupMessage) against the host/port parsed from DATABASE_URL.
# Node is guaranteed to be present in the image.
#
# Tune with DB_WAIT_ATTEMPTS (default 30) and DB_WAIT_DELAY
# (default 2s): roughly a 60s wait budget before a hard exit
# (each probe attempt also has a 5s socket timeout).
if [ -n "$DATABASE_URL" ]; then
  DB_WAIT_ATTEMPTS="${DB_WAIT_ATTEMPTS:-30}"
  DB_WAIT_DELAY="${DB_WAIT_DELAY:-2}"

  DB_READY_PROBE='
const net = require("net");
const url = process.env.DATABASE_URL || "";
const m = url.match(/^(?:[a-zA-Z0-9+]+):\/\/(?:([^:@/]*)(?::[^@/]*)?@)?(\[[^\]]*\]|[^:/?#]+)(?::(\d+))?/);
if (!m) {
  console.error("[entrypoint] Cannot parse DATABASE_URL for readiness probe");
  process.exit(1);
}
const user = m[1] || "";
const host = m[2].replace(/^\[|\]$/g, "");
const port = m[3] ? Number(m[3]) : 5432;

const sock = net.connect({ host, port });
const fail = () => { sock.destroy(); process.exit(1); };
sock.setTimeout(5000, fail);
sock.once("error", fail);
sock.once("end", fail);

sock.once("connect", () => {
  // Postgres only speaks after the client sends SSLRequest, so write
  // it first. The server answers with one byte: 0x53 ("S", SSL
  // required) or 0x4e ("N", plaintext ok). Either proves the
  // Postgres listener is up.
  const ssl = Buffer.alloc(8);
  ssl.writeInt32BE(8, 0);
  ssl.writeInt32BE(80877103, 4); // SSLRequest code
  sock.write(ssl);
  sock.once("data", (first) => {
    if (first[0] === 0x53) { sock.destroy(); process.exit(0); }
    if (first[0] !== 0x4e) { fail(); return; }
    // No user in the URL: the listener is up, let prisma do the rest.
    if (!user) { sock.destroy(); process.exit(0); }
    // StartupMessage (protocol 3.0): key\0value\0 pairs + final \0 terminator.
    // Length counts the whole packet including itself: 4 (length) + 4
    // (protocol version) + params. Only the user is sent; no password
    // (any AuthenticationRequest proves Postgres accepted the startup).
    const userBuf = Buffer.from("user\u0000" + user + "\u0000\u0000", "utf8");
    const total = 8 + userBuf.length;
    const msg = Buffer.alloc(total);
    msg.writeInt32BE(total, 0);
    msg.writeInt32BE(196608, 4); // protocol 3.0
    userBuf.copy(msg, 8);
    sock.write(msg);
    sock.once("data", (second) => {
      // 0x52 = AuthenticationRequest, 0x4b = BackendKeyData (trust):
      // Postgres accepted the connection. 0x45 = ErrorResponse, e.g.
      // "the database system is starting up" (crash recovery).
      if (second[0] === 0x52 || second[0] === 0x4b) { sock.destroy(); process.exit(0); }
      fail();
    });
  });
});
'

  db_ready() {
    node -e "$DB_READY_PROBE"
  }

  attempt=0
  while ! db_ready; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge "$DB_WAIT_ATTEMPTS" ]; then
      echo "[entrypoint] PostgreSQL did not become ready after ${DB_WAIT_ATTEMPTS} attempts (${DB_WAIT_DELAY}s apart)." >&2
      echo "[entrypoint] Check that the database is reachable at: $DATABASE_URL" >&2
      exit 1
    fi
    echo "[entrypoint] PostgreSQL not ready yet (attempt ${attempt}/${DB_WAIT_ATTEMPTS}), retrying in ${DB_WAIT_DELAY}s..."
    sleep "$DB_WAIT_DELAY"
  done
  echo "[entrypoint] PostgreSQL is accepting connections."
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
  # Prisma 7 removed --from-url and --to-schema-datamodel; the replacements are
  # --from-config-datasource (reads prisma.config.ts, which Dockerfile copies in)
  # and --to-schema.
  DIFF_OUT=$(prisma migrate diff \
    --from-config-datasource \
    --to-schema prisma/schema.prisma \
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

exec pm2-runtime server.js -i 4
