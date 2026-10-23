import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PodcastAudioImport } from "./audio-import";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  stop: vi.fn(),
  error: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock("@/hooks/script", () => ({
  useLocalTranscriptionStatus: () => ({ data: { available: true } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: vi.fn() } }));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
let root: Root, container: HTMLDivElement;
const recorders: FakeRecorder[] = [];
class FakeRecorder {
  state = "inactive";
  onstop: (() => void) | null = null;
  ondataavailable: unknown = null;
  mimeType = "audio/webm";
  constructor() {
    recorders.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}
async function mount() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: mocks.permission },
  });
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PodcastAudioImport podcastId="test" />));
}
function record() {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Record microphone",
  )!;
}
afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  vi.clearAllMocks();
});
it("releases an active microphone on unmount without uploading", async () => {
  mocks.permission.mockResolvedValue({
    getTracks: () => [{ stop: mocks.stop }],
  });
  await mount();
  await act(async () => record().click());
  expect(container.textContent).toContain("Recording microphone…");
  await act(async () => root.unmount());
  const recorder = recorders.at(-1)!;
  expect(recorder.state).toBe("inactive");
  expect(recorder.onstop).toBeNull();
  expect(mocks.stop).toHaveBeenCalledTimes(1);
});
it("releases a permission result arriving after navigation", async () => {
  let resolve!: (value: unknown) => void;
  mocks.permission.mockReturnValue(new Promise((r) => (resolve = r)));
  await mount();
  await act(async () => record().click());
  await act(async () => root.unmount());
  await act(async () => resolve({ getTracks: () => [{ stop: mocks.stop }] }));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
});
it("recovers the record control after permission is denied", async () => {
  mocks.permission.mockRejectedValue(new Error("Microphone access denied"));
  await mount();
  await act(async () => record().click());
  expect(mocks.error).toHaveBeenCalledWith("Microphone access denied");
  expect(record().disabled).toBe(false);
});

it("cancels a pending permission request and releases a late stream", async () => {
  let resolve!: (value: unknown) => void;
  mocks.permission.mockReturnValue(new Promise((r) => (resolve = r)));
  await mount();
  await act(async () => record().click());
  expect(container.textContent).toContain("Waiting for microphone permission");
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "Cancel microphone request")!
      .click(),
  );
  expect(record().disabled).toBe(false);
  await act(async () => resolve({ getTracks: () => [{ stop: mocks.stop }] }));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain("Recording microphone…");
});
