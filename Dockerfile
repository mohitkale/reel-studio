# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Reel Studio — development image.
#
# Runs the Next.js dev server AND Remotion's renderer (headless Chromium +
# bundled FFmpeg) fully isolated from the host, so CPU-heavy renders and the
# external browser/codec processes never touch the laptop directly.
#
# Node 22 matches the host toolchain. Debian (bookworm) is used rather than
# Alpine because Remotion's headless Chromium needs glibc + the system libs
# installed below. Remotion launches Chrome with --no-sandbox and
# --disable-dev-shm-usage, so the container needs no extra capabilities and
# can run as a non-root user.
# ----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS dev

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

# System libraries required by Remotion's headless Chromium on Debian.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     ca-certificates \
     fonts-liberation \
     libnss3 \
     libdbus-1-3 \
     libatk1.0-0 \
     libgbm-dev \
     libasound2 \
     libxrandr2 \
     libxkbcommon-dev \
     libxfixes3 \
     libxcomposite1 \
     libxdamage1 \
     libatk-bridge2.0-0 \
     libpango-1.0-0 \
     libcairo2 \
     libcups2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching. Native binaries
# (lightningcss, Prisma engines, Remotion's Linux compositor) are compiled/
# selected for Linux here — this is exactly why node_modules must never be
# bind-mounted from the host (see docker-compose.yml volumes).
#
# prisma/ is copied before `npm ci` because the postinstall hook runs
# `prisma generate`, which needs the schema.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Copy the rest of the source. At runtime docker-compose bind-mounts the host
# source over this for hot reload; the copy keeps the image runnable on its own.
COPY . .

# Writable dirs for the local media store and SQLite DB, owned by the
# unprivileged runtime user.
RUN mkdir -p /app/media /data && chown -R node:node /app /data
USER node

EXPOSE 3000

# Entrypoint prepares Prisma (generate + db push) before starting the server.
# Invoked via `sh` so it works even when the bind-mounted script lacks the
# executable bit (common on Windows hosts).
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "dev"]
