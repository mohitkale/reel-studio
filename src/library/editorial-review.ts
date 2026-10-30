import { createHash } from "node:crypto";
import { prisma } from "./db";
import { editorialStoryboardState } from "./editorial-storyboard";
import {
  editorialProposalSchema,
  editorialSceneSnapshotSchema,
  type EditorialReviewControl,
  type EditorialRevisionPreview,
  type EditorialFinding,
  type EditorialProposal,
} from "@/production/editorial-review";
import { filmCanonicalJson } from "@/production/film-plan";
import {
  brandOverridesSchema,
  sceneConfigSchema,
  parseJsonColumn,
} from "./schemas";
import { AIError, scenePlanSchema } from "@/providers/ai/types";
import { getAIProvider } from "@/providers/ai/registry";
import {
  creationEvidenceSources,
  unsupportedCreationNumbers,
} from "@/research/creation-grounding";
import { researchPromptContext } from "@/research/writer";
import { planMotionSequence } from "@/production/motion-plan";
import { toSceneDTO } from "./repositories/map";
import { getAssetStore } from "./storage";
import { recordHistory } from "./scene-history";
import { storyboardSnapshot } from "./structural-history";
import { boundedGeneration } from "./bounded-generation";
import type { Prisma } from "@prisma/client";

const digest = (v: unknown) =>
  createHash("sha256").update(filmCanonicalJson(v)).digest("hex");
