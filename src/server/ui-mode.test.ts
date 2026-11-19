import { describe, expect, it } from "vitest";

import { decideUiState } from "@/server/ui-mode";

describe("decideUiState", () => {
  it("opens a clean install in Simple with setup showing once", () => {
    expect(decideUiState({}, false)).toEqual({
      mode: "simple",
      needsOnboarding: true,
      existingInstall: false,
      reviewBeforeMaking: false,
      endTag: false,
      automation: { research: true, voice: true, music: true, captions: true },
    });
  });

  it("leaves the end tag off unless it was chosen", () => {
    expect(decideUiState({}, false).endTag).toBe(false);
    expect(decideUiState({ endTag: true }, false).endTag).toBe(true);
  });

  it("opens an existing install in Pro with no setup", () => {
    expect(decideUiState({}, true)).toMatchObject({
      mode: "pro",
      needsOnboarding: false,
    });
  });

  it("keeps a stored choice over the default", () => {
    expect(decideUiState({ uiMode: "simple" }, true).mode).toBe("simple");
    expect(decideUiState({ uiMode: "pro" }, false).mode).toBe("pro");
  });

  it("shows setup once: finishing it hides it", () => {
    const done = { onboardedAt: "2026-11-17T00:00:00.000Z" };
    expect(decideUiState(done, false).needsOnboarding).toBe(false);
  });

  it("lets Run setup again work even on an existing install", () => {
    expect(decideUiState({ setupRequested: true }, true).needsOnboarding).toBe(
      true,
    );
  });

  it("carries the review-before-making switch", () => {
    expect(
      decideUiState({ reviewBeforeMaking: true }, false).reviewBeforeMaking,
    ).toBe(true);
  });

  it("keeps stored automation switches and fills in the rest as on", () => {
    expect(
      decideUiState({ automation: { music: false } }, false).automation,
    ).toEqual({ research: true, voice: true, music: false, captions: true });
  });
});
