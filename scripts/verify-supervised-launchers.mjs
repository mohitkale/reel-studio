/** Live dev/start supervision checks using only an isolated regression database. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const database = process.argv[2];
if (
  !database ||
  !path.resolve(database).startsWith(path.resolve(".artifacts") + path.sep)
)
  throw new Error("Pass an isolated .artifacts database");
const evidence = [];
for (const [index, mode] of ["start", "dev"].entries()) {
  const port = 3290 + index;
  let log = "";
  const runner = spawn(
    process.execPath,
    ["scripts/supervise.mjs", mode, "--port", String(port)],
    {
      env: {
        ...process.env,
        DATABASE_URL: `file:${path.resolve(database)}`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  runner.stdout.on("data", (data) => {
    log += data.toString();
  });
  runner.stderr.on("data", (data) => {
    log += data.toString();
  });
  const closed = once(runner, "close");
  const waitFor = async (predicate) => {
    const end = Date.now() + 90000;
    while (!predicate()) {
      if (runner.exitCode !== null || Date.now() > end)
        throw new Error(`${mode} launcher failed or timed out\n${log}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };
  try {
    await waitFor(
      () => log.includes("[production-worker]") && log.includes(" ready"),
    );
    const response = await fetch(`http://127.0.0.1:${port}/api/projects`);
    assert.equal(response.status, 200);
    const first = Number([...log.matchAll(/worker started pid=(\d+)/g)][0][1]);
    process.kill(first, "SIGKILL");
    await waitFor(
      () => [...log.matchAll(/worker started pid=(\d+)/g)].length === 2,
    );
    await waitFor(
      () => [...log.matchAll(/\[production-worker\].* ready/g)].length === 2,
    );
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/api/projects`)).status,
      200,
    );
    runner.kill("SIGTERM");
    const [code] = await closed;
    assert.equal(code, 0);
    for (const match of log.matchAll(/(?:web|worker) started pid=(\d+)/g))
      assert.throws(() => process.kill(Number(match[1]), 0));
    evidence.push({
      mode,
      httpStatus: response.status,
      workerRestart: true,
      cleanShutdown: true,
    });
    console.log(
      `${mode}: web + worker startup, worker crash/restart, REST, shutdown passed`,
    );
  } finally {
    if (runner.exitCode === null) {
      runner.kill("SIGTERM");
      await closed;
    }
    await writeFile(path.resolve(".artifacts", `launcher-${mode}.log`), log);
  }
}
await writeFile(
  path.resolve(".artifacts/launcher-validation.json"),
  JSON.stringify(evidence, null, 2) + "\n",
);
