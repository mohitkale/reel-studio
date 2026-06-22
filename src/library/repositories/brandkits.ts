import type { BrandKit } from "@prisma/client";
import type { BrandKitDTO } from "@/lib/dto";
import type { BrandTokens } from "@/compositions/tokens";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { prisma } from "@/library/db";
import { paletteSchema, fontsSchema, parseJsonColumn } from "../schemas";

export function resolveBrandTokens(kit: BrandKit): BrandTokens {
  const palette = parseJsonColumn(kit.palette, paletteSchema, {});
  const fonts = parseJsonColumn(kit.fonts, fontsSchema, {});
  return {
    ...serverDefaultTokens,
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

function toDTO(kit: BrandKit): BrandKitDTO {
  return {
    id: kit.id,
    name: kit.name,
    tokens: resolveBrandTokens(kit),
    handle: kit.handle,
    logoAssetId: kit.logoAssetId,
    createdAt: kit.createdAt.toISOString(),
    updatedAt: kit.updatedAt.toISOString(),
  };
}

export async function listBrandKits(): Promise<BrandKitDTO[]> {
  const kits = await prisma.brandKit.findMany({ orderBy: { updatedAt: "desc" } });
  return kits.map(toDTO);
}

export async function getBrandKit(id: string): Promise<BrandKitDTO | null> {
  const kit = await prisma.brandKit.findUnique({ where: { id } });
  return kit ? toDTO(kit) : null;
}

export async function createBrandKit(name: string): Promise<BrandKitDTO> {
  const kit = await prisma.brandKit.create({ data: { name } });
  return toDTO(kit);
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
  return toDTO(kit);
}

export async function deleteBrandKit(id: string): Promise<void> {
  await prisma.brandKit.delete({ where: { id } });
}
