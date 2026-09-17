import type { SceneBackground } from "@/compositions/types";
import { getAssets } from "@/library/repositories/assets";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { getScript } from "@/library/repositories/scripts";
import {
  resolveAutomaticSceneMediaBatch,
  type AutomaticMediaDecision,
} from "@/library/automatic-stock-media";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import {
  createDeterministicProductionPlan,
  manualCreationSchema,
  type ManualCreationInput,
} from "@/production/manual-planner";
import { ingestPublicArticle } from "@/production/source-ingestion";

const VISUAL_ROLES = new Set([
  "screenshot-demo",
  "browser",
  "hero",
  "feature",
  "diagram",
]);

export async function createManualProject(input: ManualCreationInput) {
  const body = manualCreationSchema.parse(input);
  const source =
    body.source.kind === "url"
      ? await ingestPublicArticle(body.source.url)
      : { text: body.source.text, url: undefined, title: undefined };
  const assets = await getAssets(body.assetIds);
  if (assets.length !== body.assetIds.length) {
    throw new Error("One or more uploaded assets no longer exist");
  }
  const visualAssets = assets.filter(
    (asset) => asset.type === "image" || asset.type === "video",
  );
  const production = createDeterministicProductionPlan({
    name: body.name || source.title || "Untitled production",
    text: source.text,
    outputType: body.outputType,
    presetId: body.presetId,
    videoEngine: body.videoEngine,
    hasVisualAsset: visualAssets.length > 0,
  });

  let visualIndex = 0;
  const nonVisualAssetIds = assets
    .filter((asset) => asset.type !== "image" && asset.type !== "video")
    .map((asset) => asset.id);
  const assetRefs = production.roles.map((role, index) => {
    if (VISUAL_ROLES.has(role) && visualAssets.length) {
      return [visualAssets[visualIndex++ % visualAssets.length]!.id];
    }
    return index === 0 ? [...nonVisualAssetIds] : [];
  });
  if (
    visualAssets.length &&
    !assetRefs.some((refs) =>
      refs.some((id) => visualAssets.some((asset) => asset.id === id)),
    )
  ) {
    assetRefs[0]!.push(visualAssets[0]!.id);
  }
  const uploadedBackgrounds: (SceneBackground | undefined)[] = assetRefs.map(
    (refs) => {
      const asset = refs
        .map((id) => assets.find((candidate) => candidate.id === id))
        .find(
          (candidate) =>
            candidate?.type === "image" || candidate?.type === "video",
        );
      if (!asset || (asset.type !== "image" && asset.type !== "video"))
        return undefined;
      return asset.type === "image"
        ? { type: "image", url: asset.url, effect: "ken-burns" }
        : { type: "video", url: asset.url, muted: true };
    },
  );

  const enrichedPlan = {
    ...production.plan,
    scenes: enrichScenePlan(production.plan.scenes, body.videoEngine),
  };
  let mediaDecisions: AutomaticMediaDecision[] = [];
  if (body.mediaPreference === "none") {
    mediaDecisions = uploadedBackgrounds.map((background) => ({
      state: background ? "explicit" : "disabled",
      attemptedProviders: [],
      message: background
        ? "Existing upload or selection kept"
        : "Stock media disabled; using animated mood background",
      background,
    }));
  } else {
    mediaDecisions = await resolveAutomaticSceneMediaBatch(
      enrichedPlan.scenes,
      body.orientation,
      enrichedPlan.scenes.map(() => body.mediaPreference),
      uploadedBackgrounds,
    );
  }
  const backgrounds = mediaDecisions.map((decision) => decision.background);
  const plan = {
    ...enrichedPlan,
    scenes: enrichedPlan.scenes.map((scene, index) =>
      scene.templateId === "hf-broll" && !backgrounds[index]
        ? {
            ...scene,
            templateId: "hf-statement" as const,
            backgroundQuery: undefined,
            mediaKind: undefined,
          }
        : scene,
    ),
  };

  const created = await createProjectFromPlan(
    plan,
    body.orientation,
    backgrounds,
    body.videoEngine,
    {
      styleId: production.plan.styleId,
      energy: production.plan.energy,
    },
    {
      brandKitId: body.brandKitId,
      preset: production.preset,
      roles: production.roles,
      assetRefs,
      mediaPreferences: plan.scenes.map(() => body.mediaPreference),
      stockSelections: mediaDecisions.map((decision) => decision.snapshot),
      voiceMode: body.voiceMode,
      outputType: body.outputType,
      creationSource: {
        kind: body.source.kind,
        ...(source.url ? { url: source.url } : {}),
        ...(assets.length ? { assetIds: assets.map((asset) => asset.id) } : {}),
      },
    },
  );

  const persisted = await getScript(created.scriptId);
  for (const scene of persisted?.scenes ?? []) {
    await reportStockMediaSelectionUsage(scene.id).catch(() => undefined);
  }

  const requestedAutomaticMedia = enrichedPlan.scenes.some(
    (scene) => scene.templateId === "hf-broll",
  );
  const automaticMediaUnavailable =
    requestedAutomaticMedia &&
    body.mediaPreference !== "none" &&
    !mediaDecisions.some((decision) => decision.state === "selected");

  return {
    ...created,
    plan,
    preset: production.preset,
    warnings: [
      ...production.warnings,
      ...(automaticMediaUnavailable
        ? [
            "Automatic media was unavailable, so B-roll beats use animated layouts. Configure a stock provider or add uploads for media-led scenes.",
          ]
        : []),
    ],
    source: { kind: body.source.kind, url: source.url, title: source.title },
  };
}
