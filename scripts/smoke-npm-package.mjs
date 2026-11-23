/** Run an actual tarball from an empty directory. Intended for disposable CI hosts. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const input = process.argv[2];
if (!input || !process.env.npm_execpath)
  throw new Error("Use npm run package:smoke -- <reel-studio-package.tgz>");
const archive = path.resolve(input);
const cwd = await mkdtemp(path.join(tmpdir(), "reel package smoke "));
const home = path.join(cwd, "studio files");
const env = {
  ...process.env,
  REEL_STUDIO_HOME: home,
  REEL_STUDIO_NO_OPEN: "1",
  PUPPETEER_SKIP_DOWNLOAD: "1",
  ONNXRUNTIME_NODE_INSTALL_CUDA: "skip",
};
delete env.DATABASE_URL;
delete env.REEL_STUDIO_MEDIA_DIR;
delete env.REEL_STUDIO_MODEL_CACHE_DIR;

try {
  const start = performance.now();
  const stdout = execFileSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "exec",
      "--yes",
      "--package",
      archive,
      "--",
      "reel-studio",
    ],
    {
      env,
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      timeout: 120_000,
    },
  );
  const url = stdout.match(/^http:\/\/127\.0\.0\.1:\d+$/m)?.[0];
  assert.ok(url, "The installed CLI did not report a loopback URL");
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Reel Studio/i);
  assert.ok((await stat(path.join(home, "studio.db"))).size > 0);
  assert.ok((await stat(path.join(home, "media"))).isDirectory());
  assert.ok((await stat(path.join(home, "models"))).isDirectory());
  const elapsed = (performance.now() - start) / 1000;
  console.log(
    `Installed studio served its home screen in ${elapsed.toFixed(2)} s on ${process.platform}`,
  );
  assert.ok(elapsed < 120, "First start exceeded two minutes");
} catch (error) {
  const log = await readFile(path.join(home, "engine.log"), "utf8").catch(
    () => "",
  );
  if (log) console.error(log.slice(-10_000));
  throw error;
} finally {
  const engine = JSON.parse(
    await readFile(path.join(home, "engine.json"), "utf8").catch(() => "{}"),
  );
  if (Number.isSafeInteger(engine.pid) && engine.pid > 0) {
    try {
      process.kill(engine.pid, "SIGTERM");
    } catch {
      /* already stopped */
    }
  }
}
