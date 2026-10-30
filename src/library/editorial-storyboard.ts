import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  brandOverridesSchema,
  parseJsonColumn,
  sceneConfigSchema,
} from "./schemas";
import { editorialWorkflowSchema } from "@/production/editorial";
import {
  editorialStoryboardSchema,
  type StoryboardControl,
} from "@/production/editorial-storyboard";
import { filmCanonicalJson } from "@/production/film-plan";
import { applyPresetToAIPlan } from "@/production/ai-preset-plan";
import {
  getProductionPreset,
  type ProductionPresetId,
} from "@/production/presets";
import { scenePlanSchema, AIError } from "@/providers/ai/types";
import { creationEvidenceSources } from "@/research/creation-grounding";
import { enrichSemanticSequence } from "@/production/semantic-direction";
import { storyboardSnapshot } from "./structural-history";
import { recordHistory } from "./scene-history";

const hash = (input: unknown) =>
  createHash("sha256").update(filmCanonicalJson(input)).digest("hex");
export async function editorialStoryboardState(
  tx: Prisma.TransactionClient,
  scriptId: string,
) {
  const row = await tx.script.findUnique({
    where: { id: scriptId },
    include: {
      project: { select: { brandKitId: true, videoEngine: true } },
      scenes: { orderBy: [{ order: "asc" }, { id: "asc" }] },
    },
  });
  if (!row) throw new AIError("Script not found", 404);
  const overrides = parseJsonColumn(
    row.brandOverrides,
    brandOverridesSchema,
    {},
  );
  const { editorialStoryboard: _cache, ...settings } = overrides;
  void _cache;
  return {
    row,
    overrides,
    sourceHash: hash({
      ...row,
      brandOverrides: settings,
      createdAt: undefined,
      updatedAt: undefined,
      scenes: row.scenes.map((s) => ({
        ...s,
        createdAt: undefined,
        updatedAt: undefined,
      })),
    }),
  };
}
/** Compilation is local and deterministic. No media, product proof or extra copy is generated. */
export async function controlEditorialStoryboard(
  scriptId: string,
  input: StoryboardControl,
) {
  return prisma.$transaction(async (tx) => {
    const { row, overrides, sourceHash } = await editorialStoryboardState(
      tx,
      scriptId,
    );
    const workflow = editorialWorkflowSchema.parse(overrides.editorialWorkflow);
    if (workflow.state !== "ready" || !workflow.draft)
      throw new AIError("Save a ready editorial script first", 409);
    const draft = workflow.draft;
    const prior = overrides.editorialStoryboard;
    if (input.action !== "compile") {
      if (
        !prior ||
        prior.sourceHash !== input.expectedHash ||
        sourceHash !== prior.sourceHash ||
        prior.sourceRevision !== workflow.revision
      )
        throw new AIError(
          "The script or storyboard changed. Compile and review again before applying.",
          409,
        );
      if (input.action === "cancel") {
        const cache = { ...prior, state: "canceled" as const };
        await tx.script.update({
          where: { id: scriptId },
          data: {
            brandOverrides: JSON.stringify({
              ...overrides,
              editorialStoryboard: cache,
            }),
          },
        });
        return cache;
      }
      if (prior.state !== "ready")
        throw new AIError("Compile a current preview before applying", 409);
      const before = await storyboardSnapshot(tx, scriptId);
      const ids = prior.shots.map((s) => s.sceneId);
      for (const existing of row.scenes) {
        const locks = parseJsonColumn(
          existing.layoutJson,
          sceneConfigSchema,
          {},
        ).locks;
        const index = ids.indexOf(existing.id);
        if (
          (locks?.scene || locks?.copy || locks?.assets) &&
          (index < 0 || existing.order !== index)
        )
          throw new AIError(
            "Compilation would remove or reorder a protected scene. Unlock it before replacing the storyboard.",
            409,
          );
      }
      for (const [index, scene] of prior.plan.scenes.entries()) {
        const id = ids[index];
        const existing = row.scenes.find((s) => s.id === id);
        const config = existing
          ? parseJsonColumn(existing.layoutJson, sceneConfigSchema, {})
          : {};
        if (config.locks?.scene) continue;
        const copyLocked = config.locks?.copy;
        const assetsLocked = config.locks?.assets;
        const nextConfig = assetsLocked
          ? config
          : {
              ...config,
              role: prior.roles[index],
              direction: scene.direction,
              items: scene.items,
              chart: scene.chart,
              background: undefined,
              motion: undefined,
              mediaPreference: "none" as const,
            };
        const data = {
          order: index,
          templateId:
            assetsLocked && existing ? existing.templateId : scene.templateId,
          text: copyLocked && existing ? existing.text : scene.text,
          spokenText:
            copyLocked && existing
              ? existing.spokenText
              : (scene.spokenText ?? null),
          emphasis:
            copyLocked && existing
              ? existing.emphasis
              : JSON.stringify(scene.emphasis),
          visual:
            assetsLocked && existing ? existing.visual : (scene.visual ?? null),
          layoutJson: JSON.stringify(nextConfig),
          selectedVoiceClipId:
            existing &&
            (copyLocked ||
              (existing.text === scene.text &&
                existing.spokenText === (scene.spokenText ?? null)))
              ? existing.selectedVoiceClipId
              : null,
          assetRefs: assetsLocked && existing ? existing.assetRefs : null,
        };
        await tx.scene.upsert({
          where: { id },
          create: { id, scriptId, ...data },
          update: data,
        });
        if (!assetsLocked)
          await tx.stockMediaSelection.deleteMany({ where: { sceneId: id } });
      }
      await tx.scene.deleteMany({ where: { scriptId, id: { notIn: ids } } });
      const presetId = intentPreset(workflow.request.creativeBrief.intent);
      const preset = getProductionPreset(presetId)!;
      const nextOverrides = {
        ...overrides,
        productionPreset: { id: presetId, version: preset.version },
        editorialStoryboard: { ...prior, state: "applied" as const },
      };
      await tx.script.update({
        where: { id: scriptId },
        data: {
          name: draft.title,
          brandOverrides: JSON.stringify(nextOverrides),
        },
      });
      const appliedHash = (await editorialStoryboardState(tx, scriptId))
        .sourceHash;
      const cache = { ...prior, state: "applied" as const, appliedHash };
      await tx.script.update({
        where: { id: scriptId },
        data: {
          brandOverrides: JSON.stringify({
            ...nextOverrides,
            editorialStoryboard: cache,
          }),
        },
      });
      await recordHistory(
        tx,
        scriptId,
        "@storyboard",
        JSON.stringify(before),
        JSON.stringify(await storyboardSnapshot(tx, scriptId)),
      );
      return cache;
    }
    if (input.expectedRevision !== workflow.revision)
      throw new AIError(
        "The writing revision changed. Reload before compiling.",
        409,
      );
    const inputHash = hash({
      draft,
      creativeBrief: workflow.request.creativeBrief,
      evidence: overrides.researchEvidence,
      width: row.width,
      height: row.height,
      fps: row.fps,
    });
    if (
      prior?.inputHash === inputHash &&
      (prior.sourceHash === sourceHash || prior.appliedHash === sourceHash) &&
      prior.state !== "canceled"
    )
      return prior;
    const base = scenePlanSchema.parse({
      projectName: draft.angle,
      scriptName: draft.title,
      scenes: draft.beats.map((beat) => ({
        templateId: "hf-statement",
        text: beat.headline,
        spokenText: beat.narration,
        emphasis: [],
        evidenceRefs: beat.references,
      })),
    });
    const compiled = applyPresetToAIPlan(
      base,
      intentPreset(workflow.request.creativeBrief.intent),
      "hyperframes",
      {
        hasVisualAsset: false,
        sceneHasVisual: base.scenes.map(() => false),
        source: workflow.request.brief,
        evidenceSources: overrides.researchEvidence
          ? creationEvidenceSources(overrides.researchEvidence)
          : [],
      },
    );
    const directed = enrichSemanticSequence(compiled.plan.scenes);
    // Directors may select supported visuals, but writing remains byte-for-byte unchanged.
    const plan = scenePlanSchema.parse({
      ...compiled.plan,
      scenes: directed.map((scene, index) => ({
        ...scene,
        text: draft.beats[index].headline,
        spokenText: draft.beats[index].narration,
        emphasis: [],
      })),
    });
    const cache = editorialStoryboardSchema.parse({
      version: 1,
      sourceRevision: workflow.revision,
      inputHash,
      sourceHash,
      state: "ready",
      providerCalls: 0,
      plan,
      roles: compiled.roles,
      shots: draft.beats.map((beat, index) => ({
        beatId: beat.id,
        sceneId: `${scriptId}:${hash(beat.id).slice(0, 16)}`,
        purpose: beat.purpose,
        narration: beat.narration,
        screenCopy: beat.headline,
        references: beat.references,
        assetNeeds:
          workflow.request.creativeBrief.intent === "product"
            ? [
                "Optional real product screenshot or recording supplied by the creator",
              ]
            : [],
        explanation: plan.scenes[index].chart
          ? "Chart uses a literal supplied dataset; no values inferred."
          : "Local director chose a supported typographic/semantic visual. No external assets were fetched. Supply real product media and proof when needed; no UI or customer results are synthesized.",
      })),
    });
    await tx.script.update({
      where: { id: scriptId },
      data: {
        brandOverrides: JSON.stringify({
          ...overrides,
          editorialStoryboard: cache,
        }),
      },
    });
    return cache;
  });
}
function intentPreset(intent: string): ProductionPresetId {
  return intent === "product"
    ? "product-launch"
    : intent === "data"
      ? "data-story"
      : intent === "brand"
        ? "cinematic-brand"
        : "editorial-explainer";
}
