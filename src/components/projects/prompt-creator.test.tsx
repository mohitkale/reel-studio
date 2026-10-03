import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/ai", () => ({
  useGenerateProject: () => ({ mutate: mocks.mutate, isPending: false }),
}));
import { PromptCreator } from "./prompt-creator";
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});
async function mount(brief = "A clear supplied idea.") {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PromptCreator initialBrief={brief} />));
}
async function submit() {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
it("generates and navigates to a durable result with no paid planning or narration by default", async () => {
  await mount();
  await submit();
  expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
    brief: "A clear supplied idea.",
    orientation: "portrait",
    productionPresetId: "editorial-explainer",
    directorBudget: { maxPaidCalls: 0 },
    quickProduce: {
      planner: "deterministic",
      mediaPreference: "none",
      voice: { enabled: false },
    },
  });
  mocks.mutate.mock.calls[0][1].onSuccess({
    job: { id: "job" },
    scriptId: "script",
  });
  expect(mocks.push).toHaveBeenCalledWith("/results/job");
});
it("requires text and honors an explicit preset/narration choice", async () => {
  await mount("");
  await submit();
  expect(mocks.mutate).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  container.remove();
  await mount();
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((node) => node.textContent === "Creator Punch")!
      .click(),
  );
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click(),
  );
  await submit();
  expect(mocks.mutate.mock.calls[0][0]).toMatchObject({
    productionPresetId: "creator-punch",
    quickProduce: { voice: { enabled: true } },
  });
});
