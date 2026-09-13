import { access, mkdir, statfs } from "node:fs/promises";
import { constants, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { prisma } from "@/library/db";
import {
  CURRENT_HF_CATALOG,
  CURRENT_HF_CATALOG_REVISION,
} from "@/engines/hyperframes/catalog/versions";
import { getLocalTranscriptionStatus } from "@/library/local-transcription";

export type DiagnosticStatus = "pass" | "warn" | "fail";

export interface StudioDiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  fix?: string;
  required: boolean;
}

export interface StudioDiagnosticReport {
  ready: boolean;
  generatedAt: string;
  platform: string;
  checks: StudioDiagnosticCheck[];
  summary: { passed: number; warnings: number; failed: number };
}

export interface DiagnosticDependencies {
  nodeVersion: string;
  platform: string;
  commandVersion(command: string): string | null;
  checkDatabase(): Promise<void>;
  checkMedia(): Promise<number>;
  galleryReady(): boolean;
  transcription(): Promise<{ configured: boolean; detail: string }>;
}

function commandVersion(command: string): string | null {
  const result = spawnSync(command, ["-version"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  if (result.status !== 0 || result.error) return null;
  return result.stdout.split(/\r?\n/)[0]?.trim() || command;
}

function defaultDependencies(): DiagnosticDependencies {
  const mediaRoot = path.resolve(process.cwd(), "media");
  const galleryFiles = [
    "portrait-demo.mp4",
    "portrait-demo.jpg",
    "landscape-demo.mp4",
    "landscape-demo.jpg",
    "square-demo.mp4",
    "square-demo.jpg",
    "podcast-demo.mp3",
  ];
  return {
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    commandVersion,
    async checkDatabase() {
      await prisma.$queryRaw`SELECT 1`;
      await prisma.productionBatch.count();
    },
    async checkMedia() {
      await mkdir(mediaRoot, { recursive: true });
      await access(mediaRoot, constants.R_OK | constants.W_OK);
      const storage = await statfs(mediaRoot);
      return storage.bavail * storage.bsize;
    },
    galleryReady() {
      return galleryFiles.every((name) =>
        existsSync(path.join(mediaRoot, "gallery", name)),
      );
    },
    async transcription() {
      const status = await getLocalTranscriptionStatus();
      return {
        configured: status.available,
        detail: status.available
          ? `whisper.cpp ready with ${path.basename(status.model ?? "configured model")}`
          : "Optional local transcription is not configured",
      };
    },
  };
}

export async function collectStudioDiagnostics(
  dependencies: DiagnosticDependencies = defaultDependencies(),
): Promise<StudioDiagnosticReport> {
  const checks: StudioDiagnosticCheck[] = [];
  const nodeMajor = Number(
    dependencies.nodeVersion.replace(/^v/, "").split(".")[0],
  );
  checks.push({
    id: "node",
    label: "Node.js runtime",
    status: nodeMajor === 24 ? "pass" : "fail",
    detail:
      nodeMajor === 24
        ? `${dependencies.nodeVersion} matches the supported LTS line`
        : `${dependencies.nodeVersion} is unsupported; Reel Studio requires Node 24`,
    fix:
      nodeMajor === 24 ? undefined : "Run `nvm use` from the repository root.",
    required: true,
  });

  try {
    await dependencies.checkDatabase();
    checks.push({
      id: "database",
      label: "SQLite schema",
      status: "pass",
      detail: "Database is reachable and includes production batches",
      required: true,
    });
  } catch {
    checks.push({
      id: "database",
      label: "SQLite schema",
      status: "fail",
      detail:
        "Database is unavailable or missing the current production schema",
      fix: "Run `npm run db:migrate`; restore the matching backup if migration fails.",
      required: true,
    });
  }

  try {
    const freeBytes = await dependencies.checkMedia();
    const freeGiB = freeBytes / 1024 ** 3;
    checks.push({
      id: "media",
      label: "Local media storage",
      status: freeGiB >= 2 ? "pass" : "warn",
      detail: `Writable with ${freeGiB.toFixed(1)} GiB available`,
      fix:
        freeGiB >= 2
          ? undefined
          : "Free at least 2 GiB before longer or multi-format renders.",
      required: true,
    });
  } catch (error) {
    checks.push({
      id: "media",
      label: "Local media storage",
      status: "fail",
      detail:
        error instanceof Error ? error.message : "Media path is not writable",
      fix: "Give the repository media directory read/write permission.",
      required: true,
    });
  }

  for (const command of ["ffmpeg", "ffprobe"] as const) {
    const version = dependencies.commandVersion(command);
    checks.push({
      id: command,
      label: command === "ffmpeg" ? "Media encoder" : "Artifact verification",
      status: version ? "pass" : "fail",
      detail: version ?? `${command} was not found on PATH`,
      fix: version
        ? undefined
        : `Install ${command === "ffmpeg" ? "FFmpeg (includes ffprobe)" : "FFmpeg"} and reopen the terminal.`,
      required: true,
    });
  }

  checks.push({
    id: "hyperframes",
    label: "HyperFrames catalog",
    status: CURRENT_HF_CATALOG.items.length ? "pass" : "fail",
    detail: `${CURRENT_HF_CATALOG.items.length} curated items at ${CURRENT_HF_CATALOG_REVISION.slice(0, 12)}`,
    required: true,
  });

  const galleryReady = dependencies.galleryReady();
  checks.push({
    id: "gallery",
    label: "Bundled gallery",
    status: galleryReady ? "pass" : "warn",
    detail: galleryReady
      ? "Reproducible sample videos are installed locally"
      : "Gallery previews have not been copied into local media yet",
    fix: galleryReady ? undefined : "Run `npm run seed:gallery`.",
    required: false,
  });

  const transcription = await dependencies.transcription();
  checks.push({
    id: "transcription",
    label: "Local transcription",
    status: transcription.configured ? "pass" : "warn",
    detail: transcription.detail,
    fix: transcription.configured
      ? undefined
      : "Optional: set WHISPER_CPP_BIN and WHISPER_CPP_MODEL in .env.local.",
    required: false,
  });

  const summary = {
    passed: checks.filter((check) => check.status === "pass").length,
    warnings: checks.filter((check) => check.status === "warn").length,
    failed: checks.filter((check) => check.status === "fail").length,
  };
  return {
    ready: checks.every((check) => !check.required || check.status !== "fail"),
    generatedAt: new Date().toISOString(),
    platform: dependencies.platform,
    checks,
    summary,
  };
}
