import type { ProjectDTO } from "@/lib/dto";
import type { ScenePlan } from "@/providers/ai/types";
import type { SceneBackground } from "@/compositions/types";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  type EnergyId,
  type StyleId,
} from "@/compositions/visual-style";
import { type Orientation, DEFAULT_ORIENTATION, dimsFor } from "@/lib/orientation";
import {
  DEFAULT_VIDEO_ENGINE,
  type VideoEngineId,
  isVideoEngineId,
} from "@/engines/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import { prisma } from "@/library/db";
import {
  SAMPLE_PROJECT_NAME,
  SAMPLE_SCRIPT_NAME,
  SAMPLE_SCENES,
} from "@/library/sample-content";
import { getDefaultBrandKit } from "./brandkits";

function resolveEngine(engine?: VideoEngineId | string | null): VideoEngineId {
  return engine && isVideoEngineId(engine) ? engine : DEFAULT_VIDEO_ENGINE;
}

export async function listProjects(): Promise<ProjectDTO[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      scripts: {
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { scenes: true } } },
      },
    },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
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
  await prisma.project.delete({ where: { id } });
}

export async function assignBrandKit(
  projectId: string,
  brandKitId: string | null,
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { brandKitId },
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
): Promise<{ projectId: string; scriptId: string }> {
  const { width, height } = dimsFor(orientation);
  const engine = resolveEngine(videoEngine);
  const fallbackTemplate = defaultTemplateIdForEngine(engine);
  const defaultKit = await getDefaultBrandKit();
  const styleId = visualStyle?.styleId ?? plan.styleId ?? DEFAULT_STYLE_ID;
  const energy = visualStyle?.energy ?? plan.energy ?? DEFAULT_ENERGY_ID;
  const project = await prisma.project.create({
    data: {
      name: plan.projectName,
      videoEngine: engine,
      brandKitId: defaultKit?.id ?? null,
      scripts: {
        create: {
          name: plan.scriptName,
          width,
          height,
          brandOverrides: JSON.stringify({ styleId, energy }),
          scenes: {
            create: plan.scenes.map((scene, order) => {
              const background = backgrounds[order];
              const config: Record<string, unknown> = {};
              if (background) config.background = background;
              if (scene.mood) config.mood = scene.mood;
              if (scene.musicMood) config.musicMood = scene.musicMood;
              if (scene.items?.length) config.items = scene.items;
              return {
                order,
                templateId: scene.templateId || fallbackTemplate,
                text: scene.text,
                emphasis: scene.emphasis.length
                  ? JSON.stringify(scene.emphasis)
                  : null,
                visual: scene.visual ?? null,
                layoutJson: Object.keys(config).length
                  ? JSON.stringify(config)
                  : null,
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
