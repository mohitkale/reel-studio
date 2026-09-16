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
