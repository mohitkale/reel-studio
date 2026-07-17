import type { BrandKit } from "@prisma/client";
import type { BrandKitDTO } from "@/lib/dto";
import type { BrandTokens } from "@/compositions/tokens";
import {
  CORAL_HARBOR_NAME,
  CORAL_HARBOR_PALETTE,
  serverDefaultTokens,
} from "@/lib/brand-defaults";
import { prisma } from "@/library/db";
import { paletteSchema, fontsSchema, ctaDefaultsSchema, parseJsonColumn } from "../schemas";

export function resolveBrandTokens(kit: BrandKit): BrandTokens {
  const palette = parseJsonColumn(kit.palette, paletteSchema, {});
  const fonts = parseJsonColumn(kit.fonts, fontsSchema, {});
  return {
    ...(serverDefaultTokens as BrandTokens),
    ...(palette.background ? { background: palette.background } : {}),
    ...(palette.backgroundAccent ? { backgroundAccent: palette.backgroundAccent } : {}),
    ...(palette.foreground ? { foreground: palette.foreground } : {}),
    ...(palette.muted ? { muted: palette.muted } : {}),
    ...(palette.accent ? { accent: palette.accent } : {}),
    ...(palette.accentSecondary ? { accentSecondary: palette.accentSecondary } : {}),
    ...(palette.accentForeground ? { accentForeground: palette.accentForeground } : {}),
    ...(kit.handle ? { handle: kit.handle } : {}),
    ...(fonts.fontFamily ? { fontFamily: fonts.fontFamily } : {}),
  };
}

/**
 * Ensure a default brand kit exists. Fresh DBs get Coral Harbor; existing DBs
 * keep their marked default (or the sole / oldest kit). Idempotent.
 */
export async function ensureDefaultBrandKit(): Promise<BrandKit> {
  const kits = await prisma.brandKit.findMany({ orderBy: { createdAt: "asc" } });
  const marked = kits.find((k) => {
    const d = parseJsonColumn(k.ctaDefaults, ctaDefaultsSchema, {});
    return d.isDefault === true;
  });
  if (marked) return marked;

  if (kits.length === 1) {
    await setDefaultBrandKit(kits[0].id);
    const sole = await prisma.brandKit.findUnique({ where: { id: kits[0].id } });
    return sole ?? kits[0];
  }

  const legacy = kits.find((k) => k.name === "Northstar Studio");
  if (legacy) {
    const renamed = await prisma.brandKit.update({
      where: { id: legacy.id },
      data: {
        name: CORAL_HARBOR_NAME,
        handle: legacy.handle ?? "@yourbrand",
        palette: JSON.stringify(CORAL_HARBOR_PALETTE),
        ctaDefaults: JSON.stringify({ isDefault: true }),
      },
    });
    return renamed;
  }

  const coral = kits.find((k) => k.name === CORAL_HARBOR_NAME);
  if (coral) {
    await setDefaultBrandKit(coral.id);
    const refreshed = await prisma.brandKit.findUnique({ where: { id: coral.id } });
    return refreshed ?? coral;
  }

  if (kits.length === 0) {
    return prisma.brandKit.create({
      data: {
        name: CORAL_HARBOR_NAME,
        handle: "@yourbrand",
        palette: JSON.stringify(CORAL_HARBOR_PALETTE),
        ctaDefaults: JSON.stringify({ isDefault: true }),
      },
    });
  }

  await setDefaultBrandKit(kits[0].id);
  const oldest = await prisma.brandKit.findUnique({ where: { id: kits[0].id } });
  return oldest ?? kits[0];
}

function toDTO(kit: BrandKit): BrandKitDTO {
  const ctaDefaults = parseJsonColumn(kit.ctaDefaults, ctaDefaultsSchema, {});
  return {
    id: kit.id,
    name: kit.name,
    tokens: resolveBrandTokens(kit),
    handle: kit.handle,
    logoAssetId: kit.logoAssetId,
    isDefault: ctaDefaults.isDefault === true,
    createdAt: kit.createdAt.toISOString(),
    updatedAt: kit.updatedAt.toISOString(),
  };
}

