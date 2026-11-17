// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), post: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api-client", () => ({ apiPost: mocks.post }));

import { SAMPLE_STORYBOARD } from "@/lib/one-prompt";

import { PasteStoryboard } from "./paste-storyboard";

let root: Root;
let container: HTMLDivElement;
const clipboard = { writeText: vi.fn() };
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("navigator", { clipboard });
  mocks.push.mockReset();
  mocks.post.mockReset();
  clipboard.writeText.mockReset().mockResolvedValue(undefined);
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
  await act(async () =>
    root.render(
      <PasteStoryboard
        topic="Why the sky is blue"
        format="9:16"
        seconds={30}
        theme="auto"
        narration
      />,
    ),
  );
}
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label),
  )!;
async function paste(value: string) {
  const box = container.querySelector<HTMLTextAreaElement>("#pasted-reply")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(box, value);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("goes from topic to video with two copy-pastes", async () => {
  mocks.post
    .mockResolvedValueOnce({ prompt: "WRITER PROMPT with the brief" })
    .mockResolvedValueOnce({ jobId: "job7" });
  await mount();
  await act(async () => button("Copy prompt").click());
  expect(mocks.post.mock.calls[0]).toEqual([
    "/api/storyboards/prompt",
    { topic: "Why the sky is blue", targetSeconds: 30, format: "9:16" },
  ]);
  expect(clipboard.writeText).toHaveBeenCalledWith(
    "WRITER PROMPT with the brief",
  );
  expect(container.querySelector("button")!.textContent).toContain(
    "Copy prompt",
  );
  expect(container.textContent).not.toContain("Make the video");

  await paste(
    `Sure! Here you go:\n\`\`\`json\n${JSON.stringify(SAMPLE_STORYBOARD)}\n\`\`\`\nHope that helps.`,
  );
  await act(async () => button("Make the video").click());
  expect(mocks.post.mock.calls[1]![0]).toBe("/api/storyboards");
  expect(mocks.post.mock.calls[1]![1].storyboard.title).toBe(
    "Reel Studio in thirty seconds",
  );
  expect(mocks.push).toHaveBeenCalledWith("/results/job7");
});

it("shows errors inline and copies a fix request", async () => {
  await mount();
  await paste('{"version":1,"title":"x"}');
  expect(container.querySelector("[role='alert']")).not.toBeNull();
  expect(container.textContent).not.toContain("Make the video");
  await act(async () => button("Copy fix request").click());
  expect(clipboard.writeText.mock.calls[0]![0]).toContain(
    "corrected JSON object only",
  );
});

it("says so when the reply has no JSON", async () => {
  await mount();
  await paste("I am sorry, I cannot help with that.");
  expect(container.querySelector("[role='alert']")!.textContent).toContain(
    "No JSON object",
  );
});
