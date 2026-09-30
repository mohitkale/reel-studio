import { randomUUID } from "node:crypto";
import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import { brandOverridesSchema, parseJsonColumn } from "@/library/schemas";
import {
  assertSceneRewriteState,
  captureSceneRewriteState,
} from "@/library/scene-rewrite-service";
import { sceneContinuityContext } from "@/library/scene-append-scope";
import {
  chapterDraftSchema,
  chapterDraftCapacityIssue,
  pendingChapterDraftIssue,
  type ChapterDraft,
} from "@/production/chapter-draft";
import type { ChapterDraftRequest } from "@/library/chapter-draft-input";
import { getAIProvider } from "@/providers/ai/registry";
import { AIError, scenePlanSchema } from "@/providers/ai/types";

/** Quota authorization occurs only after preflight, immediately before generation. */
export async function generateChapterDraft(
  scriptId: string,
  input: ChapterDraftRequest,
  authorizeProvider: () => Promise<unknown>,
  signal?: AbortSignal,
) {
  const expectedState = await captureSceneRewriteState(scriptId);
  const script = await getScript(scriptId);
  if (!script) throw new AIError("Script not found", 404);
  assertSceneRewriteState(
    expectedState,
    await captureSceneRewriteState(scriptId),
  );
  if (script.chapterDraft?.chapters.some((chapter) => chapter.generated))
    throw new AIError(
      "Discard the completed writing draft before planning another.",
      400,
    );
  const issue = chapterDraftCapacityIssue(
    script,
    Array(input.chapterCount).fill(input.scenesPerChapter),
  );
  if (issue) throw new AIError(issue, 400);
  const provider = getAIProvider(input.providerId);
  if (!provider.isConfigured())
    throw new AIError(
      `${provider.label} is not configured. Update Settings.`,
      400,
      input.providerId,
    );
  if (signal?.aborted) throw new AIError("Generation canceled", 499);
  await authorizeProvider();
  // Reuse the installed structured plan adapters and their existing repair/token policy.
  // Carrier scenes are writing briefs only; none are created, enriched or rendered.
  const plan = scenePlanSchema.parse(
    await provider.generatePlan({
      mode: "chapter_outline",
      brief: input.topic,
      sceneCount: input.chapterCount,
      existingContext: sceneContinuityContext(script),
      modelId: input.modelId,
      videoEngine: script.videoEngine,
      mediaPreference: "none",
      signal,
    }),
  );
  if (plan.scenes.length !== input.chapterCount)
    throw new AIError(
      "The provider did not return the requested chapter count",
      502,
    );
  const draft = chapterDraftSchema.parse({
    version: "1.0.0",
    topic: input.topic,
    chapters: plan.scenes.map((scene) => ({
      id: `draft:${randomUUID()}`,
      title: scene.text,
      brief: scene.spokenText,
      sceneCount: input.scenesPerChapter,
    })),
  });
  return saveChapterDraft(scriptId, { draft, expectedState, signal });
}

/** Draft-only writes retain scenes, chapter boundaries, direction and audio settings. */
export async function saveChapterDraft(
  scriptId: string,
  input: {
    draft: ChapterDraft | null;
    expected?: ChapterDraft | null;
    expectedState?: string;
    signal?: AbortSignal;
  },
) {
  if (input.expectedState === undefined && input.expected === undefined)
    throw new AIError(
      "Saving a chapter draft requires the expected draft or storyboard state",
      400,
    );
  const draft =
    input.draft === null ? null : chapterDraftSchema.parse(input.draft);
  return prisma.$transaction(async (tx) => {
    if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
    if (input.expectedState !== undefined)
      assertSceneRewriteState(
        input.expectedState,
        await captureSceneRewriteState(scriptId, tx),
      );
    const row = await tx.script.findUnique({
      where: { id: scriptId },
      include: { scenes: { orderBy: { order: "asc" }, select: { id: true } } },
    });
    if (!row) throw new AIError("Script not found", 404);
    const overrides = parseJsonColumn(
      row.brandOverrides,
      brandOverridesSchema,
      {},
    );
    if (
      input.expected !== undefined &&
      JSON.stringify(input.expected) !==
        JSON.stringify(overrides.chapterDraft ?? null)
    )
      throw new AIError(
        "The chapter draft changed. Reload before saving your edits.",
        409,
      );
    if (draft) {
      const priorCompleted =
        overrides.chapterDraft?.chapters.filter(
          (chapter) => chapter.generated,
        ) ?? [];
      const completed = draft.chapters.filter((chapter) => chapter.generated);
      if (JSON.stringify(priorCompleted) !== JSON.stringify(completed))
        throw new AIError(
          "Generated chapter progress cannot be edited. Edit its scenes in the storyboard.",
          400,
        );
      const issue = pendingChapterDraftIssue(
        { scenes: row.scenes, chapterPlan: overrides.chapterPlan },
        draft,
      );
      if (issue) throw new AIError(issue, 400);
      overrides.chapterDraft = draft;
    } else delete overrides.chapterDraft;
    if (input.signal?.aborted) throw new AIError("Generation canceled", 499);
    await tx.script.update({
      where: { id: scriptId },
      data: { brandOverrides: JSON.stringify(overrides) },
    });
    return draft;
  });
}
