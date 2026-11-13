// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

import { StoryboardMenu } from "./storyboard-menu";

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

it("renders the Storyboard menu trigger in the editor toolbar", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<StoryboardMenu scriptId="script-1" />));
  const button = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Storyboard"),
  );
  expect(button).toBeTruthy();
});
