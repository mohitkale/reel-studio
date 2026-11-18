import { describe, expect, it } from "vitest";

import {
  isBusy,
  newItems,
  nextItem,
  queuePosition,
  restoreItems,
  retry,
  retryAll,
  summarise,
  type BatchItem,
} from "@/lib/batch-queue";

const items = (...statuses: BatchItem["status"][]): BatchItem[] =>
  statuses.map((status, i) => ({ id: `i${i}`, topic: `Topic ${i}`, status }));

describe("batch queue", () => {
  it("starts every topic waiting, in order", () => {
    const made = newItems(["A", "B"], 5);
    expect(made.map((m) => [m.id, m.status])).toEqual([
      ["5-0", "waiting"],
      ["5-1", "waiting"],
    ]);
  });

  it("starts the first waiting item and none when all are finished", () => {
    expect(nextItem(items("done", "waiting", "waiting"))?.id).toBe("i1");
    expect(nextItem(items("done", "failed"))).toBeUndefined();
  });

  it("says where a waiting item stands", () => {
    const list = items("making", "waiting", "waiting");
    expect(isBusy(list)).toBe(true);
    expect(queuePosition(list, "i1")).toBe("1 ahead of it");
    expect(queuePosition(list, "i2")).toBe("2 ahead of it");
    expect(queuePosition(items("done", "waiting"), "i1")).toBe("Next up");
    expect(queuePosition(list, "i0")).toBeUndefined();
  });

  it("counts what is done, failed, waiting and working", () => {
    expect(
      summarise(items("done", "failed", "waiting", "writing", "making")),
    ).toEqual({
      total: 5,
      done: 1,
      failed: 1,
      waiting: 1,
      working: 2,
    });
  });

  it("puts a failed item, or all of them, back in line", () => {
    const failed = items("failed", "done", "failed").map((i) => ({
      ...i,
      error: "x",
    }));
    expect(retry(failed, "i0")[0]).toMatchObject({
      status: "waiting",
      error: undefined,
    });
    expect(retry(failed, "i1")[1]!.status).toBe("done");
    expect(retryAll(failed).map((i) => i.status)).toEqual([
      "waiting",
      "done",
      "waiting",
    ]);
  });

  it("reads saved items back, putting unfinished work back in line", () => {
    const restored = restoreItems([
      { id: "a", topic: "T1", status: "making", jobId: "j" },
      { id: "b", topic: "T2", status: "done", jobId: "j2" },
      { id: "c", topic: "T3", status: "failed", error: "No writer" },
      { id: "d" },
      "junk",
    ]);
    expect(restored).toEqual([
      { id: "a", topic: "T1", status: "waiting" },
      { id: "b", topic: "T2", status: "done", jobId: "j2" },
      { id: "c", topic: "T3", status: "failed", error: "No writer" },
    ]);
    expect(restoreItems("nope")).toEqual([]);
  });
});
