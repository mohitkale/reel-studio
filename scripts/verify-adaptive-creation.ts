/** Opt-in M4 acceptance: saves two named examples/exports in the active app.
 * The AI transport uses a loopback fixture, never a paid or downloaded model.
 */
import type { SceneDTO } from "../src/lib/dto";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createManualProject } from "../src/library/manual-creation-service";
import { createProjectFromPlan } from "../src/library/repositories/projects";
import { getScript } from "../src/library/repositories/scripts";
import { createTake } from "../src/library/repositories/takes";
import { createRender, getRender } from "../src/library/repositories/renders";
import { createLocalCompatibleProvider } from "../src/providers/ai/lm-studio";
import { capabilityIdForTemplateId } from "../src/engines/capabilities";
import { applyPresetToAIPlan } from "../src/production/ai-preset-plan";
import { replanMotionDirection } from "../src/library/motion-direction-service";
import { captureVideoSnapshot } from "../src/library/video-snapshot";
import { createProductionRevision } from "../src/library/production-revision";
import { runRenderNow } from "../src/library/render-service";
import { getAssetStore } from "../src/library/storage";
import { makeSilentWav } from "../src/lib/wav";
import { prisma } from "../src/library/db";
import { probeCreationProvider } from "../src/providers/ai/readiness";

const root = ".artifacts/adaptive-m4";
const text =
  "Draft locally from supplied content. Review each scene before producing a film. Keep narration and facts through visual variations. Export the direction you reviewed.";
async function main() {
  await mkdir(root, { recursive: true });
  const manual = await createManualProject({
    name: "M4 · Supplied content",
    source: { kind: "text", text },
    presetId: "editorial-explainer",
    orientation: "portrait",
    videoEngine: "hyperframes",
    mediaPreference: "none",
  });
  const fixture = {
    ...manual.plan,
    projectName: "M4 · Configured AI transport fixture",
    scriptName: "M4 · Configured AI transport fixture",
    styleId: manual.plan.styleId ?? "clean-story",
    energy: manual.plan.energy ?? "normal",
    scenes: manual.plan.scenes.map(({ templateId, ...scene }) => ({
      ...scene,
      capabilityId: capabilityIdForTemplateId("hyperframes", templateId),
    })),
  };
  let modelCalls = 0;
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/models")
      res.end(JSON.stringify({ data: [{ id: "m4-fixture" }] }));
    else if (req.url === "/v1/chat/completions") {
      for await (const chunk of req) {
        assert.ok(chunk);
      }
      modelCalls++;
      res.end(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(fixture) } }],
        }),
      );
    } else res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const provider = createLocalCompatibleProvider("lm-studio", {
    readProvider: async () => ({
      baseUrl: `http://127.0.0.1:${address.port}`,
      modelId: "m4-fixture",
      temperature: 0.3,
      allowLan: false,
    }),
    recordDiagnostic: async () => {},
  });
  let ai;
  try {
    const raw = await provider.generatePlan({
      mode: "story",
      brief: text,
      sceneCount: manual.plan.scenes.length,
      mediaPreference: "none",
      videoEngine: "hyperframes",
    });
    const admitted = applyPresetToAIPlan(
      raw,
      "editorial-explainer",
      "hyperframes",
      {
        source: text,
        hasVisualAsset: false,
        sceneHasVisual: raw.scenes.map(() => false),
      },
    );
    ai = await createProjectFromPlan(
      admitted.plan,
      "landscape",
      [],
      "hyperframes",
      { styleId: fixture.styleId, energy: fixture.energy },
      {
        preset: { id: "editorial-explainer", version: "1.0.0" },
        roles: admitted.roles,
        mediaPreferences: raw.scenes.map(() => "none"),
      },
    );
    const probe = await probeCreationProvider(
      provider,
      "m4-fixture",
      "English",
      AbortSignal.timeout(10_000),
    );
    await writeFile(
      `${root}/probe.json`,
      JSON.stringify({ ...probe, fixture: true }, null, 2),
    );
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
  assert.equal(modelCalls, 2);
  const records: Array<{
    projectId: string;
    scriptId: string;
    takeId: string;
    revisionId: string;
    renderId: string;
    orientation: string;
    seconds: number;
    content: Array<Pick<SceneDTO, "text" | "spokenText" | "items" | "chart">>;
  }> = [];
  for (const [created, orientation] of [
    [manual, "portrait"],
    [ai, "landscape"],
  ] as const) {
    let script = (await getScript(created.scriptId))!;
    const original = script.scenes.map((scene) => ({
      text: scene.text,
      spokenText: scene.spokenText,
      items: scene.items,
      chart: scene.chart,
    }));
    if (records.length)
      assert.deepEqual(
        original,
        records[0].content,
        "Manual and configured AI transport retain the same admitted content",
      );
    const proposal = await replanMotionDirection(script.id, {
      ambition: "clean",
      preview: true,
      sceneIds: [script.scenes[0].id],
    });
    assert.equal(proposal.state, "planned");
    if (proposal.state !== "planned") throw new Error("Missing proposal");
    await replanMotionDirection(script.id, {
      ambition: "clean",
      sceneIds: [script.scenes[0].id],
      expectedHash: proposal.sourceHash,
      variationSeed: proposal.settings.seed,
    });
    await prisma.$disconnect();
    await replanMotionDirection(script.id, { undo: true });
    script = (await getScript(script.id))!;
    assert.deepEqual(
      script.scenes.map((scene) => ({
        text: scene.text,
        spokenText: scene.spokenText,
        items: scene.items,
        chart: scene.chart,
      })),
      original,
    );
    const seconds = script.scenes.length * 5;
    const audioPath = `fixtures/m4-${orientation}-silent.wav`;
    await getAssetStore().put(audioPath, makeSilentWav(seconds));
    const take = await createTake({
      scriptId: script.id,
      label: "M4 · Silent timing fixture",
      providerId: "placeholder",
      voiceId: "silent",
      fps: 30,
      totalFrames: seconds * 30,
      timeline: script.scenes.map((scene, index) => ({
        sceneId: scene.id,
        text: scene.spokenText ?? scene.text,
        startFrame: index * 150,
        durationFrames: 150,
      })),
      audioPath,
      isPlaceholder: true,
    });
    const snapshot = await captureVideoSnapshot(script.id, take.id);
    const revision = await createProductionRevision(snapshot);
    const render = await createRender({
      scriptId: script.id,
      voiceTakeId: take.id,
      name: `M4 accepted · ${orientation} · ${records.length ? "AI transport fixture" : "manual"}`,
      quality: "draft",
    });
    const record = {
      projectId: created.projectId,
      scriptId: script.id,
      takeId: take.id,
      revisionId: revision.id,
      renderId: render.id,
      orientation,
      seconds,
      content: original,
    };
    records.push(record);
    await writeFile(`${root}/examples.json`, JSON.stringify(records, null, 2));
    console.log(
      `Rendering M4 ${orientation}, ${seconds}s; loopback model fixture is now offline`,
    );
    await runRenderNow({
      scriptId: script.id,
      renderId: render.id,
      snapshot,
      orientation,
      quality: "draft",
      serverBaseUrl:
        process.env.REEL_VERIFY_BASE_URL ?? "http://127.0.0.1:3000",
    });
    const result = await getRender(render.id);
    assert.equal(
      result?.status,
      "done",
      result?.error ?? "Render did not complete",
    );
    await writeFile(
      `${root}/${orientation}.json`,
      JSON.stringify({ record, result }, null, 2),
    );
    console.log(`Verified ${result.outputUrl}`);
  }
  await prisma.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
