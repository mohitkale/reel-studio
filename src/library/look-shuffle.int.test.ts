// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));
const tx = { script: { findUnique, update } };
vi.mock("@/library/db", () => ({
  prisma: {
    $transaction: (run: (t: typeof tx) => Promise<unknown>) => run(tx),
  },
}));

import { updateScript } from "@/library/repositories/scripts";

const stored = (look: Record<string, unknown>) => ({
  brandOverrides: JSON.stringify({ themeId: "editorial", look }),
});

describe("Shuffle look", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
  });

  it("swaps the seed and keeps the variety and calm-motion switch", async () => {
    findUnique.mockResolvedValue(
      stored({ seed: "old", variety: "high", reduceMotion: true }),
    );
    await updateScript("s1", { lookSeed: "fresh1" });
    const saved = JSON.parse(update.mock.calls[0]![0].data.brandOverrides);
    expect(saved.look).toEqual({
      seed: "fresh1",
      variety: "high",
      reduceMotion: true,
    });
    expect(saved.themeId).toBe("editorial");
  });

  it("refuses to re-roll a look that a series locked", async () => {
    findUnique.mockResolvedValue(
      stored({ seed: "series:Tips", variety: "medium", locked: true }),
    );
    await expect(updateScript("s1", { lookSeed: "fresh1" })).rejects.toThrow(
      /locked by its series/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("still lets other settings change on a locked video", async () => {
    findUnique.mockResolvedValue(
      stored({ seed: "series:Tips", variety: "medium", locked: true }),
    );
    await updateScript("s1", { musicVolume: 20 });
    expect(update).toHaveBeenCalledOnce();
  });
});
