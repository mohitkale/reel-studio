// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, getDefaultBrandKit } = vi.hoisted(() => ({
  create: vi.fn(),
  getDefaultBrandKit: vi.fn(),
}));
vi.mock("@/library/db", () => ({ prisma: { project: { create } } }));
vi.mock("./brandkits", () => ({ getDefaultBrandKit }));

import { createProjectFromPlan } from "./projects";
import { scenePlanSchema } from "@/providers/ai/types";
import {
  motionPlanSettingsSchema,
  planMotionSequence,
} from "@/production/motion-plan";
import { motionDirection } from "@/production/motion";

const plan = scenePlanSchema.parse({
  projectName: "Motion story",
  scriptName: "Story",
  scenes: [
    { templateId: "hf-opener", text: "Opening", emphasis: [] },
    { templateId: "hf-statement", text: "Context", emphasis: [] },
    { templateId: "hf-statement", text: "Payoff", emphasis: [] },
  ],
});
const roles = ["hook", "headline", "payoff"] as const;

describe("project motion persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultBrandKit.mockResolvedValue(null);
    create.mockResolvedValue({ id: "project", scripts: [{ id: "script" }] });
  });

  it("saves planning settings and their selected decisions together", async () => {
    await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "creator-punch", version: "1.0.0" },
        roles: [...roles],
        visualAmbition: "clean",
      },
    );
    const script = create.mock.calls[0][0].data.scripts.create;
    const settings = motionPlanSettingsSchema.parse(
      JSON.parse(script.brandOverrides).motionPlan,
    );
    expect(settings.ambition).toBe("clean");
    const expected = planMotionSequence(
      plan.scenes.map((scene, index) => ({
        role: roles[index],
        text: scene.text,
      })),
      settings,
    );
    expect(
      script.scenes.create.map(
        (scene: { layoutJson: string }) => JSON.parse(scene.layoutJson).motion,
      ),
    ).toEqual(expected);
  });

  it("keeps legacy projects on their existing templates", async () => {
    await createProjectFromPlan(plan);
    const script = create.mock.calls[0][0].data.scripts.create;
    expect(JSON.parse(script.brandOverrides).motionPlan).toBeUndefined();
    expect(
      script.scenes.create.every(
        (scene: { layoutJson: string }) => !JSON.parse(scene.layoutJson).motion,
      ),
    ).toBe(true);
  });

  it("restores frozen decisions including preset looks without replanning", async () => {
    const settings = {
      version: "1.0.0",
      seed: "saved",
      ambition: "showcase",
    } as const;
    const decisions = [
      motionDirection("type-editorial"),
      undefined,
      motionDirection("type-impact"),
    ];
    await createProjectFromPlan(plan, "portrait", [], "remotion", undefined, {
      preset: { id: "creator-punch", version: "1.0.0" },
      roles: [...roles],
      motionPlan: settings,
      motions: decisions,
    });
    const script = create.mock.calls[0][0].data.scripts.create;
    expect(JSON.parse(script.brandOverrides).motionPlan).toEqual(settings);
    expect(
      script.scenes.create.map(
        (scene: { layoutJson: string }) => JSON.parse(scene.layoutJson).motion,
      ),
    ).toEqual(decisions);
  });
});
