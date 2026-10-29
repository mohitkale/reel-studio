import { describe, expect, it } from "vitest";
import { researchReadiness } from "./readiness";
import { readinessFixture } from "./readiness.fixture";
const selection = {
  mode: "supplied" as const,
  writerProviderId: "ollama",
  writerModelId: "ollama-installed",
  researcherProviderId: "",
  researcherModelId: "",
};
describe("research readiness", () => {
  it.each(["ollama", "lm-studio", "llama-cpp"])(
    "%s supports source-only operation without cloud keys",
    (providerId) => {
      expect(
        researchReadiness(
          { ...selection, writerProviderId: providerId },
          readinessFixture(),
        ),
      ).toMatchObject({
        ready: true,
        cloudResearch: false,
        writerCapability: { nativeSearch: false, sharedBackend: true },
      });
    },
  );
  it("requires an explicit researcher and a configured key for web research", () => {
    const view = readinessFixture();
    expect(
      researchReadiness({ ...selection, mode: "web" }, view).issues.join(" "),
    ).toContain("explicitly");
    expect(
      researchReadiness(
        {
          ...selection,
          mode: "web",
          researcherProviderId: "openai",
          researcherModelId: "gpt-4.1-mini",
        },
        view,
      ).issues.join(" "),
    ).toContain("API key");
  });
  it("handles mixed local writing and cloud research without conflating the models", () => {
    const view = readinessFixture();
    view.configuredProviders.openai = true;
    const ready = researchReadiness(
      {
        ...selection,
        mode: "web",
        researcherProviderId: "openai",
        researcherModelId: "gpt-4.1-mini",
      },
      view,
    );
    expect(ready).toMatchObject({
      ready: true,
      localWriter: true,
      writerCapability: { nativeSearch: false, sharedBackend: true },
      researcherCapability: { nativeSearch: true, urlContext: false },
    });
  });
  it("does not treat discovered generation models as search compatible", () => {
    const view = readinessFixture();
    view.configuredProviders.openai = true;
    const ready = researchReadiness(
      {
        ...selection,
        mode: "web",
        researcherProviderId: "openai",
        researcherModelId: "gpt-4o-mini",
      },
      view,
    );
    expect(ready.ready).toBe(false);
    expect(ready.issues.join(" ")).toContain(
      "model discovery does not establish search support",
    );
  });
  it("reports missing local configuration and cloud-writer credentials separately", () => {
    const view = readinessFixture();
    view.writers.find((writer) => writer.id === "ollama")!.configured = false;
    expect(researchReadiness(selection, view).issues.join(" ")).toContain(
      "Configure",
    );
    expect(
      researchReadiness(
        {
          ...selection,
          writerProviderId: "openai",
          writerModelId: "gpt-4o-mini",
        },
        view,
      ).ready,
    ).toBe(false);
  });
});
