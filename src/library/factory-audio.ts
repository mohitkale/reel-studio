import { createHash } from "node:crypto";
import { parseWav, pcmToWav } from "@/lib/wav";
import { getAssetStore } from "@/library/storage";
import { FACTORY_LIMITS } from "@/production/factory";
import type { FactoryRange } from "@/production/factory-derive";
/** No network or transcoder: splice normalized local PCM at complete-scene boundaries. */
export async function cutFactoryAudio(
  url: string,
  fps: number,
  ranges: FactoryRange[],
  sourceTotalFrames?: number,
) {
  if (!url.startsWith("/media/"))
    throw new Error("Cutdowns require a local normalized WAV take");
  const key = decodeURIComponent(url.slice(7));
  if (
    key.split(/[\\/]/).some((part) => part === "..") ||
    key.includes("?") ||
    key.includes("#")
  )
    throw new Error("Invalid local take path");
  const opened = await getAssetStore().open(key);
  const size = opened.size;
  if (size > FACTORY_LIMITS.cutAudioBytes) {
    await opened.close();
    throw new Error("Cutdown source audio exceeds 128 MiB");
  }
  const data = Buffer.from(
      await new Response(opened.stream({ end: size - 1 })).arrayBuffer(),
    ),
    info = parseWav(data);
  if (
    info.bitsPerSample !== 16 ||
    info.channels !== 1 ||
    info.sampleRate !== 44100 ||
    data.readUInt16LE(20) !== 1
  )
    throw new Error("Cutdowns require normalized 44.1 kHz mono 16-bit PCM WAV");
  if (
    sourceTotalFrames &&
    info.durationSeconds + 1 / info.sampleRate < sourceTotalFrames / fps
  )
    throw new Error("Take audio does not cover the full source timeline");
  const pcm = ranges.map((range) => {
    const start = Math.round((range.startFrame / fps) * info.sampleRate),
      end = Math.round((range.endFrame / fps) * info.sampleRate);
    if (end * 2 > info.dataLength)
      throw new Error("Take audio does not cover the selected scene range");
    return data.subarray(
      info.dataOffset + start * 2,
      info.dataOffset + end * 2,
    );
  });
  const wav = pcmToWav(Buffer.concat(pcm)),
    hash = createHash("sha256").update(wav).digest("hex"),
    output = `factory-audio/${hash}.wav`;
  if (!(await getAssetStore().exists(output)))
    await getAssetStore().put(output, wav);
  else {
    const cached = await getAssetStore().open(output);
    if (cached.size !== wav.length) {
      await cached.close();
      throw new Error("Cached cutdown audio changed");
    }
    const data = Buffer.from(
      await new Response(cached.stream({ end: cached.size - 1 })).arrayBuffer(),
    );
    if (createHash("sha256").update(data).digest("hex") !== hash)
      throw new Error("Cached cutdown audio changed");
  }
  return getAssetStore().url(output);
}
