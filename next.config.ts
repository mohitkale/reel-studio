import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion renderer and bundler contain native binaries that must run in Node.js;
  // exclude them from the Next.js bundle so they are required at runtime instead.
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-win32-x64-msvc",
    "@hyperframes/producer",
    "@hyperframes/engine",
    "@hyperframes/core",
    "puppeteer",
    "puppeteer-core",
    // Tailwind v4 uses lightningcss, which loads a platform-specific native
    // binary at runtime. Turbopack must not bundle it, or the dynamic native
    // require fails ("Cannot find module ../lightningcss.<platform>.node").
    "lightningcss",
    // Server-side Kokoro runs via onnxruntime-node, which ships native .node
    // binaries. Keep kokoro-js and transformers external so they (and the
    // native runtime) are required at runtime instead of bundled.
    "kokoro-js",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
};

export default nextConfig;
