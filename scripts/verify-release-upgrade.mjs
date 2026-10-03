/** Published v0.3.0 upgrade, automatic backup/restore and isolated fresh setup. */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { schemaSignature } from "./migrate-database.mjs";

const root = process.cwd(),
  evidence = path.join(root, ".artifacts/m15-upgrade");
await fs.mkdir(evidence, { recursive: true });
const provenance = JSON.parse(
  await fs.readFile("tests/fixtures/release-v030/provenance.json", "utf8"),
);
const sql = await fs.readFile("tests/fixtures/release-v030/schema.sql", "utf8");
assert.equal(
  createHash("sha256").update(sql).digest("hex"),
  provenance.sqlSha256,
);
const fixture = await fs.mkdtemp(path.join(tmpdir(), "reel-release-upgrade-"));
const filename = path.join(fixture, "legacy.db");
const legacy = new DatabaseSync(filename),
  baseline = new DatabaseSync(":memory:");
legacy.exec(sql);
baseline.exec(
  await fs.readFile(
    "prisma/migrations/20260910000100_baseline/migration.sql",
    "utf8",
  ),
);
assert.equal(
  schemaSignature(legacy),
  schemaSignature(baseline),
  "Published schema matches supported baseline",
);
baseline.close();
const media = path.join(fixture, "media");
await fs.mkdir(media);
await fs.copyFile(
  "public/samples/product-launch-dashboard.svg",
  path.join(media, "image.svg"),
);
await fs.copyFile(
  "docs/assets/examples/portrait-demo.mp4",
  path.join(media, "historical.mp4"),
);
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:sample_rate=44100",
  "-t",
  "1",
  "-c:a",
  "pcm_s16le",
  "-y",
  path.join(media, "take.wav"),
]);
const checksum = async (name) =>
  createHash("sha256")
    .update(await fs.readFile(path.join(media, name)))
    .digest("hex");
const hashes = Object.fromEntries(
  await Promise.all(
    ["image.svg", "historical.mp4", "take.wav"].map(async (name) => [
      name,
      await checksum(name),
    ]),
  ),
);
legacy.exec(`
INSERT INTO Project (id,name,videoEngine,updatedAt) VALUES ('project','Saved release project','remotion',CURRENT_TIMESTAMP);
INSERT INTO Script (id,projectId,name,updatedAt) VALUES ('script','project','Saved script',CURRENT_TIMESTAMP);
INSERT INTO Scene (id,scriptId,"order",templateId,text,spokenText,layoutJson,assetRefs,updatedAt) VALUES ('scene','script',0,'kinetic','Preserved display copy','Preserved spoken copy','{"captions":[{"text":"Legacy caption","startFrame":0,"endFrame":30}]}','["asset"]',CURRENT_TIMESTAMP);
INSERT INTO Asset (id,type,path) VALUES ('asset','image','image.svg');
INSERT INTO VoiceTake (id,scriptId,providerId,voiceId,totalFrames,timingJson,audioPath) VALUES ('take','script','kokoro-server','af_bella',30,'[{"sceneId":"scene","startFrame":0,"durationFrames":30,"text":"Preserved spoken copy"}]','take.wav');
INSERT INTO Render (id,scriptId,voiceTakeId,status,outputPath,updatedAt) VALUES ('render','script','take','done','historical.mp4',CURRENT_TIMESTAMP);
`);
const before = {
  scene: legacy
    .prepare("SELECT text,spokenText,layoutJson,assetRefs FROM Scene")
    .get(),
  take: legacy.prepare("SELECT * FROM VoiceTake").get(),
  render: legacy.prepare("SELECT * FROM Render").get(),
  asset: legacy.prepare("SELECT * FROM Asset").get(),
};
legacy.close();
const env = { ...process.env, DATABASE_URL: `file:${filename}` };
execFileSync(process.execPath, ["scripts/migrate-database.mjs"], {
  cwd: root,
  env,
  stdio: "pipe",
});
const files = await fs.readdir(fixture),
  backup = files.find((name) => name.startsWith("legacy.db.backup-"));
