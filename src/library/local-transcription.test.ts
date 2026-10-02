// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getLocalTranscriptionStatus,
  transcribeWithWhisperCpp,
} from "@/library/local-transcription";

const previousBinary = process.env.WHISPER_CPP_BIN;
const previousModel = process.env.WHISPER_CPP_MODEL;

afterEach(() => {
  if (previousBinary === undefined) delete process.env.WHISPER_CPP_BIN;
  else process.env.WHISPER_CPP_BIN = previousBinary;
  if (previousModel === undefined) delete process.env.WHISPER_CPP_MODEL;
  else process.env.WHISPER_CPP_MODEL = previousModel;
});

describe("local whisper.cpp transcription", () => {
  it("reports actionable setup when the configured binary is missing", async () => {
    process.env.WHISPER_CPP_BIN = "/definitely/missing/whisper-cli";
    delete process.env.WHISPER_CPP_MODEL;
    await expect(getLocalTranscriptionStatus()).resolves.toMatchObject({
      available: false,
      reason: expect.stringContaining("WHISPER_CPP_BIN"),
    });
  });

  it("runs the configured binary without a shell and parses its SRT", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-whisper-test-"));
    try {
      const binary = path.join(directory, "fake-whisper.mjs");
      const model = path.join(directory, "model.bin");
      writeFileSync(model, "fixture");
      writeFileSync(
        binary,
        `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const output = process.argv[process.argv.indexOf("-of") + 1];
writeFileSync(output + ".srt", "1\\n00:00:00,250 --> 00:00:01,500\\nLocal words\\n");
`,
      );
      process.env.WHISPER_CPP_BIN = process.execPath;
      process.env.WHISPER_CPP_MODEL = model;
      await expect(
        transcribeWithWhisperCpp(
          { audio: Buffer.from("RIFF"), fps: 20 },
          {
            run: async (executable, args) => {
              expect(executable).toBe(process.execPath);
              await promisify(execFile)(executable, [binary, ...args], {
                shell: false,
              });
            },
          },
        ),
      ).resolves.toEqual([
        { startFrame: 5, endFrame: 30, text: "Local words" },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("requests native token timing and retains measured speech gaps", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-whisper-words-"));
    try {
      const binary = path.join(directory, "fake-whisper.mjs");
      const model = path.join(directory, "model.bin");
      writeFileSync(model, "fixture");
      writeFileSync(
        binary,
        `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
if (!process.argv.includes("-ojf")) process.exit(1);
const output = process.argv[process.argv.indexOf("-of") + 1];
writeFileSync(output + ".srt", "1\\n00:00:00,250 --> 00:00:01,500\\nLocal words\\n");
writeFileSync(output + ".json", JSON.stringify({transcription:[{text:" Local words",offsets:{from:250,to:1500},tokens:[{text:" Local",offsets:{from:250,to:600}},{text:" words",offsets:{from:1000,to:1400}}]}]}));
`,
      );
      process.env.WHISPER_CPP_BIN = process.execPath;
      process.env.WHISPER_CPP_MODEL = model;
      expect(
        (
          await transcribeWithWhisperCpp(
            {
              audio: Buffer.from("RIFF"),
              fps: 20,
            },
            {
              run: async (executable, args) => {
                await promisify(execFile)(executable, [binary, ...args], {
                  shell: false,
                });
              },
            },
          )
        )[0].words,
      ).toEqual([
        { text: "Local", startFrame: 5, endFrame: 12 },
        { text: "words", startFrame: 20, endFrame: 28 },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
