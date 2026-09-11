import { z } from "zod";

import { ENERGY_IDS, STYLE_IDS } from "@/compositions/visual-style";
import { VIDEO_ENGINE_IDS } from "@/engines/types";
import { ORIENTATIONS } from "@/lib/orientation";
import { productionPresetIdSchema } from "@/production/presets";
import { productionSceneRoleSchema } from "@/production/roles";

export const PRODUCTION_SPEC_VERSION = 1 as const;
export const LEGACY_PRESET_ID = "legacy" as const;
export const LEGACY_PRESET_VERSION = "0.3.0" as const;

const assetIdSchema = z.string().min(1).max(160);
const sceneIdSchema = z.string().min(1).max(160);
const frameSchema = z.number().int().nonnegative();
const positiveFrameSchema = z.number().int().positive();

export const productionAssetSchema = z.object({
  id: assetIdSchema,
  type: z.enum(["image", "video", "audio", "lottie", "font", "data"]),
  uri: z.string().min(1).max(4096),
  checksum: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  source: z.enum(["uploaded", "bundled", "generated", "provider", "legacy"]),
  attribution: z.string().max(500).optional(),
});
export type ProductionAsset = z.infer<typeof productionAssetSchema>;

export const productionChartDataSchema = z
  .object({
    labels: z.array(z.string().min(1).max(120)).min(1).max(100),
    series: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          values: z.array(z.number().finite()).min(1).max(100),
          unit: z.string().max(40).optional(),
        }),
      )
      .min(1)
      .max(12),
    sourceAttribution: z.string().max(500).optional(),
  })
  .superRefine((chart, ctx) => {
    for (const [index, series] of chart.series.entries()) {
      if (series.values.length !== chart.labels.length) {
        ctx.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: "Chart values must match the number of labels",
        });
      }
    }
  });

export const productionSceneSchema = z.object({
  id: sceneIdSchema,
  order: z.number().int().nonnegative(),
  role: productionSceneRoleSchema,
  template: z.object({
    /** Stored source id remains available when a legacy id resolves to a fallback. */
    sourceId: z.string().min(1).max(160),
    resolvedId: z.string().min(1).max(160),
    version: z.string().min(1).max(80),
  }),
  displayText: z.string().max(2_000),
  narrationText: z.string().max(12_000),
  emphasis: z.array(z.string().min(1).max(240)).max(30),
  visual: z.string().max(1_000).optional(),
  items: z.array(z.string().min(1).max(500)).max(30).optional(),
  assetRefs: z.array(assetIdSchema),
  chart: productionChartDataSchema.optional(),
  timing: z.object({
    startFrame: frameSchema,
    durationFrames: positiveFrameSchema,
  }),
  locks: z.object({
    copy: z.boolean(),
    assets: z.boolean(),
    scene: z.boolean(),
  }),
  presentation: z.object({
    hideText: z.boolean(),
    mood: z.string().max(60).optional(),
  }),
});

export const productionOutputSchema = z
  .object({
    kind: z.enum(["video", "audio", "podcast", "audiogram", "captions"]),
    format: z.enum(["mp4", "wav", "mp3", "srt", "vtt", "zip"]),
    orientation: z.enum(ORIENTATIONS).optional(),
    quality: z.enum(["draft", "standard", "high"]).optional(),
  })
  .superRefine((output, ctx) => {
    if (
      (output.kind === "video" || output.kind === "audiogram") &&
      !output.orientation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["orientation"],
        message: "Video outputs require an orientation",
      });
    }
    const validFormats: Record<typeof output.kind, readonly string[]> = {
      video: ["mp4"],
      audiogram: ["mp4"],
      audio: ["wav", "mp3"],
      podcast: ["wav", "mp3"],
      captions: ["srt", "vtt"],
    };
    if (!validFormats[output.kind].includes(output.format)) {
      ctx.addIssue({
        code: "custom",
        path: ["format"],
        message: `${output.format} is not valid for ${output.kind}`,
      });
    }
  });
export type ProductionOutput = z.infer<typeof productionOutputSchema>;

const brandSnapshotSchema = z.object({
  brandKitId: z.string().nullable(),
  tokens: z.object({
    background: z.string().min(1).max(120),
    backgroundAccent: z.string().min(1).max(120),
    foreground: z.string().min(1).max(120),
    muted: z.string().min(1).max(120),
    accent: z.string().min(1).max(120),
    accentSecondary: z.string().min(1).max(120),
    accentForeground: z.string().min(1).max(120),
    handle: z.string().max(120),
    fontFamily: z.string().min(1).max(300),
    radius: z.number().nonnegative().max(500),
  }),
  styleId: z.enum(STYLE_IDS),
  energy: z.enum(ENERGY_IDS),
});

const timedCaptionWordSchema = z
  .object({
    text: z.string().min(1).max(240),
    startFrame: frameSchema,
    endFrame: positiveFrameSchema,
  })
  .refine((word) => word.endFrame > word.startFrame, {
    path: ["endFrame"],
    message: "Caption word must end after it starts",
  });

const captionCueSchema = z
  .object({
    id: z.string().min(1).max(160),
    startFrame: frameSchema,
    endFrame: positiveFrameSchema,
    text: z.string().min(1).max(2_000),
    words: z.array(timedCaptionWordSchema).optional(),
  })
  .superRefine((cue, ctx) => {
    if (cue.endFrame <= cue.startFrame) {
      ctx.addIssue({
        code: "custom",
        path: ["endFrame"],
        message: "Caption cue must end after it starts",
      });
    }
    for (const [index, word] of (cue.words ?? []).entries()) {
      if (word.startFrame < cue.startFrame || word.endFrame > cue.endFrame) {
        ctx.addIssue({
          code: "custom",
          path: ["words", index],
          message: "Caption word timing must remain inside its cue",
        });
      }
    }
  });

