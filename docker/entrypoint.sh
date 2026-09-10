#!/usr/bin/env sh
# Container entrypoint for Reel Studio (dev).
#
# Prepares the Prisma client and SQLite schema, then hands off to the command
# passed by docker-compose (default: `npm run dev`). All steps are idempotent,
# so it is safe to run on every container start.
set -e

echo "[entrypoint] Ensuring Prisma client is generated..."
# Cheap, and picks up any schema change since the image was built.
npx prisma generate

echo "[entrypoint] Migrating SQLite schema..."
node scripts/migrate-database.mjs

echo "[entrypoint] Starting: $*"
exec "$@"
