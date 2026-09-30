import { prisma } from "@/library/db";
import { brandOverridesSchema, parseJsonColumn } from "@/library/schemas";
import { getScript } from "@/library/repositories/scripts";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import {
  chapterPlanIssue,
  proposeChapterPlan,
  type ChapterEdit,
} from "@/production/chapters";
import { ProviderError } from "@/providers/voice/types";

export async function proposeScriptChapters(scriptId: string, takeId?: string) {
  const script = await getScript(scriptId);
  if (!script) throw new ProviderError("Script not found", 404);
  const take = takeId ? script.takes.find((take) => take.id === takeId) : null;
  if (takeId && !take)
    throw new ProviderError("Voice take does not belong to this script", 400);
  const fps = take?.fps ?? script.fps;
  const resolved = resolveReelTimeline(
    script.scenes.map((scene) => ({
      id: scene.id,
      text: resolveSpokenText(scene),
    })),
    take ?? null,
    fps,
  );
  try {
    return {
      proposal: proposeChapterPlan(script.scenes, resolved.timeline, fps),
      expected: script.chapterPlan ?? null,
      expectedSceneIds: script.scenes.map((scene) => scene.id),
      timingSource: resolved.takeUsable ? "voice-take" : "estimated",
    };
  } catch (error) {
    throw new ProviderError(
      error instanceof Error ? error.message : "Cannot plan these chapters",
      400,
    );
  }
}

export async function saveChapterPlan(scriptId: string, input: ChapterEdit) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.script.findUnique({
      where: { id: scriptId },
      include: { scenes: { orderBy: { order: "asc" }, select: { id: true } } },
    });
    if (!row) throw new ProviderError("Script not found", 404);
    const overrides = parseJsonColumn(
      row.brandOverrides,
      brandOverridesSchema,
      {},
    );
    const ids = row.scenes.map((scene) => scene.id);
    if (
      JSON.stringify(ids) !== JSON.stringify(input.expectedSceneIds) ||
      JSON.stringify(overrides.chapterPlan ?? null) !==
        JSON.stringify(input.expected)
    )
      throw new ProviderError(
        "Scenes or chapters changed. Reload before saving this plan.",
        409,
      );
    const issue = chapterPlanIssue(input.plan, ids);
    if (issue) throw new ProviderError(issue, 400);
    await tx.script.update({
      where: { id: scriptId },
      data: {
        brandOverrides: JSON.stringify({
          ...overrides,
          chapterPlan: input.plan,
        }),
      },
    });
    return input.plan;
  });
}
