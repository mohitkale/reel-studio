import { prisma } from "@/library/db";
import { updateScript, getScript } from "@/library/repositories/scripts";
import { chapterPlanIssue } from "@/production/chapters";
import { saveChapterPlan } from "@/library/chapter-service";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { normalizeTemplateIdForEngine } from "@/engines/registry";
import { scenePlanSchema, type ScenePlan } from "@/providers/ai/types";

export async function restoreProductionRevision(snapshotValue: unknown) {
  const snapshot = videoSnapshotSchema.parse(snapshotValue);
  if (snapshot.script.scenes.length > 240)
    throw new Error("Revision restore supports up to 240 scenes.");
  if (snapshot.script.chapterPlan) {
    const issue = chapterPlanIssue(
      snapshot.script.chapterPlan,
      snapshot.script.scenes.map((scene) => scene.id),
    );
    if (issue) throw new Error(issue);
  }
  const stockByScene = new Map(
    snapshot.stockMedia.map((item) => [item.sceneId, item.snapshot] as const),
  );
  const headers = {
    projectName: `${snapshot.script.name} · completed revision`,
    scriptName: snapshot.script.name,
    styleId: snapshot.script.styleId,
    energy: snapshot.script.energy,
  };
  const scenes = snapshot.script.scenes.map((scene) => ({
    templateId: normalizeTemplateIdForEngine(
      snapshot.script.videoEngine,
      scene.templateId,
    ),
    text: scene.text,
    spokenText: scene.spokenText ?? undefined,
    emphasis: scene.emphasis,
    visual: scene.visual,
    items: scene.items,
    chart: scene.chart,
    mood: scene.mood,
    musicMood: scene.musicMood,
  }));
  // Restore frozen content in bounded validation slices. External AI/manual
  // creation keeps its existing per-plan limits.
  const parts: ScenePlan[] = [];
  for (let start = 0; start < scenes.length; start += 20)
    parts.push(
      scenePlanSchema.parse({
        ...headers,
        scenes: scenes.slice(start, start + 20),
      }),
    );
  const plan: ScenePlan = {
    ...parts[0],
    scenes: parts.flatMap((part) => part.scenes),
  };
  const created = await createProjectFromPlan(
    plan,
    snapshot.script.width > snapshot.script.height
      ? "landscape"
      : snapshot.script.width === snapshot.script.height
        ? "square"
        : "portrait",
    snapshot.script.scenes.map((scene) => scene.background),
    snapshot.script.videoEngine,
    {
      styleId: snapshot.script.styleId,
      energy: snapshot.script.energy,
    },
    {
      preset: snapshot.script.productionPreset,
      motionPlan: snapshot.script.motionPlan,
      motions: snapshot.script.scenes.map((scene) => scene.motion),
      sceneLocks: snapshot.script.scenes.map((scene) => scene.locks),
      roles: snapshot.script.scenes.map((scene) => scene.role ?? "explanation"),
      assetRefs: snapshot.script.scenes.map((scene) => scene.assetRefs ?? []),
      mediaPreferences: snapshot.script.scenes.map(
        (scene) => scene.mediaPreference ?? "auto",
      ),
      stockSelections: snapshot.script.scenes.map((scene) =>
        stockByScene.get(scene.id),
      ),
      outputType: "video",
      creationSource: { kind: "text" },
    },
  );
  await prisma.script.update({
    where: { id: created.scriptId },
    data: {
      fps: snapshot.script.fps,
      coverUrl: snapshot.script.coverUrl,
      musicUrl: snapshot.script.musicUrl,
      musicVolume: snapshot.script.musicVolume,
      sfxEnabled: snapshot.script.sfxEnabled,
      sfxJson: snapshot.script.sfxJson,
      hideText: snapshot.script.hideText,
      hideProgressBar: snapshot.script.hideProgressBar,
    },
  });
  if (snapshot.script.audioMastering !== undefined)
    await updateScript(created.scriptId, {
      audioMastering: snapshot.script.audioMastering,
    });
  if (snapshot.script.chapterPlan) {
    const restored = await getScript(created.scriptId);
    if (!restored) throw new Error("Restored script not found");
    const newIds = restored.scenes.map((scene) => scene.id);
    const sceneMap = new Map(
      snapshot.script.scenes.map((scene, index) => [scene.id, newIds[index]]),
    );
    await saveChapterPlan(created.scriptId, {
      expected: null,
      expectedSceneIds: newIds,
      plan: {
        ...snapshot.script.chapterPlan,
        chapters: snapshot.script.chapterPlan.chapters.map((chapter) => {
          const firstSceneId = sceneMap.get(chapter.firstSceneId);
          if (!firstSceneId)
            throw new Error(
              "A saved chapter references a missing scene. Repair the outline before restoring it.",
            );
          return { ...chapter, firstSceneId };
        }),
      },
    });
  }
  return created;
}
