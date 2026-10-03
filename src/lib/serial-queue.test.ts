import { expect, it } from "vitest";
import { createSerialQueue } from "./serial-queue";

it("runs FIFO, bounds waiting work and continues after a failed operation", async () => {
  const run = createSerialQueue({ maxPending: 2 });
  const events: string[] = [];
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = run(async () => {
    events.push("first");
    await barrier;
    throw new Error("fixture failure");
  });
  const rejected = expect(first).rejects.toThrow("fixture failure");
  const second = run(async () => {
    events.push("second");
    return 2;
  });
  await expect(run(async () => 3)).rejects.toThrow("full");
  release();
  await rejected;
  expect(await second).toBe(2);
  expect(
    await run(async () => {
      events.push("third");
      return 3;
    }),
  ).toBe(3);
  expect(events).toEqual(["first", "second", "third"]);
});
