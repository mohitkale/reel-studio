import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { planFromStoryboard } from "@/production/storyboard-plan";
import { storyboardToReelProps } from "@/production/storyboard-reel";
import { lintStoryboard } from "./lint";
import { breakingChanges } from "./schema-compat";
import { storyboardJsonSchema } from "./schema";

const FROZEN = path.resolve("tests/fixtures/storyboard-v1");
const frozen = JSON.parse(
  readFileSync(path.join(FROZEN, "frozen.schema.json"), "utf8"),
);

describe("Storyboard v1 is frozen", () => {
  it("only grows: everything the frozen schema accepted is still accepted", () => {
    // If this fails, a change removed or tightened something. Make it additive
    // (a new optional field, a new enum value, a looser bound), or it needs a Storyboard v2.
    expect(breakingChanges(frozen, storyboardJsonSchema())).toEqual([]);
  });

  it("accepts itself", () => {
    expect(breakingChanges(frozen, frozen)).toEqual([]);
  });

  it("every golden storyboard from the freeze still lints without a repair, plans and draws", () => {
    const files = readdirSync(path.join(FROZEN, "corpus")).filter((f) =>
      f.endsWith(".json"),
    );
    expect(files.length).toBeGreaterThanOrEqual(12);
    for (const file of files) {
      const raw = JSON.parse(
        readFileSync(path.join(FROZEN, "corpus", file), "utf8"),
      );
      const result = lintStoryboard(raw);
      expect(result.errors, file).toEqual([]);
      expect(result.fixes, file).toEqual([]);
      const storyboard = result.storyboard!;
      if (storyboard.kind === "video") {
        expect(planFromStoryboard(storyboard).scenes.length, file).toBe(
          storyboard.scenes.length,
        );
        const { props } = storyboardToReelProps(storyboard);
        expect(buildHyperframesCompositionHtml(props), file).toContain("<html");
      }
    }
  });
});

describe("the compatibility check itself", () => {
  const base = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 40 },
      kind: { type: "string", enum: ["a", "b"] },
      tags: { type: "array", items: { type: "string" }, maxItems: 5 },
      level: { type: "number", minimum: 1, maximum: 10 },
    },
    required: ["name"],
    additionalProperties: false,
  };
  const change = (edit: (copy: typeof base) => void) => {
    const copy = JSON.parse(JSON.stringify(base)) as typeof base;
    edit(copy);
    return breakingChanges(base, copy);
  };

  it("allows additions", () => {
    expect(
      change((s) => {
        (s.properties as Record<string, unknown>).extra = { type: "string" };
        s.properties.kind.enum.push("c");
        s.properties.tags.maxItems = 8;
        s.properties.name.maxLength = 80;
        s.properties.level.minimum = 0;
      }),
    ).toEqual([]);
  });

  it.each([
    [
      "removing a property of a closed object",
      (s: typeof base) =>
        void delete (s.properties as Record<string, unknown>).level,
    ],
    ["requiring a field", (s: typeof base) => void s.required.push("kind")],
    [
      "removing an enum value",
      (s: typeof base) => void s.properties.kind.enum.pop(),
    ],
    [
      "lowering a maximum length",
      (s: typeof base) => void (s.properties.name.maxLength = 10),
    ],
    [
      "raising a minimum length",
      (s: typeof base) => void (s.properties.name.minLength = 3),
    ],
    [
      "lowering a maximum item count",
      (s: typeof base) => void (s.properties.tags.maxItems = 2),
    ],
    [
      "raising a minimum",
      (s: typeof base) => void (s.properties.level.minimum = 5),
    ],
    [
      "changing a type",
      (s: typeof base) =>
        void ((s.properties.name as { type: string }).type = "number"),
    ],
    [
      "adding a pattern",
      (s: typeof base) =>
        void ((s.properties.name as Record<string, unknown>).pattern = "^a"),
    ],
  ])("flags %s", (_name, edit) => {
    expect(change(edit).length).toBeGreaterThan(0);
  });

  it("flags a union branch that is no longer accepted, and allows a new branch", () => {
    const union = { anyOf: [{ type: "string" }, { type: "number" }] };
    expect(
      breakingChanges(union, { anyOf: [{ type: "string" }] }).length,
    ).toBeGreaterThan(0);
    expect(
      breakingChanges(union, {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      }),
    ).toEqual([]);
    expect(
      breakingChanges(
        { type: "string" },
        { anyOf: [{ type: "string" }, { type: "number" }] },
      ),
    ).toEqual([]);
  });

  it("reports a keyword it does not know instead of passing silently", () => {
    expect(
      breakingChanges(
        { type: "string", dependentRequired: {} },
        { type: "string" },
      )[0],
    ).toContain("unsupported keyword");
  });
});
