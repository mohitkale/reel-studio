import { describe, expect, it } from "vitest";

import {
  isSmallModel,
  memoryTier,
  recommendedWriter,
  sameModel,
} from "./local-models";

const GB = 1024 ** 3;

describe("local writer models", () => {
  it("picks a tier from memory", () => {
    expect(memoryTier(8 * GB)).toBe(8);
    expect(memoryTier(16 * GB)).toBe(16);
    expect(memoryTier(32 * GB)).toBe(32);
    expect(memoryTier(64 * GB)).toBe(32);
    expect(recommendedWriter(16 * GB).ollama).toBe("qwen2.5:7b");
  });

  it("recognises small models by name", () => {
    expect(isSmallModel("qwen2.5:3b")).toBe(true);
    expect(isSmallModel("llama3.2:1b")).toBe(true);
    expect(isSmallModel("qwen2.5:7b")).toBe(false);
    expect(isSmallModel("qwen2.5:14b")).toBe(false);
    expect(isSmallModel("gpt-oss")).toBe(false);
    expect(isSmallModel(undefined)).toBe(false);
  });

  it("ignores the latest tag when comparing", () => {
    expect(sameModel("qwen2.5:7b", "qwen2.5:7b")).toBe(true);
    expect(sameModel("llama3:latest", "llama3")).toBe(true);
    expect(sameModel("a:3b", "a:7b")).toBe(false);
  });
});