const snapshot = (v: unknown) => editorialSceneSnapshotSchema.strip().parse(v);
export async function readEditorialReview(scriptId: string) {
  return prisma.$transaction(async (tx) => {
    const state = await editorialStoryboardState(tx, scriptId);
    const findings: EditorialFinding[] = [];
    let proposal = state.overrides.editorialProposal;
    if (
      proposal?.state === "running" &&
      proposal.deadlineAt &&
      Date.parse(proposal.deadlineAt) <= Date.now()
    ) {
      proposal = {
        ...proposal,
        state: "failed",
        error:
          "Revision deadline expired. Reserved calls are not replayed automatically.",
      };
      await writeProposal(tx, scriptId, proposal);
    }
    const seen = new Set<string>();
    for (const scene of state.row.scenes) {
      const copy = scene.spokenText ?? scene.text;
      const shot = state.overrides.editorialStoryboard?.shots.find(
        (s) => s.sceneId === scene.id,
      );
      const references = shot?.narration === copy ? shot.references : [];
      if (!references.length)
        findings.push({
          kind: "unsupported-claim",
          sceneId: scene.id,
          message:
            "No current excerpt links support this copy. Review its claims against the supplied material.",
        });
      const plan = scenePlanSchema.parse({
        projectName: "Review",
        scriptName: "Review",
        scenes: [
          {
            templateId: "hf-statement",
            text: scene.text,
            spokenText: copy,
            emphasis: [],
          },
        ],
      });
      if (
        unsupportedCreationNumbers(plan, [
          state.overrides.editorialWorkflow?.request.brief ?? "",
          ...(state.overrides.researchEvidence
            ? creationEvidenceSources(state.overrides.researchEvidence)
            : []),
        ]).length
      )
        findings.push({
          kind: "unsupported-claim",
          sceneId: scene.id,
          message:
            "A number is absent from the admitted source text. Verify it before publishing.",
        });
      const normalized = copy
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
      if (seen.has(normalized))
        findings.push({
          kind: "repetition",
          sceneId: scene.id,
          message: "This narration repeats an earlier beat.",
        });
      seen.add(normalized);
      if (
        /\b(in today.s (?:fast.paced )?world|game.changer|unlock (?:the )?potential|let.s dive|revolutionary)\b/i.test(
          copy,
        )
      )
        findings.push({
          kind: "filler",
          sceneId: scene.id,
          message:
            "Possible generic filler. Replace it with a supplied detail or remove it.",
        });
    }
    const takeaway =
      state.overrides.editorialWorkflow?.request.creativeBrief.takeaway;
    const last = state.row.scenes.at(-1);
    const tokens =
      takeaway?.toLocaleLowerCase().match(/[\p{L}\p{N}]{5,}/gu) ?? [];
    if (
      !last ||
      !tokens.length ||
      !tokens.some((t) =>
        (last.text + " " + last.spokenText).toLocaleLowerCase().includes(t),
      )
    )
      findings.push({
        kind: "missing-payoff",
        sceneId: last?.id,
        message:
          "The closing beat may not deliver the intended takeaway. Review the payoff; this is a heuristic, not a factual verdict.",
      });
    return {
      sourceHash: state.sourceHash,
      proposal,
      findings: findings.slice(0, 100),
    };
  });
}
async function writeProposal(
  tx: Prisma.TransactionClient,
  scriptId: string,
  proposal: EditorialProposal,
) {
  const state = await editorialStoryboardState(tx, scriptId);
  await tx.script.update({
    where: { id: scriptId },
    data: {
      brandOverrides: JSON.stringify({
        ...state.overrides,
        editorialProposal: editorialProposalSchema.parse(proposal),
      }),
    },
  });
}
export async function controlEditorialReview(
  scriptId: string,
  input: EditorialReviewControl,
  authorizeProvider: (providerId: string) => Promise<unknown> = async () => {},
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (input.action !== "preview")
    return prisma.$transaction(async (tx) => {
      const state = await editorialStoryboardState(tx, scriptId),
        proposal = state.overrides.editorialProposal;
      if (!proposal || proposal.id !== input.proposalId)
        throw new AIError("Revision proposal not found", 404);
      const expected =
        input.action === "undo" ? proposal.appliedHash : proposal.sourceHash;
      if (
        input.expectedHash !== expected ||
        (input.action !== "cancel" && state.sourceHash !== expected)
      )
        throw new AIError(
          "The film changed. Preview the revision again before applying or undoing.",
          409,
        );
      if (input.action === "cancel") {
        if (!["running", "ready"].includes(proposal.state))
          throw new AIError("This proposal is no longer pending", 409);
        const next = { ...proposal, state: "canceled" as const };
        await writeProposal(tx, scriptId, next);
        return next;
      }
      if (proposal.state !== (input.action === "undo" ? "applied" : "ready"))
        throw new AIError(
          "This proposal cannot be applied or undone in its current state",
          409,
        );
      const scene = state.row.scenes.find((s) => s.id === proposal.sceneId);
      if (!scene) throw new AIError("Scene no longer exists", 409);
      assertUnlocked(scene.layoutJson, proposal.kind);
      if (proposal.kind === "replace-visual") {
        const target =
          input.action === "undo" ? proposal.before : proposal.after;
        const refs = target.assetRefs
          ? (JSON.parse(target.assetRefs) as string[])
          : [];
        for (const id of refs)
          if (!(await tx.asset.findUnique({ where: { id } })))
            throw new AIError("A saved replacement asset is unavailable", 409);
      }
      const before = await storyboardSnapshot(tx, scriptId);
      await tx.scene.update({
        where: { id: scene.id },
        data: input.action === "undo" ? proposal.before : proposal.after,
      });
      if (proposal.kind === "replace-visual") {
        await tx.stockMediaSelection.deleteMany({
          where: { sceneId: scene.id },
        });
        if (input.action === "undo" && proposal.beforeStock) {
          if (
            proposal.beforeStock.localAssetId &&
            !(await tx.asset.findUnique({
              where: { id: proposal.beforeStock.localAssetId },
            }))
          )
            throw new AIError(
              "The saved stock asset is no longer available",
              409,
            );
          await tx.stockMediaSelection.create({
            data: { sceneId: scene.id, ...proposal.beforeStock },
          });
        }
      }
      const hash = (await editorialStoryboardState(tx, scriptId)).sourceHash;
      const next = {
        ...proposal,
        state:
          input.action === "undo" ? ("undone" as const) : ("applied" as const),
        ...(input.action === "apply" ? { appliedHash: hash } : {}),
      };
      await writeProposal(tx, scriptId, next);
      await recordHistory(
        tx,
        scriptId,
        "@storyboard",
        JSON.stringify(before),
        JSON.stringify(await storyboardSnapshot(tx, scriptId)),
      );
      return next;
    });
  const claimed = await prisma.$transaction(async (tx) => {
    const state = await editorialStoryboardState(tx, scriptId);
    const fingerprint = digest(input);
    const previous = state.overrides.editorialProposal;
    if (previous?.id === input.key) {
      if (previous.fingerprint !== fingerprint)
        throw new AIError("This revision key belongs to different inputs", 409);
      return { proposal: previous, run: false };
    }
    if (previous?.state === "running")
      throw new AIError(
        "Cancel the active revision before starting another",
        409,
      );
    if (state.sourceHash !== input.expectedHash)
      throw new AIError(
        "The film changed. Reload before previewing a revision",
        409,
      );
    const scene = state.row.scenes.find((s) => s.id === input.sceneId);
    if (!scene) throw new AIError("Selected scene is outside this film", 400);
    assertUnlocked(scene.layoutJson, input.kind);
    const writingBeatId = state.overrides.editorialStoryboard?.shots.find(
      (shot) => shot.sceneId === scene.id,
    )?.beatId;
    if (
      (input.kind === "make-specific" || input.kind === "shorten") &&
      state.overrides.editorialWorkflow?.draft?.beats.find(
        (beat) => beat.id === writingBeatId,
      )?.locked
    )
      throw new AIError(
        "Unlock the protected writing beat before revising its copy",
        409,
      );
    const before = snapshot(scene);
    const stock = await tx.stockMediaSelection.findUnique({
      where: { sceneId: scene.id },
    });
    const beforeStock = stock
      ? {
          providerId: stock.providerId,
          providerAssetId: stock.providerAssetId,
          kind: stock.kind,
          snapshotJson: stock.snapshotJson,
          localAssetId: stock.localAssetId,
        }
      : null;
    const workflow = state.overrides.editorialWorkflow;
    if (input.budget.maxProviderCalls) {
      if (!workflow || workflow.state !== "ready")
        throw new AIError(
          "An AI revision requires a saved editorial writer",
          400,
        );
      if (
        workflow.callsUsed + workflow.revisionCallsUsed >=
        workflow.request.budget.maxProviderCalls
      )
        throw new AIError(
          "The total writer call budget is exhausted. Use a local edit or a new explicit creative brief",
          409,
        );
      await tx.script.update({
        where: { id: scriptId },
        data: {
          brandOverrides: JSON.stringify({
            ...state.overrides,
            editorialWorkflow: {
              ...workflow,
              revisionCallsUsed: workflow.revisionCallsUsed + 1,
            },
          }),
        },
      });
    }
    const sourceHash = (await editorialStoryboardState(tx, scriptId))
      .sourceHash;
    const after = input.budget.maxProviderCalls
      ? before
      : await localRevision(tx, scene, state.row, input);
    validateCopy(after, before, input, state.overrides);
    const proposal = editorialProposalSchema.parse({
      id: input.key,
      deadlineAt: new Date(Date.now() + 30000).toISOString(),
      fingerprint,
      sourceHash,
      sceneId: scene.id,
      kind: input.kind,
      state: input.budget.maxProviderCalls ? "running" : "ready",
      providerCalls: input.budget.maxProviderCalls,
      before,
      beforeStock,
      after,
      error: null,
    });
    await writeProposal(tx, scriptId, proposal);
    return {
      proposal,
      run: Boolean(input.budget.maxProviderCalls),
      workflow,
      evidence: state.overrides.researchEvidence,
    };
  });
  if (!claimed.run) return claimed.proposal;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 30_000);
  let checking = false;
  const poll = setInterval(() => {
    if (checking) return;
    checking = true;
    void readEditorialReview(scriptId)
      .then((s) => {
        if (s.proposal?.id !== input.key || s.proposal.state !== "running")
          abort();
      })
      .catch(abort)
      .finally(() => {
        checking = false;
      });
  }, 250);
  try {
    const request = claimed.workflow!.request,
      provider = getAIProvider(request.providerId);
    if (!provider.isConfigured()) throw new Error("Writer unavailable");
    controller.signal.throwIfAborted();
    await authorizeProvider(request.providerId);
    const active = await readEditorialReview(scriptId);
    if (
      active.proposal?.id !== input.key ||
      active.proposal.state !== "running" ||
      active.sourceHash !== claimed.proposal.sourceHash
    )
      throw new Error("Revision no longer active");
    controller.signal.throwIfAborted();
    const generated = scenePlanSchema.parse(
      await boundedGeneration(
        provider.generatePlan({
          mode: "rewrite",
          sceneCount: 1,
          replacementSceneNumbers: [1],
          brief: JSON.stringify({
            task: input.kind,
            source: request.brief,
            detail: input.detail,
            evidence: claimed.evidence
              ? JSON.parse(researchPromptContext(claimed.evidence))
              : null,
            instructions:
              "Rewrite only this beat. Preserve factual limits. Do not invent proof, product UI, metrics or URLs. Shorten must reduce narration length.",
          }),
          existingContext: `Screen: ${claimed.proposal.before.text}\nNarration: ${claimed.proposal.before.spokenText ?? claimed.proposal.before.text}`,
          modelId: request.modelId,
          mediaPreference: "none",
          allowStructuredRepair: false,
          signal: controller.signal,
        }),
        controller.signal,
      ),
    );
    if (generated.scenes.length !== 1)
      throw new Error("Writer returned the wrong scope");
    const scene = generated.scenes[0];
    const after = {
      ...claimed.proposal.before,
      text: scene.text,
      spokenText: scene.spokenText ?? scene.text,
      emphasis: null,
      selectedVoiceClipId: null,
    };
    await prisma.$transaction(async (tx) => {
      const state = await editorialStoryboardState(tx, scriptId);
      if (
        state.overrides.editorialProposal?.id !== input.key ||
        state.overrides.editorialProposal.state !== "running"
      )
        return;
      if (state.sourceHash !== claimed.proposal.sourceHash)
        throw new AIError("The film changed during revision", 409);
      controller.signal.throwIfAborted();
      validateCopy(after, claimed.proposal.before, input, state.overrides);
      await writeProposal(tx, scriptId, {
        ...claimed.proposal,
        after,
        state: "ready",
      });
    });
  } catch {
    await prisma.$transaction(async (tx) => {
      const state = await editorialStoryboardState(tx, scriptId);
      if (
        state.overrides.editorialProposal?.id === input.key &&
        state.overrides.editorialProposal.state === "running"
      )
        await writeProposal(tx, scriptId, {
          ...claimed.proposal,
          state: "failed",
          error:
            "Revision stopped or failed validation. No automatic paid retry was made; review the remaining budget.",
        });
    });
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
    signal?.removeEventListener("abort", abort);
  }
  return (await readEditorialReview(scriptId)).proposal!;
}
function assertUnlocked(
  layout: string | null,
  kind: EditorialProposal["kind"],
) {
  const locks = parseJsonColumn(layout, sceneConfigSchema, {}).locks;
  if (
    locks?.scene ||
    (kind === "make-specific" || kind === "shorten"
      ? locks?.copy
      : locks?.assets)
  )
    throw new AIError(
      "This revision scope is protected. Unlock it before changing it",
      409,
    );
}
function validateCopy(
  after: EditorialProposal["after"],
  before: EditorialProposal["before"],
  input: EditorialRevisionPreview,
  overrides: import("zod").infer<typeof brandOverridesSchema>,
) {
  if (input.kind !== "make-specific" && input.kind !== "shorten") return;
  if (
    input.kind === "shorten" &&
    (after.spokenText ?? after.text).length >=
      (before.spokenText ?? before.text).length
  )
    throw new AIError("Shorten must reduce the selected narration", 422);
  const plan = scenePlanSchema.parse({
    projectName: "Revision",
    scriptName: "Revision",
    scenes: [
      {
        templateId: "hf-statement",
        text: after.text,
        spokenText: after.spokenText ?? after.text,
        emphasis: [],
      },
    ],
  });
  if (
    unsupportedCreationNumbers(plan, [
      overrides.editorialWorkflow?.request.brief ?? "",
      before.text,
      before.spokenText ?? "",
      input.detail,
      ...(overrides.researchEvidence
        ? creationEvidenceSources(overrides.researchEvidence)
        : []),
    ]).length
  )
    throw new AIError(
      "Revision contains numbers absent from the supplied sources and detail",
      422,
    );
}
async function localRevision(
  tx: Prisma.TransactionClient,
  scene: Parameters<typeof toSceneDTO>[0],
  script: { width: number; height: number },
  input: EditorialRevisionPreview,
) {
  const before = snapshot(scene),
    config = parseJsonColumn(scene.layoutJson, sceneConfigSchema, {});
  if (input.kind === "make-specific" || input.kind === "shorten")
    return {
      ...before,
      text: input.copy!.screenCopy,
      spokenText: input.copy!.narration,
      emphasis: null,
      selectedVoiceClipId: null,
    };
  if (input.kind === "replace-visual") {
    const asset = input.assetId
      ? await tx.asset.findUnique({ where: { id: input.assetId } })
      : null;
    if (input.assetId && (!asset || asset.type !== "image"))
      throw new AIError("Choose an existing local image asset", 400);
    return {
      ...before,
      templateId: asset ? "hf-broll" : "hf-statement",
      visual: null,
      assetRefs: asset ? JSON.stringify([asset.id]) : null,
      layoutJson: JSON.stringify({
        ...config,
        role: "explanation",
        background: asset
          ? {
              type: "image",
              url: getAssetStore().url(asset.path),
              effect: "none",
            }
          : undefined,
        items: undefined,
        chart: undefined,
        motion: undefined,
        direction: { version: 1, role: "explanation", composition: "authored" },
      }),
    };
  }
  const dto = toSceneDTO(scene);
  const motion = planMotionSequence(
    [
      {
        text: scene.text,
        spokenText: scene.spokenText ?? undefined,
        role: dto.role,
        direction: dto.direction,
        chart: dto.chart,
        items: dto.items,
        background: dto.background,
        hasVisualContent: Boolean(scene.visual),
        layout: {
          ...script,
          duration: Math.max(
            3,
            (scene.spokenText ?? scene.text).split(/\s+/).length / 2.5 + 1,
          ),
        },
      },
    ],
    {
      version: "1.0.0",
      seed: input.key,
      ambition: "expressive",
      adaptiveRecipes: true,
    },
  )[0];
  return { ...before, layoutJson: JSON.stringify({ ...config, motion }) };
}
