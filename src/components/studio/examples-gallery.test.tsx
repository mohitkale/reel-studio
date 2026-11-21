// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import motivationExample from "../../../examples/storyboards/motivation.json";
import { ExamplesGallery } from "./examples-gallery";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api-client", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
}));
vi.mock("@/hooks/ui-mode", () => ({ useReviewFields: () => ({}) }));
vi.mock("@/hooks/ai", () => ({
  useAIProviders: () => ({
    data: [{ id: "ollama", kind: "local", label: "Ollama", configured: true }],
  }),
}));
vi.mock("./example-previews", () => ({ ExamplePreview: () => null }));

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
const motivation = { ...motivationExample, theme: "editorial-paper" };
const example = {
  name: "motivation",
  title: motivation.title,
  format: motivation.format,
  theme: motivation.theme,
  seconds: 20,
  sceneTypes: motivation.scenes.map((scene) => scene.type),
};

async function openRemix() {
  mocks.get.mockResolvedValue({ storyboard: motivation });
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <ExamplesGallery examples={[example]} initialOpen={example.name} />,
    ),
  );
  const topic = container.querySelector<HTMLInputElement>("input[maxlength]")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(topic, "Making time to practise");
    topic.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === label,
  );
  expect(button?.disabled).toBe(false);
  await act(async () => button?.click());
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container.remove();
  vi.clearAllMocks();
});

it("reviews the new topic with the example's look and structure before producing", async () => {
  const written = {
    ...motivation,
    kind: "video",
    title: "Practise a little",
    theme: "neon",
    format: "1:1",
    scenes: motivation.scenes.map((scene, index) => ({
      ...scene,
      headline: `Build a habit ${index + 1}`,
    })),
  };
  mocks.post
    .mockResolvedValueOnce({ storyboard: written })
    .mockResolvedValueOnce({ jobId: "example-export" });
  await openRemix();
  await click("Rewrite for this topic");
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
    "/api/storyboards/write",
    expect.objectContaining({
      research: "off",
      retry: false,
      brief: expect.objectContaining({
        topic: "Making time to practise",
        revise: {
          storyboard: motivation,
          instruction: expect.stringContaining("Making time to practise"),
        },
      }),
    }),
  );
  expect(
    container.querySelector<HTMLInputElement>('[aria-label="Scene 1 headline"]')
      ?.value,
  ).toBe("Build a habit 1");
  expect(mocks.push).not.toHaveBeenCalled();
  await click("Make my version");
  expect(mocks.post).toHaveBeenLastCalledWith(
    "/api/storyboards",
    expect.objectContaining({
      storyboard: expect.objectContaining({
        title: written.title,
        theme: motivation.theme,
        format: motivation.format,
        scenes: written.scenes.map((scene) =>
          expect.objectContaining({
            type: scene.type,
            headline: scene.headline,
          }),
        ),
      }),
    }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/results/example-export");
});

it("leaves the manual edit available if the writer changes the scene types", async () => {
  mocks.post.mockResolvedValueOnce({
    storyboard: {
      ...motivation,
      kind: "video",
      scenes: [
        { ...motivation.scenes[0], type: "cta" },
        ...motivation.scenes.slice(1),
      ],
    },
  });
  await openRemix();
  await click("Rewrite for this topic");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "could not keep the example’s scene structure",
  );
  expect(
    container.querySelector<HTMLInputElement>('[aria-label="Scene 1 headline"]')
      ?.value,
  ).toBe(motivation.scenes[0].headline);
  expect(mocks.push).not.toHaveBeenCalled();
});
