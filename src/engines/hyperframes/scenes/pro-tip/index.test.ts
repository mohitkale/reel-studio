import { describe, expect, it } from "vitest";

import type { SceneKit } from "../types";
import { proTip } from "./index";

const kit: SceneKit = {
  text: "A headline",
  emphasis: [],
  ink: "#111111",
  accent: "#2255ee",
  onAccent: "#ffffff",
  chip: "",
  escape: (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  emphasize: (text) => text,
  lineStack: (text) => text,
};

describe("pro-tip scene", () => {
  it("accepts its own sample and rejects too few or too many items", () => {
    expect(proTip.schema.safeParse(proTip.sample.payload).success).toBe(true);
    expect(proTip.schema.safeParse({ items: ["one"] }).success).toBe(false);
    expect(proTip.schema.safeParse({ items: Array(7).fill("x") }).success).toBe(
      false,
    );
  });

  it("draws every item and escapes what a storyboard supplies", () => {
    const html = proTip.build({ items: ["<b>one</b>", "two & three"] }, kit);
    expect(html).toContain("&lt;b&gt;one&lt;/b&gt;");
    expect(html).toContain("two &amp; three");
    expect(html).not.toContain("<b>");
  });

  it("styles the classes it draws", () => {
    const html = proTip.build(proTip.sample.payload, kit);
    expect(html).toContain("sc-pro-tip");
    expect(proTip.css).toContain(".sc-pro-tip");
  });
});
