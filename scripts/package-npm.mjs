/** Build a staged npm distribution from the checked-in source. Never publish. */
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildVoicePack } from "./package-voice-pack.mjs";
import { checkPhonemizerProvenance } from "./check-phonemizer-provenance.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { values } = parseArgs({
  options: { "voice-source": { type: "string" } },
});
if (!values["voice-source"] || !process.env.npm_execpath)
  throw new Error(
    "Use npm run package:npm -- --voice-source <phonemizer corresponding-source archive>",
  );
const voiceSource = path.resolve(values["voice-source"]);
await checkPhonemizerProvenance({ distribution: true, archive: voiceSource });

const require = createRequire(import.meta.url);
const manifest = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const lock = JSON.parse(
  await readFile(path.join(root, "package-lock.json"), "utf8"),
);
const directory = path.join(root, ".artifacts", "npm-package");
await mkdir(directory, { recursive: true });
const work = await mkdtemp(path.join(directory, "candidate-"));
const buildRoot = path.join(work, "build");
const staged = path.join(work, "package");
const dist = ".next-package";
const rootFiles = new Set([
  "LICENSE",
  "README.md",
  "tsconfig.json",
  "next.config.ts",
  "package.json",
  "postcss.config.mjs",
  "prisma.config.ts",
  "prisma/schema.prisma",
]);
const runtimeScripts = new Set([
  "database-url.mjs",
  "doctor.ts",
  "hyperframes-render-worker.mjs",
  "hyperframes-review-hook.mts",
  "hyperframes-section-render.ts",
  "installed-environment.mjs",
  "migrate-database.mjs",
  "process-tree.mjs",
  "production-worker.ts",
  "supervise.mjs",
]);
const projectFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const developmentOnly =
  /(?:^|\/)(?:fixtures?|__tests__|__mocks__)(?:\/|\.)|\.(?:int\.)?(?:test|spec|fixture)\.[^/]+$/;
function isRuntime(file) {
  if (
    developmentOnly.test(file) ||
    file === "src/production/editorial-benchmark.ts"
  )
    return false;
  const [top, next] = file.split("/");
  return (
    rootFiles.has(file) ||
    ["src", "public", "bin", "schemas"].includes(top) ||
    (top === "scripts" && runtimeScripts.has(next)) ||
    (top === "mcp" && next === "src") ||
    (top === "prisma" && next === "migrations") ||
    (top === "examples" && next === "storyboards") ||
    file === "docs/prompts/storyboard-writer.md"
  );
}
async function copyFiles(from, to, files) {
  for (const file of files) {
    const destination = path.join(to, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(from, file), destination, { recursive: true });
  }
}

// Next's standalone trace of the live checkout can copy .env, media and local
// data. Build from allowlisted source in an isolated directory even on laptops.
const sources = projectFiles.filter(isRuntime);
await copyFiles(root, buildRoot, sources);
await symlink(
  path.join(root, "node_modules"),
  path.join(buildRoot, "node_modules"),
  "junction",
);
const buildEnv = {
  ...process.env,
  REEL_NEXT_DIST_DIR: dist,
  REEL_STUDIO_PACKAGE_BUILD: "1",
  NEXT_PUBLIC_REEL_STUDIO_PACKAGED: "1",
  REEL_STUDIO_HOME: path.join(work, "build-data"),
  DATABASE_URL: `file:${path.join(work, "build-data", "build.db")}`,
  NEXT_TELEMETRY_DISABLED: "1",
};
execFileSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build", "--webpack"],
  {
    cwd: buildRoot,
    env: buildEnv,
    stdio: "inherit",
  },
);

const standalone = path.join(buildRoot, dist, "standalone");
await copyFiles(standalone, staged, ["server.js", dist]);
await copyFiles(buildRoot, staged, [`${dist}/static`]);
await copyFiles(
  root,
  staged,
  sources.filter(
    (file) =>
      !["next.config.ts", "postcss.config.mjs", "package.json"].includes(file),
  ),
);
const pack = await buildVoicePack(
  root,
  voiceSource,
  path.join(work, "reel-kokoro-voice-pack.json.gz"),
  manifest.version,
);
await writeFile(
  path.join(staged, "voice-pack-manifest.json"),
  `${JSON.stringify(pack)}\n`,
);

const dependencies = { ...manifest.dependencies };
delete dependencies["kokoro-js"];
delete dependencies.phonemizer;
for (const name of ["@modelcontextprotocol/sdk", "hyperframes", "tsx"])
  dependencies[name] = manifest.devDependencies[name];
for (const name of ["@huggingface/transformers", "@next/env", "puppeteer"]) {
  const version = lock.packages[`node_modules/${name}`]?.version;
  if (!version) throw new Error(`Missing locked runtime dependency ${name}`);
  dependencies[name] = version;
}
await writeFile(
  path.join(staged, "package.json"),
  JSON.stringify(
    {
      name: "@mohitkale/reel-studio",
      version: manifest.version,
      description: manifest.description,
      license: manifest.license,
      repository: {
        type: "git",
        url: "git+https://github.com/mohitkale/reel-studio.git",
      },
      engines: manifest.engines,
      bin: manifest.bin,
      files: [
        dist,
        "server.js",
        "voice-pack-manifest.json",
        "bin",
        "docs/prompts",
        "examples/storyboards",
        "mcp/src",
        "prisma",
        "prisma.config.ts",
        "public",
        "schemas",
        "scripts",
        "src",
        "tsconfig.json",
      ],
      scripts: { postinstall: "prisma generate" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);
const npm = (args) =>
  execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: staged,
    encoding: "utf8",
  });
const [report] = JSON.parse(
  npm(["pack", "--dry-run", "--ignore-scripts", "--json"]),
);
const forbidden =
  /(?:^|\/)(?:\.env(?:\.|$)|\.artifacts(?:\/|$)|node_modules(?:\/|$)|vendor(?:\/|$)|media\/hf-work|reel-kokoro-voice-pack\.json\.gz)|\.(?:onnx|wasm|node|db(?:-(?:shm|wal))?)$/i;
const unsafe = report.files.find(
  ({ path: file }) => forbidden.test(file) || developmentOnly.test(file),
);
if (unsafe) throw new Error(`Unexpected archive entry ${unsafe.path}`);
if (
  ![
    "server.js",
    `${dist}/BUILD_ID`,
    "bin/reel-studio.mjs",
    "voice-pack-manifest.json",
  ].every((file) => report.files.some((entry) => entry.path === file))
)
  throw new Error("Package is missing a startup file");
await writeFile(
  path.join(work, "pack-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const [archive] = JSON.parse(
  npm(["pack", "--ignore-scripts", "--json", "--pack-destination", work]),
);
console.log(
  `Candidate: ${path.join(work, archive.filename)}\nPacked ${archive.size} bytes (${archive.unpackedSize} bytes unpacked)`,
);
