import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGeminiProvider } from "./gemini";
import { createLMStudioProvider } from "./lm-studio";
import { createOpenAIProvider } from "./openai";
import {
  podcastWriterPromptDocument,
  storyboardWriterPromptDocument,
} from "./storyboard-doc";
import {
  buildRetryMessages,
  buildStoryboardMessages,
  PODCAST_WRITER_PROMPT,
  STORYBOARD_WRITER_PROMPT,
  type StoryboardBrief,
} from "./storyboard-prompt";
import {
  geminiStoryboardSchema,
  strictStoryboardSchema,
} from "./storyboard-schema";
import { writeStoryboard } from "./storyboard-writer";
import { AIError, type AIProvider } from "./types";
import { storyboardJsonSchema } from "@/storyboard";

const root = path.resolve(__dirname, "..", "..", "..");
const fixtureDir = path.join(
  root,
  "src",
  "storyboard",
  "fixtures",
  "model-outputs",
);
const fixture = (name: string) =>
  readFileSync(path.join(fixtureDir, name), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const BRIEFS: StoryboardBrief[] = [
  {
    topic: "Three habits that make code reviews faster",
    format: "16:9",
    targetSeconds: 45,
  },
  { topic: "Why index funds beat most stock pickers", audience: "beginners" },
  {
    topic: "A product teaser for a reusable water bottle",
    format: "1:1",
    targetSeconds: 30,
  },
  { topic: "How the Roman aqueducts worked", audience: "curious teens" },
  { topic: "Five tips for a calmer morning", tone: "warm" },
];

describe("the writer prompt", () => {
  it("is under 900 tokens, with no internal ids", () => {
    expect(STORYBOARD_WRITER_PROMPT.length / 4).toBeLessThan(900);
    expect(STORYBOARD_WRITER_PROMPT).not.toMatch(
      /hf[.-]|capabilityId|templateId|recipe|catalog|remotion|hyperframes/i,
    );
  });

  it("covers the craft rules and every scene type", () => {
    for (const part of [
      "first three seconds",
      "seven words",
      "spoken",
      "payoff",
      "Never invent",
    ]) {
      expect(STORYBOARD_WRITER_PROMPT).toContain(part);
    }
    for (const type of [
      "hook",
      "statement",
      "list",
      "stat",
      "chart",
      "quote",
      "code",
      "media",
      "cta",
    ]) {
      expect(STORYBOARD_WRITER_PROMPT).toContain(`- ${type}:`);
    }
  });

  it("sends the brief as JSON and the problems on the single retry", () => {
    const { system, user } = buildStoryboardMessages(BRIEFS[0]!);
    expect(system).toBe(STORYBOARD_WRITER_PROMPT);
    expect(JSON.parse(user).brief).toMatchObject({
      topic: BRIEFS[0]!.topic,
      format: "16:9",
      targetSeconds: 45,
    });
    const retry = buildRetryMessages(BRIEFS[0]!, "bad reply", [
      {
        path: "scenes",
        message: "Required",
        expected: "scenes",
        example: "[]",
      },
    ]);
    expect(JSON.parse(retry.user)).toMatchObject({
      previousReply: "bad reply",
      problems: [{ path: "scenes" }],
    });
  });

  it("asks to change an existing storyboard and keeps the rest as it is", () => {
    const current = { version: 1, title: "T", scenes: [{ type: "hook" }] };
    const brief: StoryboardBrief = {
      topic: "Revise an existing video",
      revise: { storyboard: current, instruction: "Make the hook shorter" },
    };
    const { system, user } = buildStoryboardMessages(brief);
    expect(system).toBe(STORYBOARD_WRITER_PROMPT);
    expect(JSON.parse(user)).toMatchObject({
      instruction: "Make the hook shorter",
      currentStoryboard: current,
    });
    expect(JSON.parse(user).task).toMatch(/exactly as it is/);
    const retry = JSON.parse(
      buildRetryMessages(brief, "bad", [
        { path: "scenes", message: "Required", expected: "x", example: "[]" },
      ]).user,
    );
    expect(retry).toMatchObject({
      instruction: "Make the hook shorter",
      currentStoryboard: current,
      previousReply: "bad",
    });
    expect(retry.brief).toBeUndefined();
  });

  it("has a podcast variant: its own prompt, its own schema, a spoken task", () => {
    const brief: StoryboardBrief = {
      kind: "podcast",
      topic: "Why the sky is blue",
      hosts: 1,
    };
    const { system, user } = buildStoryboardMessages(brief);
    expect(system).toBe(PODCAST_WRITER_PROMPT);
    expect(system).toMatch(/sound spoken/);
    const parsed = JSON.parse(user);
    expect(parsed.task).toMatch(/podcast/);
    expect(parsed.brief).toMatchObject({
      topic: "Why the sky is blue",
      speakers: 1,
      targetSeconds: 180,
    });
    const schema = strictStoryboardSchema("podcast").schema as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(["speakers", "turns"]),
    );
    expect(Object.keys(schema.properties)).not.toContain("scenes");
    const video = strictStoryboardSchema().schema as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(video.properties)).toContain("scenes");
  });

  it("publishes the podcast prompt and keeps its generated document current", () => {
    const doc = readFileSync(
      path.join(root, "docs", "prompts", "podcast-writer.md"),
      "utf8",
    );
    expect(doc).toBe(podcastWriterPromptDocument());
    expect(doc).toContain(PODCAST_WRITER_PROMPT);
  });

  it("is published for chat apps and the generated files are current", () => {
    const doc = readFileSync(
      path.join(root, "docs", "prompts", "storyboard-writer.md"),
      "utf8",
    );
    expect(doc).toBe(storyboardWriterPromptDocument());
    expect(doc).toContain(STORYBOARD_WRITER_PROMPT);
    expect(
      readFileSync(path.join(root, "schemas", "storyboard.v1.json"), "utf8"),
    ).toBe(`${JSON.stringify(storyboardJsonSchema(), null, 2)}\n`);
  });
});

