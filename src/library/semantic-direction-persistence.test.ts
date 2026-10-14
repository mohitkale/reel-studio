// @vitest-environment node
import { expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { semanticGraphicsFixture } from "../../tests/fixtures/semantic-graphics";
import { scenePlanSchema } from "@/providers/ai/types";
import { VISUAL_THEMES } from "@/production/creative-direction";

it("automatically persists whole-story subjects on creation and restores the exact frozen illustrations", async () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "reel-semantic-persistence-"),
  );
  const filename = path.join(directory, "test.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  db.close();
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const { createProjectFromPlan } = await import("./repositories/projects");
    const { getScript } = await import("./repositories/scripts");
    const { captureVideoSnapshot } = await import("./video-snapshot");
    const { restoreProductionRevision } =
      await import("./restore-production-revision");
    const fixture = semanticGraphicsFixture();
    const plan = scenePlanSchema.parse({
      projectName: "Story",
      scriptName: "Story",
      scenes: fixture.scenes.map((scene) => ({
        templateId: scene.templateId,
        text: scene.text,
        spokenText: scene.spokenText,
        emphasis: scene.emphasis,
        direction: scene.direction,
      })),
    });
    const created = await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        visualTheme: VISUAL_THEMES.paper,
        roles: fixture.scenes.map(() => "explanation"),
      },
    );
    const { ensureSfxCues } = await import("./sfx-service");
    const { parseSfxState } = await import("@/lib/sfx-cues");
    await ensureSfxCues(created.scriptId);
    const script = (await getScript(created.scriptId))!;
    expect(
      parseSfxState(script.sfxJson).cues.some((cue) =>
        Boolean(cue.showpieceEvent),
      ),
    ).toBe(true);
    expect(
      script.scenes[0].direction?.graphic?.nodes.map((node) => [
        node.label,
        node.symbol,
      ]),
    ).toEqual([
      ["SEO", "search"],
      ["AEO", "answer"],
      ["GEO", "sources"],
    ]);
    expect(
      script.scenes[0].direction?.graphic?.nodes.every((node) =>
        Boolean(node.sourceQuote),
      ),
    ).toBe(true);
    expect(script.scenes[0].motion).toBeUndefined();
    expect(
      script.scenes.map((scene) => [scene.text, scene.spokenText]),
    ).toEqual(
      plan.scenes.map((scene) => [scene.text, scene.spokenText ?? null]),
    );
    const restored = await restoreProductionRevision(
      await captureVideoSnapshot(created.scriptId),
    );
    const copy = (await getScript(restored.scriptId))!;
    expect(
      parseSfxState(copy.sfxJson).cues.map((cue) => cue.showpieceEvent),
    ).toEqual(
      parseSfxState(script.sfxJson).cues.map((cue) => cue.showpieceEvent),
    );
    expect(copy.scenes.map((scene) => scene.direction)).toEqual(
      script.scenes.map((scene) => scene.direction),
    );
    const { ensureDefaultBrandKit } = await import("./repositories/brandkits");
    const kit = await ensureDefaultBrandKit();
    await prisma.brandKit.update({
      where: { id: kit.id },
      data: {
        name: "Custom identity",
        palette: JSON.stringify({ background: "#0D256F", accent: "#FF5900" }),
      },
    });
    const automatic = await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        visualTheme: VISUAL_THEMES.celestial,
        brandKitId: null,
      },
    );
    const themed = (await getScript(automatic.scriptId))!;
    expect(themed.brandKitId).toBeNull();
    expect(themed.brandTokens.background).toBe(
      VISUAL_THEMES.celestial.palette.background,
    );
    const branded = await createProjectFromPlan(
      plan,
      "portrait",
      [],
      "hyperframes",
      undefined,
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        visualTheme: VISUAL_THEMES.celestial,
        brandKitId: kit.id,
      },
    );
    expect((await getScript(branded.scriptId))!.brandTokens.background).toBe(
      "#0D256F",
    );
  } finally {
    await prisma.$disconnect();
    delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    vi.resetModules();
    rmSync(directory, { recursive: true, force: true });
  }
  // Include migration setup and cold repository imports on Windows runners.
}, process.platform === "win32" ? 30_000 : 5_000);
