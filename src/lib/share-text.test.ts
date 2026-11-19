import { describe, expect, it } from "vitest";

import { REPO_URL, buildShareText } from "./share-text";

describe("share text", () => {
  it("is the title, what made the video and the repository", () => {
    expect(buildShareText("Why the sky is blue")).toBe(
      `Why the sky is blue. Made with Reel Studio, free and on my own computer: ${REPO_URL}`,
    );
  });

  it("does not stack punctuation and keeps a long title short", () => {
    expect(buildShareText("Is it worth it?!")).toMatch(
      /^Is it worth it\. Made/,
    );
    const long = buildShareText("word ".repeat(60));
    expect(long.length).toBeLessThan(200);
    expect(long).toContain("…");
  });

  it("has a fallback for an empty title", () => {
    expect(buildShareText("   ")).toMatch(/^My video\. Made/);
  });
});
