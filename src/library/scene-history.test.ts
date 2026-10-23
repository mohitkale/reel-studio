// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { createPrismaClient } from "./prisma-client";
import { saveStudioPreset } from "./repositories/studio-presets";
import { recordSceneEdit, moveSceneHistory } from "./scene-history";

describe("persistent scene history", () => {
  let directory: string;
  let client: ReturnType<typeof createPrismaClient>;
  let previous: string | undefined;
  let sceneId: string;
  let scriptId: string;
  beforeEach(async () => {
    directory = mkdtempSync(path.join(tmpdir(), "reel-history-"));
    const filename = path.join(directory, "history.db");
    const db = new DatabaseSync(filename);
    for (const migration of readdirSync("prisma/migrations").sort()) {
      if (migration.startsWith("20"))
        db.exec(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
    }
    db.close();
    previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${filename}`;
    client = createPrismaClient();
    const project = await client.project.create({
      data: { name: "History test" },
    });
    const script = await client.script.create({
      data: { name: "Script", projectId: project.id },
    });
    scriptId = script.id;
    sceneId = (
      await client.scene.create({
        data: {
          scriptId,
          order: 0,
          templateId: "hf-statement",
          text: "Original",
        },
      })
    ).id;
  });
  afterEach(async () => {
    await client.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    rmSync(directory, { recursive: true, force: true });
  });
  async function edit(text: string) {
    await client.$transaction(async (tx) => {
      const before = await tx.scene.findUniqueOrThrow({
        where: { id: sceneId },
      });
      const after = await tx.scene.update({
        where: { id: sceneId },
        data: { text },
      });
      await recordSceneEdit(tx, before, after);
    });
  }
  it("undoes and redoes in order, and discards redo after a new edit", async () => {
    await edit("First");
    await edit("Second");
    await moveSceneHistory(scriptId, "undo", client);
    expect(
      (await client.scene.findUniqueOrThrow({ where: { id: sceneId } })).text,
    ).toBe("First");
    await moveSceneHistory(scriptId, "undo", client);
    expect(
      (await client.scene.findUniqueOrThrow({ where: { id: sceneId } })).text,
    ).toBe("Original");
    await moveSceneHistory(scriptId, "redo", client);
    await edit("Replacement");
    await expect(moveSceneHistory(scriptId, "redo", client)).rejects.toThrow(
      "Nothing to redo",
    );
    await moveSceneHistory(scriptId, "undo", client);
    expect(
      (await client.scene.findUniqueOrThrow({ where: { id: sceneId } })).text,
    ).toBe("First");
  });
  it("refuses to overwrite an intervening automated edit", async () => {
    await edit("Manual");
    await client.scene.update({
      where: { id: sceneId },
      data: { text: "New automated result" },
    });
    await expect(moveSceneHistory(scriptId, "undo", client)).rejects.toThrow(
      "changed since",
    );
    expect(
      (await client.scene.findUniqueOrThrow({ where: { id: sceneId } })).text,
    ).toBe("New automated result");
    expect(await client.sceneEdit.count({ where: { undone: true } })).toBe(0);
  });
  it("rolls back the edit and its history together", async () => {
    await expect(
      client.$transaction(async (tx) => {
        const before = await tx.scene.findUniqueOrThrow({
          where: { id: sceneId },
        });
        const after = await tx.scene.update({
          where: { id: sceneId },
          data: { text: "Should roll back" },
        });
        await recordSceneEdit(tx, before, after);
        throw new Error("Interrupted save");
      }),
    ).rejects.toThrow("Interrupted save");
    expect(await client.sceneEdit.count()).toBe(0);
    expect(
      (await client.scene.findUniqueOrThrow({ where: { id: sceneId } })).text,
    ).toBe("Original");
  });
  it("does not record unchanged saves", async () => {
    await edit("Original");
    expect(await client.sceneEdit.count()).toBe(0);
  });
  it("preserves pronunciation rules when updating only a saved voice", async () => {
    const pronunciations = [
      { find: "SQL", replaceWith: "sequel", caseSensitive: false },
    ];
    await saveStudioPreset({ name: "Show voice", pronunciations }, client);
    const saved = await saveStudioPreset(
      {
        name: "Show voice",
        voice: { providerId: "kokoro", voiceId: "af_heart" },
      },
      client,
    );
    expect(JSON.parse(saved.documentJson)).toMatchObject({
      pronunciations,
      voice: { voiceId: "af_heart" },
    });
    const cleared = await saveStudioPreset(
      { name: "Show voice", pronunciations: [] },
      client,
    );
    expect(JSON.parse(cleared.documentJson)).toMatchObject({
      pronunciations: [],
      voice: { voiceId: "af_heart" },
    });
  });
});
