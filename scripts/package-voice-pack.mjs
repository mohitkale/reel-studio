import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const modelId = "onnx-community/Kokoro-82M-v1.0-ONNX";
const modelRelative = "node_modules/@huggingface/transformers";

export async function buildVoicePack(root, sourceArchive, output, version) {
  const files = {};
  async function add(key, relative) {
    files[key] = (await readFile(path.resolve(root, relative))).toString(
      "base64",
    );
  }
  const browser = await build({
    absWorkingDir: root,
    entryPoints: ["src/lib/client-tts/kokoro.worker.ts"],
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    define: { "process.env.NEXT_PUBLIC_REEL_STUDIO_PACKAGED": '"1"' },
  });
  files["client.mjs"] = Buffer.from(browser.outputFiles[0].contents).toString(
    "base64",
  );
  const server = await build({
    absWorkingDir: root,
    entryPoints: ["node_modules/kokoro-js/dist/kokoro.js"],
    bundle: true,
    write: false,
    minify: true,
    format: "esm",
    platform: "node",
    target: "node24",
    plugins: [
      {
        name: "installed-transformers",
        setup(plugin) {
          plugin.onResolve({ filter: /^@huggingface\/transformers$/ }, () => ({
            path: "transformers",
            namespace: "installed",
          }));
          plugin.onLoad({ filter: /.*/, namespace: "installed" }, () => ({
            contents: `
            import {createRequire} from "node:module";
            import {fileURLToPath} from "node:url";
            import path from "node:path";
            const require = createRequire(path.join(process.env.REEL_STUDIO_INSTALL_ROOT, "package.json"));
            const transformers = require("@huggingface/transformers");
            export const { StyleTextToSpeech2Model, AutoTokenizer, Tensor, RawAudio, env } = transformers;
            env.allowRemoteModels = false;
            env.allowLocalModels = true;
            env.localModelPath = fileURLToPath(new URL("../models/", import.meta.url));
          `,
          }));
        },
      },
    ],
  });
  files["dist/kokoro.mjs"] = Buffer.from(
    server.outputFiles[0].contents,
  ).toString("base64");

  const cachedModel = path.join(modelRelative, ".cache", modelId);
  for (const filename of [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "onnx/model_quantized.onnx",
  ])
    await add(
      `models/${modelId}/${filename}`,
      path.join(cachedModel, filename),
    );
  for (const filename of [
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
  ])
    await add(`wasm/${filename}`, path.join(modelRelative, "dist", filename));
  for (const filename of await readdir(
    path.join(root, "node_modules/kokoro-js/voices"),
  )) {
    if (/^[a-z]{2}_[a-z]+\.bin$/.test(filename))
      await add(
        `voices/${filename}`,
        `node_modules/kokoro-js/voices/${filename}`,
      );
  }
  for (const filename of await readdir(path.join(root, "vendor/phonemizer"))) {
    if (/^(?:COPYING|NOTICE|LICENSE)/.test(filename))
      await add(
        `licenses/phonemizer/${filename}`,
        `vendor/phonemizer/${filename}`,
      );
  }
  await add(
    "licenses/reel-phonemizer-corresponding-source.tar.gz",
    sourceArchive,
  );
  await add("licenses/Kokoro-LICENSE", "node_modules/kokoro-js/LICENSE");

  const bytes = gzipSync(JSON.stringify(files));
  await writeFile(output, bytes);
  return { version, sha256: createHash("sha256").update(bytes).digest("hex") };
}
