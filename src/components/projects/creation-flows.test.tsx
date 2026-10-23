import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CreateWithAIDialog } from "./create-with-ai-dialog";
import { CreationWizard } from "./creation-wizard";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/ai", () => ({
  useAIProviders: () => ({
    data: [{ id: "gemini", label: "Gemini", configured: true }],
  }),
  useGenerateProject: () => ({ mutate: mocks.generate, isPending: false }),
}));
vi.mock("@/hooks/script", () => ({
  useCreateManualProduction: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
}));
vi.mock("@/hooks/assets", () => ({
  useUploadAsset: () => ({ isPending: false }),
}));
vi.mock("@/hooks/brandkits", () => ({ useBrandKits: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Browser checks cover opening/focus; keep the real creation controls mounted here.
vi.mock("@/components/ui/dialog", () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Wrapper,
    DialogTrigger: Wrapper,
    DialogContent: Wrapper,
    DialogDescription: Wrapper,
    DialogFooter: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
    DialogClose: Wrapper,
  };
});
let root: Root;
let container: HTMLDivElement;
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});
async function mount(node: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<TooltipProvider>{node}</TooltipProvider>));
}
function button(text: string) {
  return Array.from(container.querySelectorAll("button")).find(
    (node) => node.textContent?.trim() === text,
  )!;
}
async function enter(selector: string, value: string) {
  const field = container.querySelector<HTMLTextAreaElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("creates an AI draft from a brief using the configured provider and preset defaults", async () => {
  await mount(<CreateWithAIDialog />);
  expect(button("Create draft").disabled).toBe(true);
  await enter("#ai-brief", " Explain how local video production works. ");
  await act(async () => button("Create draft").click());
  expect(mocks.generate.mock.calls[0][0]).toMatchObject({
    providerId: "gemini",
    brief: "Explain how local video production works.",
    productionPresetId: "auto",
    styleId: "auto",
    energy: "auto",
    brandKitId: null,
  });
  expect(mocks.generate.mock.calls[0][0]).not.toHaveProperty("quickProduce");
});
it("retains AI planning when Quick Produce is enabled and honors visible narration", async () => {
  await mount(<CreateWithAIDialog />);
  await enter("#ai-brief", "Explain a reading habit.");
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click(),
  );
  expect(container.textContent).toContain("Add local narration");
  await act(async () => button("Create and produce").click());
  expect(mocks.generate.mock.calls[0][0].quickProduce).toMatchObject({
    planner: "gemini",
    voice: { enabled: false },
  });
  await act(async () =>
    container
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]!
      .click(),
  );
  await act(async () => button("Create and produce").click());
  expect(mocks.generate.mock.calls[1][0].quickProduce.voice.enabled).toBe(true);
  mocks.generate.mock.calls[1][1].onSuccess({
    scriptId: "script",
    mediaDecisions: [],
    job: { id: "job" },
  });
  expect(mocks.push).toHaveBeenCalledWith("/results/job");
});
it("builds a local production directly from content without requiring a name or wizard steps", async () => {
  mocks.create.mockResolvedValue({ scriptId: "local-script", warnings: [] });
  await mount(<CreationWizard />);
  expect(button("Build draft").disabled).toBe(true);
  await enter(
    "#production-copy",
    " Start with a clear idea. Give a useful example. Finish with a next step. ",
  );
  await act(async () => button("Build draft").click());
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Start with a clear idea",
      source: {
        kind: "text",
        text: "Start with a clear idea. Give a useful example. Finish with a next step.",
      },
      outputType: "video",
      presetId: "editorial-explainer",
      voiceMode: "oneshot",
      structure: "single",
    }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/editor/local-script");
});
it("keeps output, style and narration customization reachable before building", async () => {
  await mount(<CreationWizard />);
  await enter(
    "#production-copy",
    "A supplied script that is long enough to plan.",
  );
  await act(async () => button("Customize options").click());
  expect(container.textContent).toContain("Chaptered video");
  await act(async () => button("Continue").click());
  expect(container.querySelector("#production-orientation")).not.toBeNull();
  await act(async () => button("Continue").click());
  expect(container.textContent).toContain("Narration workflow");
  expect(button("Build draft").disabled).toBe(false);
});

it("honors explicit local planner, format, and preset selections in Quick Produce", async () => {
  await mount(<CreateWithAIDialog />);
  await enter(
    "#ai-brief",
    "A finished script. A useful example. One next step.",
  );
  await act(async () =>
    container
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .click(),
  );
  for (const [id, value] of [
    ["ai-provider", "deterministic"],
    ["ai-production-preset", "creator-punch"],
    ["ai-orientation", "landscape"],
  ]) {
    await act(async () => {
      const select = container.querySelector<HTMLSelectElement>(`#${id}`)!;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await act(async () => button("Create and produce").click());
  expect(mocks.generate.mock.calls[0][0]).toMatchObject({
    providerId: undefined,
    productionPresetId: "creator-punch",
    orientation: "landscape",
    quickProduce: { planner: "deterministic" },
  });
});

it("opens voiceover drafts in their audio workspace", async () => {
  mocks.create.mockResolvedValue({ scriptId: "voice-script", warnings: [] });
  await mount(<CreationWizard initialOutputType="voiceover" />);
  await enter("#production-copy", "First paragraph.\n\nSecond paragraph.");
  await act(async () => button("Build draft").click());
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ outputType: "voiceover" }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/voiceovers/voice-script");
});
it("lets a voiceover entry switch explicitly to video", async () => {
  mocks.create.mockResolvedValue({ scriptId: "video-script", warnings: [] });
  await mount(<CreationWizard initialOutputType="voiceover" />);
  await enter(
    "#production-copy",
    "A complete supplied script to turn into video.",
  );
  await act(async () => button("Customize options").click());
  const choice = Array.from(container.querySelectorAll("button")).find((node) =>
    node.textContent?.includes("Polished video"),
  )!;
  await act(async () => choice.click());
  await act(async () => button("Continue").click());
  await act(async () => button("Continue").click());
  await act(async () => button("Build draft").click());
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ outputType: "video" }),
  );
  expect(mocks.push).toHaveBeenCalledWith("/editor/video-script");
});
