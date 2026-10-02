/** Node-only process cleanup probe; also runs on a real Windows CI runner. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { stopProcessTree } from "./process-tree.mjs";
import { supervise } from "./supervise.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stopped = async (pid) => {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") return true;
    throw error;
  }
  // Linux may briefly retain terminated orphans as zombies under CI's init.
  if (process.platform === "linux") {
    const stat = await readFile(`/proc/${pid}/stat`, "utf8").catch(() => "");
    return stat === "" || /^\d+ \(.*\) Z /.test(stat);
  }
  return false;
};
const waitStopped = async (pid) => {
  const deadline = Date.now() + 10000;
  while (!(await stopped(pid)) && Date.now() < deadline) await sleep(50);
  assert.ok(await stopped(pid), `Process ${pid} still running`);
};
for (const mode of ["stubborn", "polite"]) {
  const child = spawn(
    process.execPath,
    ["scripts/fixtures/process-tree-child.mjs", mode],
    {
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const closed = once(child, "close");
  const [data] = await once(child.stdout, "data");
  const ids = JSON.parse(data.toString());
  try {
    await stopProcessTree(child, 100);
    await closed;
    await Promise.all(Object.values(ids).map(waitStopped));
    // Natural exit racing cleanup and repeated cleanup are harmless.
    await stopProcessTree(child, 100);
    console.log(
      `${process.platform}: ${mode} root and detached descendant terminated`,
    );
  } finally {
    await stopProcessTree(child, 100);
    // Isolated fixture only; clean up if an assertion failed.
    for (const pid of Object.values(ids))
      if (!(await stopped(pid))) process.kill(pid, "SIGKILL");
  }
}
// Exercise supervisor wiring and confirm done waits for both owned trees.
const directory = await mkdtemp(path.join(tmpdir(), "reel-tree-probe-"));
const runner = supervise({
  web: [process.execPath, "scripts/fixtures/process-tree-child.mjs"],
  worker: [process.execPath, "scripts/fixtures/process-tree-child.mjs"],
  env: { ...process.env, REEL_PROCESS_TEST_DIRECTORY: directory },
  graceMs: 100,
});
try {
  const deadline = Date.now() + 10000;
  while ((await readdir(directory)).length < 2 && Date.now() < deadline)
    await sleep(50);
  const files = await readdir(directory);
  assert.equal(files.length, 2, "Both supervisor trees must be ready");
  const trees = await Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(path.join(directory, file), "utf8")),
    ),
  );
  runner.stop();
  assert.equal(await runner.done, 0);
  await Promise.all(
    trees.flatMap((tree) => Object.values(tree)).map(waitStopped),
  );
  console.log(`${process.platform}: supervisor shutdown reaped both trees`);
} finally {
  runner.stop();
  await runner.done;
  await rm(directory, { recursive: true, force: true });
}
