import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BENCHMARK_BRIEFS } from "./benchmark-briefs";
import { benchmarkTable, summarise } from "./benchmark-report";

describe("writer benchmark", () => {
  it("has one brief for each golden example", () => {
    const examples = BENCHMARK_BRIEFS.map((b) => b.example).sort();
    expect(examples).toHaveLength(12);
    for (const name of examples)
      expect(() =>
        readFileSync(
          path.join(process.cwd(), "examples", "storyboards", `${name}.json`),
        ),
      ).not.toThrow();
  });

  it("summarises passes, calls and the median time", () => {
    const rows = [
      {
        example: "a",
        pass: true,
        attempts: 1,
        errors: 0,
        warnings: 0,
        seconds: 4,
      },
      {
        example: "b",
        pass: false,
        attempts: 2,
        errors: 1,
        warnings: 1,
        seconds: 10,
        note: "x | y",
      },
      {
        example: "c",
        pass: true,
        attempts: 1,
        errors: 0,
        warnings: 0,
        seconds: 6,
      },
    ];
    expect(summarise(rows)).toEqual({
      total: 3,
      passed: 2,
      calls: 4,
      medianSeconds: 6,
    });
    expect(benchmarkTable(rows)).toContain(
      "| b | fail | 2 | 1 | 10.0 | x / y |",
    );
  });
});
