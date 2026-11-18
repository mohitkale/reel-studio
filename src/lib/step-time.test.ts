import { expect, it } from "vitest";

import { stepElapsed } from "@/lib/step-time";

const t = (s: string) => Date.parse(`2026-11-18T10:00:${s}Z`);

it("shows nothing before a step starts", () => {
  expect(stepElapsed(null, null, t("30"))).toBeNull();
  expect(stepElapsed(undefined, undefined, t("30"))).toBeNull();
});

it("counts up while a step runs and stops when it ends", () => {
  const start = "2026-11-18T10:00:00Z";
  expect(stepElapsed(start, null, t("12"))).toBe("12 s");
  expect(stepElapsed(start, "2026-11-18T10:01:05Z", t("59"))).toBe(
    "1 min 05 s",
  );
});

it("never goes negative", () => {
  expect(stepElapsed("2026-11-18T10:00:30Z", null, t("00"))).toBe("0 s");
});
