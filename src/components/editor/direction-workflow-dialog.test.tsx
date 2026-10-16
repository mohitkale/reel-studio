import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
const { apiPost } = vi.hoisted(() => ({ apiPost: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiPost }));
import { DirectionWorkflowDialog } from "./direction-workflow-dialog";

it("reviews only the selected chapter and clears approval when the scope changes", async () => {
  apiPost.mockResolvedValue({
    result: {
      state: "planned",
      sourceHash: "a".repeat(64),
      settings: { seed: "reviewed" },
      changes: [
        { sceneId: "b", before: "type-impact", after: "type-editorial" },
      ],
      changedSceneIds: ["b"],
      protectedSceneCount: 2,
    },
    script: { id: "film" },
  });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <DirectionWorkflowDialog
            scriptId="film"
            scenes={[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]}
            selectedId="c"
            chapters={{
              version: "1.0.0",
              chapters: [
                { id: "one", title: "One", firstSceneId: "a" },
                { id: "two", title: "Two", firstSceneId: "b" },
                { id: "three", title: "Three", firstSceneId: "d" },
              ],
            }}
            input={{ newVariation: true }}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      ),
    );
    const button = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent === name,
      )!;
    expect(button("Apply direction").disabled).toBe(true);
    const select = document.querySelector<HTMLSelectElement>(
      '[aria-label="Variation scope"]',
    )!;
    await act(async () => {
      select.value = "chapter";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      button("Review changes").click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(apiPost).toHaveBeenCalledWith("/api/scripts/film/motion", {
      newVariation: true,
      sceneIds: ["b", "c"],
      preview: true,
    });
    expect(button("Apply direction").disabled).toBe(false);
    await act(async () => {
      select.value = "scene";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Apply direction").disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    node.remove();
    client.clear();
  }
});
