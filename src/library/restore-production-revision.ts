import { prisma } from "@/library/db";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { normalizeTemplateIdForEngine } from "@/engines/registry";
import { scenePlanSchema } from "@/providers/ai/types";

export async function restoreProductionRevision(snapshotValue: unknown) {
  const snapshot = videoSnapshotSchema.parse(snapshotValue);
  const stockByScene = new Map(
    snapshot.stockMedia.map((item) => [item.sceneId, item.snapshot] as const),
  );
  const plan = scenePlanSchema.parse({
    projectName: `${snapshot.script.name} · completed revision`,
    scriptName: snapshot.script.name,
    styleId: snapshot.script.styleId,
    energy: snapshot.script.energy,
    scenes: snapshot.script.scenes.map((scene) => ({
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
    })),
  });
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
  return created;
}
