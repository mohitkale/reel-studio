/**
 * Seeds a generic public-safe brand kit for local testing.
 * Idempotent: if a kit named "Northstar Studio" already exists it is updated.
 *
 * Run once: npm run seed:demo-brandkit
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PALETTE = {
  background: "#0D256F",
  backgroundAccent: "#1A3490",
  foreground: "#FFFFFF",
  muted: "#F6ECDB",
  accent: "#FF5900",
  accentSecondary: "#FFA000",
  accentForeground: "#FFFFFF",
};

async function main() {
  const existing = await prisma.brandKit.findFirst({ where: { name: "Northstar Studio" } });

  if (existing) {
    await prisma.brandKit.update({
      where: { id: existing.id },
      data: {
        handle: "@northstarstudio",
        palette: JSON.stringify(DEMO_PALETTE),
      },
    });
    console.log(`Updated existing Northstar Studio kit (id: ${existing.id})`);
  } else {
    const kit = await prisma.brandKit.create({
      data: {
        name: "Northstar Studio",
        handle: "@northstarstudio",
        palette: JSON.stringify(DEMO_PALETTE),
      },
    });
    console.log(`Created Northstar Studio kit (id: ${kit.id})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
