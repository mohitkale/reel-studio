import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Three projects:
//   unit        – pure logic and components. No database, filesystem,
//                 FFmpeg or child processes. Must stay fast. Runs in the
//                 Node environment; a test that needs a DOM starts with
//                 `// @vitest-environment jsdom`.
//   integration – `*.int.test.ts`: SQLite, filesystem, FFmpeg, workers.
//   render      – the real export smoke test; slow, run on request.
const RENDER_SMOKE = "src/lib/render-smoke.test.ts";
const INTEGRATION = "src/**/*.int.{test,spec}.{ts,tsx}";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: [INTEGRATION, RENDER_SMOKE],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [INTEGRATION],
          // Cold SQLite/Prisma setup and child processes can take tens of
          // seconds on Windows CI, even with a single integration worker.
          testTimeout: process.platform === "win32" ? 60_000 : 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: "render",
          include: [RENDER_SMOKE],
        },
      },
    ],
  },
});
