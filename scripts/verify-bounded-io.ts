/** Read and hash a 512 MiB sparse fixture without retaining its whole body. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalDiskStore } from "../src/library/storage/local-disk";
import { hashRenderFile } from "../src/library/render-section-cache";

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "reel-io-probe-"));
  const size = 512 * 1024 ** 2;
  try {
    const filename = path.join(directory, "large.mp4");
    const file = await open(filename, "w");
    await file.truncate(size);
    await file.close();
    global.gc?.();
    const before = process.memoryUsage();
    let peakRss = before.rss;
    const sample = () => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    };
    const interval = setInterval(sample, 5);
    try {
      const asset = await new LocalDiskStore(directory).open("large.mp4");
      const reader = asset.stream().getReader();
      let bytes = 0;
      let maxChunk = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        maxChunk = Math.max(maxChunk, next.value.byteLength);
        sample();
      }
      const expected = createHash("sha256");
      const zeros = Buffer.alloc(64 * 1024);
      for (let offset = 0; offset < size; offset += zeros.length)
        expected.update(zeros);
      const actual = await hashRenderFile(filename);
      sample();
      assert.equal(actual, expected.digest("hex"));
      assert.equal(bytes, size);
      assert.equal(maxChunk, 64 * 1024);
      assert.ok(
        peakRss - before.rss < 128 * 1024 ** 2,
        "Memory grew with full media size",
      );
      console.log(
        JSON.stringify({
          platform: process.platform,
          sizeBytes: size,
          bytesRead: bytes,
          maxChunkBytes: maxChunk,
          peakRssGrowthBytes: peakRss - before.rss,
          checksum: actual,
        }),
      );
    } finally {
      clearInterval(interval);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
