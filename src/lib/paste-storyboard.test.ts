import { describe, expect, it } from "vitest";

import { SAMPLE_STORYBOARD } from "./one-prompt";
import { buildFixRequest, checkPasted, extractJson } from "./paste-storyboard";

const json = JSON.stringify(SAMPLE_STORYBOARD, null, 2);

describe("extractJson", () => {
  it("takes plain JSON", () => {
    expect(extractJson(json)).toMatchObject({ ok: true });
  });

  it("finds JSON in a code fence with chatter around it", () => {
    const reply = `Sure! Here is your storyboard:\n\n\`\`\`json\n${json}\n\`\`\`\n\nLet me know if you want changes.`;
    const result = extractJson(reply);
    expect(result).toMatchObject({ ok: true });
    expect((result as { value: { title: string } }).value.title).toBe(
      "Reel Studio in thirty seconds",
    );
  });

  it("finds JSON in prose with no fence, ignoring braces in text and strings", () => {
    const reply = `I used {curly} words. Here you go: ${JSON.stringify({ title: "T {x}", scenes: [{ headline: 'say "}" twice' }] })} Done.`;
    expect(extractJson(reply)).toMatchObject({
      ok: true,
      value: { title: "T {x}" },
    });
  });

  it("reports what is wrong when there is no JSON", () => {
    expect(extractJson("")).toMatchObject({ ok: false });
    expect(extractJson("I cannot do that")).toMatchObject({
      ok: false,
      reason: expect.stringContaining("No JSON object"),
    });
  });

  it("does not take an unfinished object", () => {
    expect(extractJson('{"title": "cut off')).toMatchObject({ ok: false });
  });
});

describe("checkPasted and buildFixRequest", () => {
  it("lints a good reply with no errors", () => {
    const result = checkPasted(`\`\`\`\n${json}\n\`\`\``);
    expect(result.lint?.errors).toEqual([]);
    expect(result.lint?.storyboard).not.toBeNull();
  });

  it("turns lint errors into a message to paste back", () => {
    const result = checkPasted('{"version":1,"title":"x"}');
    const message = buildFixRequest(result);
    expect(message).toContain("scenes");
    expect(message).toContain("Expected");
    expect(message).toContain("corrected JSON object only");
  });

  it("asks for a clean reply when nothing was found", () => {
    expect(buildFixRequest(checkPasted("no json here"))).toContain(
      "complete storyboard as one JSON object",
    );
  });
});
