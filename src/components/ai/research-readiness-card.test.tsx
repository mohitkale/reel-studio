import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResearchReadinessFields } from "./research-readiness-card";
import { readinessFixture } from "@/research/readiness.fixture";
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});
async function mount(view = readinessFixture()) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ResearchReadinessFields view={view} />));
}
async function select(id: string, value: string) {
  const field = container.querySelector<HTMLSelectElement>(`#${id}`)!;
  await act(async () => {
    field.value = value;
    field.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
it("starts with sources only and shows bounded local writing without provider calls", async () => {
  await mount();
  expect(container.textContent).toContain("Configuration ready");
  expect(container.textContent).toContain("24,000 evidence characters");
  expect(
    container
      .querySelector<HTMLFieldSetElement>("#research-provider")!
      .closest("fieldset")!.disabled,
  ).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it("requires an explicit configured researcher and preserves it when the writer changes", async () => {
  const view = readinessFixture();
  await mount(view);
  await select("research-mode", "web");
  expect(container.textContent).toContain("Select Gemini or OpenAI explicitly");
  await select("research-provider", "openai");
  expect(container.textContent).toContain("Add the OpenAI API key");
  view.configuredProviders.openai = true;
  await act(async () => root.render(<ResearchReadinessFields view={view} />));
  expect(container.textContent).toContain("Configuration ready");
  await select("research-writer", "llama-cpp");
  expect(
    container.querySelector<HTMLSelectElement>("#research-provider")!.value,
  ).toBe("openai");
  expect(
    container.querySelector<HTMLSelectElement>("#research-model")!.value,
  ).toBe("gpt-4.1-mini");
  expect(
    container.querySelector<HTMLInputElement>("#research-writer-model")!.value,
  ).toBe("llama-cpp-installed");
  await select("research-mode", "supplied");
  expect(container.textContent).toContain("without cloud calls");
  await select("research-mode", "web");
  expect(
    container.querySelector<HTMLSelectElement>("#research-provider")!.value,
  ).toBe("openai");
  expect(fetch).not.toHaveBeenCalled();
});
