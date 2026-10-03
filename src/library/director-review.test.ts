// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  review: vi.fn(),
  revision: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));
vi.mock("@/library/visual-review", () => ({
  createVisualReview: mocks.review,
}));
vi.mock("@/library/production-revision", () => ({
  currentVideoRevisionHash: mocks.revision,
}));
vi.mock("@/library/db", () => ({
  prisma: {
    scene: { findMany: mocks.findMany },
    $transaction: (
      fn: (tx: {
        scene: { updateMany: typeof mocks.updateMany };
      }) => Promise<unknown>,
    ) => fn({ scene: { updateMany: mocks.updateMany } }),
  },
}));
import { reviewAndRepairDirection } from "./director-review";
import { planDirectorRepair } from "@/production/director-repair";
const scene = {
  id: "scene",
  scriptId: "script",
  text: "Complete supplied words",
  spokenText: "Complete supplied narration",
  visual: null,
  hideText: null,
  templateId: "hf-statement",
  layoutJson: JSON.stringify({ role: "headline" }),
};
const finding = {
  sceneId: "scene",
  sceneNumber: 1,
  frame: 42,
  kind: "text-clipping" as const,
  message: "Measured clipping",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.revision.mockResolvedValue("current");
  mocks.findMany.mockResolvedValue([scene]);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.review.mockResolvedValue({ findings: [finding], stills: [] });
});
it("performs exactly one repair and one fresh measurement without editing copy or narration", async () => {
  mocks.review
    .mockResolvedValueOnce({ findings: [finding], stills: [] })
    .mockResolvedValueOnce({ findings: [], stills: [] });
  const result = await reviewAndRepairDirection(
    "script",
    { sceneIds: ["scene"], repairPasses: 1 },
    "http://localhost",
  );
  expect(mocks.review).toHaveBeenCalledTimes(2);
  expect(result.repair).toEqual({
    passesUsed: 1,
    paidCallsUsed: 0,
    sourceRevision: "current",
    repairedSceneIds: ["scene"],
    unresolved: 0,
  });
  const write = mocks.updateMany.mock.calls[0][0];
  expect(Object.keys(write.data)).toEqual(["layoutJson"]);
  expect(write.where).toMatchObject({
    text: scene.text,
    spokenText: scene.spokenText,
    layoutJson: scene.layoutJson,
  });
  expect(JSON.parse(write.data.layoutJson).direction.composition).toBe(
    "layered-title",
  );
});
it("does not repair without opt-in or loop on remaining findings", async () => {
  await reviewAndRepairDirection(
    "script",
    { sceneIds: ["scene"] },
    "http://localhost",
  );
  expect(mocks.review).toHaveBeenCalledTimes(1);
  expect(mocks.updateMany).not.toHaveBeenCalled();
  vi.clearAllMocks();
  const result = await reviewAndRepairDirection(
    "script",
    { sceneIds: ["scene"], repairPasses: 1 },
    "http://localhost",
  );
  expect(mocks.review).toHaveBeenCalledTimes(2);
  expect(result.repair?.unresolved).toBe(1);
});
it("rejects concurrent revision/scene edits before overwriting any user changes", async () => {
  mocks.revision
    .mockResolvedValueOnce("before")
    .mockResolvedValueOnce("changed");
  await expect(
    reviewAndRepairDirection(
      "script",
      { sceneIds: ["scene"], repairPasses: 1 },
      "http://localhost",
    ),
  ).rejects.toThrow("changed during review");
  expect(mocks.updateMany).not.toHaveBeenCalled();
  mocks.revision.mockResolvedValue("current");
  mocks.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    reviewAndRepairDirection(
      "script",
      { sceneIds: ["scene"], repairPasses: 1 },
      "http://localhost",
    ),
  ).rejects.toThrow("changed during repair");
});
it("leaves locked, media/data, long and already repaired scenes for explicit manual review", () => {
  for (const config of [
    { locks: { copy: false, assets: false, scene: true } },
    { background: { type: "image", url: "/media/image.png" } },
    { items: ["Actual", "Data"] },
    {
      direction: { version: 1, role: "headline", composition: "layered-title" },
    },
  ])
    expect(
      planDirectorRepair({ ...scene, layoutJson: JSON.stringify(config) }, [
        finding,
      ]),
    ).toBeNull();
  expect(
    planDirectorRepair({ ...scene, text: "Long complete copy ".repeat(30) }, [
      finding,
    ]),
  ).toBeNull();
  expect(
    planDirectorRepair(scene, [{ ...finding, kind: "reading-time" }]),
  ).toBeNull();
});

it("rejects edits during the bounded recapture", async () => {
  mocks.revision
    .mockResolvedValueOnce("current")
    .mockResolvedValueOnce("current")
    .mockResolvedValueOnce("repaired")
    .mockResolvedValueOnce("edited-again");
  await expect(
    reviewAndRepairDirection(
      "script",
      { sceneIds: ["scene"], repairPasses: 1 },
      "http://localhost",
    ),
  ).rejects.toThrow("changed during recapture");
  expect(mocks.review).toHaveBeenCalledTimes(2);
});
