import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { TopicChapterDraft } from "./topic-chapter-draft";
import type { ChapterDraft } from "@/production/chapter-draft";
const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  apiPost: mocks.post,
  apiPatch: mocks.patch,
}));
vi.mock("@/hooks/ai", () => ({
  useAIProviders: () => ({
    data: [{ id: "openai", label: "OpenAI", configured: true }],
  }),
}));
const draft: ChapterDraft = {
  version: "1.0.0",
  topic: "Supplied source",
  chapters: [
    {
      id: "next",
      title: "Proof",
      brief: "Explain the supplied proof",
      sceneCount: 4,
    },
  ],
};
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.resetAllMocks();
});
async function mount(saved?: ChapterDraft) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const script = { id: "script", scenes: [], chapterDraft: saved };
  mocks.post.mockResolvedValue({
    draft,
    script: { ...script, chapterDraft: draft },
  });
  mocks.patch.mockResolvedValue({
    draft,
    script: { ...script, chapterDraft: draft },
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <TopicChapterDraft script={script} />
      </QueryClientProvider>,
    ),
  );
}
function button(label: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  )!;
}
async function enter(selector: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    selector,
  )!;
  const prototype =
    field instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      field,
      value,
    );
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("shows one planning request and blocks invalid capacity before requesting it", async () => {
  await mount();
  expect(button("Generate writing draft").disabled).toBe(true);
  await enter("#chapter-topic", "Supplied facts and workflow");
  await enter("#chapter-draft-count", "13");
  expect(button("Generate writing draft").disabled).toBe(true);
  expect(mocks.post).not.toHaveBeenCalled();
  await enter("#chapter-draft-count", "2");
  await act(async () => {
    button("Generate writing draft").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
    "/api/scripts/script/chapter-draft",
    {
      providerId: "openai",
      topic: "Supplied facts and workflow",
      chapterCount: 2,
      scenesPerChapter: 4,
    },
  );
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(container.textContent).toContain(
    "Scenes and saved chapter boundaries stay unchanged",
  );
});
it("loads a saved draft and edits it without a provider call", async () => {
  await mount(draft);
  expect(
    container.querySelector<HTMLInputElement>("#chapter-draft-title-0")!.value,
  ).toBe("Proof");
  expect(button("Save writing draft").disabled).toBe(true);
  await enter("#chapter-draft-title-0", "Clear proof");
  await act(async () => {
    button("Save writing draft").click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(mocks.patch).toHaveBeenCalledExactlyOnceWith(
    "/api/scripts/script/chapter-draft",
    {
      expected: draft,
      draft: {
        ...draft,
        chapters: [{ ...draft.chapters[0], title: "Clear proof" }],
      },
    },
  );
  expect(mocks.post).not.toHaveBeenCalled();
});
