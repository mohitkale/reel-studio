import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion renderer and bundler contain native binaries that must run in Node.js;
  // exclude them from the Next.js bundle so they are required at runtime instead.
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-win32-x64-msvc",
    "puppeteer-core",
  ],
};

export default nextConfig;
