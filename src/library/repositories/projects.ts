import type { Prisma } from "@prisma/client";
import {
  parseJsonColumn,
  brandOverridesSchema,
  sceneConfigSchema,
} from "@/library/schemas";
import { collectSequenceSubjects } from "@/production/sequence-subjects";
import { randomUUID } from "node:crypto";

import type { ProjectDTO } from "@/lib/dto";
import type { ScenePlan } from "@/providers/ai/types";
import type { SceneBackground } from "@/video/types";
import type { ProductionPresetId } from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import {
  planMotionSequence,
  type MotionPlanSettings,
  type VisualAmbition,
} from "@/production/motion-plan";
import type { MotionDirection } from "@/production/motion";
import type { MediaPreference } from "@/lib/media-preference";
import type { ResolvedStockAsset } from "@/providers/stock/schemas";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  type EnergyId,
  type StyleId,
} from "@/video/visual-style";
import {
  type Orientation,
  DEFAULT_ORIENTATION,
  dimsFor,
} from "@/lib/orientation";
import {
  DEFAULT_VIDEO_ENGINE,
  type VideoEngineId,
  isVideoEngineId,
} from "@/engines/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import { sourcePlanSeed } from "@/production/director";
import { prisma } from "@/library/db";
import type { SceneLocks } from "@/library/schemas";
import {
  SAMPLE_PROJECT_NAME,
  SAMPLE_SCRIPT_NAME,
  SAMPLE_SCENES,
} from "@/library/sample-content";
import { getDefaultBrandKit } from "./brandkits";
import { resolveBrandTokens } from "./brandkits";
import { CORAL_HARBOR_NAME, CORAL_HARBOR_PALETTE } from "@/lib/brand-defaults";
import { defaultMotionSystem } from "@/production/motion-systems";
import { enrichSemanticSequence } from "@/production/semantic-direction";
import type { VisualTheme } from "@/production/creative-direction";
import { chapterPlanFromStarts } from "@/production/chapters";

function resolveEngine(engine?: VideoEngineId | string | null): VideoEngineId {
  return engine && isVideoEngineId(engine) ? engine : DEFAULT_VIDEO_ENGINE;
}

export async function listProjects(): Promise<ProjectDTO[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      scripts: {
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { scenes: true, takes: true } },
          scenes: {
            take: 1,
            orderBy: { order: "asc" },
            select: { text: true, layoutJson: true },
          },
        },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    archivedAt: p.archivedAt?.toISOString() ?? null,
    series: p.series,
    outputType:
      parseJsonColumn(p.scripts[0]?.brandOverrides, brandOverridesSchema, {})
        .creationOutputType ?? "video",
    thumbnailUrl:
      p.scripts[0]?.coverUrl ??
      (() => {
        const background = parseJsonColumn(
          p.scripts[0]?.scenes[0]?.layoutJson,
          sceneConfigSchema,
          {},
        ).background;
        return background?.type === "image" ? background.url : null;
      })(),
    openingText: p.scripts[0]?.scenes[0]?.text.slice(0, 160) ?? "",
    status: p.scripts.some((s) => s._count.takes > 0) ? "ready" : "draft",
    createdAt: p.createdAt.toISOString(),
    scriptCount: p.scripts.length,
    sceneCount: p.scripts.reduce((sum, s) => sum + s._count.scenes, 0),
    firstScriptId: p.scripts[0]?.id ?? null,
    brandKitId: p.brandKitId,
    videoEngine: resolveEngine(p.videoEngine),
  }));
}

/** Create a project with one empty script, returning the new script id. */
export async function createProject(
  name: string,
  orientation: Orientation = DEFAULT_ORIENTATION,
  videoEngine: VideoEngineId = DEFAULT_VIDEO_ENGINE,
): Promise<{ projectId: string; scriptId: string }> {
  const { width, height } = dimsFor(orientation);
  const engine = resolveEngine(videoEngine);
  const defaultKit = await getDefaultBrandKit();
  const project = await prisma.project.create({
    data: {
      name,
      videoEngine: engine,
      brandKitId: defaultKit?.id ?? null,
      scripts: { create: { name: "Untitled script", width, height } },
    },
    include: { scripts: true },
  });
  return { projectId: project.id, scriptId: project.scripts[0].id };
}

export async function deleteProject(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const scripts = await tx.script.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    await tx.sceneEdit.deleteMany({
      where: { scriptId: { in: scripts.map((script) => script.id) } },
    });
    await tx.project.delete({ where: { id } });
  });
}

export async function assignBrandKit(
  projectId: string,
  brandKitId: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { brandKitId } });
    const scripts = await tx.script.findMany({
      where: { projectId },
      select: { id: true, brandOverrides: true },
    });
    for (const script of scripts) {
      const overrides = parseJsonColumn(
        script.brandOverrides,
        brandOverridesSchema,
        {},
      );
      if (overrides.frozenBrandTokens) {
        const { frozenBrandTokens: _tokens, ...rest } = overrides;
        void _tokens;
        await tx.script.update({
          where: { id: script.id },
          data: { brandOverrides: JSON.stringify(rest) },
        });
      }
    }
  });
}

