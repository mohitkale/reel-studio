import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AIEnhanceDialog } from "./ai-enhance-dialog";
import type { SceneDTO } from "@/lib/dto";
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@/hooks/ai", () => ({
  useAIProviders: () => ({
    data: [{ id: "openai", label: "OpenAI", configured: true }],
  }),
}));
vi.mock("@/hooks/script", () => ({
  useEnhanceScript: () => ({ mutate: mocks.mutate, isPending: false }),
  useUpdateScene: () => ({ mutate: vi.fn(), isPending: false }),
}));
// Keep the dialog mounted; exercise its real fields, state and validation.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h1>{children}</h1>
  ),
}));
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});
async function mount(count: number, outlined = true) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const scenes: SceneDTO[] = Array.from({ length: count }, (_, index) => ({
    id: `scene-${index}`,
    scriptId: "script",
    hideText: null,
    selectedVoiceClipId: null,
    order: index,
    templateId: "hf-statement",
    text: `Scene ${index}`,
    spokenText: null,
    emphasis: [],
    assetRefs: [],
  }));
  await act(async () =>
    root.render(
      <AIEnhanceDialog
        scriptId="script"
        scriptName="Explain this topic"
        scenes={scenes}
        chapterPlan={
          outlined
            ? {
                version: "1.0.0",
                chapters: [
                  { id: "first", title: "First", firstSceneId: "scene-0" },
                ],
              }
            : undefined
        }
        open
        onOpenChange={vi.fn()}
      />,
    ),
  );
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.startsWith("Add scenes"))!
      .click(),
  );
}
function submitButton() {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "Add scenes",
  )!;
}
async function enterTitle(value: string) {
  const field =
    container.querySelector<HTMLInputElement>("#ai-append-chapter")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("enables a named chapter when extending the final chapter would overflow, then submits its trimmed title", async () => {
  await mount(20);
  expect(submitButton().disabled).toBe(true);
  expect(container.textContent).toContain("exceed 20 scenes");
  await enterTitle("  Next topic  ");
  expect(submitButton().disabled).toBe(false);
  await act(async () => submitButton().click());
  expect(mocks.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      mode: "append",
      chapterTitle: "Next topic",
      chapterId: undefined,
      sceneIds: undefined,
      sceneCount: undefined,
    }),
    expect.any(Object),
  );
});
it("keeps ordinary append available and explains the outline prerequisite", async () => {
  await mount(3, false);
  expect(
    container.querySelector<HTMLInputElement>("#ai-append-chapter")!.disabled,
  ).toBe(true);
  expect(container.textContent).toContain("Save a chapter outline");
  expect(submitButton().disabled).toBe(false);
  await act(async () => submitButton().click());
  expect(mocks.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ chapterTitle: undefined }),
    expect.any(Object),
  );
});
