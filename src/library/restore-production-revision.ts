import { randomUUID } from "node:crypto";
import { getAssetStore } from "@/library/storage";
import { sanitizeKey } from "@/library/storage/local-disk";
import { createTake } from "@/library/repositories/takes";
import { prisma } from "@/library/db";
import { updateScript } from "@/library/repositories/scripts";
import { parseSfxState } from "@/lib/sfx-cues";
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
  let factoryAudio: Buffer | undefined;
  if (snapshot.factory && snapshot.take) {
    if (!snapshot.take.audioUrl.startsWith("/media/"))
      throw new Error("Factory take restoration requires local audio");
    const key = sanitizeKey(
        decodeURIComponent(snapshot.take.audioUrl.slice(7)),
      ),
      opened = await getAssetStore().open(key);
    if (opened.size > 128 * 1024 * 1024) {
      await opened.close();
      throw new Error("Factory take exceeds the 128 MiB restoration budget");
    }
    factoryAudio = Buffer.from(
      await new Response(opened.stream({ end: opened.size - 1 })).arrayBuffer(),
    );
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
    direction: scene.direction,
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
      visualTheme: snapshot.script.visualTheme,
      brandKitId: snapshot.script.visualTheme ? null : undefined,
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
      savedOverrides: snapshot.script.researchEvidence
        ? { researchEvidence: snapshot.script.researchEvidence }
        : undefined,
    },
  );
  const ownedAudio: string[] = [];
  try {
    const restoredScenes = await prisma.scene.findMany({
      where: { scriptId: created.scriptId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const newIds = restoredScenes.map((scene) => scene.id);
    const sceneMap = new Map(
      snapshot.script.scenes.map((scene, index) => [scene.id, newIds[index]]),
    );
    const sfx = parseSfxState(snapshot.script.sfxJson);
    const restoredSfx =
      snapshot.script.sfxJson === null
        ? null
        : JSON.stringify({
            ...sfx,
            cues: sfx.cues.flatMap((cue) => {
              const sceneId = sceneMap.get(cue.sceneId);
              return sceneId ? [{ ...cue, sceneId }] : [];
            }),
          });
    await prisma.$transaction([
      prisma.script.update({
        where: { id: created.scriptId },
        data: {
          fps: snapshot.script.fps,
          width: snapshot.script.width,
          height: snapshot.script.height,
          coverUrl: snapshot.script.coverUrl,
          musicUrl: snapshot.script.musicUrl,
          musicVolume: snapshot.script.musicVolume,
          sfxEnabled: snapshot.script.sfxEnabled,
          sfxJson: restoredSfx,
          hideText: snapshot.script.hideText,
          hideProgressBar: snapshot.script.hideProgressBar,
        },
      }),
      ...snapshot.script.scenes.flatMap((scene, index) =>
        scene.hideText === null || scene.hideText === undefined
          ? []
          : [
              prisma.scene.update({
                where: { id: newIds[index] },
                data: { hideText: scene.hideText },
              }),
            ],
      ),
    ]);
    await updateScript(created.scriptId, {
      audioMastering: snapshot.script.audioMastering,
      factoryLineage: snapshot.factory,
      frozenBrandTokens: snapshot.script.brandTokens,
      chapterDraft: snapshot.script.chapterDraft
        ? {
            ...snapshot.script.chapterDraft,
            chapters: snapshot.script.chapterDraft.chapters.map((chapter) => ({
              ...chapter,
              generated: chapter.generated
                ? {
                    ...chapter.generated,
                    sceneIds: chapter.generated.sceneIds.map((id) => {
                      const restoredId = sceneMap.get(id);
                      if (!restoredId)
                        throw new Error(
                          "A generated chapter references a missing scene.",
                        );
                      return restoredId;
                    }),
                  }
                : undefined,
            })),
          }
        : undefined,
    });
    if (snapshot.script.chapterPlan) {
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
    if (snapshot.factory) {
      let restoredTakeId: string | undefined;
      if (snapshot.take) {
        const bytes = factoryAudio!,
          audioPath = `revision-restores/${randomUUID()}.wav`;
        ownedAudio.push(audioPath);
        await getAssetStore().put(audioPath, bytes);
        const take = await createTake({
          ...snapshot.take,
          scriptId: created.scriptId,
          modelId: snapshot.take.modelId ?? undefined,
          label: snapshot.take.label ?? "Restored narration",
          timeline: snapshot.take.timeline.map((beat) => ({
            ...beat,
            sceneId: sceneMap.get(beat.sceneId)!,
          })),
          audioPath,
        });
        restoredTakeId = take.id;
      }
      for (const track of snapshot.script.captionTracks ?? [])
        await prisma.captionTrack.create({
          data: {
            scriptId: created.scriptId,
            label: track.label,
            language: track.language,
            timingSource: track.timingSource,
            enabled: track.enabled,
            styleJson: JSON.stringify(track.style),
            sourceTakeId:
              track.sourceTakeId === snapshot.take?.id ? restoredTakeId : null,
            sourceFps: track.sourceFps,
            cues: {
              create: track.cues.map((cue) => ({
                order: cue.order,
                startFrame: cue.startFrame,
                endFrame: cue.endFrame,
                text: cue.text,
                wordsJson: cue.words ? JSON.stringify(cue.words) : null,
              })),
            },
          },
        });
    }
    return created;
  } catch (error) {
    // Only this incomplete newly-created copy and its private audio are rolled back.
    await prisma.project
      .delete({ where: { id: created.projectId } })
      .catch(() => undefined);
    await Promise.all(
      ownedAudio.map((key) =>
        getAssetStore()
          .delete(key)
          .catch(() => undefined),
      ),
    );
    throw error;
  }
}
