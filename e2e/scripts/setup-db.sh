#!/usr/bin/env bash
# Creates a fresh test database with every migration applied, then seeds it.
# Uses the standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# Needs PostGIS available on the server (migration 001).
set -euo pipefail
DB="${E2E_DB:-niche_e2e}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../../infrastructure/supabase/migrations"
LOG="$(mktemp)"

apply() {
  if ! psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1" >"$LOG" 2>&1; then
    echo "failed: $1"; cat "$LOG"; exit 1
  fi
}

psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
apply "$HERE/supabase-shim.sql"
for f in "$MIGRATIONS"/0*.sql; do apply "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -c "
  grant all on all tables in schema public to anon, authenticated;
  grant all on all sequences in schema public to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;"
apply "$HERE/seed.sql"
echo "e2e database $DB ready"
