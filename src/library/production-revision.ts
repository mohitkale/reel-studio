import { createHash } from "node:crypto";

import { prisma } from "@/library/db";
import { captureVideoSnapshot } from "@/library/video-snapshot";
import {
  videoSnapshotSchema,
  type VideoSnapshot,
} from "@/production/video-snapshot";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function videoRevisionHash(snapshot: VideoSnapshot): string {
  return createHash("sha256").update(stable(snapshot)).digest("hex");
}

export async function createProductionRevision(snapshot: VideoSnapshot) {
  const parsed = videoSnapshotSchema.parse(snapshot);
  return prisma.productionRevision.create({
    data: {
      projectId: parsed.script.projectId,
      scriptId: parsed.script.id,
      revisionHash: videoRevisionHash(parsed),
      snapshotJson: JSON.stringify(parsed),
    },
  });
}

export async function currentVideoRevisionHash(
  scriptId: string,
  voiceTakeId?: string,
) {
  return videoRevisionHash(await captureVideoSnapshot(scriptId, voiceTakeId));
}

export async function currentVideoRevisionHashes(
  inputs: Array<{ scriptId: string; voiceTakeId?: string }>,
) {
  if (!inputs.length) return new Map<string, string | null>();
  const { getScripts } = await import("@/library/repositories/scripts");
  const { listScriptsStockMediaSelections } =
    await import("@/library/repositories/stock-media-selections");
  const ids = [...new Set(inputs.map((input) => input.scriptId))];
  const scripts = await getScripts(ids);
  const selections = await listScriptsStockMediaSelections(ids);
  const hashes = new Map<string, string | null>();
  for (const input of inputs) {
    const key = JSON.stringify([input.scriptId, input.voiceTakeId ?? null]);
    if (hashes.has(key)) continue;
    const script = scripts.get(input.scriptId);
    const take = input.voiceTakeId
      ? script?.takes.find((t) => t.id === input.voiceTakeId)
      : null;
    if (!script || (input.voiceTakeId && !take)) {
      hashes.set(key, null);
      continue;
    }
    hashes.set(
      key,
      videoRevisionHash(
        videoSnapshotSchema.parse({
          version: 1,
          script,
          take: take ?? null,
          stockMedia: selections.get(input.scriptId) ?? [],
        }),
      ),
    );
  }
  return hashes;
}
