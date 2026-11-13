// @vitest-environment node
import { backup, DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";

const m = vi.hoisted(() => ({
  db: null as PrismaClient | null,
  generate: vi.fn(),
  authorize: vi.fn(),
}));
vi.mock("@/library/db", () => ({
  get prisma() {
    return m.db!;
  },
}));
import { readProductProof, controlProductProof } from "./product-proof-service";
import { getScript } from "./repositories/scripts";
import { captureVideoSnapshot } from "./video-snapshot";
import { restoreProductionRevision } from "./restore-production-revision";
import { getAssetUsage } from "./asset-usage";
import { moveSceneHistory } from "./scene-history";
import { productProofControlSchema } from "@/production/product-proof";
vi.setConfig({ testTimeout: 15_000, hookTimeout: 20_000 });
const root = mkdtempSync(path.join(tmpdir(), "reel-product-proof-"));
let previous: string | undefined;
beforeAll(async () => {
  const db = new DatabaseSync(":memory:");
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => !name.endsWith(".toml"))
    .sort())
    db.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  await backup(db, path.join(root, "proof.db"));
  db.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${path.join(root, "proof.db")}`;
  m.db = createPrismaClient();
});
afterAll(async () => {
  await m.db?.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(root, { recursive: true, force: true });
});
beforeEach(async () => {
  await m.db!.project.deleteMany();
  await m.db!.sceneEdit.deleteMany();
  await m.db!.asset.deleteMany();
});
const dependencies = {
  exists: async () => true,
  url: (key: string) => `/media/${key}`,
  probeVideo: async () => ({ width: 1920, height: 1080, durationSec: 20 }),
};
async function setup() {
  const project = await m.db!.project.create({
    data: {
      name: "Supplied proof",
      scripts: {
        create: {
          name: "Proof",
          brandOverrides: JSON.stringify({
            productionPreset: { id: "product-launch", version: "1.0.0" },
          }),
          scenes: {
            create: [
              {
                text: "Review linked sources.",
                spokenText:
                  "Review the actual source excerpts before you publish a claim.",
                templateId: "hf-statement",
                order: 0,
              },
              {
                text: "Keep the approved copy.",
                spokenText:
                  "Change a supplied visual while retaining the approved narration and source links.",
                templateId: "hf-statement",
                order: 1,
              },
            ],
          },
        },
      },
    },
    include: {
      scripts: { include: { scenes: { orderBy: { order: "asc" } } } },
    },
  });
  const script = project.scripts[0],
    image = await m.db!.asset.create({
      data: { type: "image", path: "proof.png", name: "Supplied screenshot" },
    }),
    video = await m.db!.asset.create({
      data: { type: "video", path: "proof.mp4", name: "Supplied recording" },
    });
  const features = [
    {
      id: "sources",
      label: "Source review",
      subjectLabel: "Reel Studio",
      sceneIds: [script.scenes[0].id],
      assets: [{ assetId: image.id, startSeconds: 0 }],
    },
    {
      id: "revisions",
      label: "Scoped revisions",
      subjectLabel: "Reel Studio",
      sceneIds: [script.scenes[1].id],
      assets: [{ assetId: video.id, startSeconds: 2.5 }],
    },
  ];
  await controlProductProof(
    script.id,
    {
      action: "save",
      expectedHash: (await readProductProof(script.id)).sourceHash,
      features,
    },
    dependencies,
  );
  return { scriptId: script.id, scenes: script.scenes, image, video, features };
}
it("maps supplied proof to recurring subjects and changes only visuals with guarded preview/apply/undo", async () => {
  const { scriptId, scenes, image } = await setup(),
    context = await readProductProof(scriptId);
  expect(context.plan!.subjects).toHaveLength(1);
  expect(context.plan!.features[0].subjectId).toBe(
    context.plan!.features[1].subjectId,
  );
  const input = {
    action: "preview" as const,
    expectedHash: context.sourceHash,
    featureId: "sources",
    assetId: image.id,
  };
  const preview = await controlProductProof(scriptId, input, dependencies);
  expect(preview.state).toBe("preview");
  expect(
    await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[0].id } }),
  ).toEqual(scenes[0]);
  await controlProductProof(
    scriptId,
    { ...input, action: "apply" },
    dependencies,
  );
  const after = await getScript(scriptId);
  expect(after!.scenes[0]).toMatchObject({
    text: scenes[0].text,
    spokenText: scenes[0].spokenText,
    templateId: "hf-opener",
    motion: { recipeId: "media-device" },
    proof: {
      featureId: "sources",
      assetId: image.id,
      sourceStatus: "supplied_unverified",
    },
  });
  expect(
    await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[1].id } }),
  ).toEqual(scenes[1]);
  await expect(
    controlProductProof(scriptId, { ...input, action: "apply" }, dependencies),
  ).rejects.toMatchObject({ status: 409 });
  await moveSceneHistory(scriptId, "undo");
  expect(
    (await m.db!.scene.findUniqueOrThrow({ where: { id: scenes[0].id } }))
      .layoutJson,
  ).toBe(scenes[0].layoutJson);
});
it("retains video cues and proof mappings through immutable capture and restored scene identities", async () => {
  const { scriptId, video } = await setup();
  await controlProductProof(
    scriptId,
    {
      action: "apply",
      expectedHash: (await readProductProof(scriptId)).sourceHash,
      featureId: "revisions",
      assetId: video.id,
    },
    dependencies,
  );
  const frozen = await captureVideoSnapshot(scriptId);
  expect(frozen.script.scenes[1].background).toMatchObject({
    type: "video",
    startSeconds: 2.5,
  });
  expect(frozen.script.productProof!.features[1].assets[0].startSeconds).toBe(
    2.5,
  );
  const restored = await restoreProductionRevision(frozen),
    copy = await getScript(restored.scriptId);
  expect(copy!.scenes[1].background).toEqual(
    frozen.script.scenes[1].background,
  );
  expect(copy!.scenes[1].proof).toEqual(frozen.script.scenes[1].proof);
  expect(copy!.productProof!.features[1].sceneIds).toEqual([
    copy!.scenes[1].id,
  ]);
  expect(copy!.scenes[1].text).toBe(frozen.script.scenes[1].text);
});
it("flags missing proof, keeps mapped assets retained and refuses locked or out-of-file changes", async () => {
  const { scriptId, scenes, image, video, features } = await setup();
  const usage = await getAssetUsage(image.id, m.db!);
  expect(usage!.scripts.map((s) => s.id)).toContain(scriptId);
  await m.db!.scene.update({
    where: { id: scenes[0].id },
    data: {
      layoutJson: JSON.stringify({
        locks: { copy: false, assets: true, scene: false },
      }),
    },
  });
  await expect(
    controlProductProof(
      scriptId,
      {
        action: "apply",
        expectedHash: (await readProductProof(scriptId)).sourceHash,
        featureId: "sources",
        assetId: image.id,
      },
      dependencies,
    ),
  ).rejects.toMatchObject({ status: 409 });
  const invalid = features.map((f) =>
    f.id === "revisions"
      ? { ...f, assets: [{ assetId: video.id, startSeconds: 25 }] }
      : f,
  );
  await controlProductProof(
    scriptId,
    {
      action: "save",
      expectedHash: (await readProductProof(scriptId)).sourceHash,
      features: invalid,
    },
    dependencies,
  );
  await expect(
    controlProductProof(
      scriptId,
      {
        action: "preview",
        expectedHash: (await readProductProof(scriptId)).sourceHash,
        featureId: "revisions",
        assetId: video.id,
      },
      dependencies,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const missing = invalid.map((f) =>
    f.id === "revisions" ? { ...f, assets: [] } : f,
  );
  await controlProductProof(
    scriptId,
    {
      action: "save",
      expectedHash: (await readProductProof(scriptId)).sourceHash,
      features: missing,
    },
    dependencies,
  );
  expect(
    (await readProductProof(scriptId)).findings.some((f) =>
      f.message.includes("no supplied artifact"),
    ),
  ).toBe(true);
  await controlProductProof(
    scriptId,
    {
      action: "apply",
      expectedHash: (await readProductProof(scriptId)).sourceHash,
      featureId: "revisions",
    },
    dependencies,
  );
  const after = await getScript(scriptId);
  expect(after!.scenes[1]).toMatchObject({
    text: scenes[1].text,
    templateId: "hf-statement",
    proof: { sourceStatus: "missing" },
  });
  expect(after!.scenes[1].background).toBeUndefined();
  expect(
    productProofControlSchema.safeParse({
      action: "save",
      expectedHash: "a".repeat(64),
      features: [{ ...features[0], sceneIds: [scenes[0].id, scenes[0].id] }],
    }).success,
  ).toBe(false);
});
it("does not present a later unrelated background as the mapped product proof", async () => {
  const { scriptId, scenes, image } = await setup();
  await controlProductProof(
    scriptId,
    {
      action: "apply",
      expectedHash: (await readProductProof(scriptId)).sourceHash,
      featureId: "sources",
      assetId: image.id,
    },
    dependencies,
  );
  const row = await m.db!.scene.findUniqueOrThrow({
      where: { id: scenes[0].id },
    }),
    config = JSON.parse(row.layoutJson!);
  config.background.url = "/media/other.png";
  await m.db!.scene.update({
    where: { id: row.id },
    data: { layoutJson: JSON.stringify(config) },
  });
  expect((await getScript(scriptId))!.scenes[0].proof).toBeUndefined();
  expect(
    (await readProductProof(scriptId)).findings.some((f) =>
      f.message.includes("differs from the applied proof"),
    ),
  ).toBe(true);
});
