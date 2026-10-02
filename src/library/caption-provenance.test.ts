// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveSpokenWordWindows } from "@/lib/spoken-word-windows";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveReelSfxCues } from "@/lib/sfx-cues";
import { motionDirection } from "@/production/motion";

const previousUrl = process.env.DATABASE_URL;
afterEach(async () => {
  const state = globalThis as typeof globalThis & {
    prisma?: { $disconnect(): Promise<void> };
  };
  await state.prisma?.$disconnect();
  delete state.prisma;
  if (previousUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousUrl;
  vi.resetModules();
});
it("migrates old tracks safely, freezes measured provenance, and keeps preview/export protection identical", async () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "reel-caption-provenance-"),
  );
  const filename = path.join(directory, "review.db");
  const db = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort()) {
    if (migration === "20260930000100_caption_take_provenance") {
      db.exec(`INSERT INTO "Project" (id,name,updatedAt) VALUES ('project','Fixture',CURRENT_TIMESTAMP);
        INSERT INTO "Script" (id,projectId,name,updatedAt) VALUES ('script','project','Fixture',CURRENT_TIMESTAMP);
        INSERT INTO "CaptionTrack" (id,scriptId,updatedAt) VALUES ('old-caption','script',CURRENT_TIMESTAMP);`);
    }
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  db.close();
  process.env.DATABASE_URL = `file:${filename}`;
  vi.resetModules();
  const { prisma } = await import("./db");
  try {
    const {
      replaceCaptionTrack,
      listCaptionTracks,
      updateCaptionCue,
      setCaptionTrackEnabled,
      updateCaptionTrackStyle,
    } = await import("./repositories/captions");
    const { captureVideoSnapshot } = await import("./video-snapshot");
    const { prepareVideoComposition } = await import("./render-service");
    const old = (await listCaptionTracks("script"))[0];
    expect(old).toMatchObject({ sourceTakeId: null, sourceFps: null });
    const cue = {
      sceneId: "scene",
      sfxId: "soft-hit",
      offsetSeconds: 0,
      volume: 0.14,
      source: "automatic",
      event: { ...motionDirection("type-impact"), anchor: "impact" },
    };
    await prisma.script.update({
      where: { id: "script" },
      data: {
        sfxJson: JSON.stringify({ enabled: true, cues: [cue] }),
        coverUrl: "/media/cover.png",
      },
    });
    await prisma.scene.create({
      data: {
        id: "scene",
        scriptId: "script",
        order: 0,
        templateId: "hook",
        text: "Measured speech",
        layoutJson: JSON.stringify({ motion: motionDirection("type-impact") }),
      },
    });
    await prisma.voiceTake.create({
      data: {
        id: "audible",
        scriptId: "script",
        providerId: "uploaded",
        voiceId: "uploaded",
        fps: 30,
        totalFrames: 90,
        timingJson: JSON.stringify([
          {
            sceneId: "scene",
            startFrame: 0,
            durationFrames: 90,
            text: "Measured speech",
          },
        ]),
        audioPath: "fixture.wav",
      },
    });
    const track = await replaceCaptionTrack({
      scriptId: "script",
      timingSource: "local-transcription",
      sourceTakeId: "audible",
      sourceFps: 30,
      enabled: true,
      cues: [
        {
          text: "Measured speech",
          startFrame: 0,
          endFrame: 90,
          words: [{ text: "speech", startFrame: 17, endFrame: 35 }],
        },
      ],
    });
    await setCaptionTrackEnabled("script", track.id, false);
    await updateCaptionTrackStyle("script", track.id, track.style);
    for (const videoEngine of ["hyperframes"] as const) {
      await prisma.project.update({
        where: { id: "project" },
        data: { videoEngine },
      });
      const snapshot = await captureVideoSnapshot("script", "audible");
      expect(
        snapshot.script.captionTracks?.find((item) => item.id === track.id),
      ).toMatchObject({
        sourceTakeId: "audible",
        sourceFps: 30,
        enabled: false,
      });
      const resolved = resolveReelTimeline(
        snapshot.script.scenes,
        snapshot.take,
        30,
      );
      const props = prepareVideoComposition(snapshot, resolved).props;
      const preview = resolveReelSfxCues({
        sfxEnabled: true,
        sfxJson: snapshot.script.sfxJson,
        scenes: snapshot.script.scenes,
        videoEngine,
        fps: 30,
        timeline: resolved.timeline,
        spokenWords: resolveSpokenWordWindows(
          snapshot.script.captionTracks,
          "audible",
          30,
        ),
      });
      expect(preview).toEqual([]);
      expect(props.sfxCues).toEqual(preview);
      expect(
        prepareVideoComposition(
          { ...snapshot, take: null },
          { ...resolved, takeUsable: false },
        ).props.sfxCues,
      ).toHaveLength(1);
    }
    const edited = await updateCaptionCue("script", track.cues[0].id, {
      startFrame: 1,
    });
    expect(edited).toMatchObject({ sourceTakeId: null, sourceFps: null });
    expect(resolveSpokenWordWindows([edited], "audible", 30)).toEqual([]);
    const replaced = await replaceCaptionTrack({
      scriptId: "script",
      trackId: track.id,
      timingSource: "imported",
      cues: [{ text: "Manual subtitles", startFrame: 0, endFrame: 80 }],
    });
    expect(replaced).toMatchObject({ sourceTakeId: null, sourceFps: null });
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
