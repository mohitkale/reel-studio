import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import type { ScriptDTO, VoiceMode } from "@/lib/dto";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  normalizeEnergyId,
  normalizeStyleId,
  type EnergyId,
  type StyleId,
} from "@/video/visual-style";
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
import { toCaptionTrackDTO } from "./captions";
import { getAssets } from "./assets";

function resolveEngine(value: string | null | undefined): VideoEngineId {
  return value && isVideoEngineId(value) ? value : DEFAULT_VIDEO_ENGINE;
}

function resolveVoiceMode(value: string | null | undefined): VoiceMode {
  const parsed = voiceModeSchema.safeParse(value ?? "oneshot");
  return parsed.success ? parsed.data : "oneshot";
}

/** Batch all relations once per list request; no time cache can hide an edit. */
export async function getScripts(
  ids: string[],
): Promise<Map<string, ScriptDTO>> {
  if (!ids.length) return new Map();
  const scripts = await prisma.script.findMany({
    where: { id: { in: [...new Set(ids)] } },
    include: {
      scenes: { orderBy: { order: "asc" } },
      takes: { orderBy: { createdAt: "desc" } },
      voiceClips: { orderBy: { createdAt: "desc" } },
      captionTracks: {
        include: { cues: { orderBy: { order: "asc" } } },
        orderBy: { updatedAt: "desc" },
      },
      project: { include: { brandKit: true } },
    },
  });
  const defaultKit = scripts.some((s) => !s.project.brandKit)
    ? await getDefaultBrandKit()
    : null;
  const sceneDTOs = new Map(
    scripts.map((s) => [s.id, s.scenes.map(toSceneDTO)]),
  );
  const assetIds = [
    ...new Set(
      [...sceneDTOs.values()].flat().flatMap((scene) => scene.assetRefs ?? []),
    ),
  ];
  const assets = await getAssets(assetIds);
  const imageUrls = new Map(
    assets.filter((a) => a.type === "image").map((a) => [a.id, a.url] as const),
  );
  return new Map(
    scripts.map((script) => {
      const brandKit = script.project.brandKit ?? defaultKit;
      const captionTracks = script.captionTracks.map(toCaptionTrackDTO);
      const overrides = parseJsonColumn(
        script.brandOverrides,
        brandOverridesSchema,
        {},
      );
      const scenes = sceneDTOs.get(script.id)!;
      const dto: ScriptDTO = {
        id: script.id,
        projectId: script.projectId,
        name: script.name,
        fps: script.fps,
        width: script.width,
        height: script.height,
        videoEngine: resolveEngine(script.project.videoEngine),
        scenes: scenes.map((scene) => {
          const carouselImages = (scene.assetRefs ?? []).flatMap((assetId) => {
            const url = imageUrls.get(assetId);
            return url ? [url] : [];
          });
          return {
            ...scene,
            templateId: normalizeHfTemplateId(scene.templateId),
            carouselImages: carouselImages.length ? carouselImages : undefined,
          };
        }),
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
        sfxEnabled: script.sfxEnabled ?? true,
        sfxJson: script.sfxJson ?? null,
        hideText: script.hideText,
        hideProgressBar: script.hideProgressBar ?? false,
        styleId: normalizeStyleId(overrides.styleId),
        energy: normalizeEnergyId(overrides.energy),
        productionPreset: overrides.productionPreset,
        motionPlan: overrides.motionPlan,
        musicMap:
          overrides.musicMap?.sourceUrl === script.musicUrl
            ? overrides.musicMap
            : undefined,
        captionTracks,
        audioMastering: overrides.audioMastering ?? "original",
        chapterPlan: overrides.chapterPlan,
        chapterDraft: overrides.chapterDraft,
      };
      return [script.id, dto] as const;
    }),
  );
}

export async function getScript(id: string): Promise<ScriptDTO | null> {
  return (await getScripts([id])).get(id) ?? null;
}

export async function updateScript(
  id: string,
  data: {
    name?: string;
    coverUrl?: string | null;
    musicUrl?: string | null;
    musicVolume?: number;
    sfxEnabled?: boolean;
    sfxJson?: string | null;
    hideText?: boolean;
    hideProgressBar?: boolean;
    styleId?: StyleId;
    energy?: EnergyId;
    voiceMode?: VoiceMode;
    audioMastering?: import("@/production/audio-mastering").AudioMastering;
    chapterDraft?: import("@/production/chapter-draft").ChapterDraft;
  },
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl || null } : {}),
    ...(data.musicUrl !== undefined ? { musicUrl: data.musicUrl || null } : {}),
    ...(data.musicVolume !== undefined
      ? {
          musicVolume: Math.max(0, Math.min(100, Math.round(data.musicVolume))),
        }
      : {}),
    ...(data.sfxEnabled !== undefined ? { sfxEnabled: data.sfxEnabled } : {}),
    ...(data.sfxJson !== undefined ? { sfxJson: data.sfxJson || null } : {}),
    ...(data.hideText !== undefined ? { hideText: data.hideText } : {}),
    ...(data.hideProgressBar !== undefined
      ? { hideProgressBar: data.hideProgressBar }
      : {}),
    ...(data.voiceMode !== undefined ? { voiceMode: data.voiceMode } : {}),
  };

  await prisma.$transaction(async (tx) => {
    if (
      data.styleId !== undefined ||
      data.energy !== undefined ||
      data.audioMastering !== undefined ||
      data.chapterDraft !== undefined
    ) {
      const current = await tx.script.findUnique({
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
        ...(data.chapterDraft !== undefined
          ? { chapterDraft: data.chapterDraft }
          : {}),
        ...(data.audioMastering !== undefined
          ? { audioMastering: data.audioMastering }
          : {}),
      });
    }

    await tx.script.update({
      where: { id },
      data: patch as Parameters<typeof prisma.script.update>[0]["data"],
    });
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
