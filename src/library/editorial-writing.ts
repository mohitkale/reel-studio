import { boundedGeneration } from "./bounded-generation";
import { createHash } from "node:crypto";
import { filmCanonicalJson } from "@/production/film-plan";
import { estimateSpeechSeconds } from "@/lib/audio-timing";
import {
  EDITORIAL_ARCS,
  editorialCreationRequestSchema,
  editorialScriptSchema,
  type EditorialCreationRequest,
  type EditorialScript,
} from "@/production/editorial";
import { AIError, type ScenePlan } from "@/providers/ai/types";
import { getAIProvider, listAIProviderStatuses } from "@/providers/ai/registry";
import { ResearchRepository } from "./repositories/research";
import { researchPromptContext } from "@/research/writer";
import type { EvidencePack } from "@/research/contracts";
import {
  creationEvidenceSources,
  unsupportedCreationNumbers,
} from "@/research/creation-grounding";
import {
  createEditorialRecord,
  readEditorialRecord,
  changeEditorialRecord,
} from "./repositories/editorial";
import { getBrandKit } from "./repositories/brandkits";

export function admitEditorialScript(
  plan: ScenePlan,
  request: EditorialCreationRequest,
  evidence: EvidencePack | null,
): EditorialScript {
  if (
    unsupportedCreationNumbers(plan, [
      request.brief,
      ...(evidence ? creationEvidenceSources(evidence) : []),
    ]).length
  )
    throw new AIError(
      "Editorial copy contains unsupported numbers. Review the source before trying again.",
      422,
    );
  const arc = EDITORIAL_ARCS[request.creativeBrief.intent];
  const gaps = [...(evidence?.gaps ?? [])];
  const beats = plan.scenes.map((scene, index) => {
    const references = scene.evidenceRefs ?? [];
    for (const ref of references) {
      if (
        !evidence?.sources
          .find((source) => source.id === ref.sourceId)
          ?.excerpts.some((excerpt) => excerpt.id === ref.excerptId)
      )
        throw new AIError(
          "The writer returned an invalid evidence reference",
          422,
        );
    }
    if (!references.length)
      gaps.push(
        `Beat ${index + 1} has no linked excerpt. Review its claims against the supplied text.`,
      );
    return {
      id: `beat-${index + 1}`,
      purpose:
        arc[
          Math.min(
            arc.length - 1,
            Math.floor((index * arc.length) / plan.scenes.length),
          )
        ]!,
      headline: scene.text,
      narration: scene.spokenText ?? scene.text,
      references,
      locked: false,
    };
  });
  const estimatedSeconds = beats.reduce(
    (sum, beat) => sum + estimateSpeechSeconds(beat.narration),
    0,
  );
  if (
    Math.abs(estimatedSeconds - request.creativeBrief.targetSeconds) >
    request.creativeBrief.targetSeconds * 0.25
  )
    gaps.push(
      "Estimated narration differs materially from the requested duration. Do not pad unsupported content to fill time.",
    );
  if (evidence?.conflicts.length)
    gaps.push(
      "Evidence contains unresolved conflicts. Check the linked claims before publication.",
    );
  return editorialScriptSchema.parse({
    version: 1,
    title: plan.scriptName.slice(0, 300),
    angle: plan.projectName.slice(0, 500),
    beats,
    estimatedSeconds,
    gaps: gaps.slice(0, 100),
  });
}

export async function startEditorialWriting(input: unknown) {
  const request = editorialCreationRequestSchema.parse(input);
  const fingerprint = createHash("sha256")
    .update(filmCanonicalJson(request))
    .digest("hex");
  const evidence = request.evidenceId
    ? await new ResearchRepository().getEvidence(request.evidenceId)
    : null;
  if (request.evidenceId && !evidence)
    throw new AIError("Evidence revision not found", 404);
  if (evidence) {
    try {
      researchPromptContext(evidence);
    } catch {
      throw new AIError("Evidence has no usable bounded context", 400);
    }
  }
  if (request.brandKitId && !(await getBrandKit(request.brandKitId)))
    throw new AIError("Brand kit not found", 404);
  return createEditorialRecord(
    {
      version: 1,
      key: request.idempotencyKey,
      fingerprint,
      request,
      state: "queued",
      callsUsed: 0,
      deadlineAt: new Date(
        Date.now() + request.budget.deadlineMs,
      ).toISOString(),
      revision: 0,
      error: null,
    },
    evidence,
  );
}

