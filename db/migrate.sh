#!/bin/sh
# Apply db/migrations/*.sql in order, each in its own transaction, and record it in
# schema_migrations with a checksum. Roadmap M7 step 1: this is the only migration runner, so
# local runs (docker/compose.yml) and any future CI service container behave the same way.
#
#   docker compose -f docker/compose.yml run --rm migrate
#   DATABASE_URL=postgres://... sh db/migrate.sh          # against any reachable database
#
# Refuses to guess: a migration that is already applied must keep its checksum, and a file whose
# number is already recorded under another name is an error. No destructive statement is allowed
# in a migration (checked by tests/unit/db_schema.test.mjs), so re-running is always safe.
set -eu

DB="${DATABASE_URL:-postgres://aeterna:aeterna@db:5432/aeterna}"
DIR="$(cd "$(dirname "$0")" && pwd)/migrations"

echo "[migrate] $DIR -> $DB"
psql "$DB" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    integer PRIMARY KEY,
  name       text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

applied=0
for f in "$DIR"/*.sql; do
  base="$(basename "$f")"
  version="$(echo "$base" | cut -d_ -f1)"
  checksum="$(sha256sum "$f" | cut -d' ' -f1)"
  have="$(psql "$DB" -tAX -c "SELECT checksum FROM schema_migrations WHERE version = $version")"
  if [ -n "$have" ]; then
    if [ "$have" != "$checksum" ]; then
      echo "[migrate] $base was applied with checksum $have but the file is now $checksum; write a new migration instead of editing an applied one" >&2
      exit 1
    fi
    echo "[migrate] skip $base (already applied)"
    continue
  fi
  if psql "$DB" -tAX -c "SELECT 1 FROM schema_migrations WHERE name = '$base' AND version <> $version" | grep -q 1; then
    echo "[migrate] $base is already recorded under another number; renumbering an applied migration is not allowed" >&2
    exit 1
  fi
  echo "[migrate] apply $base"
  psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
  psql "$DB" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (version, name, checksum) VALUES ($version, '$base', '$checksum')"
  applied=$((applied + 1))
done
echo "[migrate] done, $applied new migration(s)"
