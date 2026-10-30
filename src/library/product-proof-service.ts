import { createHash } from "node:crypto";
import { prisma } from "./db";
import { editorialStoryboardState } from "./editorial-storyboard";
import {
  productProofSchema,
  type ProductProofControl,
} from "@/production/product-proof";
import { subjectRegistrySchema, subjectKey } from "@/video/sequence-direction";
import { sceneConfigSchema, parseJsonColumn, assetRefsSchema } from "./schemas";
import { motionDirection, motionFallbackReason } from "@/production/motion";
import { sequenceSourceKey } from "@/production/sequence-subjects";
import { AIError } from "@/providers/ai/types";
import { getAssetStore } from "./storage";
import { probeStockVideo } from "./stock-media-download";
import { storyboardSnapshot } from "./structural-history";
import { recordHistory } from "./scene-history";
import { estimateSpeechSeconds } from "@/lib/audio-timing";
const subjectId = (label: string) =>
  `proof-${createHash("sha256").update(subjectKey(label)).digest("hex").slice(0, 20)}`;
async function probeProofVideo(key: string) {
  const opened = await getAssetStore().open(key);
  if (opened.size <= 0 || opened.size > 128 * 1024 * 1024) {
    await opened.close();
    throw new AIError("Recording must be a nonempty file under 128 MiB", 400);
  }
  try {
    const signal = AbortSignal.timeout(10000),
      bytes = Buffer.from(
        await new Response(
          opened.stream({ end: opened.size - 1, signal }),
        ).arrayBuffer(),
      );
    return await probeStockVideo(bytes, "mp4", signal);
  } finally {
    await opened.close();
  }
}
export async function readProductProof(scriptId: string) {
  return prisma.$transaction(async (tx) => {
    const source = await editorialStoryboardState(tx, scriptId),
      plan = source.overrides.productProof;
    const findings: Array<{
      featureId?: string;
      sceneId?: string;
      message: string;
    }> = [];
    if (
      !plan?.features.length &&
      (source.overrides.productionPreset?.id === "product-launch" ||
        source.overrides.editorialWorkflow?.request.creativeBrief.intent ===
          "product")
    )
      findings.push({
        message:
          "Map actual supplied screenshots or recordings to product features before treating visuals as proof.",
      });
    const available = new Set(
      (
        await tx.asset.findMany({
          where: {
            id: {
              in:
                plan?.features.flatMap((feature) =>
                  feature.assets.map((a) => a.assetId),
                ) ?? [],
            },
          },
          select: { id: true },
        })
      ).map((asset) => asset.id),
    );
    for (const feature of plan?.features ?? []) {
      if (!feature.assets.length)
        findings.push({
          featureId: feature.id,
          message: `${feature.label}: no supplied artifact is mapped. Typography is available; product UI and customer outcomes are never synthesized.`,
        });
      for (const id of feature.sceneIds) {
        const scene = source.row.scenes.find((s) => s.id === id);
        if (!scene)
          findings.push({
            featureId: feature.id,
            message: `${feature.label}: a mapped scene no longer exists.`,
          });
        else if (
          parseJsonColumn(scene.layoutJson, sceneConfigSchema, {}).proof
            ?.featureId === feature.id &&
          parseJsonColumn(scene.layoutJson, sceneConfigSchema, {}).proof
            ?.sourceUrl !==
            parseJsonColumn(scene.layoutJson, sceneConfigSchema, {}).background
              ?.url
        )
          findings.push({
            featureId: feature.id,
            sceneId: id,
            message: `${feature.label}: the current visual differs from the applied proof mapping. Review the supplied artifact again.`,
          });
        if (scene && estimateSpeechSeconds(scene.spokenText ?? scene.text) < 3)
          findings.push({
            featureId: feature.id,
            sceneId: id,
            message: `${feature.label}: estimated reading time is short. Inspect the screenshot hold with the real narration timing.`,
          });
      }
      for (const artifact of feature.assets) {
        if (!available.has(artifact.assetId))
          findings.push({
            featureId: feature.id,
            message: `${feature.label}: a supplied artifact is unavailable.`,
          });
      }
    }
    return { sourceHash: source.sourceHash, plan, findings };
  });
}
/** No writer, research, media search or speech call. Provider IO never runs inside the transaction. */
export async function controlProductProof(
  scriptId: string,
  input: ProductProofControl,
  dependencies: {
    exists?: (key: string) => Promise<boolean>;
    probeVideo?: typeof probeProofVideo;
    url?: (key: string) => string;
  } = {},
) {
  let recording: Awaited<ReturnType<typeof probeProofVideo>> | undefined;
  if (input.action !== "save" && input.assetId) {
    const source = await editorialStoryboardState(prisma, scriptId);
    if (source.sourceHash !== input.expectedHash)
      throw new AIError(
        "The film changed. Review the proof mapping again",
        409,
      );
    const feature = source.overrides.productProof?.features.find(
      (item) => item.id === input.featureId,
    );
    if (!feature?.assets.some((artifact) => artifact.assetId === input.assetId))
      throw new AIError("Artifact is outside this feature mapping", 400);
    if (
      feature.sceneIds.some((id) => {
        const row = source.row.scenes.find((scene) => scene.id === id);
        if (!row) return true;
        const locks = parseJsonColumn(
          row.layoutJson,
          sceneConfigSchema,
          {},
        ).locks;
        return locks?.scene || locks?.assets;
      })
    )
      throw new AIError("A mapped scene's visual scope is protected", 409);
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
    });
    if (!asset) throw new AIError("Supplied artifact not found", 404);
    if (
      !(await (dependencies.exists ?? ((key) => getAssetStore().exists(key)))(
        asset.path,
      ))
    )
      throw new AIError("The supplied artifact file is unavailable", 409);
    if (asset.type === "video")
      recording = await (dependencies.probeVideo ?? probeProofVideo)(
        asset.path,
      );
  }
  return prisma.$transaction(async (tx) => {
    const source = await editorialStoryboardState(tx, scriptId),
      { row, overrides } = source;
    if (source.sourceHash !== input.expectedHash)
      throw new AIError(
        "The film changed. Review the proof mapping again before saving or applying",
        409,
      );
    if (input.action === "save") {
      const assets = await tx.asset.findMany({
        where: {
          id: {
            in: input.features.flatMap((f) => f.assets.map((a) => a.assetId)),
          },
        },
        include: {
          stockMediaMaterializations: { select: { assetId: true }, take: 1 },
        },
      });
      const subjects = [...(overrides.motionPlan?.subjectRegistry ?? [])];
      const featureSubjects = new Map<string, (typeof subjects)[number]>();
      const features = input.features.map((feature) => {
        if (
          feature.sceneIds.some(
            (id) => !row.scenes.some((scene) => scene.id === id),
          )
        )
          throw new AIError(
            "A proof mapping contains a scene outside this film",
            400,
          );
        for (const artifact of feature.assets) {
          const asset = assets.find((a) => a.id === artifact.assetId);
          if (!asset || !["image", "video"].includes(asset.type))
            throw new AIError(
              "Proof needs an existing supplied image or video",
              400,
            );
          if (asset.stockMediaMaterializations.length)
            throw new AIError(
              "Stock media can illustrate a story; use actual supplied media for product proof",
              400,
            );
          if (asset.type === "image" && artifact.startSeconds)
            throw new AIError("Screenshots do not have a recording cue", 400);
        }
        const saved = subjects.find((s) =>
          [s.label, ...s.aliases].some(
            (label) => subjectKey(label) === subjectKey(feature.subjectLabel),
          ),
        );
        const subject = saved ?? {
          id: subjectId(feature.subjectLabel),
          label: feature.subjectLabel,
          aliases: [],
          symbol: "none" as const,
          colorSlot: "accent" as const,
        };
        featureSubjects.set(subject.id, subject);
        return { ...feature, subjectId: subject.id };
      });
      const plan = productProofSchema.parse({
        version: 1,
        revision: (overrides.productProof?.revision ?? 0) + 1,
        features,
        subjects: subjectRegistrySchema.parse([...featureSubjects.values()]),
      });
      const removedApplied = row.scenes.some((scene) => {
        const proof = parseJsonColumn(
          scene.layoutJson,
          sceneConfigSchema,
          {},
        ).proof;
        return (
          proof &&
          proof.sourceUrl ===
            parseJsonColumn(scene.layoutJson, sceneConfigSchema, {}).background
              ?.url &&
          !plan.features.some(
            (f) => f.id === proof.featureId && f.sceneIds.includes(scene.id),
          )
        );
      });
      if (removedApplied)
        throw new AIError(
          "Undo the applied proof edit before removing its mapping",
          409,
        );
      const before = await storyboardSnapshot(tx, scriptId);
      await tx.script.update({
        where: { id: scriptId },
        data: {
          brandOverrides: JSON.stringify({ ...overrides, productProof: plan }),
        },
      });
      await recordHistory(
        tx,
        scriptId,
        "@storyboard",
        JSON.stringify(before),
        JSON.stringify(await storyboardSnapshot(tx, scriptId)),
      );
      return { state: "saved" as const, plan };
    }
    const plan = overrides.productProof,
      feature = plan?.features.find((f) => f.id === input.featureId);
    if (!plan || !feature) throw new AIError("Proof feature not found", 404);
    const artifact = feature.assets.find((a) => a.assetId === input.assetId);
    if (input.assetId && !artifact)
      throw new AIError("Artifact is outside this feature mapping", 400);
    if (!input.assetId && feature.assets.length)
      throw new AIError("Choose a mapped artifact explicitly", 400);
    const asset = input.assetId
      ? await tx.asset.findUnique({
          where: { id: input.assetId },
          include: {
            stockMediaMaterializations: { select: { assetId: true }, take: 1 },
          },
        })
      : null;
    if (
      input.assetId &&
      (!asset ||
        !["image", "video"].includes(asset.type) ||
        asset.stockMediaMaterializations.length)
    )
      throw new AIError(
        "Mapped proof artifact is unavailable or is stock media",
        409,
      );
    if (recording && artifact && artifact.startSeconds >= recording.durationSec)
      throw new AIError("Recording cue must be inside the supplied file", 400);
    const targets = feature.sceneIds.map((id) => {
      const scene = row.scenes.find((s) => s.id === id);
      if (!scene) throw new AIError("A mapped scene no longer exists", 409);
      return scene;
    });
    const changes = targets.map((scene) => {
      const config = parseJsonColumn(scene.layoutJson, sceneConfigSchema, {});
      if (config.locks?.scene || config.locks?.assets)
        throw new AIError("A mapped scene's visual scope is protected", 409);
      const background = asset
        ? {
            type: asset.type as "image" | "video",
            url: (dependencies.url ?? ((key) => getAssetStore().url(key)))(
              asset.path,
            ),

            muted: true,
            ...(asset.type === "video"
              ? { startSeconds: artifact?.startSeconds ?? 0 }
              : {}),
          }
        : undefined;
      const motion = asset
        ? {
            ...motionDirection("media-device"),
            system: overrides.motionPlan?.system ?? ("precision" as const),
            sequenceVersion: 1 as const,
            decision: {
              version: 1 as const,
              sourceKey: sequenceSourceKey({
                text: scene.text,
                role: "screenshot-demo",
                background,
              }),
              subjectIds: [feature.subjectId],
              reason:
                "Use the mapped creator-supplied artifact in a contained product frame, with a brief reveal and a stable reading hold.",
              profile: {
                silhouette: "media" as const,
                movement: "hold" as const,
                density: "low" as const,
                subjects: 1,
              },
              alternatives: [],
            },
          }
        : undefined;
      if (motion) {
        const reason = motionFallbackReason(
          motion,
          scene.text,
          undefined,
          false,
          undefined,
          background,
        );
        if (reason)
          throw new AIError(
            `The supplied screen copy does not fit the product frame: ${reason}`,
            400,
          );
      }
      const next = {
        ...config,
        background,
        role: asset ? ("screenshot-demo" as const) : ("explanation" as const),
        motion,
        items: undefined,
        chart: undefined,
        direction: {
          version: 1 as const,
          role: asset ? ("screenshot-demo" as const) : ("explanation" as const),
          composition: "authored" as const,
        },
        mediaPreference: "none" as const,
        proof: {
          featureId: feature.id,
          subjectId: feature.subjectId,
          assetId: asset?.id,
          sourceUrl: background?.url,
          sourceStatus: asset
            ? ("supplied_unverified" as const)
            : ("missing" as const),
          note: asset
            ? "Creator-supplied artifact. Check that it supports the feature; it does not establish customer outcomes."
            : "No supplied proof. Existing copy is preserved in a typographic fallback.",
        },
      };
      return {
        scene,
        layoutJson: JSON.stringify(sceneConfigSchema.parse(next)),
        templateId: asset ? "hf-opener" : "hf-statement",
        assetRefs: asset ? [asset.id] : [],
        reason: next.proof.note,
        readingSeconds: estimateSpeechSeconds(scene.spokenText ?? scene.text),
      };
    });
    const preview = {
      state: "preview" as const,
      sourceHash: source.sourceHash,
      featureId: feature.id,
      assetId: asset?.id,
      subjectId: feature.subjectId,
      startSeconds: artifact?.startSeconds ?? 0,
      changes: changes.map((change) => ({
        sceneId: change.scene.id,
        text: change.scene.text,
        narration: change.scene.spokenText ?? change.scene.text,
        beforeAssetIds: parseJsonColumn(
          change.scene.assetRefs,
          assetRefsSchema,
          [],
        ),
        afterAssetIds: change.assetRefs,
        reason: change.reason,
        readingSeconds: change.readingSeconds,
      })),
      warnings: [
        ...(asset
          ? [
              "Supplied proof is unverified; review its relevance to the actual feature.",
            ]
          : [
              "Missing proof: typography preserves the supplied copy without generating product UI.",
            ]),
        ...(recording &&
        artifact &&
        changes.some(
          (c) =>
            c.readingSeconds > recording.durationSec - artifact.startSeconds,
        )
          ? [
              "The scene may outlast the remaining recording. Inspect the ending in the animatic and export.",
            ]
          : []),
      ],
    };
    if (input.action === "preview") return preview;
    const before = await storyboardSnapshot(tx, scriptId);
    for (const change of changes) {
      await tx.scene.update({
        where: { id: change.scene.id },
        data: {
          templateId: change.templateId,
          layoutJson: change.layoutJson,
          assetRefs: JSON.stringify(change.assetRefs),
          visual: null,
        },
      });
      await tx.stockMediaSelection.deleteMany({
        where: { sceneId: change.scene.id },
      });
    }
    const registry = subjectRegistrySchema.parse([
      ...(overrides.motionPlan?.subjectRegistry ?? []).filter(
        (s) => !plan.subjects.some((subject) => subject.id === s.id),
      ),
      ...plan.subjects,
    ]);
    await tx.script.update({
      where: { id: scriptId },
      data: {
        brandOverrides: JSON.stringify({
          ...overrides,
          motionPlan: {
            version: "1.0.0",
            seed: scriptId,
            ambition: "expressive",
            ...overrides.motionPlan,
            subjectRegistry: registry,
          },
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
    return { ...preview, state: "applied" as const };
  });
}
