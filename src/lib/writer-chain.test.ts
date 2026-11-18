import { describe, expect, it } from "vitest";

import type { AIProviderStatus } from "@/providers/ai/types";
import {
  cloudFallback,
  pickWriter,
  writerChain,
  writerPrivacyNote,
} from "./writer-chain";

const gemini: AIProviderStatus = {
  id: "gemini",
  kind: "cloud",
  label: "Gemini",
  configured: true,
  defaultModel: "gemini-x",
};
const ollama: AIProviderStatus = {
  id: "ollama",
  kind: "local",
  label: "Ollama",
  configured: true,
  defaultModel: "qwen2.5:7b",
};

describe("writer chain", () => {
  it("prefers a local model over an online key", () => {
    expect(pickWriter([gemini, ollama])?.id).toBe("ollama");
    expect(pickWriter([gemini])?.id).toBe("gemini");
    expect(pickWriter([{ ...gemini, configured: false }])).toBeUndefined();
  });

  it("marks the step in use and falls through to paste mode", () => {
    expect(writerChain([gemini, ollama]).map((s) => s.state)).toEqual([
      "active",
      "ready",
      "ready",
    ]);
    expect(writerChain([gemini]).map((s) => s.state)).toEqual([
      "off",
      "active",
      "ready",
    ]);
    expect(writerChain([]).map((s) => s.state)).toEqual([
      "off",
      "off",
      "active",
    ]);
  });

  it("says where the text goes", () => {
    expect(writerPrivacyNote(ollama)).toContain("Nothing leaves your machine");
    expect(writerPrivacyNote(gemini)).toContain("sent to Gemini");
    expect(cloudFallback([ollama, gemini])?.id).toBe("gemini");
  });
});
