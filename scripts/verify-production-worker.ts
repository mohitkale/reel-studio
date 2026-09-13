/** Real worker/engine regression with an isolated database; never touches user rows. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const directory = path.resolve(
    ".artifacts",
    `production-worker-${Date.now()}`,
  );
  await mkdir(directory, { recursive: true });
  process.env.DATABASE_URL = `file:${directory}/test.db`;
  const db = new DatabaseSync(path.join(directory, "test.db"));
  for (const migration of (await readdir("prisma/migrations")).sort()) {
    if (migration.endsWith(".toml")) continue;
    db.exec(
      await readFile(
        path.join("prisma/migrations", migration, "migration.sql"),
        "utf8",
      ),
    );
  }
  db.close();
  const { prisma } = await import("../src/library/db");
  const { captureVideoSnapshot } =
    await import("../src/library/video-snapshot");
  const { createRender } = await import("../src/library/repositories/renders");
  const { enqueueProductionJob, requestProductionJobCancellation } =
    await import("../src/library/repositories/production-jobs");
  const { runProductionWorkerOnce } =
    await import("../src/library/production-worker");
  const { executeProductionJob } =
    await import("../src/library/production-job-executor");
  const renderPids = async () => {
    const { stdout } = await promisify(execFile)("ps", ["-axo", "pid,command"]);
    return stdout
      .split("\n")
      .filter((line) =>
        /chrome-headless|Chrome for Testing|hyperframes-render-worker|ffmpeg/.test(
          line,
        ),
      )
      .map((line) => Number(line.trim().split(/\s+/)[0]));
  };
  const baselinePids = new Set(await renderPids());
  const evidence: unknown[] = [];
  try {
    for (const engine of ["remotion", "hyperframes"] as const) {
      for (const cancel of [false, true]) {
        const project = await prisma.project.create({
          data: {
            name: "PR 1 isolated worker regression",
            videoEngine: engine,
          },
        });
        const script = await prisma.script.create({
          data: {
            projectId: project.id,
            name: "Immutable fixture",
            width: 480,
            height: 854,
            fps: 24,
            sfxEnabled: false,
            scenes: {
              create: [
                {
                  order: 0,
                  templateId: engine === "hyperframes" ? "hf-opener" : "hook",
                  text: cancel
                    ? "This longer rendering verifies active cancellation. ".repeat(
                        30,
                      )
                    : "Local production works.",
                },
              ],
            },
          },
        });
        const snapshot = await captureVideoSnapshot(script.id);
        const render = await createRender({
          scriptId: script.id,
          quality: "draft",
        });
        const input = {
          kind: "video" as const,
          idempotencyKey: `worker-${render.id}`,
          inputSnapshot: {
            renderId: render.id,
            scriptId: script.id,
            quality: "draft",
            snapshot,
          },
        };
        const job = await enqueueProductionJob(input);
        assert.equal((await enqueueProductionJob(input)).id, job.id);
        await prisma.scene.updateMany({
          where: { scriptId: script.id },
          data: { text: "Edited after submission" },
        });
        let requested = false;
        let polling = false;
        const timer = cancel
          ? setInterval(() => {
              if (polling || requested) return;
              polling = true;
              void prisma.render
                .findUniqueOrThrow({ where: { id: render.id } })
                .then(async (row) => {
                  if (
                    row.status === "rendering" &&
                    row.progress > (engine === "hyperframes" ? 0.4 : 0.03)
                  ) {
                    requested = true;
                    await requestProductionJobCancellation(job.id);
                  }
                })
                .finally(() => {
                  polling = false;
                });
            }, 100)
          : undefined;
        let result;
        try {
          result = await runProductionWorkerOnce({
            workerId: "regression",
            leaseMs: 3000,
            execute: executeProductionJob,
          });
        } finally {
          clearInterval(timer);
        }
        const saved = await prisma.productionJob.findUniqueOrThrow({
          where: { id: job.id },
          include: { steps: true, outputs: true },
        });
        assert.equal(
          result,
          cancel ? "canceled" : "succeeded",
          saved.error ?? "Unexpected terminal state",
        );
        assert.equal(saved.leaseOwner, null);
        if (cancel) {
          assert.deepEqual(
            (await renderPids()).filter((pid) => !baselinePids.has(pid)),
            [],
            "No renderer children may survive cancellation",
          );
          assert.ok(requested, "Cancellation must occur during rendering");
          assert.equal(saved.outputs.length, 0);
          await assert.rejects(
            stat(path.resolve("media", "renders", `render-${render.id}.mp4`)),
          );
          await assert.rejects(
            stat(path.resolve("media", "hf-work", render.id)),
          );
        } else {
          assert.equal(saved.steps.length, 8);
          assert.ok(
            saved.steps.every(
              (step) =>
                step.state === "succeeded" && step.cacheKey && step.detailJson,
            ),
          );
          assert.equal(saved.outputs.length, 1);
          const plan = JSON.parse(
            saved.steps.find((step) => step.key === "plan")!.detailJson!,
          );
          assert.equal(plan.script.scenes[0].text, "Local production works.");
        }
        evidence.push({
          engine,
          cancel,
          result,
          jobId: job.id,
          steps: saved.steps.map((step) => ({
            key: step.key,
            state: step.state,
            cacheKey: step.cacheKey,
          })),
          outputs: saved.outputs.map((output) => ({
            path: output.path,
            checksum: output.checksum,
          })),
        });
        console.log(
          `[worker-regression] ${engine} ${cancel ? "active cancellation" : "verified output"}: passed`,
        );
      }
    }
    await writeFile(
      path.join(directory, "evidence.json"),
      JSON.stringify(evidence, null, 2) + "\n",
    );
    console.log(`Evidence: ${directory}`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