describe("structured-output schemas", () => {
  const FORBIDDEN =
    /"(\$schema|\$id|default|pattern|minLength|maxLength|minItems|maxItems|const)"/;
  it("uses only keywords every provider accepts and keeps the descriptions", () => {
    const text = JSON.stringify(geminiStoryboardSchema());
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).toContain("at most 60 characters");
    expect(JSON.stringify(strictStoryboardSchema())).not.toMatch(FORBIDDEN);
  });

  it("strict mode requires every key and allows null for the optional ones", () => {
    const strict = strictStoryboardSchema();
    expect(strict).toMatchObject({ name: "storyboard", strict: true });
    const root = strict.schema as {
      required: string[];
      properties: Record<string, unknown>;
      additionalProperties: boolean;
    };
    expect(root.additionalProperties).toBe(false);
    expect(root.required.sort()).toEqual(Object.keys(root.properties).sort());
    expect(JSON.stringify(root.properties.theme)).toContain('"null"');
    expect(JSON.stringify(root.properties.scenes)).not.toContain("hf.");
  });
});

describe("writeStoryboard through each provider's native structured output", () => {
  const sets = {
    gemini: [
      "sonnet-schema-1.json",
      "sonnet-schema-2.json",
      "sonnet-schema-4.json",
      "sonnet-schema-5.json",
      "haiku-schema-1.json",
    ],
    openai: [
      "haiku-schema-2.json",
      "haiku-schema-4.json",
      "haiku-schema-5.json",
      "sonnet-chat-1.txt",
      "sonnet-chat-2.txt",
    ],
    local: [
      "sonnet-chat-3.txt",
      "sonnet-chat-4.txt",
      "sonnet-chat-5.txt",
      "haiku-chat-1.txt",
      "haiku-chat-2.txt",
    ],
  } as const;

  const localStore = () => ({
    readProvider: vi.fn(async () => ({
      baseUrl: "http://127.0.0.1:1234",
      modelId: "qwen2.5-7b-instruct",
      temperature: 0.45,
      contextWindow: 16384,
      maxOutputTokens: 3072,
      allowLan: false,
      token: undefined,
    })),
    recordDiagnostic: vi.fn(async () => undefined),
  });

  function setup(kind: keyof typeof sets, replies: string[]) {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (kind === "local" && String(url).endsWith("/models")) {
          return Response.json({ data: [{ id: "qwen2.5-7b-instruct" }] });
        }
        requests.push({
          url: String(url),
          body: JSON.parse(String(init.body)),
        });
        const reply = replies[Math.min(call++, replies.length - 1)]!;
        return kind === "gemini"
          ? Response.json({
              candidates: [{ content: { parts: [{ text: reply }] } }],
            })
          : Response.json({ choices: [{ message: { content: reply } }] });
      }),
    );
    if (kind === "gemini") {
      vi.stubEnv("GEMINI_API_KEY", "key");
      return { provider: createGeminiProvider(), requests };
    }
    if (kind === "openai") {
      vi.stubEnv("OPENAI_API_KEY", "key");
      return { provider: createOpenAIProvider(), requests };
    }
    return {
      provider: createLMStudioProvider(localStore() as never),
      requests,
    };
  }

  for (const kind of ["gemini", "openai", "local"] as const) {
    it.each(sets[kind].map((file, index) => [file, index] as const))(
      `${kind}: ${"%s"} passes the linter with no errors`,
      async (file, index) => {
        const { provider, requests } = setup(kind, [fixture(file)]);
        const result = await writeStoryboard({
          provider,
          brief: BRIEFS[index]!,
        });
        expect(result.errors).toEqual([]);
        expect(result.storyboard).not.toBeNull();
        expect(result.attempts).toBe(1);
        const sent = requests[0]!.body;
        if (kind === "gemini") {
          expect(sent.generationConfig).toMatchObject({
            responseMimeType: "application/json",
          });
          expect(JSON.stringify(sent.generationConfig)).toContain(
            "responseJsonSchema",
          );
          expect(JSON.stringify(sent)).toContain(BRIEFS[index]!.topic);
        } else {
          expect(sent.response_format).toMatchObject({
            type: "json_schema",
            json_schema: { name: "storyboard", strict: true },
          });
          expect(JSON.stringify(sent.messages)).toContain(BRIEFS[index]!.topic);
        }
        expect(JSON.stringify(sent)).not.toMatch(/hf\./);
      },
    );
  }

  it("accepts the nulls strict structured output sends for optional keys", async () => {
    const reply = JSON.stringify({
      version: 1,
      kind: "video",
      title: "T",
      format: "9:16",
      theme: null,
      voice: null,
      music: "auto",
      captions: "auto",
      sources: null,
      scenes: [
        {
          type: "hook",
          headline: "H",
          narration: "A hook worth hearing.",
          body: null,
          items: null,
          stat: null,
          chart: null,
          quote: null,
          code: null,
          media: null,
          icon: null,
          emphasis: null,
          durationHint: null,
        },
      ],
    });
    const { provider } = setup("openai", [reply]);
    const result = await writeStoryboard({ provider, brief: BRIEFS[1]! });
    expect(result.errors).toEqual([]);
  });

  it("retries once with the linter's errors, then stops", async () => {
    const bad = JSON.stringify({ version: 1, title: "T" });
    const { provider, requests } = setup("openai", [
      bad,
      fixture("haiku-schema-2.json"),
    ]);
    const result = await writeStoryboard({ provider, brief: BRIEFS[1]! });
    expect(result.attempts).toBe(2);
    expect(result.errors).toEqual([]);
    expect(JSON.stringify(requests[1]!.body.messages)).toContain("problems");
    expect(requests).toHaveLength(2);

    const stuck = setup("openai", [bad, bad, bad]);
    const failed = await writeStoryboard({
      provider: stuck.provider,
      brief: BRIEFS[1]!,
    });
    expect(failed.attempts).toBe(2);
    expect(failed.errors.length).toBeGreaterThan(0);
    expect(stuck.requests).toHaveLength(2);
  });

  it("makes one call when the retry is turned off", async () => {
    const { provider, requests } = setup("gemini", [
      JSON.stringify({ version: 1, title: "T" }),
    ]);
    const result = await writeStoryboard({
      provider,
      brief: BRIEFS[0]!,
      retry: false,
    });
    expect(result.attempts).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it("explains when a provider cannot write storyboards", async () => {
    const provider = {
      id: "gemini",
      label: "Test",
      isConfigured: () => true,
    } as unknown as AIProvider;
    await expect(
      writeStoryboard({ provider, brief: BRIEFS[0]! }),
    ).rejects.toBeInstanceOf(AIError);
  });
});

