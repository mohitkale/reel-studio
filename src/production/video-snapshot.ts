import { z } from "zod";
import {
  sceneConfigSchema,
  timelineSchema,
  captionWordsSchema,
  captionTimingSourceSchema,
  brandOverridesSchema,
} from "@/library/schemas";
import { resolvedStockAssetSchema } from "@/providers/stock/schemas";
import {
  captionStyleSnapshotSchema,
  LEGACY_CAPTION_STYLE,
} from "@/lib/caption-style";

const scene = sceneConfigSchema.extend({
  id: z.string().min(1),
  scriptId: z.string().min(1),
  order: z.number().int(),
  templateId: z.string().min(1),
  text: z.string(),
  spokenText: z.string().nullable(),
  emphasis: z.array(z.string()),
  visual: z.string().optional(),
  hideText: z.boolean().nullable(),
  selectedVoiceClipId: z.string().nullable(),
  assetRefs: z.array(z.string()).optional(),
  carouselImages: z.array(z.string().min(1)).optional(),
});
export const videoTakeSnapshotSchema = z
  .object({
    id: z.string(),
    scriptId: z.string(),
    label: z.string().nullable(),
    providerId: z.string(),
    voiceId: z.string(),
    modelId: z.string().nullable(),
    fps: z.number().positive(),
    totalFrames: z.number().int().positive(),
    timeline: timelineSchema,
    audioUrl: z.string(),
    isPlaceholder: z.boolean(),
    source: z.enum(["oneshot", "assembled"]),
    createdAt: z.string(),
  })
  .strict();
export const videoScriptSnapshotSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  videoEngine: z.enum(["remotion", "hyperframes"]),
  scenes: z.array(scene).min(1),
  brandTokens: z.object({
    background: z.string(),
    backgroundAccent: z.string(),
    foreground: z.string(),
    muted: z.string(),
    accent: z.string(),
    accentSecondary: z.string(),
    accentForeground: z.string(),
    handle: z.string(),
    fontFamily: z.string(),
    radius: z.number(),
  }),
  coverUrl: z.string().nullable(),
  musicUrl: z.string().nullable(),
  musicVolume: z.number().min(0).max(100),
  sfxEnabled: z.boolean(),
  sfxJson: z.string().nullable(),
  hideText: z.boolean(),
  hideProgressBar: z.boolean(),
  styleId: z.enum(["bold-hook", "clean-story", "teach-me", "soft-brand"]),
  energy: z.enum(["calm", "normal", "high"]),
  productionPreset: brandOverridesSchema.shape.productionPreset,
  captionTracks: z
    .array(
      z.object({
        id: z.string(),
        scriptId: z.string(),
        label: z.string(),
        language: z.string(),
        timingSource: captionTimingSourceSchema,
        enabled: z.boolean(),
        style: captionStyleSnapshotSchema.default(LEGACY_CAPTION_STYLE),
        updatedAt: z.string(),
        cues: z.array(
          z.object({
            id: z.string(),
            order: z.number().int(),
            startFrame: z.number().int().nonnegative(),
            endFrame: z.number().int().positive(),
            text: z.string(),
            words: captionWordsSchema.optional(),
          }),
        ),
      }),
    )
    .optional(),
});
export const videoSnapshotSchema = z
  .object({
    version: z.literal(1),
    sfxAssets: z.record(z.string(), z.string()).optional(),
    stockMedia: z
      .array(
        z
          .object({
            sceneId: z.string().min(1),
            snapshot: resolvedStockAssetSchema,
          })
          .strict(),
      )
      .default([]),
    script: videoScriptSnapshotSchema,
    take: videoTakeSnapshotSchema.nullable(),
  })
  .strict();
export type VideoSnapshot = z.infer<typeof videoSnapshotSchema>;

export function stockMediaOutputMetadata(snapshot: VideoSnapshot) {
  return snapshot.stockMedia.map(({ sceneId, snapshot: selected }) => ({
    sceneId,
    providerId: selected.providerSnapshot.providerId,
    providerAssetId: selected.providerSnapshot.providerAssetId,
    kind: selected.providerSnapshot.kind,
    creator: selected.providerSnapshot.creator,
    creatorUrl: selected.providerSnapshot.creatorUrl,
    sourcePageUrl: selected.providerSnapshot.sourcePageUrl,
    attribution: selected.providerSnapshot.attribution,
    acquisitionPolicy: selected.providerSnapshot.acquisitionPolicy,
    selectedRendition: selected.selectedRendition,
    sourceRevision: selected.sourceRevision,
    localAssetId: selected.localAssetId,
    contentHash: selected.contentHash,
    usageEvent: selected.usageEvent,
  }));
}

/** Validates the exact internal composition artifact consumed by either adapter. */
export const preparedVideoCompositionSchema = z
  .object({
    totalFrames: z.number().int().positive(),
    props: z.object({
      scenes: z.array(
        scene
          .pick({
            id: true,
            templateId: true,
            text: true,
            emphasis: true,
            visual: true,
            items: true,
            chart: true,
            carouselImages: true,
            role: true,
            mood: true,
            order: true,
          })
          .extend({
            hideText: z.boolean().optional(),
            background: sceneConfigSchema.shape.background
              .unwrap()
              .extend({ url: z.string().min(1) })
              .optional(),
          }),
      ),
      timeline: z.array(
        z.object({
          sceneId: z.string(),
          startFrame: z.number().int().nonnegative(),
          durationFrames: z.number().int().nonnegative(),
        }),
      ),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      fps: z.number().positive(),
      audioUrl: z.string().optional(),
      musicUrl: z.string().optional(),
      musicVolume: z.number().optional(),
      coverUrl: z.string().optional(),
      sfxCues: z
        .array(
          z.object({
            url: z.string(),
            startFrame: z.number().int().nonnegative(),
            volume: z.number(),
          }),
        )
        .optional(),
      tokens: videoScriptSnapshotSchema.shape.brandTokens,
      hideProgressBar: z.boolean().optional(),
      styleId: videoScriptSnapshotSchema.shape.styleId.optional(),
      energy: videoScriptSnapshotSchema.shape.energy.optional(),
      preset: videoScriptSnapshotSchema.shape.productionPreset,
      catalogRevision: z.string().min(1).optional(),
      captions: videoScriptSnapshotSchema.shape.captionTracks
        .unwrap()
        .element.optional(),
    }),
  })
  .strict();
