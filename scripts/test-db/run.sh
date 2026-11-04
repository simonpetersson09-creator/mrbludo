#!/usr/bin/env bash
# Database integration tests on a throwaway local PostgreSQL.
# Creates a fresh cluster in a temp folder, applies every migration in order, runs *.db.test.ts, then deletes it.
# It never connects to the hosted backend: the URL it hands to the tests is a local socket only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d /tmp/ludo-testdb.XXXXXX)"
PORT="${LUDO_TEST_DB_PORT:-54329}"
AS=()
# PostgreSQL refuses to run as root: in a root-only sandbox, run it as an unprivileged account.
if [ "$(id -u)" = "0" ] && ! getent passwd 65534 >/dev/null; then echo "nobody:x:65534:65534:nobody:/nonexistent:/bin/false" >> /etc/passwd; getent group 65534 >/dev/null || echo "nogroup:x:65534:" >> /etc/group; fi
if [ "$(id -u)" = "0" ]; then AS=(setpriv --reuid=65534 --regid=65534 --clear-groups); chown -R 65534:65534 "$TMP"; fi
cleanup() { "${AS[@]}" pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
"${AS[@]}" initdb -D "$TMP/data" -U ludo_test --auth=trust >/dev/null
"${AS[@]}" pg_ctl -D "$TMP/data" -o "-k $TMP -p $PORT -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null
PSQL=(psql -h "$TMP" -p "$PORT" -U ludo_test -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "CREATE DATABASE ludo_test"
"${PSQL[@]}" -d ludo_test -f "$ROOT/scripts/test-db/shim.sql"
for f in "$ROOT"/drizzle/migrations/*.sql; do "${PSQL[@]}" -d ludo_test -f "$f"; done
SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n' | head -c 48)"
REST_PORT="${LUDO_TEST_REST_PORT:-54330}"
POSTGREST="$(command -v postgrest || echo "$(nix build nixpkgs#postgrest --no-link --print-out-paths 2>/dev/null)/bin/postgrest")"
PGRST_DB_URI="postgres://authenticator@localhost:$PORT/ludo_test?host=$TMP" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT="$REST_PORT" PGRST_SERVER_HOST=127.0.0.1 PGRST_DB_POOL=20 \
  "$POSTGREST" >"$TMP/rest.log" 2>&1 &
REST_PID=$!
trap 'kill $REST_PID 2>/dev/null || true; cleanup' EXIT
for _ in $(seq 1 100); do curl -sf "http://127.0.0.1:$REST_PORT/" >/dev/null 2>&1 && break; sleep 0.1; done
export LUDO_TEST_REST_URL="http://127.0.0.1:$REST_PORT" LUDO_TEST_JWT_SECRET="$SECRET"
export LUDO_TEST_DATABASE_URL="postgres://ludo_test@localhost:$PORT/ludo_test?host=$TMP"
cd "$ROOT"
# The tests must never see the live backend: strip every backend address/key from the environment.
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_PUBLISHABLE_KEY SUPABASE_ANON_KEY VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID SUPABASE_DB_URL DATABASE_URL
bunx vitest run --config vitest.db.config.ts "$@"
