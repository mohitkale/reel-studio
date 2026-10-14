// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, getDefaultBrandKit } = vi.hoisted(() => ({
  create: vi.fn(),
  getDefaultBrandKit: vi.fn(),
}));
vi.mock("@/library/db", () => ({ prisma: { project: { create } } }));
vi.mock("./brandkits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./brandkits")>()),
  getDefaultBrandKit,
}));

import { createProjectFromPlan } from "./projects";
import { scenePlanSchema } from "@/providers/ai/types";
import {
  motionPlanSettingsSchema,
  planMotionSequence,
} from "@/production/motion-plan";
import { motionDirection } from "@/production/motion";
import { VISUAL_THEMES } from "@/production/creative-direction";
import { CORAL_HARBOR_NAME, CORAL_HARBOR_PALETTE } from "@/lib/brand-defaults";

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
  it("freezes an automatic theme without attaching the untouched starter kit", async () => {
    getDefaultBrandKit.mockResolvedValue({
      id: "starter",
      name: CORAL_HARBOR_NAME,
      palette: JSON.stringify(CORAL_HARBOR_PALETTE),
      handle: "@yourbrand",
      fonts: null,
    });
    await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      { visualTheme: VISUAL_THEMES.botanical },
    );
    const project = create.mock.calls[0][0].data;
    expect(project.brandKitId).toBeNull();
    expect(
      JSON.parse(project.scripts.create.brandOverrides).visualTheme,
    ).toEqual(VISUAL_THEMES.botanical);
  });
  it("respects a customized default brand and an explicit kit", async () => {
    getDefaultBrandKit.mockResolvedValue({
      id: "custom",
      name: CORAL_HARBOR_NAME,
      palette: JSON.stringify({ ...CORAL_HARBOR_PALETTE, accent: "#123456" }),
      handle: "@yourbrand",
      fonts: null,
    });
    await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      { visualTheme: VISUAL_THEMES.botanical },
    );
    expect(create.mock.calls[0][0].data.brandKitId).toBe("custom");
    await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      { visualTheme: VISUAL_THEMES.botanical, brandKitId: "chosen" },
    );
    expect(create.mock.calls[1][0].data.brandKitId).toBe("chosen");
  });
  it("treats repeated AI motion suggestions as hints and retains explicit scene locks", async () => {
    const directed = {
      ...plan,
      scenes: plan.scenes.map((scene) => ({
        ...scene,
        direction: {
          version: 1 as const,
          role: "explanation" as const,
          composition: "authored" as const,
          motion: motionDirection("quiet-center"),
        },
      })),
    };
    await createProjectFromPlan(
      directed,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        roles: ["explanation", "explanation", "explanation"],
        sceneLocks: [undefined, { scene: true, copy: false, assets: false }],
      },
    );
    const motions =
      create.mock.calls[0][0].data.scripts.create.scenes.create.map(
        (scene: { layoutJson: string }) =>
          JSON.parse(scene.layoutJson).motion.recipeId,
      );
    expect(motions[1]).toBe("quiet-center");
    expect(new Set(motions).size).toBeGreaterThan(1);
  });
  it("creates scene IDs and their chapter boundaries in the same nested database write", async () => {
    const long = {
      ...plan,
      scenes: Array.from({ length: 24 }, () => plan.scenes[0]!),
    };
    await createProjectFromPlan(
      long,
      "landscape",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        chapterStarts: [
          { title: "Question", firstSceneIndex: 0 },
          { title: "Explanation", firstSceneIndex: 12 },
        ],
      },
    );
    const script = create.mock.calls[0][0].data.scripts.create;
    const ids = script.scenes.create.map((scene: { id: string }) => scene.id);
    expect(new Set(ids).size).toBe(24);
    expect(
      JSON.parse(script.brandOverrides).chapterPlan.chapters.map(
        (chapter: { firstSceneId: string }) => chapter.firstSceneId,
      ),
    ).toEqual([ids[0], ids[12]]);
    expect(script.scenes.create).toHaveLength(24);
    create.mockClear();
    await expect(
      createProjectFromPlan(long, "portrait", [], "hyperframes", undefined, {
        chapterStarts: [{ title: "Invalid start", firstSceneIndex: 1 }],
      }),
    ).rejects.toThrow(/first scene/);
    expect(create).not.toHaveBeenCalled();
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
    await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "creator-punch", version: "1.0.0" },
        roles: [...roles],
        motionPlan: settings,
        motions: decisions,
        sceneLocks: [{ copy: false, assets: false, scene: true }],
      },
    );
    const script = create.mock.calls[0][0].data.scripts.create;
    expect(JSON.parse(script.brandOverrides).motionPlan).toEqual(settings);
    expect(JSON.parse(script.scenes.create[0].layoutJson).locks).toEqual({
      copy: false,
      assets: false,
      scene: true,
    });
    expect(
      script.scenes.create.map(
        (scene: { layoutJson: string }) => JSON.parse(scene.layoutJson).motion,
      ),
    ).toEqual(decisions);
  });
  it("persists admitted direction and uses a reproducible seed when creating the same supplied plan", async () => {
    const directed = {
      ...plan,
      scenes: [
        {
          ...plan.scenes[0],
          direction: {
            version: 1 as const,
            role: "headline" as const,
            composition: "layered-title" as const,
          },
        },
      ],
    };
    const production = {
      preset: { id: "editorial-explainer" as const, version: "1.0.0" },
      roles: ["headline" as const],
    };
    await createProjectFromPlan(
      directed,
      "portrait",
      [],
      "hyperframes",
      undefined,
      production,
    );
    await createProjectFromPlan(
      directed,
      "portrait",
      [],
      "hyperframes",
      undefined,
      production,
    );
    const [first, second] = create.mock.calls.map(
      ([request]) => request.data.scripts.create,
    );
    expect(JSON.parse(first.scenes.create[0].layoutJson).direction).toEqual(
      directed.scenes[0].direction,
    );
    expect(JSON.parse(first.brandOverrides).motionPlan.seed).toBe(
      JSON.parse(second.brandOverrides).motionPlan.seed,
    );
  });
});
