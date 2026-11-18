// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { KokoroTTS } from "kokoro-js";
import {
  createInferenceGate,
  guardKokoroTokenizer,
  KokoroTokenLimit,
  NO_PACING,
  planPacing,
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
    const result = await synthesizeSpeechChunks(
      text,
      async (chunk) => {
        seen.push(chunk);
        return { audio: new Float32Array([seen.length]), sampling_rate: 24000 };
      },
      undefined,
      NO_PACING,
    );
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

describe("pacing", () => {
  const long = "This first sentence has quite a few spoken words in it.";

  it("plans pauses: none first, a short one between sentences, a longer one between paragraphs", () => {
    const plan = planPacing(
      `${long} Another longer sentence follows here today.\n\nNew paragraph starts now.`,
    );
    expect(plan.map((c) => c.pauseBefore)).toEqual([0, 0.16, 0.4]);
  });

  it("reads the first sentence a little slower and the rest at speed", () => {
    const plan = planPacing(`${long} The second sentence is plain enough.`);
    expect(plan.map((c) => c.speed)).toEqual([0.95, 1]);
  });

  it("adds a beat before a short punchline and before a number", () => {
    const punchline = planPacing(
      `${long} Then a somewhat longer sentence comes in. Yes.`,
    );
    expect(punchline.at(-1)!.pauseBefore).toBeCloseTo(0.36);
    const stat = planPacing(`${long} 40% of people agree.`);
    expect(stat.at(-1)!.pauseBefore).toBeCloseTo(0.36);
    // After normalisation the number is a word.
    const spoken = planPacing(
      `${long} Forty percent of people from the survey agree.`,
    );
    expect(spoken.at(-1)!.pauseBefore).toBeCloseTo(0.36);
  });

  it("puts the planned silence between the audio parts", async () => {
    const result = await synthesizeSpeechChunks(
      `${long} The second sentence is plain enough.`,
      async () => ({
        audio: new Float32Array(100).fill(1),
        sampling_rate: 1000,
      }),
    );
    // 100 + 160 samples of silence (0.16 s at 1 kHz) + 100.
    expect(result.audio.length).toBe(360);
    expect(result.audio.slice(100, 260).every((v) => v === 0)).toBe(true);
    expect(result.audio[260]).toBe(1);
  });

  it("passes the first-sentence speed to the voice", async () => {
    const factors: Array<number | undefined> = [];
    await synthesizeSpeechChunks(
      `${long} The second sentence is plain enough.`,
      async (_chunk, factor) => {
        factors.push(factor);
        return { audio: new Float32Array(2).fill(1), sampling_rate: 1000 };
      },
    );
    expect(factors).toEqual([0.95, 1]);
  });

  it("is the same every time", () => {
    expect(planPacing(`${long} Yes.`)).toEqual(planPacing(`${long} Yes.`));
  });
});
