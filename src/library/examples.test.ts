// @vitest-environment node
import { describe, expect, it } from "vitest";

import { listExamples, readExample } from "./examples";

describe("examples", () => {
  it("lists the video examples with look, scene types and length", () => {
    const examples = listExamples();
    expect(examples.length).toBeGreaterThanOrEqual(10);
    const explainer = examples.find((e) => e.name === "explainer")!;
    expect(explainer).toMatchObject({ format: "16:9" });
    expect(explainer.seconds).toBeGreaterThan(20);
    expect(explainer.sceneTypes.length).toBeGreaterThan(3);
    // The podcast example is audio and is not offered here.
    expect(examples.find((e) => e.name === "podcast")).toBeUndefined();
  });

  it("reads one example and refuses names that are not plain slugs", () => {
    expect(readExample("listicle")).toMatchObject({
      title: expect.any(String),
    });
    expect(readExample("../package")).toBeNull();
    expect(readExample("nope")).toBeNull();
    expect(readExample("podcast")).toBeNull();
  });
});