export async function listBrandKits(): Promise<BrandKitDTO[]> {
  await ensureDefaultBrandKit();
  await ensureSoleKitIsDefault();
  // Stable ordering by creation time so toggling the default doesn't reshuffle
  // the grid (every update bumps updatedAt).
  const kits = await prisma.brandKit.findMany({ orderBy: { createdAt: "asc" } });
  return kits.map(toDTO);
}

export async function getBrandKit(id: string): Promise<BrandKitDTO | null> {
  const kit = await prisma.brandKit.findUnique({ where: { id } });
  return kit ? toDTO(kit) : null;
}

/** Returns the raw BrandKit entity marked as default (creates Coral Harbor if needed). */
export async function getDefaultBrandKit(): Promise<BrandKit | null> {
  return ensureDefaultBrandKit();
}

/** When only one kit exists, persist it as the default so the editor picks it up. */
async function ensureSoleKitIsDefault(): Promise<void> {
  const kits = await prisma.brandKit.findMany({ select: { id: true, ctaDefaults: true } });
  if (kits.length !== 1) return;
  const only = kits[0];
  const current = parseJsonColumn(only.ctaDefaults, ctaDefaultsSchema, {});
  if (current.isDefault !== true) {
    await setDefaultBrandKit(only.id);
  }
}

export async function createBrandKit(name: string): Promise<BrandKitDTO> {
  const kit = await prisma.brandKit.create({ data: { name } });
  await ensureSoleKitIsDefault();
  const refreshed = await prisma.brandKit.findUnique({ where: { id: kit.id } });
  return toDTO(refreshed ?? kit);
}

export interface BrandKitPatch {
  name?: string;
  handle?: string | null;
  palette?: Record<string, string>;
  fonts?: { fontFamily?: string };
}

export async function updateBrandKit(
  id: string,
  patch: BrandKitPatch,
): Promise<BrandKitDTO> {
  const current = await prisma.brandKit.findUnique({ where: { id } });
  if (!current) throw new Error(`Brand kit ${id} not found`);

  const currentPalette = parseJsonColumn(current.palette, paletteSchema, {});
  const currentFonts = parseJsonColumn(current.fonts, fontsSchema, {});

  const kit = await prisma.brandKit.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
      ...(patch.palette !== undefined
        ? { palette: JSON.stringify({ ...currentPalette, ...patch.palette }) }
        : {}),
      ...(patch.fonts !== undefined
        ? { fonts: JSON.stringify({ ...currentFonts, ...patch.fonts }) }
        : {}),
    },
  });
  await ensureSoleKitIsDefault();
  const refreshed = await prisma.brandKit.findUnique({ where: { id } });
  return toDTO(refreshed ?? kit);
}

/**
 * Sets `id` as the system-wide default brand kit (or clears the default when
 * `id` is null). Only one kit can be default at a time.
 */
export async function setDefaultBrandKit(id: string | null): Promise<void> {
  const kits = await prisma.brandKit.findMany({ select: { id: true, ctaDefaults: true } });
  // Only write rows whose default flag actually changes so untouched kits keep
  // their updatedAt (and the seed colors/handle) intact.
  const writes = kits.flatMap((kit) => {
    const current = parseJsonColumn(kit.ctaDefaults, ctaDefaultsSchema, {});
    const wasDefault = current.isDefault === true;
    const shouldBeDefault = id !== null && kit.id === id;
    if (wasDefault === shouldBeDefault) return [];
    return [
      prisma.brandKit.update({
        where: { id: kit.id },
        data: { ctaDefaults: JSON.stringify({ ...current, isDefault: shouldBeDefault }) },
      }),
    ];
  });
  if (writes.length > 0) await prisma.$transaction(writes);
}

export async function deleteBrandKit(id: string): Promise<void> {
  await prisma.brandKit.delete({ where: { id } });
  await ensureSoleKitIsDefault();
}
