import type { ProjectDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import {
  SAMPLE_PROJECT_NAME,
  SAMPLE_SCRIPT_NAME,
  SAMPLE_SCENES,
} from "@/library/sample-content";

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
  }));
}

/** Create a project with one empty script, returning the new script id. */
export async function createProject(
  name: string,
): Promise<{ projectId: string; scriptId: string }> {
  const project = await prisma.project.create({
    data: {
      name,
      scripts: { create: { name: "Untitled script" } },
    },
    include: { scripts: true },
  });
  return { projectId: project.id, scriptId: project.scripts[0].id };
}

export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({ where: { id } });
}

/** Seed the sample project + script + scenes if the database has no projects yet. */
export async function ensureSampleSeed(): Promise<void> {
  const count = await prisma.project.count();
  if (count > 0) return;

  await prisma.project.create({
    data: {
      name: SAMPLE_PROJECT_NAME,
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
