import { prisma } from "@/library/db";
import { SAMPLE_PROJECT_NAME } from "@/library/sample-content";
import { getConfig, type AppConfig } from "@/server/app-config";
import { resolveAutomation, type Automation } from "@/lib/automation";

/**
 * Simple is for people who want a finished video from a sentence. Pro keeps
 * every manual tool. Both modes use the same data; switching never changes it.
 */
export type UiMode = "simple" | "pro";

export interface UiState {
  mode: UiMode;
  /** True when first-run setup should appear (a clean install that has not finished it). */
  needsOnboarding: boolean;
  /** True when the install already had work in it before modes existed. */
  existingInstall: boolean;
  /** Videos wait for an OK on the scenes before they are made. */
  reviewBeforeMaking: boolean;
  /** New videos end with a one-second "Made with Reel Studio" tag. Off unless chosen. */
  endTag: boolean;
  /** Steps a new video runs by itself. */
  automation: Automation;
}

/** Work the user made themselves. The seeded sample project does not count. */
export async function hasExistingWork(): Promise<boolean> {
  const [projects, jobs, podcasts, renders] = await Promise.all([
    prisma.project.count({ where: { name: { not: SAMPLE_PROJECT_NAME } } }),
    prisma.productionJob.count(),
    prisma.podcast.count(),
    prisma.render.count(),
  ]);
  return projects + jobs + podcasts + renders > 0;
}

export function decideUiState(
  config: Pick<
    AppConfig,
    | "uiMode"
    | "onboardedAt"
    | "setupRequested"
    | "reviewBeforeMaking"
    | "endTag"
    | "automation"
  >,
  existingInstall: boolean,
): UiState {
  return {
    // Existing installs open in Pro so nobody loses their workspace.
    mode: config.uiMode ?? (existingInstall ? "pro" : "simple"),
    needsOnboarding:
      Boolean(config.setupRequested) ||
      (!config.onboardedAt && !existingInstall),
    existingInstall,
    reviewBeforeMaking: Boolean(config.reviewBeforeMaking),
    endTag: Boolean(config.endTag),
    automation: resolveAutomation(config.automation),
  };
}

export async function readUiState(): Promise<UiState> {
  const config = await getConfig();
  // Skip the database when the choice is already stored and setup is done.
  const existing =
    config.uiMode && config.onboardedAt ? false : await hasExistingWork();
  return decideUiState(config, existing);
}
