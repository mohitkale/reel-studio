import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { filmSnapshot } from "../../../tests/fixtures/film-plan";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api-client", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
  apiDelete: vi.fn(),
}));
import { FactoryPanel } from "./factory-panel";
it("retains a run key after a lost response and requires review by default", async () => {
  mocks.get.mockImplementation(async (url: string) =>
    url === "/api/factory"
      ? {
          profiles: [],
          runs: [],
          packs: [],
          revisions: [
            {
              id: "master",
              scriptId: "script",
              source: "checkpoint",
              script: { name: "Saved master" },
            },
          ],
        }
      : { document: { snapshot: filmSnapshot() } },
  );
  mocks.post.mockRejectedValue(new Error("Response lost"));
  const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const button = () =>
    Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === "Create factory run",
    )!;
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <FactoryPanel />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await vi.waitFor(() =>
        expect(container.textContent).toContain("Saved master"),
      );
    });
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>(
        '[aria-label="Factory master"]',
      )!;
      select.value = "master";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      await vi.waitFor(() => expect(button().disabled).toBe(false));
    });
    await act(async () => button().click());
    await act(async () => {
      await vi.waitFor(() =>
        expect(container.textContent).toContain("Response lost"),
      );
    });
    await act(async () => button().click());
    await act(async () => {
      await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    });
    const first = mocks.post.mock.calls[0][1],
      second = mocks.post.mock.calls[1][1];
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(first.runMode).toBe("approval");
    expect(first.variants).toHaveLength(3);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});
