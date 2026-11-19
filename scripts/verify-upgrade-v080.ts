/**
 * `npm run test:upgrade-v080`: a database made by the published v0.8.0 opens and
 * exports with the current code (roadmap L6).
 *
 * It builds the exact v0.8.0 schema from the migrations at the `v0.8.0` git tag,
 * puts a saved project in it (scenes, a voice take with its audio, a render, a
 * brand kit), upgrades it with the real migration script, checks that every saved
 * row survived, and then opens the project and exports a draft MP4 from the
 * saved take. Nothing touches your own data: the database is a temporary file and
 * the media goes under `media/upgrade-check-<id>/`, removed at the end.
 *
 *   npm run test:upgrade-v080 [-- --skip-export]
 *
 * Needs the `v0.8.0` tag (`git fetch --tags`), FFmpeg and Chrome.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import os from "node:os";
import path from "node:path";

const TAG = "v0.8.0";
const skipExport = process.argv.includes("--skip-export");
const root = process.cwd();

const git = (...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

function migrationsAtTag(): Array<{ name: string; sql: string }> {
  try {
    git("rev-parse", "--verify", `${TAG}^{commit}`);
  } catch {
    throw new Error(`The ${TAG} tag is missing. Run: git fetch --tags`);
  }
  return git("ls-tree", "-r", "--name-only", TAG, "prisma/migrations")
    .split("\n")
    .filter((f) => f.endsWith("/migration.sql"))
    .sort()
    .map((file) => ({
      name: path.basename(path.dirname(file)),
      sql: git("show", `${TAG}:${file}`),
    }));
}

/** Insert a row, naming only what the test cares about; a missing required column is reported. */
function insert(
  db: DatabaseSync,
  table: string,
  values: Record<string, unknown>,
): void {
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
    name: string;
    notnull: number;
    dflt_value: unknown;
    pk: number;
  }>;
  const missing = columns.filter(
    (c) => c.notnull && c.dflt_value === null && !(c.name in values),
  );
  assert.equal(
    missing.length,
    0,
    `${table}: required columns not given: ${missing.map((c) => c.name).join(", ")}`,
  );
  const names = Object.keys(values);
  db.prepare(
    `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
  ).run(...(Object.values(values) as never[]));
}

async function main(): Promise<void> {
  const work = mkdtempSync(path.join(os.tmpdir(), "reel-upgrade-v080-"));
  const dbFile = path.join(work, "v080.db");
  const mediaDir = `upgrade-check-${randomUUID().slice(0, 8)}`;
  const mediaRoot = path.join(root, "media", mediaDir);
  mkdirSync(mediaRoot, { recursive: true });
  try {
    // 1. The published v0.8.0 database.
    const published = migrationsAtTag();
    assert.ok(
      published.length > 15,
      `Found only ${published.length} migrations at ${TAG}`,
    );
    const legacy = new DatabaseSync(dbFile);
    legacy.exec(`CREATE TABLE "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL, "logs" TEXT, "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count" INTEGER UNSIGNED NOT NULL DEFAULT 0)`);
    for (const migration of published) {
      legacy.exec(migration.sql);
      insert(legacy, "_prisma_migrations", {
        id: randomUUID(),
        checksum: createHash("sha256").update(migration.sql).digest("hex"),
        finished_at: new Date().toISOString(),
        migration_name: migration.name,
        applied_steps_count: 1,
      });
    }

    // 2. A saved project, with the audio of its voice take on disk.
    const wav = path.join(mediaRoot, "take.wav");
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=330:sample_rate=24000",
      "-t",
      "6",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      "-y",
      wav,
    ]);
    const now = new Date().toISOString();
    insert(legacy, "Project", {
      id: "p1",
      name: "Saved in v0.8.0",
      videoEngine: "hyperframes",
      updatedAt: now,
    });
    insert(legacy, "Script", {
      id: "s1",
      projectId: "p1",
      name: "Saved script",
      updatedAt: now,
    });
    const copy = [
      [
        "hf-opener",
        "Saved in an older version",
        "Saved in an older version of the studio.",
      ],
      [
        "hf-statement",
        "Your projects still open",
        "Your projects still open after an upgrade.",
      ],
      ["hf-cta", "And they still export", "And they still export."],
    ];
    copy.forEach(([templateId, text, spokenText], order) =>
      insert(legacy, "Scene", {
        id: `scene${order}`,
        scriptId: "s1",
        order,
        templateId,
        text,
        spokenText,
        layoutJson: "{}",
        assetRefs: "[]",
        updatedAt: now,
      }),
    );
    insert(legacy, "VoiceTake", {
      id: "take1",
      scriptId: "s1",
      providerId: "kokoro-server",
      voiceId: "af_heart",
      totalFrames: 180,
      timingJson: JSON.stringify(
        copy.map(([, , spoken], i) => ({
          sceneId: `scene${i}`,
          startFrame: i * 60,
          durationFrames: 60,
          text: spoken,
        })),
      ),
      audioPath: `${mediaDir}/take.wav`,
    });
    insert(legacy, "BrandKit", {
      id: "kit1",
      name: "Saved kit",
      updatedAt: now,
    });
    const tables = ["Project", "Script", "Scene", "VoiceTake", "BrandKit"];
    const before = Object.fromEntries(
      tables.map((t) => [
        t,
        legacy.prepare(`SELECT * FROM "${t}" ORDER BY id`).all(),
      ]),
    );
    legacy.close();

    // 3. The real upgrade.
    const env = {
      ...process.env,
      DATABASE_URL: `file:${dbFile}`,
      NEXT_TELEMETRY_DISABLED: "1",
    };
    execFileSync(process.execPath, ["scripts/migrate-database.mjs"], {
      cwd: root,
      env,
      stdio: "pipe",
    });
    const upgraded = new DatabaseSync(dbFile);
    const expected = readdirSync(path.join(root, "prisma/migrations"), {
      withFileTypes: true,
    }).filter((e) => e.isDirectory()).length;
    const applied = (
      upgraded
        .prepare(
          "SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL",
        )
        .get() as { n: number }
    ).n;
    assert.equal(applied, expected, "Every migration in the repository ran");
    assert.deepEqual(upgraded.prepare("PRAGMA foreign_key_check").all(), []);
    for (const table of tables) {
      const after = upgraded
        .prepare(`SELECT * FROM "${table}" ORDER BY id`)
        .all() as Array<Record<string, unknown>>;
      (before[table] as Array<Record<string, unknown>>).forEach((row, i) => {
        for (const [column, value] of Object.entries(row))
          assert.deepEqual(
            after[i]?.[column],
            value,
            `${table}.${column} was preserved`,
          );
      });
    }
    upgraded.close();
    console.log(
      `✓ v0.8.0 database upgraded through ${expected - published.length} newer migrations; ${tables.length} saved tables kept every column`,
    );

    // 4. Open the project and export it, with the current code.
    Object.assign(process.env, env);
    const { getScript } = await import("../src/library/repositories/scripts");
    const { projectToStoryboard } =
      await import("../src/library/project-storyboard");
    const script = await getScript("s1");
    assert.equal(script?.scenes.length, 3, "The saved scenes open");
    const opened = await projectToStoryboard("s1");
    assert.ok(opened, "The saved project opens as a storyboard");
    console.log("✓ the saved project opens");
    if (skipExport) return console.log("(export skipped)");

    const { createRender } =
      await import("../src/library/repositories/renders");
    const { runRenderNow } = await import("../src/library/render-service");
    const { prisma } = await import("../src/library/db");
    const render = await createRender({
      scriptId: "s1",
      voiceTakeId: "take1",
      quality: "draft",
      name: "Upgrade check",
    });
    await runRenderNow({
      renderId: render.id,
      scriptId: "s1",
      voiceTakeId: "take1",
      quality: "draft",
      serverBaseUrl: "http://127.0.0.1:3000",
    });
    const row = await prisma.render.findUniqueOrThrow({
      where: { id: render.id },
    });
    assert.equal(row.status, "done");
    const mp4 = path.join(root, "media", row.outputPath!);
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_type",
          "-of",
          "json",
          mp4,
        ],
        { encoding: "utf8" },
      ),
    ) as {
      format: { duration: string };
      streams: Array<{ codec_type: string }>;
    };
    assert.ok(
      probe.streams.some((s) => s.codec_type === "video"),
      "The export has video",
    );
    assert.ok(
      probe.streams.some((s) => s.codec_type === "audio"),
      "The export has the saved voice take's audio",
    );
    assert.ok(
      Math.abs(Number(probe.format.duration) - 6) < 1,
      `The export is about 6 s (${probe.format.duration})`,
    );
    console.log(
      `✓ the saved project exports a draft MP4 from its saved take (${Number(probe.format.duration).toFixed(1)} s, video and audio)`,
    );
    // The renderer leaves a contact sheet and audio notes beside the MP4; remove them all.
    const renders = path.dirname(mp4);
    for (const file of readdirSync(renders))
      if (file.startsWith(`render-${render.id}`))
        rmSync(path.join(renders, file), { force: true });
    await prisma.$disconnect();
  } finally {
    rmSync(mediaRoot, { recursive: true, force: true });
    rmSync(work, { recursive: true, force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
