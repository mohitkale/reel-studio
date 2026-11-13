// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRead: vi.fn(),
  projectToStoryboard: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorizeRead: mocks.authorizeRead }));
vi.mock("@/library/project-storyboard", () => ({
  projectToStoryboard: mocks.projectToStoryboard,
}));

import { GET } from "./route";

const get = (query = "") =>
  GET(new Request(`http://localhost/api/scripts/s1/storyboard${query}`), {
    params: Promise.resolve({ id: "s1" }),
  });
const storyboard = {
  version: 1,
  kind: "video",
  title: "My Video: Part 2!",
  scenes: [],
};

beforeEach(() => vi.resetAllMocks());

it("returns the storyboard and the notes", async () => {
  mocks.projectToStoryboard.mockResolvedValue({
    storyboard,
    notes: ["a note"],
    errors: [],
  });
  const response = await get();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    notes: ["a note"],
    storyboard: { title: "My Video: Part 2!" },
  });
});

it("sends a download with a safe file name", async () => {
  mocks.projectToStoryboard.mockResolvedValue({
    storyboard,
    notes: [],
    errors: [],
  });
  const response = await get("?download=1");
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="my-video-part-2.storyboard.json"',
  );
  expect(JSON.parse(await response.text()).title).toBe("My Video: Part 2!");
});

it("answers 404 for an unknown project and 422 when nothing valid can be built", async () => {
  mocks.projectToStoryboard.mockResolvedValueOnce(null);
  expect((await get()).status).toBe(404);
  mocks.projectToStoryboard.mockResolvedValueOnce({
    storyboard: null,
    notes: [],
    errors: [
      { path: "scenes", message: "Required", expected: "x", example: "y" },
    ],
  });
  const response = await get();
  expect(response.status).toBe(422);
  expect((await response.json()).errors).toHaveLength(1);
});
