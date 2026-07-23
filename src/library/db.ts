import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. In dev, Next.js hot-reloads modules repeatedly; we
 * stash the client on globalThis to avoid exhausting connections.
 *
 * If the schema gained models (e.g. Podcast) while an old client is cached,
 * drop and recreate so routes don't crash on undefined delegates.
 *
 * Server-only. Access goes through the repository layer, not directly.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient & { podcast?: unknown };
};

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function getClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) {
    // Hot-reload after `prisma generate` can leave a stale client without new models.
    if (existing.podcast == null) {
      void existing.$disconnect().catch(() => undefined);
      const fresh = createClient();
      globalForPrisma.prisma = fresh;
      return fresh;
    }
    return existing;
  }
  const client = createClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = getClient();
