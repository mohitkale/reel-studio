import { defineConfig } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3187";
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Browser tests for the three journeys that define the product (roadmap U8).
 * They run against a throwaway install and a fake writer, with no network. Real
 * draft exports happen, so they need FFmpeg and Chrome like the studio does.
 * `npm run test:e2e`; E2E_SERVER=start uses a production build.
 */
export default defineConfig({
  testDir: "e2e",
  // The journeys share one install and run in order: the first needs it empty.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 12 * 60_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  outputDir: "test-results",
  use: {
    baseURL,
    // The installed Chrome that exports already need; no browser download.
    channel: process.env.E2E_BROWSER ?? "chrome",
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  webServer: {
    command: "node e2e/start-server.mjs",
    url: `${baseURL}/api/ui-mode`,
    timeout: 5 * 60_000,
    reuseExistingServer: false,
    // Let the launcher stop the studio and its worker; a hard kill leaves them running.
    gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
});
