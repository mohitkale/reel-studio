// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { SceneDTO } from "@/lib/dto";
import { createPrismaClient } from "@/library/prisma-client";
import {
  mergeGeneratedScene,
  selectRegenerationTargets,
} from "@/library/selective-scene-regeneration";
import type { AIScene } from "@/providers/ai/types";

function scene(overrides: Partial<SceneDTO> = {}): SceneDTO {
  return {
    id: "scene-1",
    scriptId: "script-1",
    order: 0,
    templateId: "kinetic",
    text: "Original display copy",
    spokenText: "Original narration",
    emphasis: ["Original"],
    visual: "OLD",
    background: {
      type: "image",
      url: "/media/assets/original/content",
      effect: "ken-burns",
    },
    items: ["Original item"],
    chart: {
      labels: ["August"],
      series: [{ label: "Users", values: [42], unit: "people" }],
      sourceAttribution: "Supplied report",
    },
    hideText: null,
    mood: "calm",
    musicMood: "soft focus",
    selectedVoiceClipId: "clip-1",
    role: "feature",
    assetRefs: ["asset-1"],
    ...overrides,
  };
}

const generated: AIScene = {
  templateId: "icon-grid",
  text: "Fresh display copy",
  spokenText: "Fresh narration with more detail",
  emphasis: ["Fresh"],
  visual: "NEW",
  items: ["Fresh item one", "Fresh item two"],
  mood: "energetic",
  musicMood: "creator beat",
};

describe("selective scene regeneration", () => {
  it("targets only requested scenes that are not wholly locked", () => {
    const scenes = [
      scene(),
      scene({
        id: "scene-2",
        order: 1,
        locks: { copy: false, assets: false, scene: true },
      }),
      scene({ id: "scene-3", order: 2 }),
    ];

    expect(
      selectRegenerationTargets(scenes, ["scene-1", "scene-2"]).map(
        (item) => item.id,
      ),
    ).toEqual(["scene-1"]);
    expect(selectRegenerationTargets(scenes).map((item) => item.id)).toEqual([
      "scene-1",
      "scene-3",
    ]);
    expect(selectRegenerationTargets(scenes, [])).toEqual([]);
  });

  it("preserves locked copy, locked assets, roles, and reusable audio references", () => {
    const existing = scene({
      locks: { copy: true, assets: true, scene: false },
    });
    const result = mergeGeneratedScene(existing, generated, {
      type: "image",
      url: "/media/assets/generated/content",
    });
    const config = JSON.parse(result.layoutJson) as Record<string, unknown>;

    expect(result).toMatchObject({
      text: existing.text,
      spokenText: existing.spokenText,
      visual: existing.visual,
      emphasis: JSON.stringify(existing.emphasis),
    });
    expect(config).toMatchObject({
      background: existing.background,
      items: existing.items,
      chart: existing.chart,
      role: existing.role,
      locks: existing.locks,
    });
    expect(result).not.toHaveProperty("selectedVoiceClipId");
    expect(result).not.toHaveProperty("assetRefs");
  });

  it("updates unlocked copy but retains a valid background when no replacement resolves", () => {
    const result = mergeGeneratedScene(scene(), generated);
    const config = JSON.parse(result.layoutJson) as Record<string, unknown>;

    expect(result).toMatchObject({
      text: generated.text,
      spokenText: generated.spokenText,
      visual: generated.visual,
      emphasis: JSON.stringify(generated.emphasis),
    });
    expect(config.background).toEqual(scene().background);
    expect(config.items).toEqual(generated.items);
  });

  it("keeps the selected voice clip and uploaded asset references in the database", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "reel-selective-ai-"));
    const filename = path.join(directory, "selective.db");
    const sqlite = new DatabaseSync(filename);
    sqlite.exec(
      readFileSync(
        "prisma/migrations/20260910000100_baseline/migration.sql",
        "utf8",
      ),
    );
    sqlite.close();
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${filename}`;
    const client = createPrismaClient();
    try {
      const project = await client.project.create({
        data: { name: "Selective AI" },
      });
      const script = await client.script.create({
        data: { projectId: project.id, name: "Keep valid work" },
      });
      const storedScene = await client.scene.create({
        data: {
          scriptId: script.id,
          order: 0,
          templateId: "kinetic",
          text: "Original display copy",
          spokenText: "Original narration",
          assetRefs: JSON.stringify(["asset-1"]),
        },
      });
      const clip = await client.sceneVoiceClip.create({
        data: {
          scriptId: script.id,
          sceneId: storedScene.id,
          providerId: "kokoro",
          voiceId: "af_heart",
          text: "Original narration",
          textHash: "unchanged-hash",
          audioPath: "voice/clip.wav",
          durationFrames: 90,
        },
      });
      await client.scene.update({
        where: { id: storedScene.id },
        data: { selectedVoiceClipId: clip.id },
      });

      await client.scene.update({
        where: { id: storedScene.id },
        data: mergeGeneratedScene(
          scene({
            id: storedScene.id,
            scriptId: script.id,
            selectedVoiceClipId: clip.id,
          }),
          generated,
        ),
      });
      const updated = await client.scene.findUniqueOrThrow({
        where: { id: storedScene.id },
      });

      expect(updated.id).toBe(storedScene.id);
      expect(updated.selectedVoiceClipId).toBe(clip.id);
      expect(JSON.parse(updated.assetRefs!)).toEqual(["asset-1"]);
      expect(await client.sceneVoiceClip.count()).toBe(1);
    } finally {
      await client.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
