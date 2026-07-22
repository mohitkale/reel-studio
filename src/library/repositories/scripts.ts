import type { ScriptDTO, VoiceMode } from "@/lib/dto";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  normalizeEnergyId,
  normalizeStyleId,
  type EnergyId,
  type StyleId,
} from "@/compositions/visual-style";
import {
  DEFAULT_VIDEO_ENGINE,
  isVideoEngineId,
  type VideoEngineId,
} from "@/engines/types";
import { prisma } from "@/library/db";
import {
  brandOverridesSchema,
  parseJsonColumn,
  voiceModeSchema,
} from "@/library/schemas";
import { resolveBrandTokens, getDefaultBrandKit } from "./brandkits";
import { toSceneDTO, toTakeDTO, toVoiceClipDTO } from "./map";

function resolveEngine(value: string | null | undefined): VideoEngineId {
  return value && isVideoEngineId(value) ? value : DEFAULT_VIDEO_ENGINE;
}

function resolveVoiceMode(value: string | null | undefined): VoiceMode {
  const parsed = voiceModeSchema.safeParse(value ?? "oneshot");
  return parsed.success ? parsed.data : "oneshot";
}

export async function getScript(id: string): Promise<ScriptDTO | null> {
  const script = await prisma.script.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      takes: { orderBy: { createdAt: "desc" } },
      voiceClips: { orderBy: { createdAt: "desc" } },
      project: { include: { brandKit: true } },
    },
  });
  if (!script) return null;

  const brandKit = script.project.brandKit ?? await getDefaultBrandKit();
  const overrides = parseJsonColumn(
    script.brandOverrides,
    brandOverridesSchema,
    {},
  );

  return {
    id: script.id,
    projectId: script.projectId,
    name: script.name,
    fps: script.fps,
    width: script.width,
    height: script.height,
    videoEngine: resolveEngine(script.project.videoEngine),
    scenes: script.scenes.map(toSceneDTO),
    takes: script.takes.map(toTakeDTO),
    voiceClips: script.voiceClips.map(toVoiceClipDTO),
    voiceMode: resolveVoiceMode(script.voiceMode),
    brandKitId: script.project.brandKitId,
    brandTokens: brandKit
      ? resolveBrandTokens(brandKit)
      : { ...serverDefaultTokens },
    coverUrl: script.coverUrl,
    musicUrl: script.musicUrl,
    musicVolume: script.musicVolume,
    hideText: script.hideText,
    hideProgressBar: script.hideProgressBar ?? false,
    styleId: normalizeStyleId(overrides.styleId),
    energy: normalizeEnergyId(overrides.energy),
  };
}

export async function updateScript(
  id: string,
  data: {
    name?: string;
    coverUrl?: string | null;
    musicUrl?: string | null;
    musicVolume?: number;
    hideText?: boolean;
    hideProgressBar?: boolean;
    styleId?: StyleId;
    energy?: EnergyId;
    voiceMode?: VoiceMode;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
    ...(data.musicUrl !== undefined ? { musicUrl: data.musicUrl || null } : {}),
    ...(data.musicVolume !== undefined
      ? { musicVolume: Math.max(0, Math.min(100, Math.round(data.musicVolume))) }
      : {}),
    ...(data.hideText !== undefined ? { hideText: data.hideText } : {}),
    ...(data.hideProgressBar !== undefined ? { hideProgressBar: data.hideProgressBar } : {}),
    ...(data.voiceMode !== undefined ? { voiceMode: data.voiceMode } : {}),
  };

  if (data.styleId !== undefined || data.energy !== undefined) {
    const current = await prisma.script.findUnique({
      where: { id },
      select: { brandOverrides: true },
    });
    const overrides = parseJsonColumn(
      current?.brandOverrides,
      brandOverridesSchema,
      {},
    );
    patch.brandOverrides = JSON.stringify({
      ...overrides,
      ...(data.styleId !== undefined ? { styleId: data.styleId } : {}),
      ...(data.energy !== undefined ? { energy: data.energy } : {}),
    });
  }

  await prisma.script.update({
    where: { id },
    data: patch as Parameters<typeof prisma.script.update>[0]["data"],
  });
}

/** Persist Style + Energy into brandOverrides (used by AI project create). */
export async function setScriptVisualStyle(
  scriptId: string,
  styleId: StyleId = DEFAULT_STYLE_ID,
  energy: EnergyId = DEFAULT_ENERGY_ID,
): Promise<void> {
  await updateScript(scriptId, { styleId, energy });
}
