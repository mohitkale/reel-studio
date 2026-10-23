import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { getAIProvider } from "@/providers/ai/registry";
import { AI_PROVIDER_IDS, scenePlanSchema } from "@/providers/ai/types";
import { ProviderError } from "@/providers/voice/types";
const paragraph = z.object({
  sceneId: z.string().min(1),
  text: z.string().trim().min(1).max(2000),
  spokenText: z.string().trim().min(1).max(4000),
});
export const languageProposalSchema = z.object({
  sourceHash: z.string().length(64),
  language: z.string().trim().min(2).max(64),
  paragraphs: z.array(paragraph).min(1).max(240),
});
export const translationRequestSchema = z.object({
  language: z.string().trim().min(2).max(64),
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().max(200).optional(),
});
export async function languageSource(scriptId: string) {
  const script = await getScript(scriptId);
  if (!script) throw new ProviderError("Script not found", 404);
  const sourceHash = createHash("sha256")
    .update(
      JSON.stringify({
        scenes: script.scenes,
        tokens: script.brandTokens,
        style: script.styleId,
        energy: script.energy,
        settings: {
          coverUrl: script.coverUrl,
          musicUrl: script.musicUrl,
          musicVolume: script.musicVolume,
          sfxJson: script.sfxJson,
          sfxEnabled: script.sfxEnabled,
          hideText: script.hideText,
          hideProgressBar: script.hideProgressBar,
          fps: script.fps,
          width: script.width,
          height: script.height,
        },
      }),
    )
    .digest("hex");
  return {
    script,
    sourceHash,
    paragraphs: script.scenes.map((s) => ({
      sceneId: s.id,
      text: s.text,
      spokenText: s.spokenText ?? s.text,
    })),
  };
}
export async function translateLanguageVersion(
  scriptId: string,
  raw: z.input<typeof translationRequestSchema>,
) {
  const input = translationRequestSchema.parse(raw),
    source = await languageSource(scriptId);
  if (
    source.paragraphs.reduce(
      (sum, p) => sum + p.text.length + p.spokenText.length,
      0,
    ) > 100000
  )
    throw new ProviderError(
      "Translate a script with up to 100,000 characters per request",
      400,
    );
  const provider = getAIProvider(input.providerId);
  if (!provider.isConfigured())
    throw new ProviderError(
      "Configure this AI provider in Settings first",
      400,
    );
  const paragraphs: z.infer<typeof paragraph>[] = [];
  for (let index = 0; index < source.paragraphs.length; index += 20) {
    const batch = source.paragraphs.slice(index, index + 20);
    const plan = await provider.generatePlan({
      mode: "translate",
      translationLanguage: input.language,
      brief: JSON.stringify(batch),
      sceneCount: batch.length,
      modelId: input.modelId,
      videoEngine: "hyperframes",
      mediaPreference: "none",
    });
    if (plan.scenes.length !== batch.length)
      throw new ProviderError(
        "Translation changed paragraph coverage. Try again or paste the translation manually.",
        502,
      );
    paragraphs.push(
      ...plan.scenes.map((scene, i) =>
        paragraph.parse({
          sceneId: batch[i].sceneId,
          text: scene.text,
          spokenText: scene.spokenText ?? scene.text,
        }),
      ),
    );
  }
  return languageProposalSchema.parse({
    sourceHash: source.sourceHash,
    language: input.language,
    paragraphs,
  });
}
export async function saveLanguageVersion(
  scriptId: string,
  raw: z.input<typeof languageProposalSchema>,
) {
  const proposal = languageProposalSchema.parse(raw),
    source = await languageSource(scriptId);
  if (source.sourceHash !== proposal.sourceHash)
    throw new ProviderError(
      "Source changed while translating. Reopen language versions to review the latest copy.",
      409,
    );
  if (
    proposal.paragraphs.length !== source.paragraphs.length ||
    proposal.paragraphs.some(
      (p, i) => p.sceneId !== source.paragraphs[i].sceneId,
    )
  )
    throw new ProviderError(
      "Keep every source paragraph exactly once, in order",
      400,
    );
  const scenes = source.script.scenes.map((scene, i) => ({
    ...scene,
    text: proposal.paragraphs[i].text,
    spokenText: proposal.paragraphs[i].spokenText,
    emphasis: [],
  }));
  const parts = [];
  for (let index = 0; index < scenes.length; index += 20)
    parts.push(
      scenePlanSchema.parse({
        projectName: `${source.script.name} · ${proposal.language}`.slice(
          0,
          120,
        ),
        scriptName: `${source.script.name} · ${proposal.language}`.slice(
          0,
          120,
        ),
        scenes: scenes.slice(index, index + 20),
      }),
    );
  const plan = { ...parts[0], scenes: parts.flatMap((part) => part.scenes) };
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: source.script.projectId },
  });
  const created = await createProjectFromPlan(
    plan,
    source.script.width > source.script.height
      ? "landscape"
      : source.script.width === source.script.height
        ? "square"
        : "portrait",
    source.script.scenes.map((s) => s.background),
    source.script.videoEngine,
    { styleId: source.script.styleId, energy: source.script.energy },
    {
      series: project.series,
      scriptSettings: {
        coverUrl: source.script.coverUrl,
        musicUrl: source.script.musicUrl,
        musicVolume: source.script.musicVolume,
        sfxEnabled: source.script.sfxEnabled,
        sfxJson: source.script.sfxJson,
        hideText: source.script.hideText,
        hideProgressBar: source.script.hideProgressBar,
        fps: source.script.fps,
        width: source.script.width,
        height: source.script.height,
      },
      savedOverrides: {
        frozenBrandTokens: source.script.brandTokens,
        audioMastering: source.script.audioMastering,
        musicMap: source.script.musicMap,
        translationSource: {
          scriptId,
          sourceHash: proposal.sourceHash,
          language: proposal.language,
        },
      },
      visualTheme: source.script.visualTheme,
      preset: source.script.productionPreset,
      motionPlan: source.script.motionPlan,
      chapterStarts: source.script.chapterPlan?.chapters.map((c) => ({
        title: c.title,
        firstSceneIndex: source.script.scenes.findIndex(
          (s) => s.id === c.firstSceneId,
        ),
      })),
      mediaPreferences: source.script.scenes.map(
        (s) => s.mediaPreference ?? "auto",
      ),
      brandKitId: source.script.brandKitId,
      outputType: source.script.outputType,
      voiceMode: source.script.voiceMode,
      assetRefs: source.script.scenes.map((s) => s.assetRefs ?? []),
      motions: source.script.scenes.map((s) => s.motion),
      sceneLocks: source.script.scenes.map((s) => s.locks),
      creationSource: { kind: "text" },
    },
  );
  return { ...created, outputType: source.script.outputType };
}