describe("a long video in two passes", () => {
  const chapterReply = (n: number) =>
    JSON.stringify({
      version: 1,
      title: `Chapter ${n} board`,
      scenes: [
        {
          type: n === 1 ? "hook" : "statement",
          headline: `Part ${n} opens`,
          narration: "A line that is spoken aloud for this chapter.",
        },
        {
          type: "statement",
          headline: `Part ${n} idea`,
          narration: "One more idea that follows right after the first.",
        },
        {
          type: "cta",
          headline: `Part ${n} ends`,
          narration: "And a closing line that wraps up this chapter.",
        },
      ],
    });

  function fakeProvider(replies: string[]) {
    const calls: { kind?: string; user: string }[] = [];
    const provider = {
      id: "openai",
      label: "Fake",
      isConfigured: () => true,
      completeStructured: async (input: { kind?: string; user: string }) => {
        calls.push({ kind: input.kind, user: input.user });
        return replies[calls.length - 1]!;
      },
    } as unknown as AIProvider;
    return { provider, calls };
  }

  it("plans the chapters first, then writes each chapter and joins them with marks and title cards", async () => {
    const outline = JSON.stringify({
      title: "The whole story",
      chapters: [
        { title: "The question", goal: "Pose it." },
        { title: "The answer", goal: "Give it." },
        { title: "What it means", goal: "Close it." },
      ],
    });
    const { provider, calls } = fakeProvider([
      outline,
      chapterReply(1),
      chapterReply(2),
      chapterReply(3),
    ]);
    const result = await writeStoryboard({
      provider,
      brief: { topic: "A long topic", targetSeconds: 450 },
      lint: { minSeconds: 1, maxSeconds: 10_000 },
    });
    expect(calls.map((c) => c.kind)).toEqual([
      "outline",
      "video",
      "video",
      "video",
    ]);
    expect(calls[2]!.user).toContain("chapter 2 of 3");
    expect(result.attempts).toBe(4);
    expect(result.errors).toEqual([]);
    const board = result.storyboard as unknown as {
      title: string;
      scenes: { type: string; headline: string }[];
      chapters: { title: string; startScene: number }[];
    };
    expect(board.title).toBe("The whole story");
    // Chapter one keeps its hook first; the others open with a card naming them.
    expect(board.scenes[0]!.type).toBe("hook");
    expect(board.chapters).toEqual([
      { title: "The question", startScene: 0 },
      { title: "The answer", startScene: 3 },
      { title: "What it means", startScene: 7 },
    ]);
    expect(board.scenes[3]!.headline).toBe("The answer");
    expect(board.scenes[7]!.headline).toBe("What it means");
    expect(board.scenes).toHaveLength(11);
  });

  it("retries an unusable outline once, then says so plainly", async () => {
    const { provider } = fakeProvider(["not json", "still not json"]);
    await expect(
      writeStoryboard({ provider, brief: { topic: "T", targetSeconds: 450 } }),
    ).rejects.toThrow(/usable chapter outline/);
  });

  it("writes a short video in two steps for a weak model, without chapter marks or cards", async () => {
    const outline = JSON.stringify({
      title: "Short and sure",
      chapters: [
        { title: "Open", goal: "Hook." },
        { title: "Middle", goal: "Explain." },
        { title: "Close", goal: "Payoff." },
      ],
    });
    const { provider, calls } = fakeProvider([
      outline,
      chapterReply(1),
      chapterReply(2),
      chapterReply(3),
    ]);
    const result = await writeStoryboard({
      provider,
      twoPass: true,
      brief: { topic: "T", targetSeconds: 45, compact: true },
      lint: { minSeconds: 1, maxSeconds: 10_000 },
    });
    expect(calls.map((c) => c.kind)).toEqual([
      "outline",
      "video",
      "video",
      "video",
    ]);
    expect(result.errors).toEqual([]);
    const board = result.storyboard as unknown as {
      scenes: unknown[];
      chapters?: unknown;
    };
    expect(board.chapters).toBeUndefined();
    expect(board.scenes).toHaveLength(9);
  });

  it("uses the shorter prompt for a compact brief", () => {
    const full = buildStoryboardMessages({ topic: "T" });
    const compact = buildStoryboardMessages({ topic: "T", compact: true });
    expect(compact.system.length).toBeLessThan(full.system.length / 2);
    expect(compact.system).toContain("JSON Schema");
  });

  it("keeps short videos to one call", async () => {
    const { provider, calls } = fakeProvider([chapterReply(1)]);
    await writeStoryboard({
      provider,
      brief: { topic: "T", targetSeconds: 60 },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.kind).toBe("video");
  });
});
