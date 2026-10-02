// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { KokoroTTS } from "kokoro-js";
import {
  createInferenceGate,
  guardKokoroTokenizer,
  KokoroTokenLimit,
  splitSpeechText,
  synthesizeSpeechChunks,
} from "./kokoro-chunks";

describe("Kokoro complete narration", () => {
  it("retains every sentence of a long script including its last word", async () => {
    const text =
      Array.from(
        { length: 80 },
        (_, i) => `Sentence ${i} has several spoken words.`,
      ).join(" ") + " The final word is finito.";
    const seen: string[] = [];
    const result = await synthesizeSpeechChunks(text, async (chunk) => {
      seen.push(chunk);
      return { audio: new Float32Array([seen.length]), sampling_rate: 24000 };
    });
    expect(seen.join(" ")).toBe(text);
    expect(result.audio.length).toBe(seen.length);
    expect(result.audio.at(-1)).toBe(seen.length);
    expect(seen.at(-1)).toContain("finito.");
  });
  it("disables tokenizer truncation and recursively splits before oversized inference", async () => {
    const tokenizer = vi.fn(
      (text: string, options: { truncation: boolean }) => {
        expect(options.truncation).toBe(false);
        return { input_ids: { dims: [1, text.length * 30] } };
      },
    );
    const tts = { tokenizer: tokenizer as unknown as KokoroTTS["tokenizer"] };
    guardKokoroTokenizer(tts);
    guardKokoroTokenizer(tts);
    const inferred: string[] = [];
    await synthesizeSpeechChunks(
      "Oversized phonemes must retain this ending.",
      async (chunk) => {
        Reflect.apply(tts.tokenizer, null, [chunk, { truncation: true }]);
        inferred.push(chunk);
        return { audio: new Float32Array([1]), sampling_rate: 24000 };
      },
    );
    expect(inferred.join(" ")).toBe(
      "Oversized phonemes must retain this ending.",
    );
    expect(inferred.every((chunk) => chunk.length * 30 <= 510)).toBe(true);
    expect(() => Reflect.apply(tts.tokenizer, null, ["a".repeat(18)])).toThrow(
      KokoroTokenLimit,
    );
  });
  it("handles multilingual text without breaking surrogate pairs", () => {
    const text = "你好世界。こんにちは！" + "😀".repeat(250);
    const chunks = splitSpeechText(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => !/[\uD800-\uDBFF]$/.test(chunk))).toBe(true);
  });
  it("fails an incomplete or mixed-rate synthesis", async () => {
    let n = 0;
    await expect(
      synthesizeSpeechChunks("First. Second.", async () => ({
        audio: new Float32Array([1]),
        sampling_rate: ++n === 1 ? 24000 : 44100,
      })),
    ).rejects.toThrow("sample rates differ");
    await expect(
      synthesizeSpeechChunks("Hello.", async () => ({
        audio: new Float32Array(),
        sampling_rate: 24000,
      })),
    ).rejects.toThrow("empty audio");
  });
});
describe("global inference gate", () => {
  it("serializes concurrent callers and holds a canceled native call until it settles", async () => {
    const gate = createInferenceGate();
    const caller = new AbortController();
    let release!: () => void;
    const native = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstRun = vi.fn(() => native);
    const nextRun = vi.fn(async () => "next");
    const first = gate(firstRun, caller.signal);
    await Promise.resolve();
    expect(firstRun).toHaveBeenCalledOnce();
    const next = gate(nextRun);
    caller.abort(new Error("cancel"));
    await expect(first).rejects.toThrow("cancel");
    expect(nextRun).not.toHaveBeenCalled();
    release();
    expect(await next).toBe("next");
  });
  it("never starts a canceled queued call and survives rejection", async () => {
    const gate = createInferenceGate();
    let release!: () => void;
    const first = gate(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await Promise.resolve();
    const caller = new AbortController();
    const run = vi.fn(async () => 1);
    const queued = gate(run, caller.signal);
    caller.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    release();
    await first;
    expect(await gate(async () => 2)).toBe(2);
    expect(run).not.toHaveBeenCalled();
  });
});

it("bounds queued inference and frees canceled entries behind a stalled active call", async () => {
  const gate = createInferenceGate(1);
  let release!: () => void;
  const active = gate(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  const caller = new AbortController();
  const run = vi.fn(async () => "canceled");
  const queued = gate(run, caller.signal);
  await expect(gate(async () => "too many")).rejects.toThrow("queue is full");
  caller.abort();
  await expect(queued).rejects.toMatchObject({ name: "AbortError" });
  const replacement = gate(async () => "replacement");
  release();
  await active;
  expect(await replacement).toBe("replacement");
  expect(run).not.toHaveBeenCalled();
});
