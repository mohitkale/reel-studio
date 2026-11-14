/**
 * `npm run voice:download`: fetch the local Kokoro voice model (about 90 MB)
 * with a progress line, resuming a partial download. Run on its own or through
 * `npm run setup -- --voice`.
 */
import {
  downloadVoiceModel,
  getVoiceModelStatus,
} from "../src/library/voice-model";

const before = await getVoiceModelStatus();
if (before.cached) {
  console.log(`✓ Voice model already on this machine: ${before.location}`);
  process.exit(0);
}
console.log(`Downloading the voice model (about 90 MB) to ${before.location}`);
let last = "";
await downloadVoiceModel({
  onProgress: (p) => {
    const line = `  ${Math.round((p.bytesDone / Math.max(1, p.bytesTotal)) * 100)}%  ${p.file} (${p.fileIndex + 1}/${p.fileCount})`;
    if (line !== last) process.stdout.write(`\r${line}      `);
    last = line;
  },
});
console.log("\n✓ Voice model ready. Narration now runs fully offline.");
