/** Reuses cached Kokoro and the explicitly configured Whisper model. No paid API calls. */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { env } = await import("@huggingface/transformers");
  env.allowRemoteModels = false;
  const { prisma } = await import("../src/library/db");
  const { promises: fs } = await import("node:fs");
  const { createManualProject } =
    await import("../src/library/manual-creation-service");
  const { generateTake } = await import("../src/library/take-service");
  const { getAssetStore } = await import("../src/library/storage");
  const { saveAudioEdit, commitAudioEdit } =
    await import("../src/library/audio-edit-service");
  const { createPodcast } =
    await import("../src/library/repositories/podcasts");
  const { importPodcastAudio } = await import("../src/library/podcast-import");
  const { transcribePodcastRecording } =
    await import("../src/library/podcast-transcription");
  const { getScript } = await import("../src/library/repositories/scripts");
  const { resolveReelTimeline } = await import("../src/lib/reel-timeline");
  const { createHash } = await import("node:crypto");
  const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };
  const directory = ".artifacts/studio-completion";
  await fs.mkdir(directory, { recursive: true });
  let fixture: {
    scriptId: string;
    takeId: string;
    podcastId?: string;
    importedTakeId?: string;
    editedTakeId?: string;
    transcribedTakeId?: string;
    renderId?: string;
  };
  try {
    fixture = JSON.parse(
      await fs.readFile(`${directory}/fixture.json`, "utf8"),
    );
  } catch {
    const created = await createManualProject({
      name: "Factory completion · Local narration",
      source: {
        kind: "text",
        text: "Good stories begin with clear ideas.\n\nReview the voice and pacing before sharing your work.",
      },
      outputType: "voiceover",
      presetId: "editorial-explainer",
      orientation: "portrait",
      videoEngine: "hyperframes",
      mediaPreference: "none",
    });
    const take = await generateTake({
      scriptId: created.scriptId,
      providerId: "kokoro-server",
      voiceId: "af_heart",
      label: "Cached Kokoro · real local speech",
    });
    fixture = { scriptId: created.scriptId, takeId: take.id };
    await fs.writeFile(
      `${directory}/fixture.json`,
      JSON.stringify(fixture, null, 2),
    );
  }
  try {
    const row = await prisma.voiceTake.findUniqueOrThrow({
        where: { id: fixture.takeId },
      }),
      wav = await getAssetStore().get(row.audioPath),
      hash = createHash("sha256").update(wav).digest("hex");
    const script = await getScript(fixture.scriptId);
    assert(script, "Review script missing");
    const take = script!.takes.find((t) => t.id === fixture.takeId)!;
    if (!fixture.editedTakeId) {
      const initial = {
        version: 1 as const,
        ranges: [{ start: 0, end: take.totalFrames / take.fps - 1 / take.fps }],
        gains: {},
        cleanup: false,
      };
      const edited = {
        ...initial,
        ranges: [{ start: 0, end: take.timeline[0].durationFrames / take.fps }],
        gains: { Narrator: 0.7 },
        cleanup: true,
      };
      const saved = await saveAudioEdit({
        kind: "voiceover",
        takeId: take.id,
        history: [initial, edited],
        cursor: 1,
        expectedRevision: 0,
      });
      fixture.editedTakeId = (
        await commitAudioEdit("voiceover", take.id, saved.revision)
      ).takeId;
      await fs.writeFile(
        `${directory}/fixture.json`,
        JSON.stringify(fixture, null, 2),
      );
    }
    const edited = (await getScript(fixture.scriptId))!.takes.find(
      (t) => t.id === fixture.editedTakeId,
    )!;
    const resolved = resolveReelTimeline(
      script!.scenes.map((s) => ({ id: s.id, text: s.spokenText ?? s.text })),
      edited,
      script!.fps,
    );
    assert(
      resolved.takeUsable && resolved.timeline.length === 1,
      "Edited take was not usable in the shared video timeline",
    );
    assert(
      createHash("sha256")
        .update(await getAssetStore().get(row.audioPath))
        .digest("hex") === hash,
      "Source audio changed",
    );
    if (!fixture.podcastId) {
      fixture.podcastId = (
        await createPodcast({
          title: "Factory completion · Local recording",
          description:
            "Real cached Kokoro speech imported and transcribed locally with the approved Whisper small model.",
        })
      ).id;
      await fs.writeFile(
        `${directory}/fixture.json`,
        JSON.stringify(fixture, null, 2),
      );
    }
    if (!fixture.importedTakeId) {
      fixture.importedTakeId = (
        await importPodcastAudio(fixture.podcastId, wav)
      ).id;
      await fs.writeFile(
        `${directory}/fixture.json`,
        JSON.stringify(fixture, null, 2),
      );
    }
    if (!fixture.transcribedTakeId) {
      const transcribed = await transcribePodcastRecording(
        fixture.importedTakeId,
        "en",
      );
      fixture.transcribedTakeId = transcribed.id;
      assert(
        transcribed.timeline.some((c) =>
          /stories|ideas|review|voice/i.test(c.text),
        ),
        "Local transcript does not match the spoken sample",
      );
      await fs.writeFile(
        `${directory}/fixture.json`,
        JSON.stringify(fixture, null, 2),
      );
    }
    if (process.argv.includes("--export")) {
      const { createRender } =
        await import("../src/library/repositories/renders");
      const { runRenderNow } = await import("../src/library/render-service");
      let render: { id: string; status: string } | null = fixture.renderId
        ? await prisma.render.findUnique({ where: { id: fixture.renderId } })
        : null;
      if (!render || render.status === "error") {
        render = await createRender({
          scriptId: fixture.scriptId,
          voiceTakeId: fixture.editedTakeId!,
          quality: "draft",
          name: "Factory completion · Edited local narration",
        });
        fixture.renderId = render.id;
        await fs.writeFile(
          `${directory}/fixture.json`,
          JSON.stringify(fixture, null, 2),
        );
        await runRenderNow({
          renderId: render.id,
          scriptId: fixture.scriptId,
          voiceTakeId: fixture.editedTakeId!,
          quality: "draft",
          serverBaseUrl: "http://127.0.0.1:3020",
        });
      }
      const deadline = Date.now() + 600000;
      while (Date.now() < deadline) {
        const saved = await prisma.render.findUniqueOrThrow({
          where: { id: render.id },
        });
        if (saved.status === "done") {
          console.log(JSON.stringify({ outputPath: saved.outputPath }));
          break;
        }
        if (saved.status === "error")
          throw new Error(saved.error ?? "Export failed");
        if (Date.now() > deadline - 1000) throw new Error("Export timed out");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log(JSON.stringify(fixture));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
