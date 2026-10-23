import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/library/db";
import {
  studioPresetSchema,
  studioPresetInputSchema,
} from "@/lib/studio-preset";
import { ProviderError } from "@/providers/voice/types";
export async function listStudioPresets() {
  const rows = await prisma.studioPreset.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    ...studioPresetSchema.parse(JSON.parse(row.documentJson)),
  }));
}
export async function saveStudioPreset(
  input: unknown,
  client: PrismaClient = prisma,
) {
  const supplied = studioPresetInputSchema.parse(input);
  const value = studioPresetSchema.parse(supplied);
  return client.$transaction(async (tx) => {
    const existing = await tx.studioPreset.findUnique({
      where: { name: value.name },
    });
    if (!existing && (await tx.studioPreset.count()) >= 50)
      throw new ProviderError(
        "The 50-preset library is full. Update an existing preset.",
        409,
      );
    const previous = existing
      ? studioPresetSchema.parse(JSON.parse(existing.documentJson))
      : undefined;
    const merged = studioPresetSchema.parse({
      ...previous,
      ...value,
      voice: supplied.voice ?? previous?.voice,
      pronunciations: supplied.pronunciations ?? previous?.pronunciations ?? [],
    });
    return tx.studioPreset.upsert({
      where: { name: value.name },
      create: { name: value.name, documentJson: JSON.stringify(merged) },
      update: { documentJson: JSON.stringify(merged) },
    });
  });
}