assert.ok(backup, "Migration creates a consistent backup");
const upgraded = new DatabaseSync(filename);
assert.equal(
  upgraded.prepare("SELECT videoEngine FROM Project").get().videoEngine,
  "hyperframes",
);
assert.equal(
  upgraded.prepare("SELECT templateId FROM Scene").get().templateId,
  "hf-opener",
);
assert.deepEqual(
  upgraded
    .prepare("SELECT text,spokenText,layoutJson,assetRefs FROM Scene")
    .get(),
  before.scene,
);
for (const [table, key] of [
  ["VoiceTake", "take"],
  ["Render", "render"],
  ["Asset", "asset"],
]) {
  const current = upgraded.prepare(`SELECT * FROM ${table}`).get();
  for (const [column, value] of Object.entries(before[key]))
    assert.deepEqual(current[column], value, `${table}.${column} is preserved`);
}
assert.equal(
  upgraded
    .prepare(
      "SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL",
    )
    .get().count,
  14,
);
upgraded.exec(
  `INSERT INTO CaptionTrack (id,scriptId,label,language,timingSource,enabled,updatedAt) VALUES ('captions','script','Saved captions','en','imported',1,CURRENT_TIMESTAMP); INSERT INTO CaptionCue (id,trackId,"order",startFrame,endFrame,text,updatedAt) VALUES ('cue','captions',0,0,30,'Saved subtitle',CURRENT_TIMESTAMP);`,
);
upgraded.close();
execFileSync(process.execPath, ["scripts/migrate-database.mjs"], {
  cwd: root,
  env,
  stdio: "pipe",
});
const again = new DatabaseSync(filename);
assert.equal(
  again.prepare("SELECT text FROM CaptionCue").get().text,
  "Saved subtitle",
);
again.close();
await fs.copyFile(
  path.join(fixture, backup),
  path.join(fixture, "restored.db"),
);
const restored = new DatabaseSync(path.join(fixture, "restored.db"));
assert.equal(
  restored.prepare("SELECT videoEngine FROM Project").get().videoEngine,
  "remotion",
);
assert.deepEqual(
  restored.prepare("SELECT * FROM VoiceTake").get(),
  before.take,
);
assert.deepEqual(restored.prepare("SELECT * FROM Render").get(), before.render);
restored.close();
for (const [name, hash] of Object.entries(hashes))
  assert.equal(await checksum(name), hash);
// Copy only setup scripts. Linked code/tools run with a separate working directory,
// empty environment placeholders, database and media; no user files are changed.
const fresh = path.join(fixture, "fresh");
await fs.mkdir(fresh);
await fs.cp(path.join(root, "scripts"), path.join(fresh, "scripts"), {
  recursive: true,
});
for (const name of ["node_modules", "src", "prisma", "docs", "public"])
  await fs.symlink(path.join(root, name), path.join(fresh, name), "dir");
for (const name of [
  "package.json",
  "tsconfig.json",
  "prisma.config.ts",
  ".env.example",
])
  await fs.copyFile(path.join(root, name), path.join(fresh, name));
let freshResult;
try {
  freshResult = execFileSync(process.execPath, ["scripts/setup.mjs"], {
    cwd: fresh,
    env: {
      ...process.env,
      DATABASE_URL: `file:${fresh}/fresh.db`,
      VOICEFORGE_SERVICE_URL: "",
      CARTESIA_API_KEY: "",
      ELEVENLABS_API_KEY: "",
      GEMINI_API_KEY: "",
      OPENAI_API_KEY: "",
      MCP_API_TOKEN: "",
      MCP_NAMED_TOKENS: "",
    },
    encoding: "utf8",
    timeout: 120000,
  });
} catch (error) {
  await fs.writeFile(
    path.join(evidence, "fresh-setup.log"),
    String(error.stdout) + String(error.stderr),
  );
  throw error;
}
await fs.writeFile(path.join(evidence, "fresh-setup.log"), freshResult);
const freshDb = new DatabaseSync(path.join(fresh, "fresh.db"));
assert.ok(
  freshDb.prepare("SELECT count(*) AS count FROM Project").get().count > 0,
);
assert.equal(
  freshDb
    .prepare(
      "SELECT count(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL",
    )
    .get().count,
  14,
);
freshDb.close();
await fs.writeFile(
  path.join(evidence, "report.json"),
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      publishedSource: provenance,
      migrations: 14,
      backupRestore: true,
      copy: true,
      media: hashes,
      voiceTakes: true,
      historicalExports: true,
      legacyCaptionPayload: true,
      captionTracksAfterUpgrade: true,
      freshSetup: true,
    },
    null,
    2,
  ) + "\n",
);
await fs.rm(fixture, { recursive: true, force: true });
console.log(
  "Published v0.3.0 populated upgrade, backup/restore, saved media/copy/takes/exports/captions and isolated fresh setup passed.",
);
