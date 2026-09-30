import { getScript } from "@/library/repositories/scripts";
import {
  captureSceneRewriteState,
  assertSceneRewriteState,
} from "@/library/scene-rewrite-service";
import { generateSceneAppend } from "@/library/generate-scene-append";
import type { ChapterGenerationRequest } from "@/library/chapter-draft-input";
import { pendingChapterDraftIssue } from "@/production/chapter-draft";
import { getAIProvider } from "@/providers/ai/registry";
import { AIError } from "@/providers/ai/types";

/** One explicit chapter at a time. Failures leave it pending; success commits progress with scenes. */
export async function generateDraftChapter(
  scriptId: string,
  input: ChapterGenerationRequest,
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
  if (JSON.stringify(script.chapterDraft) !== JSON.stringify(input.expected))
    throw new AIError(
      "The writing draft changed. Reload before generating.",
      409,
    );
  const draft = script.chapterDraft!;
  const chapter = draft.chapters.find((item) => item.id === input.chapterId);
  if (!chapter)
    throw new AIError("The selected writing chapter does not exist", 400);
  if (chapter.generated)
    throw new AIError(
      "This chapter is already generated. Edit or rewrite its scenes in the storyboard.",
      409,
    );
  if (draft.chapters.find((item) => !item.generated)?.id !== chapter.id)
    throw new AIError("Generate the next pending chapter in draft order.", 400);
  const issue = pendingChapterDraftIssue(script, draft);
  if (issue) throw new AIError(issue, 400);
  if (script.scenes.length && !script.chapterPlan)
    throw new AIError(
      "Save a chapter outline before generating a named chapter.",
      400,
    );
  const provider = getAIProvider(input.providerId);
  if (!provider.isConfigured())
    throw new AIError(
      `${provider.label} is not configured. Update Settings.`,
      400,
      input.providerId,
    );
  if (signal?.aborted) throw new AIError("Generation canceled", 499);
  await authorizeProvider();
  // Budget is fixed at one adapter invocation; existing provider repair/token policy stays intact.
  await generateSceneAppend({
    script,
    expectedState,
    signal,
    draftChapterId: chapter.id,
    body: {
      providerId: input.providerId,
      modelId: input.modelId,
      mode: "append",
      brief: `Topic and supplied facts (bounded excerpt): ${draft.topic.slice(0, 1800)}\nChapter writing brief: ${chapter.brief}`,
      chapterTitle: chapter.title,
      sceneCount: chapter.sceneCount,
      scriptStyle: "detailed",
      mediaPreference: input.mediaPreference,
    },
  });
  return (await getScript(scriptId))!;
}
