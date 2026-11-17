// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  post: vi.fn(),
  providers: {
    data: [{ id: "gemini", configured: true }] as unknown,
    isLoading: false,
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/hooks/ai", () => ({ useAIProviders: () => mocks.providers }));
vi.mock("@/lib/api-client", () => ({ apiPost: mocks.post }));

import { OnePromptCreate } from "./one-prompt-create";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mocks.push.mockReset();
  mocks.post.mockReset();
  mocks.providers = {
    data: [{ id: "gemini", configured: true }],
    isLoading: false,
  };
});
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<OnePromptCreate />));
}
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  )!;
async function type(value: string) {
  const box = container.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("starts a video from one text entry and one click", async () => {
  mocks.post
    .mockResolvedValueOnce({
      storyboard: { version: 1, title: "T", scenes: [] },
    })
    .mockResolvedValueOnce({ jobId: "job1" });
  await mount();
  expect(button("Create").disabled).toBe(true);
  await type("Why the sky is blue");
  await act(async () => button("Video").click());
  await act(async () => button("Midnight Tech").click());
  await act(async () => button("Create").click());
  const [writeUrl, writeBody] = mocks.post.mock.calls[0]!;
  expect(writeUrl).toBe("/api/storyboards/write");
  expect(writeBody).toMatchObject({
    providerId: "gemini",
    brief: { topic: "Why the sky is blue", targetSeconds: 30, format: "16:9" },
    research: "auto",
  });
  const [produceUrl, produceBody] = mocks.post.mock.calls[1]!;
  expect(produceUrl).toBe("/api/storyboards");
  expect(produceBody.storyboard.theme).toBe("midnight-tech");
  expect(mocks.push).toHaveBeenCalledWith("/results/job1");
});

it("fills the box from an example idea", async () => {
  await mount();
  await act(async () => button("Five Excel shortcuts").click());
  expect(container.querySelector("textarea")!.value).toContain(
    "Five Excel shortcuts",
  );
});

it("shows the writer's problem instead of failing silently", async () => {
  mocks.post.mockRejectedValueOnce(
    new Error("Gemini is not configured. Check Settings."),
  );
  await mount();
  await type("A topic");
  await act(async () => button("Create").click());
  expect(container.querySelector("[role='alert']")?.textContent).toContain(
    "not configured",
  );
  expect(mocks.push).not.toHaveBeenCalled();
});

it("offers a sample video when nothing can write a storyboard", async () => {
  mocks.providers = {
    data: [{ id: "gemini", configured: false }],
    isLoading: false,
  };
  mocks.post.mockResolvedValueOnce({ jobId: "sample1" });
  await mount();
  expect(container.textContent).toContain(
    "Nothing is set up to write the storyboard",
  );
  await act(async () => button("Make a sample video").click());
  expect(mocks.post.mock.calls[0]![0]).toBe("/api/storyboards");
  expect(mocks.post.mock.calls[0]![1].storyboard.title).toBe(
    "Reel Studio in thirty seconds",
  );
  expect(mocks.push).toHaveBeenCalledWith("/results/sample1");
});
