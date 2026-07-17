/**
 * Seeds the Coral Harbor default brand kit (Airbnb-inspired).
 * Idempotent: if a kit named "Coral Harbor" already exists it is updated and
 * marked as the system default. Also migrates the legacy "Northstar Studio"
 * name when that is the only kit.
 *
 * Run once: npm run seed:demo-brandkit
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CORAL_HARBOR_NAME = "Coral Harbor";
const DEMO_PALETTE = {
  background: "#0B0B0F",
  backgroundAccent: "#16161C",
  foreground: "#FFFFFF",
  muted: "#C4C4C8",
  accent: "#FF5A5F",
  accentSecondary: "#2BB5A8",
  accentForeground: "#FFFFFF",
};

async function main() {
  const existing =
    (await prisma.brandKit.findFirst({ where: { name: CORAL_HARBOR_NAME } })) ??
    (await prisma.brandKit.findFirst({ where: { name: "Northstar Studio" } }));

  if (existing) {
    await prisma.brandKit.update({
      where: { id: existing.id },
      data: {
        name: CORAL_HARBOR_NAME,
        handle: "@yourbrand",
        palette: JSON.stringify(DEMO_PALETTE),
        ctaDefaults: JSON.stringify({ isDefault: true }),
      },
    });
    // Clear default flag on every other kit.
    const others = await prisma.brandKit.findMany({
      where: { id: { not: existing.id } },
      select: { id: true, ctaDefaults: true },
    });
    for (const kit of others) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = kit.ctaDefaults ? JSON.parse(kit.ctaDefaults) : {};
      } catch {
        parsed = {};
      }
      if (parsed.isDefault === true) {
        await prisma.brandKit.update({
          where: { id: kit.id },
          data: { ctaDefaults: JSON.stringify({ ...parsed, isDefault: false }) },
        });
      }
    }
    console.log(`Updated ${CORAL_HARBOR_NAME} kit (id: ${existing.id}) as default`);
  } else {
    const kit = await prisma.brandKit.create({
      data: {
        name: CORAL_HARBOR_NAME,
        handle: "@yourbrand",
        palette: JSON.stringify(DEMO_PALETTE),
        ctaDefaults: JSON.stringify({ isDefault: true }),
      },
    });
    console.log(`Created ${CORAL_HARBOR_NAME} kit (id: ${kit.id}) as default`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
