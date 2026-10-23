import { frozenRevisionMatches } from "./frozen-revision";
import { Prisma } from "@prisma/client";
import { prisma } from "@/library/db";
import {
  filmDigest,
  filmCanonicalJson,
  withResolvedFilmPlan,
} from "@/production/film-plan";
import {
  videoSnapshotSchema,
  type VideoSnapshot,
} from "@/production/video-snapshot";
import { videoRevisionHash } from "@/library/production-revision";
import {
  factoryDesignSchema,
  factoryProfileDocumentSchema,
  factoryProfileRequestSchema,
  factoryRunRequestSchema,
  FACTORY_LIMITS,
  type FactoryRunRequest,
  type FactoryVariant,
} from "@/production/factory";
import { deriveFactorySnapshot } from "@/production/factory-derive";
import { cutFactoryAudio } from "@/library/factory-audio";
import { ensureFactoryPack, verifyFactoryPack } from "@/library/factory-packs";
import { ProviderError } from "@/providers/voice/types";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { assertVideoDuration, videoDurationLimit } from "@/production/limits";
import { coverFrames } from "@/video/types";
import { submitProductionBatch } from "@/library/production-batch-service";
import { productionBatchRequestSchema } from "@/production/batch";
import { factoryBatchView } from "@/library/factory-batch-view";
import type { RequestAuthorization } from "@/server/auth";
const include = { variants: { orderBy: { key: "asc" as const } } };
async function loadRevision(id: string) {
  const row = await prisma.productionRevision.findUnique({ where: { id } });
  if (!row) throw new ProviderError("Source revision not found", 404);
  if (Buffer.byteLength(row.snapshotJson) > FACTORY_LIMITS.snapshotBytes)
    throw new ProviderError("Factory source exceeds 4 MiB", 400);
  const snapshot = videoSnapshotSchema.parse(JSON.parse(row.snapshotJson));
  if (!frozenRevisionMatches(row, snapshot))
    throw new ProviderError("Source revision integrity check failed", 409);
  return { row, snapshot };
}
export async function publishFactoryProfile(value: unknown) {
  const request = factoryProfileRequestSchema.parse(value),
    { snapshot } = await loadRevision(request.sourceRevisionId),
    pack = await ensureFactoryPack();
  const document = factoryProfileDocumentSchema.parse({
      ...request,
      schemaVersion: 1,
      design: factoryDesignSchema.parse(snapshot.script),
      packDigest: pack.digest,
    }),
    digest = filmDigest(document);
  return prisma.$transaction(async (tx) => {
    const prior = await tx.factoryProfile.findUnique({
      where: { key_version: { key: request.key, version: request.version } },
    });
    if (prior) {
      if (prior.digest !== digest)
        throw new ProviderError(
          "This profile version is immutable. Publish a new version",
          409,
        );
      return prior;
    }
    if ((await tx.factoryProfile.count()) >= FACTORY_LIMITS.profiles)
      throw new ProviderError(
        "The 50-version profile storage budget is full",
        409,
      );
    const latest = await tx.factoryProfile.findFirst({
      where: { key: request.key },
      orderBy: { version: "desc" },
    });
    if (request.version !== (latest?.version ?? 0) + 1)
      throw new ProviderError(
        "Publish the next sequential profile version",
        409,
      );
    return tx.factoryProfile.create({
      data: {
        key: request.key,
        version: request.version,
        name: request.name,
        documentJson: JSON.stringify(document),
        digest,
      },
    });
  });
}
export async function listFactoryProfiles() {
  return prisma.factoryProfile.findMany({
    where: { archived: false },
    orderBy: [{ key: "asc" }, { version: "desc" }],
    take: FACTORY_LIMITS.profiles,
  });
}
export async function archiveFactoryProfile(id: string) {
  return prisma.factoryProfile.update({
    where: { id },
    data: { archived: true },
  });
}
export async function listFactoryRuns() {
  const rows = await prisma.factoryRun.findMany({
    include,
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return Promise.all(rows.map(factoryRunView));
}
export async function getFactoryRun(id: string) {
  const row = await prisma.factoryRun.findUnique({ where: { id }, include });
  return row ? factoryRunView(row) : null;
}
async function factoryRunView(
  row: Prisma.FactoryRunGetPayload<{ include: typeof include }>,
) {
  const batch = row.batchId ? await factoryBatchView(row.batchId) : null;
  return {
    ...row,
    request: JSON.parse(row.requestJson) as unknown,
    variants: row.variants.map((variant) => ({
      ...variant,
      lineage: JSON.parse(variant.lineageJson) as unknown,
    })),
    batch,
  };
}
export async function submitFactoryRun(args: {
  request: FactoryRunRequest;
  auth: RequestAuthorization;
  serverBaseUrl: string;
}) {
  const request = factoryRunRequestSchema.parse(args.request);
  if (
    args.auth.origin === "mcp" &&
    args.auth.token.kind === "named" &&
    request.variants.length > args.auth.token.record.maxBatchSize
  )
    throw new ProviderError(
      "Factory variants exceed this token's batch allowance",
      403,
    );
  let run = await prisma.factoryRun.findUnique({
    where: { idempotencyKey: request.idempotencyKey },
    include,
  });
  if (
    run &&
    filmCanonicalJson(JSON.parse(run.requestJson)) !==
      filmCanonicalJson(request)
  )
    throw new ProviderError(
      "Idempotency key belongs to a different factory request",
      409,
    );
  if (!run) {
    if ((await prisma.factoryRun.count()) >= FACTORY_LIMITS.runs)
      throw new ProviderError("The 50-run factory storage budget is full", 409);
    const { row: source, snapshot } = await loadRevision(
      request.sourceRevisionId,
    );
    const storedProfile = request.profileId
      ? await prisma.factoryProfile.findUnique({
          where: { id: request.profileId },
        })
      : null;
    if (request.profileId && (!storedProfile || storedProfile.archived))
      throw new ProviderError("Series profile is unavailable", 404);
    const profile = storedProfile
      ? factoryProfileDocumentSchema.parse(
          JSON.parse(storedProfile.documentJson),
        )
      : undefined;
    if (profile && filmDigest(profile) !== storedProfile!.digest)
      throw new ProviderError("Profile integrity check failed", 409);
    const pack = profile
      ? { digest: profile.packDigest }
      : snapshot.factory
        ? { digest: snapshot.factory.packDigest }
        : await ensureFactoryPack();
    await verifyFactoryPack(pack.digest);
    let seconds = 0;
    const children: {
      variant: FactoryVariant;
      child: VideoSnapshot;
      json: string;
      ranges: import("@/production/factory-derive").FactoryRange[];
    }[] = [];
    // Bound and validate every child before persisting lineage or creating jobs.
    for (const variant of request.variants) {
      const derived = deriveFactorySnapshot(snapshot, variant, profile);
      const timing = resolveReelTimeline(
        derived.snapshot.script.scenes.map((scene) => ({
          id: scene.id,
          text: resolveSpokenText(scene),
        })),
        derived.snapshot.take,
        derived.snapshot.script.fps,
      );
      const frames =
        timing.totalFrames +
        coverFrames(
          derived.snapshot.script.fps,
          Boolean(derived.snapshot.script.coverUrl),
        );
      assertVideoDuration(
        frames,
        derived.snapshot.script.fps,
        videoDurationLimit(derived.snapshot.script),
      );
      if (
        args.auth.origin === "mcp" &&
        args.auth.token.kind === "named" &&
        frames / derived.snapshot.script.fps >
          args.auth.token.record.maxDurationSeconds
      )
        throw new ProviderError(
          "Factory variant exceeds this token duration allowance",
          403,
        );
      seconds += frames / derived.snapshot.script.fps;
      if (seconds > (request.maxOutputSeconds ?? FACTORY_LIMITS.runSeconds))
        throw new ProviderError(
          `Factory output exceeds the ${request.maxOutputSeconds ?? FACTORY_LIMITS.runSeconds}-second budget. Reduce formats or cutdown length.`,
          400,
        );
      derived.snapshot.factory = {
        version: 1,
        sourceRevisionId: source.id,
        sourceHash: source.revisionHash,
        packDigest: pack.digest,
        profileDigest: storedProfile?.digest,
        kind: variant.kind,
        sceneIds: derived.snapshot.script.scenes.map((scene) => scene.id),
      };
      const child = derived.finalize(),
        json = JSON.stringify(child);
      if (Buffer.byteLength(json) > FACTORY_LIMITS.snapshotBytes)
        throw new ProviderError("Factory variant exceeds 4 MiB", 400);
      children.push({ variant, child, json, ranges: derived.ranges });
    }
    for (const item of children) {
      if (item.variant.kind === "cutdown" && item.child.take) {
        item.child.take.audioUrl = await cutFactoryAudio(
          item.child.take.audioUrl,
          item.child.script.fps,
          item.ranges,
          snapshot.take?.totalFrames,
        );
        item.child = withResolvedFilmPlan(item.child);
        item.json = JSON.stringify(item.child);
      }
    }
    try {
      run = await prisma.$transaction(async (tx) => {
        if ((await tx.factoryRun.count()) >= FACTORY_LIMITS.runs)
          throw new ProviderError(
            "The 50-run factory storage budget is full",
            409,
          );
        const created = await tx.factoryRun.create({
          data: {
            idempotencyKey: request.idempotencyKey,
            sourceRevisionId: source.id,
            requestJson: JSON.stringify(request),
            packDigest: pack.digest,
          },
        });
        for (const { variant, child, json } of children) {
          const revision = await tx.productionRevision.create({
            data: {
              projectId: source.projectId,
              scriptId: source.scriptId,
              revisionHash: videoRevisionHash(
                videoSnapshotSchema.parse(JSON.parse(json)),
              ),
              snapshotJson: json,
              source: "factory",
            },
          });
          await tx.factoryVariant.create({
            data: {
              runId: created.id,
              key: variant.key,
              revisionId: revision.id,
              lineageJson: JSON.stringify({
                ...child.factory,
                orientation: variant.orientation,
                label: variant.label,
                sourceSceneIds: child.script.scenes.map((scene) => scene.id),
              }),
            },
          });
        }
        return tx.factoryRun.findUniqueOrThrow({
          where: { id: created.id },
          include,
        });
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      )
        throw error;
      run = await prisma.factoryRun.findUniqueOrThrow({
        where: { idempotencyKey: request.idempotencyKey },
        include,
      });
      if (
        filmCanonicalJson(JSON.parse(run.requestJson)) !==
        filmCanonicalJson(request)
      )
        throw new ProviderError("Concurrent factory request differs", 409);
    }
  }
  if (run.batchId) return factoryRunView(run);
  const profile = request.profileId
    ? await prisma.factoryProfile.findUnique({
        where: { id: request.profileId },
      })
    : null;
  const document = profile
    ? factoryProfileDocumentSchema.parse(JSON.parse(profile.documentJson))
    : undefined;
  const revisions = await prisma.productionRevision.findMany({
    where: { id: { in: run.variants.map((v) => v.revisionId) } },
  });
  const batch = await submitProductionBatch({
    auth: args.auth,
    serverBaseUrl: args.serverBaseUrl,
    request: productionBatchRequestSchema.parse({
      idempotencyKey: `factory:${run.id}`,
      runMode: request.runMode,
      rows: run.variants.map((variant) => {
        const revision = revisions.find((r) => r.id === variant.revisionId);
        if (!revision)
          throw new ProviderError("Factory revision is unavailable", 409);
        const snapshot = videoSnapshotSchema.parse(
            JSON.parse(revision.snapshotJson),
          ),
          intent = request.variants.find((v) => v.key === variant.key)!;
        return {
          kind: "video",
          key: variant.key,
          label: intent.label,
          scriptId: revision.scriptId,
          revisionId: revision.id,
          voiceTakeId: snapshot.take?.id,
          orientations: [intent.orientation],
          quality: request.quality ?? document?.quality ?? "standard",
        };
      }),
    }),
  });
  run = await prisma.factoryRun.update({
    where: { id: run.id },
    data: { batchId: batch.id },
    include,
  });
  return factoryRunView(run);
}