export const productionSpecSchema = z
  .object({
    schemaVersion: z.literal(PRODUCTION_SPEC_VERSION),
    id: z.string().min(1).max(240),
    createdAt: z.iso.datetime({ offset: true }),
    productionKind: z.enum(["video", "audio", "podcast", "audiogram"]),
    source: z.object({
      kind: z.enum(["script", "brief", "article", "upload", "podcast"]),
      id: z.string().max(240).optional(),
      revision: z.string().min(1).max(240),
      contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    }),
    engine: z.object({
      id: z.enum(VIDEO_ENGINE_IDS),
      adapterVersion: z.string().min(1).max(80),
      catalogRevision: z.string().min(1).max(160),
    }),
    preset: z.object({
      id: z.union([productionPresetIdSchema, z.literal(LEGACY_PRESET_ID)]),
      version: z.string().min(1).max(80),
    }),
    brand: brandSnapshotSchema,
    canvas: z.object({
      orientation: z.enum(ORIENTATIONS),
      width: z.number().int().positive().max(7680),
      height: z.number().int().positive().max(7680),
      fps: z.number().int().min(1).max(120),
    }),
    assets: z.array(productionAssetSchema),
    scenes: z.array(productionSceneSchema).min(1).max(240),
    narration: z.object({
      mode: z.enum(["none", "oneshot", "per_scene", "podcast_cast"]),
      readiness: z.enum(["missing", "ready", "placeholder", "stale"]),
      takeId: z.string().optional(),
      providerId: z.string().optional(),
      voiceId: z.string().optional(),
      modelId: z.string().nullable().optional(),
      audioAssetRef: assetIdSchema.optional(),
    }),
    captions: z.object({
      enabled: z.boolean(),
      timingSource: z.enum([
        "provider",
        "local-transcription",
        "estimated",
        "imported",
      ]),
      cues: z.array(captionCueSchema),
    }),
    audio: z.object({
      musicAssetRef: assetIdSchema.optional(),
      musicVolume: z.number().min(0).max(1),
      sfx: z.array(
        z.object({
          assetRef: assetIdSchema,
          startFrame: frameSchema,
          volume: z.number().min(0).max(1),
        }),
      ),
    }),
    timing: z.object({
      contentFrames: positiveFrameSchema,
      coverFrames: frameSchema,
      totalFrames: positiveFrameSchema,
    }),
    requestedOutputs: z.array(productionOutputSchema).min(1).max(12),
  })
  .superRefine((spec, ctx) => {
    const assetIds = new Set<string>();
    for (const [index, asset] of spec.assets.entries()) {
      if (assetIds.has(asset.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "id"],
          message: `Duplicate asset id: ${asset.id}`,
        });
      }
      assetIds.add(asset.id);
    }

    const sceneIds = new Set<string>();
    const sceneOrders = new Set<number>();
    for (const [index, scene] of spec.scenes.entries()) {
      if (sceneIds.has(scene.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "id"],
          message: `Duplicate scene id: ${scene.id}`,
        });
      }
      sceneIds.add(scene.id);
      if (sceneOrders.has(scene.order)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "order"],
          message: `Duplicate scene order: ${scene.order}`,
        });
      }
      sceneOrders.add(scene.order);
      if (scene.order !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "order"],
          message: "Scenes must use contiguous order values starting at zero",
        });
      }
      if (
        scene.timing.startFrame + scene.timing.durationFrames >
        spec.timing.contentFrames
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", index, "timing"],
          message: "Scene timing exceeds the content timeline",
        });
      }
      for (const assetRef of scene.assetRefs) {
        if (!assetIds.has(assetRef)) {
          ctx.addIssue({
            code: "custom",
            path: ["scenes", index, "assetRefs"],
            message: `Unknown asset reference: ${assetRef}`,
          });
        }
      }
    }

    const captionIds = new Set<string>();
    for (const [index, cue] of spec.captions.cues.entries()) {
      if (captionIds.has(cue.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["captions", "cues", index, "id"],
          message: `Duplicate caption cue id: ${cue.id}`,
        });
      }
      captionIds.add(cue.id);
      if (cue.endFrame > spec.timing.contentFrames) {
        ctx.addIssue({
          code: "custom",
          path: ["captions", "cues", index, "endFrame"],
          message: "Caption cue exceeds the content timeline",
        });
      }
    }

    const audioRefs = [
      spec.narration.audioAssetRef,
      spec.audio.musicAssetRef,
      ...spec.audio.sfx.map((cue) => cue.assetRef),
    ].filter((ref): ref is string => Boolean(ref));
    for (const assetRef of audioRefs) {
      if (!assetIds.has(assetRef)) {
        ctx.addIssue({
          code: "custom",
          path: ["audio"],
          message: `Unknown audio asset reference: ${assetRef}`,
        });
      }
    }

    if (
      spec.timing.totalFrames !==
      spec.timing.contentFrames + spec.timing.coverFrames
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["timing", "totalFrames"],
        message: "totalFrames must equal contentFrames plus coverFrames",
      });
    }
  });

export type ProductionSpec = z.infer<typeof productionSpecSchema>;
