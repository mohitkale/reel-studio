import { captureVideoSnapshot } from "@/library/video-snapshot";
import { estimateSpeechSeconds } from "@/lib/audio-timing";
import type { RequestAuthorization } from "@/server/auth";
import { prisma } from "@/library/db";
import { createRender } from "@/library/repositories/renders";
import {
  appendProductionJobEvent,
  enqueueProductionJob,
  getProductionJobByIdempotencyKey,
} from "@/library/repositories/production-jobs";
import {
  PAID_MCP_PROVIDERS,
  hasMcpScope,
  providerPolicyDecision,
} from "@/production/mcp-access";
import type { ProduceContentRequest } from "@/production/api";
import { ProviderError } from "@/providers/voice/types";
import { reserveNamedMcpPaidRequest } from "@/server/secrets";
import { createProductionRevision } from "@/library/production-revision";

interface ResolvedRequest {
  kind: ProduceContentRequest["kind"];
  durationSeconds: number;
  providerIds: string[];
  inputSnapshot: Record<string, unknown>;
}

function estimateTextDuration(texts: readonly string[]): number {
  return texts.reduce(
    (sum, text) => sum + estimateSpeechSeconds(text) + 0.35,
    0,
  );
}

async function resolveRequest(
  request: ProduceContentRequest,
  serverBaseUrl: string,
): Promise<ResolvedRequest> {
  if (request.kind === "video") {
    const script = await prisma.script.findUnique({
      where: { id: request.scriptId },
      include: {
        scenes: { orderBy: { order: "asc" } },
        takes: request.voiceTakeId
          ? { where: { id: request.voiceTakeId } }
          : { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!script) throw new ProviderError("Script not found", 404);
    if (request.voiceTakeId && !script.takes.length) {
      throw new ProviderError("Voice take does not belong to this script", 400);
    }
    const durationSeconds = script.takes[0]
      ? script.takes[0].totalFrames / script.takes[0].fps
      : estimateTextDuration(
          script.scenes.map((scene) => scene.spokenText ?? scene.text),
        );
    return {
      kind: request.kind,
      durationSeconds,
      providerIds: [],
      inputSnapshot: {
        snapshot: await captureVideoSnapshot(
          request.scriptId,
          request.voiceTakeId,
        ),
        scriptId: request.scriptId,
        voiceTakeId: request.voiceTakeId,
        orientation: request.orientation,
        quality: request.quality,
        serverBaseUrl,
      },
    };
  }
  if (request.kind === "audio") {
    const script = await prisma.script.findUnique({
      where: { id: request.scriptId },
      include: { scenes: { orderBy: { order: "asc" } } },
    });
    if (!script) throw new ProviderError("Script not found", 404);
    if (!request.placeholder && (!request.providerId || !request.voiceId)) {
      throw new ProviderError(
        "Audio production requires a provider and voice",
        400,
      );
    }
    return {
      kind: request.kind,
      durationSeconds: estimateTextDuration(
        script.scenes.map((scene) => scene.spokenText ?? scene.text),
      ),
      providerIds:
        request.placeholder || !request.providerId ? [] : [request.providerId],
      inputSnapshot: {
        scriptId: request.scriptId,
        providerId: request.providerId,
        voiceId: request.voiceId,
        modelId: request.modelId,
        placeholder: request.placeholder,
        label: request.label,
      },
    };
  }
  if (request.kind === "podcast") {
    const podcast = await prisma.podcast.findUnique({
      where: { id: request.podcastId },
      include: {
        turns: { orderBy: { order: "asc" }, include: { character: true } },
      },
    });
    if (!podcast) throw new ProviderError("Podcast not found", 404);
    return {
      kind: request.kind,
      durationSeconds: estimateTextDuration(
        podcast.turns.map((turn) => turn.text),
      ),
      providerIds: podcast.turns.map((turn) => turn.character.providerId),
      inputSnapshot: {
        podcastId: request.podcastId,
        regenerateTurnIds: request.regenerateTurnIds,
        label: request.label,
      },
    };
  }
  const take = await prisma.podcastTake.findUnique({
    where: { id: request.takeId },
  });
  if (!take) throw new ProviderError("Podcast take not found", 404);
  const timeline = JSON.parse(take.timingJson) as Array<{
    turnId: string;
    startFrame: number;
    durationFrames: number;
  }>;
  const start = timeline.findIndex(
    (turn) => turn.turnId === request.startTurnId,
  );
  const end = timeline.findIndex((turn) => turn.turnId === request.endTurnId);
  if (start < 0 || end < start)
    throw new ProviderError("Invalid audiogram turn range", 400);
  const first = timeline[start];
  const last = timeline[end];
  return {
    kind: request.kind,
    durationSeconds:
      (last.startFrame + last.durationFrames - first.startFrame) / take.fps,
    providerIds: [],
    inputSnapshot: {
      takeId: request.takeId,
      startTurnId: request.startTurnId,
      endTurnId: request.endTurnId,
      orientation: request.orientation,
      quality: request.quality,
    },
  };
}

export async function submitProduction(args: {
  request: ProduceContentRequest;
  auth: RequestAuthorization;
  serverBaseUrl: string;
  batchItemId?: string;
}) {
  const duplicate = await getProductionJobByIdempotencyKey(
    args.request.idempotencyKey,
  );
  if (duplicate) return duplicate;

  const resolved = await resolveRequest(args.request, args.serverBaseUrl);
  const launchLimit =
    resolved.kind === "podcast"
      ? 600
      : resolved.kind === "audiogram"
        ? 90
        : 180;
  if (resolved.durationSeconds > launchLimit) {
    throw new ProviderError(
      `${resolved.kind} production is limited to ${launchLimit} seconds in this release`,
      400,
    );
  }
  let state: "queued" | "awaiting_approval" =
    args.request.runMode === "approval" ? "awaiting_approval" : "queued";
  let approvalReason: string | undefined;

  if (resolved.kind === "video" || resolved.kind === "audiogram") {
    if (args.auth.origin === "mcp") {
      const automatic =
        args.auth.token.kind === "named" &&
        hasMcpScope(args.auth.token.record, "production:automatic");
      if (!automatic) {
        state = "awaiting_approval";
        approvalReason =
          "Automatic rendering is not enabled for this MCP token";
      }
    }
  }

  if (args.auth.origin === "mcp" && args.auth.token.kind === "named") {
    const policy = args.auth.token.record;
    if (resolved.durationSeconds > policy.maxDurationSeconds) {
      throw new ProviderError(
        `Requested duration ${Math.ceil(resolved.durationSeconds)}s exceeds this token's ${policy.maxDurationSeconds}s limit`,
        403,
      );
    }
    const providerDecision = providerPolicyDecision(
      policy,
      resolved.providerIds,
    );
    if (!providerDecision.allowed) {
      if (providerDecision.paidRequest) {
        state = "awaiting_approval";
        approvalReason = providerDecision.reason;
      } else {
        throw new ProviderError(
          providerDecision.reason ?? "Provider is not allowed",
          403,
        );
      }
    } else if (providerDecision.paidRequest && state === "queued") {
      const reserved = await reserveNamedMcpPaidRequest(policy.id);
      if (!reserved) {
        state = "awaiting_approval";
        approvalReason = "The token's paid-request allowance is exhausted";
      }
    }
  }

  if (resolved.kind === "video") {
    const request = args.request.kind === "video" ? args.request : null;
    if (!request) throw new Error("Video production request mismatch");
    const render = await createRender({
      scriptId: request.scriptId,
      voiceTakeId: request.voiceTakeId,
      quality: request.quality,
      name: request.orientation
        ? `Production · ${request.orientation}`
        : "Production",
    });
    resolved.inputSnapshot.renderId = render.id;
    if (request.quickProduce) {
      const snapshot = await captureVideoSnapshot(
        request.scriptId,
        request.voiceTakeId,
      );
      const revision = await createProductionRevision(snapshot);
      resolved.inputSnapshot.snapshot = snapshot;
      resolved.inputSnapshot.quickProduce = request.quickProduce;
      resolved.inputSnapshot.productionRevisionId = revision.id;
      resolved.inputSnapshot.revisionHash = revision.revisionHash;
    }
  }

  const job = await enqueueProductionJob({
    kind: resolved.kind,
    state,
    idempotencyKey: args.request.idempotencyKey,
    priority: args.request.priority,
    inputSnapshot: resolved.inputSnapshot,
    batchItemId: args.batchItemId,
    productionRevisionId:
      typeof resolved.inputSnapshot.productionRevisionId === "string"
        ? resolved.inputSnapshot.productionRevisionId
        : undefined,
  });
  await appendProductionJobEvent(job.id, "submitted", {
    origin: args.auth.origin,
    durationSeconds: resolved.durationSeconds,
    providers: resolved.providerIds,
    state,
    approvalReason,
  });
  return getProductionJobByIdempotencyKey(args.request.idempotencyKey);
}

export function isPaidProvider(providerId: string): boolean {
  return PAID_MCP_PROVIDERS.has(providerId as never);
}
