import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve same-origin srcDoc previews, WASM workers and media. Inline motion
  // scripts still need a separate nonce-based policy; do not claim XSS isolation.
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // Native database, video and voice packages must run in Node.js;
  // exclude them from the Next.js bundle so they are required at runtime instead.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-better-sqlite3",
    "better-sqlite3",
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
