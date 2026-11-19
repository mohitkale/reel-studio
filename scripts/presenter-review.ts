/**
 * `npm run presenter:review`: check the presenter's lip sync with numbers and make
 * a half-speed copy of a clip to watch.
 *
 *   npm run presenter:review                          speak a sample, measure it
 *   npm run presenter:review -- --video clip.mp4      also write clip.half-speed.mp4
 *
 * The numbers (correlation of mouth openness with loudness, how often the mouth
 * is open when the voice is loud and shut when it is quiet, and the best lag)
 * catch a mouth that is late, stuck or unrelated. They do not replace watching
 * the clip at normal and half speed, which is what the maintainer's review is for.
 * Needs the local voice model and whisper.cpp (for word times).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { hearWav } from "../src/library/take-word-alignment";
import { buildPresenterTrack, loudness } from "../src/library/presenter-track";
import { createKokoroServerProvider } from "../src/providers/voice/kokoro-server";
import { lipSyncReport } from "../src/video/lip-sync-check";

const { values } = parseArgs({
  options: {
    text: { type: "string" },
    voice: { type: "string", default: "af_heart" },
    video: { type: "string" },
  },
});

const TEXT =
  values.text ??
  "Why does sleep matter so much for your memory? Because while you rest, your brain replays what you learned during the day. It sorts the important things from the noise. Most adults need seven to nine hours every night, and many people get far less than that.";

async function main() {
  const out = path.resolve(".artifacts/presenter-review");
  mkdirSync(out, { recursive: true });

  const provider = createKokoroServerProvider();
  const spoken = await provider.synth!({ voiceId: values.voice!, text: TEXT });
  const wavPath = path.join(out, "sample.wav");
  writeFileSync(wavPath, spoken.wav);
  const seconds = (spoken.wav.length - 44) / 2 / spoken.sampleRate;

  const heard = await hearWav(wavPath);
  if (!heard) {
    console.error(
      "whisper.cpp is not set up (WHISPER_CPP_BIN and WHISPER_CPP_MODEL), so word times are not available.",
    );
    process.exit(2);
  }
  const words = heard.map((word, i) => ({
    text: word.text,
    start: word.ms / 1000,
    end: Math.max(
      word.ms / 1000 + 0.08,
      Math.min(
        (heard[i + 1]?.ms ?? word.ms + 500) / 1000,
        word.ms / 1000 + 1.2,
      ),
    ),
  }));
  const track = await buildPresenterTrack({
    words,
    wav: spoken.wav,
    seconds,
    seed: "review",
  });
  const report = lipSyncReport(track.mouth, loudness(spoken.wav), seconds);

  const verdict =
    report.agreement >= 0.85 &&
    report.activeWhenSpeaking >= 0.9 &&
    report.restWhenSilent >= 0.7 &&
    Math.abs(report.bestLagSeconds) <= 0.08
      ? "in step"
      : "needs a look";
  const lines = [
    "# Presenter lip sync check",
    "",
    `Sample: ${seconds.toFixed(1)} s, ${words.length} words, voice ${values.voice}.`,
    "",
    `- Mouth moving when the voice sounds and still when it does not, agreement: **${Math.round(report.agreement * 100)}%**`,
    `- Mouth moving while the voice sounds: **${Math.round(report.activeWhenSpeaking * 100)}%**`,
    `- Mouth at rest while the voice is silent: **${Math.round(report.restWhenSilent * 100)}%**`,
    `- Mouth openness against loudness while speaking, correlation: **${report.correlationWhileSpeaking}** (phonemes are not loudness, so this is only a hint)`,
    `- Best lag of the audio against the mouth: **${report.bestLagSeconds} s** (0 is in step)`,
    `- Verdict: **${verdict}**`,
    "",
    "A person still has to watch a presenter clip at normal speed and at half speed.",
  ];
  writeFileSync(path.join(out, "report.md"), `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));

  if (values.video) {
    const input = path.resolve(values.video);
    const half = input.replace(/\.mp4$/i, ".half-speed.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      input,
      "-filter_complex",
      "[0:v]setpts=2*PTS[v];[0:a]atempo=0.5[a]",
      "-map",
      "[v]",
      "-map",
      "[a]",
      half,
    ]);
    console.log(`\nHalf-speed copy: ${half}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  });
