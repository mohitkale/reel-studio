import { getScript } from "@/library/repositories/scripts";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { listScriptStockMediaSelections } from "@/library/repositories/stock-media-selections";

export async function captureVideoSnapshot(
  scriptId: string,
  voiceTakeId?: string,
) {
  const script = await getScript(scriptId);
  if (!script) throw new Error(`Script ${scriptId} not found`);
  const take = voiceTakeId
    ? script.takes.find((take) => take.id === voiceTakeId)
    : null;
  if (voiceTakeId && !take)
    throw new Error("Voice take does not belong to this script");
  const stockMedia = await listScriptStockMediaSelections(scriptId);
  return videoSnapshotSchema.parse({
    version: 1,
    script,
    take: take ?? null,
    stockMedia,
  });
}