/**
 * Create a project + script + scenes from an AI-generated scene plan.
 * `backgrounds` (aligned by scene index) and `orientation` come from the AI
 * route after resolving stock imagery and the chosen video orientation.
 */
export async function createProjectFromPlan(
  plan: ScenePlan,
  orientation: Orientation = DEFAULT_ORIENTATION,
  backgrounds: (SceneBackground | undefined)[] = [],
  videoEngine: VideoEngineId = DEFAULT_VIDEO_ENGINE,
  visualStyle?: { styleId?: StyleId; energy?: EnergyId },
  production?: {
    series?: string;
    scriptSettings?: Pick<
      Prisma.ScriptCreateWithoutProjectInput,
      | "coverUrl"
      | "musicUrl"
      | "musicVolume"
      | "sfxEnabled"
      | "sfxJson"
      | "hideText"
      | "hideProgressBar"
      | "fps"
      | "width"
      | "height"
    >;
    savedOverrides?: Record<string, unknown>;
    visualTheme?: VisualTheme;
    brandKitId?: string | null;
    preset?: { id: ProductionPresetId; version: string };
    roles?: ProductionSceneRole[];
    chapterStarts?: Array<{ title: string; firstSceneIndex: number }>;
    assetRefs?: string[][];
    mediaPreferences?: MediaPreference[];
    stockSelections?: Array<ResolvedStockAsset | undefined>;
    visualAmbition?: VisualAmbition;
    /** Frozen revision decisions bypass planning when restoring a production. */
    motionPlan?: MotionPlanSettings;
    motions?: Array<MotionDirection | undefined>;
    sceneLocks?: Array<SceneLocks | undefined>;
    voiceMode?: "oneshot" | "per_scene";
    outputType?: "video" | "voiceover";
    creationSource?: {
      kind: "text" | "url" | "upload";
      url?: string;
      assetIds?: string[];
    };
  },
): Promise<{ projectId: string; scriptId: string }> {
  const { width, height } = dimsFor(orientation);
  const directedScenes =
    production?.preset && !production.motions
      ? enrichSemanticSequence(plan.scenes)
      : plan.scenes;
  const engine = resolveEngine(videoEngine);
  const fallbackTemplate = defaultTemplateIdForEngine(engine);
  const sceneIds = production?.chapterStarts
    ? plan.scenes.map(() => randomUUID())
    : [];
  const chapterPlan = production?.chapterStarts
    ? chapterPlanFromStarts(production.chapterStarts, sceneIds)
    : undefined;
  const defaultKit = await getDefaultBrandKit();
  // Automatic themes replace only the untouched starter palette. A selected
  // or customized brand remains authoritative, including on later kit changes.
  const starterKit =
    !defaultKit ||
    (defaultKit.name === CORAL_HARBOR_NAME &&
      (!defaultKit.handle || defaultKit.handle === "@yourbrand") &&
      (!defaultKit.fonts || defaultKit.fonts === "{}") &&
      Object.entries(CORAL_HARBOR_PALETTE).every(
        ([key, value]) =>
          resolveBrandTokens(defaultKit)[
            key as keyof typeof CORAL_HARBOR_PALETTE
          ] === value,
      ));
  const brandKitId =
    production?.brandKitId === undefined
      ? production?.visualTheme && starterKit
        ? null
        : (defaultKit?.id ?? null)
      : production.brandKitId;
  const styleId = visualStyle?.styleId ?? plan.styleId ?? DEFAULT_STYLE_ID;
  const energy = visualStyle?.energy ?? plan.energy ?? DEFAULT_ENERGY_ID;
  const motionPlan: MotionPlanSettings | undefined =
    production?.motionPlan ??
    (production?.preset && !production.motions
      ? {
          version: "1.0.0",
          seed: sourcePlanSeed(
            JSON.stringify({ preset: production.preset, scenes: plan.scenes }),
          ),
          ambition: production.visualAmbition ?? "expressive",
          system: defaultMotionSystem(
            production.visualTheme?.id,
            production.preset.id,
          ),
          adaptiveRecipes: true,
          sequenceDirection: true,
        }
      : undefined);
  if (motionPlan?.sequenceDirection && !production?.motions)
    motionPlan.subjectRegistry = collectSequenceSubjects(
      directedScenes,
      motionPlan.subjectRegistry,
    );
  const motions =
    production?.motions ??
    (motionPlan
      ? planMotionSequence(
          directedScenes.map((scene, order) => ({
            role: production?.roles?.[order],
            layout: {
              width,
              height,
              duration: Math.max(
                3,
                Math.min(
                  120,
                  (scene.spokenText ?? scene.text).split(/\s+/).length / 2.5 +
                    1,
                ),
              ),
            },
            energy,
            text: scene.text,
            spokenText: scene.spokenText,
            direction: scene.direction,
            chart: scene.chart,
            items: scene.items,
            background: backgrounds[order],
            hasVisualContent: Boolean(scene.visual),
            current: scene.direction?.motion,
            locked: Boolean(production?.sceneLocks?.[order]?.scene),
          })),
          motionPlan,
        )
      : []);
  const project = await prisma.project.create({
    data: {
      name: plan.projectName,
      series: production?.series ?? "",
      videoEngine: engine,
      brandKitId,
      scripts: {
        create: {
          name: plan.scriptName,
          width,
          height,
          ...production?.scriptSettings,
          brandOverrides: JSON.stringify({
            ...production?.savedOverrides,
            ...(production?.visualTheme
              ? { visualTheme: production.visualTheme }
              : {}),
            styleId,
            energy,
            ...(motionPlan ? { motionPlan } : {}),
            ...(chapterPlan ? { chapterPlan } : {}),
            ...(production?.preset
              ? { productionPreset: production.preset }
              : {}),
            ...(production?.creationSource
              ? { creationSource: production.creationSource }
              : {}),
            ...(production?.outputType
              ? { creationOutputType: production.outputType }
              : {}),
          }),
          voiceMode: production?.voiceMode ?? "oneshot",
          scenes: {
            create: directedScenes.map((scene, order) => {
              const background = backgrounds[order];
              const config: Record<string, unknown> = {};
              if (background) config.background = background;
              config.mediaPreference =
                production?.mediaPreferences?.[order] ?? "auto";
              if (scene.mood) config.mood = scene.mood;
              if (scene.musicMood) config.musicMood = scene.musicMood;
              if (scene.items?.length) config.items = scene.items;
              if (scene.chart) config.chart = scene.chart;
              const role = scene.direction?.graphic
                ? scene.direction.role
                : production?.roles?.[order];
              if (role) config.role = role;
              if (production?.sceneLocks?.[order])
                config.locks = production.sceneLocks[order];
              const motion = motions[order];
              if (motion) config.motion = motion;
              if (scene.direction) config.direction = scene.direction;
              return {
                ...(chapterPlan ? { id: sceneIds[order] } : {}),
                order,
                templateId: scene.templateId || fallbackTemplate,
                text: scene.text,
                spokenText: scene.spokenText ?? null,
                emphasis: scene.emphasis.length
                  ? JSON.stringify(scene.emphasis)
                  : null,
                visual: scene.visual ?? null,
                layoutJson: Object.keys(config).length
                  ? JSON.stringify(config)
                  : null,
                assetRefs: production?.assetRefs?.[order]?.length
                  ? JSON.stringify(production.assetRefs[order])
                  : null,
                ...(production?.stockSelections?.[order]
                  ? {
                      stockMediaSelection: {
                        create: {
                          providerId:
                            production.stockSelections[order]!.providerSnapshot
                              .providerId,
                          providerAssetId:
                            production.stockSelections[order]!.providerSnapshot
                              .providerAssetId,
                          kind: production.stockSelections[order]!
                            .providerSnapshot.kind,
                          snapshotJson: JSON.stringify(
                            production.stockSelections[order],
                          ),
                          localAssetId:
                            production.stockSelections[order]!.localAssetId ??
                            null,
                        },
                      },
                    }
                  : {}),
              };
            }),
          },
        },
      },
    },
    include: { scripts: true },
  });
  return { projectId: project.id, scriptId: project.scripts[0].id };
}

/** Seed the sample project + script + scenes if the database has no projects yet. */
export async function ensureSampleSeed(): Promise<void> {
  const count = await prisma.project.count();
  if (count > 0) return;

  const defaultKit = await getDefaultBrandKit();
  await prisma.project.create({
    data: {
      name: SAMPLE_PROJECT_NAME,
      videoEngine: DEFAULT_VIDEO_ENGINE,
      brandKitId: defaultKit?.id ?? null,
      scripts: {
        create: {
          name: SAMPLE_SCRIPT_NAME,
          scenes: {
            create: SAMPLE_SCENES.map((scene, order) => ({
              order,
              templateId: scene.templateId,
              text: scene.text,
              emphasis: scene.emphasis ? JSON.stringify(scene.emphasis) : null,
            })),
          },
        },
      },
    },
  });
}

export async function organizeProject(
  id: string,
  data: { archived?: boolean; series?: string; name?: string },
) {
  await prisma.project.update({
    where: { id },
    data: {
      ...(data.archived !== undefined
        ? { archivedAt: data.archived ? new Date() : null }
        : {}),
      ...(data.series !== undefined ? { series: data.series } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
    },
  });
}
