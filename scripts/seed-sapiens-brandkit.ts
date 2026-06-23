/**
 * Seeds the Sapiens brand kit with the official corporate color palette.
 * Idempotent: if a kit named "Sapiens" already exists it is updated in place.
 *
 * Run once:  npm run seed:sapiens
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAPIENS_PALETTE = {
  background: "#0D256F",        // Sapphire — official primary dark background
  backgroundAccent: "#1A3490",  // Lighter navy for gradient accents
  foreground: "#FFFFFF",
  muted: "#F6ECDB",             // Warm Grey 2 — official muted tone
  accent: "#FF5900",            // Mandarin — official primary orange
  accentSecondary: "#FFA000",   // Honey — official secondary amber
  accentForeground: "#FFFFFF",
};

async function main() {
  const existing = await prisma.brandKit.findFirst({ where: { name: "Sapiens" } });

  if (existing) {
    await prisma.brandKit.update({
      where: { id: existing.id },
      data: {
        handle: "@sapiens",
        palette: JSON.stringify(SAPIENS_PALETTE),
      },
    });
    console.log(`Updated existing Sapiens brand kit (id: ${existing.id})`);
  } else {
    const kit = await prisma.brandKit.create({
      data: {
        name: "Sapiens",
        handle: "@sapiens",
        palette: JSON.stringify(SAPIENS_PALETTE),
      },
    });
    console.log(`Created Sapiens brand kit (id: ${kit.id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
