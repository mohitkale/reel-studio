import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ResearchSelection } from "./research-selection";
import { evidenceFixture } from "@/research/fixtures";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  evidence: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ apiGet: mocks.get, apiPost: mocks.post }));
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});
async function mount(initial = false) {
  function Host() {
    const [mode, setMode] = useState<"off" | "supplied" | "web">(
      initial ? "supplied" : "web",
    );
    return (
      <ResearchSelection
        brief="A supplied product brief"
        mode={mode}
        onModeChange={setMode}
        onEvidence={mocks.evidence}
        initialEvidence={initial ? evidenceFixture() : undefined}
      />
    );
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Host />));
}
const button = (label: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === label,
  )!;
it("reconnects a lost submission using exactly the original idempotency key and budget", async () => {
  mocks.post.mockRejectedValueOnce(new Error("Connection lost"));
  await mount();
  await act(async () => button("Research sources").click());
  const request = mocks.post.mock.calls[0][1];
  expect(request.budget.maxProviderCalls).toBe(1);
  mocks.post.mockResolvedValueOnce({
    job: {
      id: "job-1",
      state: "succeeded",
      evidenceId: "evidence-1",
      error: null,
    },
  });
  mocks.get.mockResolvedValueOnce({ evidence: evidenceFixture() });
  await act(async () => button("Reconnect to previous research").click());
  expect(mocks.post.mock.calls[1][1]).toEqual(request);
  expect(mocks.evidence).toHaveBeenLastCalledWith(evidenceFixture());
  expect(container.textContent).toContain("Product brief");
});
it("ignores an in-flight status response after research is switched off", async () => {
  vi.useFakeTimers();
  let finish: (value: unknown) => void = () => {};
  mocks.post.mockResolvedValueOnce({
    job: { id: "job-2", state: "running", evidenceId: null, error: null },
  });
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await mount();
  await act(async () => button("Research sources").click());
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>(
      "#creation-research-mode",
    )!;
    select.value = "off";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    finish({
      job: {
        id: "job-2",
        state: "succeeded",
        evidenceId: "evidence-1",
        error: null,
      },
    }),
  );
  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(mocks.evidence).toHaveBeenLastCalledWith(null);
});
it("shows saved evidence without refreshing and exposes source excerpts", async () => {
  await mount(true);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(container.textContent).toContain("A local-first editor.");
  expect(container.textContent).toContain("user supplied");
  expect(container.textContent).toContain("2026-10-29");
});
