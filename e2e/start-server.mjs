/**
 * Starts what the browser tests talk to: a throwaway install (its own data
 * folder and SQLite file, migrated), a fake local writer that answers with a
 * canned storyboard (no network, no AI), and the studio on a fixed port.
 *
 * E2E_SERVER=start uses the production build (CI); the default is dev mode.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pcmToWav } from "../src/lib/wav.ts";

const PORT = process.env.E2E_PORT ?? "3187";
const WRITER_PORT = Number(process.env.E2E_WRITER_PORT ?? "3199");
const home = mkdtempSync(path.join(os.tmpdir(), "reel-e2e-"));
const reply = readFileSync(
  new URL("./fixtures/written.storyboard.json", import.meta.url),
  "utf8",
);

const env = {
  ...process.env,
  REEL_STUDIO_HOME: home,
  DATABASE_URL: `file:${path.join(home, "e2e.db")}`,
  // A developer's .env.local keys must not leak into the tests.
  GEMINI_API_KEY: "",
  OPENAI_API_KEY: "",
  CARTESIA_API_KEY: "",
  ELEVENLABS_API_KEY: "",
  UNSPLASH_ACCESS_KEY: "",
  PEXELS_API_KEY: "",
  PIXABAY_API_KEY: "",
  VOICEFORGE_SERVICE_URL: `http://127.0.0.1:${WRITER_PORT}`,
  VOICEFORGE_API_TOKEN: "",
  NEXT_TELEMETRY_DISABLED: "1",
  // CI reuses the build it just made; elsewhere the tests keep to their own folder.
  REEL_NEXT_DIST_DIR: process.env.E2E_REUSE_BUILD ? ".next" : ".next-e2e",
};

const migrate = spawnSync(process.execPath, ["scripts/migrate-database.mjs"], {
  env,
  stdio: "inherit",
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

// A deterministic local tone stands in for each voiced scene in the retry journey.
const voiceRate = 24_000;
const voiceSamples = voiceRate * 9;
const voicePcm = Buffer.alloc(voiceSamples * 2);
for (let i = 0; i < voiceSamples; i++) {
  voicePcm.writeInt16LE(
    Math.round(1500 * Math.sin((i * 2 * Math.PI * 180) / voiceRate)),
    i * 2,
  );
}
const voiceWav = pcmToWav(voicePcm, { sampleRate: voiceRate });
let voiceReady = false;

/** Local fixtures for the Ollama writer and the VoiceForge retry scenario. */
const writer = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/api/tags") {
    res.end(JSON.stringify({ models: [{ name: "fixture:latest" }] }));
  } else if (req.url === "/api/chat") {
    req.resume();
    req.on("end", () =>
      res.end(
        JSON.stringify({ message: { role: "assistant", content: reply } }),
      ),
    );
  } else if (req.method === "POST" && req.url === "/__fixture/voice-ready") {
    voiceReady = true;
    res.end("{}");
  } else if (req.url === "/v1/engines" || req.url === "/v1/voices") {
    res.end("[]");
  } else if (req.method === "POST" && req.url === "/v1/synthesize") {
    req.resume();
    req.on("end", () => {
      if (!voiceReady) {
        res.statusCode = 422;
        res.end(JSON.stringify({ detail: "Fixture voice is unavailable" }));
        return;
      }
      res.setHeader("content-type", "audio/wav");
      res.end(voiceWav);
    });
  } else {
    res.statusCode = 404;
    res.end("{}");
  }
});
writer.listen(WRITER_PORT, "127.0.0.1");

const mode = process.env.E2E_SERVER === "start" ? "start" : "dev";
if (mode === "start" && !process.env.E2E_REUSE_BUILD) {
  // A production run needs its own build in the same folder.
  const build = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "build", "--webpack"],
    { env, stdio: "inherit" },
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const app = spawn(
  process.execPath,
  ["scripts/supervise.mjs", mode, "-p", PORT],
  { env, stdio: "inherit", detached: process.platform !== "win32" },
);
let stopping = false;
/** Signal the studio's whole process group: `next dev` leaves a server and a worker behind otherwise. */
const signalApp = (signal) => {
  try {
    if (process.platform === "win32") app.kill(signal);
    else process.kill(-app.pid, signal);
  } catch {
    // Already gone.
  }
};
const stop = () => {
  if (stopping) return;
  stopping = true;
  writer.close();
  signalApp("SIGTERM");
  setTimeout(() => {
    signalApp("SIGKILL");
    process.exit(0);
  }, 8_000);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
app.on("exit", (code) => {
  writer.close();
  // The supervisor can exit while its children still run; make sure they do not.
  if (stopping) signalApp("SIGKILL");
  process.exit(stopping ? 0 : (code ?? 0));
});