export async function runEditorialWriting(
  scriptId: string,
  authorizeProvider: (providerId: string) => Promise<unknown>,
  options: { getProvider?: typeof getAIProvider } = {},
) {
  let claimed = false;
  const current = await changeEditorialRecord(scriptId, (workflow) => {
    if (workflow.state !== "queued" || workflow.callsUsed) return workflow;
    if (Date.parse(workflow.deadlineAt) <= Date.now())
      return {
        ...workflow,
        state: "failed",
        error:
          "Writing deadline expired. Resume only unspent queued work or submit a new explicit request.",
      };
    claimed = true;
    return { ...workflow, state: "running" };
  });
  if (!claimed) return current;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(0, Date.parse(current.deadlineAt) - Date.now()),
  );
  let checking = false;
  const poll = setInterval(() => {
    if (checking) return;
    checking = true;
    void readEditorialRecord(scriptId)
      .then((record) => {
        if (record?.workflow.state !== "running") controller.abort();
      })
      .catch(() => controller.abort())
      .finally(() => {
        checking = false;
      });
  }, 250);
  try {
    const record = await readEditorialRecord(scriptId);
    if (!record) throw new Error("Missing draft");
    const request = current.request;
    const provider = (options.getProvider ?? getAIProvider)(request.providerId);
    if (!provider.isConfigured()) throw new Error("Writer is not configured");
    const modelId =
      request.modelId ??
      (await listAIProviderStatuses()).find(
        (status) => status.id === request.providerId,
      )?.defaultModel;
    controller.signal.throwIfAborted();
    await authorizeProvider(request.providerId);
    await changeEditorialRecord(scriptId, (workflow) => {
      if (workflow.state !== "running" || workflow.callsUsed)
        throw new Error("Writing no longer active");
      return {
        ...workflow,
        callsUsed: 1,
        request: { ...workflow.request, modelId },
      };
    });
    controller.signal.throwIfAborted();
    const plan = await boundedGeneration(
      provider.generatePlan({
        mode: "editorial_script",
        brief: request.brief,
        creativeBrief: request.creativeBrief,
        sceneCount: Math.max(
          3,
          Math.min(12, Math.round(request.creativeBrief.targetSeconds / 10)),
        ),
        modelId,
        evidence: record.evidence ?? undefined,
        mediaPreference: "none",
        allowStructuredRepair: false,
        signal: controller.signal,
      }),
      controller.signal,
    );
    controller.signal.throwIfAborted();
    const draft = admitEditorialScript(plan, request, record.evidence);
    return await changeEditorialRecord(scriptId, (workflow) =>
      workflow.state === "running"
        ? { ...workflow, state: "ready", revision: 1, draft, error: null }
        : workflow,
    );
  } catch {
    return changeEditorialRecord(scriptId, (workflow) =>
      workflow.state === "canceled"
        ? workflow
        : {
            ...workflow,
            state: "failed",
            error:
              "Editorial writing failed or stopped. Check the selected writer and evidence; no automatic paid retry was made.",
          },
    );
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
  }
}

export async function controlEditorialWriting(
  scriptId: string,
  input: import("@/production/editorial").EditorialControl,
) {
  return changeEditorialRecord(scriptId, (current, evidence) => {
    if (input.action === "cancel")
      return current.state === "ready"
        ? current
        : { ...current, state: "canceled", error: null };
    if (input.action === "resume") {
      if (
        current.callsUsed ||
        current.state === "ready" ||
        current.state === "running"
      )
        return current;
      return {
        ...current,
        state: "queued",
        deadlineAt: new Date(
          Date.now() + current.request.budget.deadlineMs,
        ).toISOString(),
        error: null,
      };
    }
    if (
      current.state !== "ready" ||
      current.revision !== input.expectedRevision ||
      !current.draft
    )
      throw new AIError(
        "The editorial draft changed. Reload before saving.",
        409,
      );
    for (const old of current.draft.beats.filter((beat) => beat.locked)) {
      const next = input.draft.beats.find((beat) => beat.id === old.id);
      if (
        !next ||
        JSON.stringify({ ...next, locked: true }) !== JSON.stringify(old)
      )
        throw new AIError(
          "Unlock the protected writing beat before changing it",
          409,
        );
    }
    for (const beat of input.draft.beats)
      for (const ref of beat.references)
        if (
          !evidence?.sources
            .find((source) => source.id === ref.sourceId)
            ?.excerpts.some((excerpt) => excerpt.id === ref.excerptId)
        )
          throw new AIError("Invalid editorial evidence reference", 400);
    const draft = {
      ...input.draft,
      estimatedSeconds: input.draft.beats.reduce(
        (sum, beat) => sum + estimateSpeechSeconds(beat.narration),
        0,
      ),
      gaps: [
        ...(evidence?.gaps ?? []).slice(0, 99),
        "Manually edited script: recheck references, figures and uncertainty before publication.",
      ],
    };
    return { ...current, draft, revision: current.revision + 1 };
  });
}
