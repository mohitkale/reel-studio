// @vitest-environment node
import { describe, expect, it } from "vitest";

import { collectStudioDiagnostics } from "@/library/studio-diagnostics";

describe("studio diagnostics", () => {
  it("reports a ready core while keeping optional tools visible", async () => {
    const report = await collectStudioDiagnostics({
      nodeVersion: "v24.18.1",
      platform: "test arm64",
      commandVersion: (command) => `${command} test`,
      checkDatabase: async () => undefined,
      checkMedia: async () => 8 * 1024 ** 3,
      galleryReady: () => true,
      transcription: async () => ({
        configured: false,
        detail: "not installed",
      }),
    });
    expect(report.ready).toBe(true);
    expect(report.summary).toEqual({ passed: 7, warnings: 1, failed: 0 });
    expect(
      report.checks.find((check) => check.id === "transcription"),
    ).toMatchObject({
      status: "warn",
      required: false,
    });
  });

  it("blocks sample export readiness when a required dependency fails", async () => {
    const report = await collectStudioDiagnostics({
      nodeVersion: "v22.0.0",
      platform: "test x64",
      commandVersion: () => null,
      checkDatabase: async () => {
        throw new Error("missing migration");
      },
      checkMedia: async () => 1024 ** 3,
      galleryReady: () => false,
      transcription: async () => ({
        configured: false,
        detail: "not installed",
      }),
    });
    expect(report.ready).toBe(false);
    expect(
      report.checks
        .filter((check) => check.status === "fail")
        .map((check) => check.id),
    ).toEqual(["node", "database", "ffmpeg", "ffprobe"]);
  });
});
