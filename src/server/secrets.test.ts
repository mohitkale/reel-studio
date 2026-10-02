// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";

import {
  setAIKey,
  setKey,
  setStockKey,
  setMusicKey,
  generateNamedMcpToken,
} from "./secrets";

vi.mock("node:fs", () => ({
  promises: { readFile: vi.fn(), writeFile: vi.fn() },
}));

const aiEnvName = "OPENAI_API_KEY";

describe("secret persistence", () => {
  beforeEach(() => {
    vi.mocked(fs.readFile).mockResolvedValue(
      "# existing settings\nUNRELATED=kept\n",
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  const writers = [
    (value: string) => setKey("elevenlabs", value),
    (value: string) => setAIKey("openai", value),
    (value: string) => setStockKey("unsplash", value),
    (value: string) => setMusicKey("jamendo", value),
  ];

  it.each([
    "x\nNODE_OPTIONS=malicious",
    "x\rNODE_OPTIONS=malicious",
    "\n",
    "x=value",
    "x\0y",
    'x"y',
    "x#y",
    "x$y",
    "x\\y",
    "x y",
  ])("rejects dotenv injection before any read/write", async (value) => {
    vi.stubEnv("OPENAI_API_KEY", "previous-test-value");
    for (const write of writers) {
      await expect(
        Promise.resolve().then(() => write(value)),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(process.env.OPENAI_API_KEY).toBe("previous-test-value");
  });

  it("preserves unrelated settings and trims ordinary surrounding spaces", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await setAIKey("openai", "  opaque-test-value_123  ");
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      `# existing settings\nUNRELATED=kept\n\n${aiEnvName}=opaque-test-value_123\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    expect(process.env.OPENAI_API_KEY).toBe("opaque-test-value_123");
  });

  it("still clears a key with an empty value", async () => {
    vi.stubEnv("OPENAI_API_KEY", "old-test-value");
    vi.mocked(fs.readFile).mockResolvedValue(
      `${aiEnvName}=old-test-value\nUNRELATED=kept\n`,
    );
    await setAIKey("openai", "");
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      "UNRELATED=kept\n",
      expect.any(Object),
    );
    expect(process.env.OPENAI_API_KEY).toBeUndefined();
  });

  it("keeps structured named token metadata supported", async () => {
    vi.stubEnv("MCP_NAMED_TOKENS", "");
    await generateNamedMcpToken({
      name: "Reader = local",
      policy: {
        scopes: ["studio:read"],
        allowedProviders: [],
        paidProviders: [],
        maxDurationSeconds: 60,
        maxBatchSize: 1,
        paidRequestLimit: 0,
      },
    });
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"name":"Reader = local"'),
      expect.any(Object),
    );
  });
});
