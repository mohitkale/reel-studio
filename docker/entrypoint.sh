#!/usr/bin/env sh
# Container entrypoint for Reel Studio (dev).
#
# Prepares the Prisma client and SQLite schema, then hands off to the command
# passed by docker-compose (default: `npm run dev`). All steps are idempotent,
# so it is safe to run on every container start.
set -e

echo "[entrypoint] Ensuring Prisma client is generated..."
# Cheap, and picks up any schema change since the image was built.
npx prisma generate >/dev/null 2>&1 || true

echo "[entrypoint] Syncing SQLite schema (DATABASE_URL=${DATABASE_URL:-unset})..."
# No --accept-data-loss: a destructive schema change should fail loudly here
# rather than silently wipe the local database.
npx prisma db push --skip-generate

echo "[entrypoint] Starting: $*"
exec "$@"
