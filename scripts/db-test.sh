#!/usr/bin/env bash
# Datenbank-Tests ohne Docker: frische Test-DB, Supabase-Shim, alle Migrationen, Seed,
# pgTAP-Tests (pg_prove) und Nebenläufigkeitstest (50 parallele Buchungen).
#
# Voraussetzungen: PostgreSQL 16 mit PostGIS 3 und pgTAP (+ pg_prove).
# Verbindung über die üblichen PG*-Variablen (Standard: postgres@localhost, Passwort postgres).
set -euo pipefail

cd "$(dirname "$0")/.."

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
DB="${MEDNOW_TEST_DB:-mednow_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -X -q -d "$DB")

echo "› Test-Datenbank $DB neu anlegen"
dropdb --if-exists "$DB"
createdb "$DB"
psql -X -q -d "$DB" -c "alter database \"$DB\" set search_path = \"\$user\", public, extensions;"

echo "› Supabase-Shim"
"${PSQL[@]}" -f supabase/tests/shim/supabase_shim.sql

echo "› Migrationen"
for f in supabase/migrations/*.sql; do
  echo "  - $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "› Seed"
npx --yes tsx scripts/generate-seed-sql.ts >/dev/null
"${PSQL[@]}" -f supabase/seed.sql >/dev/null
"${PSQL[@]}" -tAc "select 'Praxen: ' || count(*) from public.practices; select 'Slots: ' || count(*) from public.availability_slots;"

echo "› pgTAP"
pg_prove -d "$DB" --ext .sql supabase/tests/database/

echo "› Nebenläufigkeit (Doppelbuchung)"
MEDNOW_TEST_DB="$DB" npx --yes tsx scripts/db-concurrency-test.ts
