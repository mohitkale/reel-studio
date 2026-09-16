/**
 * Curated HyperFrames registry blocks for production-grade ads.
 * Sourced from heygen-com/hyperframes (Apache-2.0). Full registry has 100+;
 * we vendor a focused ad/premium subset.
 */

export const HF_CATALOG_SOURCE =
  "https://github.com/heygen-com/hyperframes/tree/main/registry";

export type HfCatalogBlockId =
  | "caption-kinetic-slam"
  | "apple-money-count"
  | "data-chart"
  | "app-showcase"
  | "logo-outro"
  | "instagram-follow"
  | "tiktok-follow"
  | "yt-lower-third"
  | "carousel-circle-1"
  | "carousel-path-1"
  | "carousel-vision-1";

export interface HfCatalogBlockMeta {
  /** Registry / file id. */
  id: HfCatalogBlockId;
  /** Reel Studio template id (`hf-*`). */
  templateId: string;
  name: string;
  description: string;
  /** Must match data-composition-id inside the block HTML. */
  compositionId: string;
  width: number;
  height: number;
  /** Authored duration in the registry (seconds). */
  duration: number;
  /**
   * When true the block is an overlay (transparent bg) — keep our mood/photo
   * background underneath.
   */
  transparent: boolean;
  /** Filename under catalog/blocks/. */
  file: string;
  sampleText: string;
  sampleEmphasis: string[];
  sampleVisual?: string;
  visualHint?: string;
  /** First immutable catalog version allowed to expose this adapter. */
  availableSinceRevision?: string;
  /** Native adapter requires project images and never uses upstream demos. */
  requiresCarouselImages?: boolean;
}

/** Ad-focused subset of the upstream HyperFrames catalog. */
export const HF_CATALOG_BLOCKS: HfCatalogBlockMeta[] = [
  {
    id: "caption-kinetic-slam",
    templateId: "hf-kinetic-slam",
    name: "Kinetic slam",
    description:
      "High-energy word-by-word slam captions — ideal cold opens and punch lines.",
    compositionId: "caption-kinetic-slam",
    width: 1920,
    height: 1080,
    duration: 8,
    transparent: true,
    file: "caption-kinetic-slam.html",
    sampleText: "Stop scrolling. This is the part that matters.",
    sampleEmphasis: ["matters"],
  },
  {
    id: "apple-money-count",
    templateId: "hf-money-count",
    name: "Money count",
    description:
      "Apple-style finance counter that slams a big dollar (or metric) total.",
    compositionId: "apple-money-count",
    width: 1920,
    height: 1080,
    duration: 5,
    transparent: false,
    file: "apple-money-count.html",
    sampleText: "Revenue unlocked this quarter.",
    sampleEmphasis: [],
    sampleVisual: "$10000",
    visualHint: "Target amount (e.g. $10000 or 250%)",
  },
  {
    id: "data-chart",
    templateId: "hf-data-chart",
    name: "Data chart",
    description:
      "Animated bar + line chart with staggered reveal — proof and comparison beats.",
    compositionId: "data-chart",
    width: 1920,
    height: 1080,
    duration: 15,
    transparent: false,
    file: "data-chart.html",
    sampleText: "Growth that compounds every month.",
    sampleEmphasis: ["compounds"],
    sampleVisual: "Monthly Revenue",
    visualHint: "Chart title override (optional)",
  },
  {
    id: "app-showcase",
    templateId: "hf-app-showcase",
    name: "App showcase",
    description:
      "Premium product / app hero with floating device frames and CTA energy.",
    compositionId: "app-showcase",
    width: 1920,
    height: 1080,
    duration: 5.5,
    transparent: false,
    file: "app-showcase.html",
    sampleText: "Unleash Full Potential",
    sampleEmphasis: ["Potential"],
    sampleVisual: "START NOW",
    visualHint: "CTA label on the showcase",
  },
  {
    id: "logo-outro",
    templateId: "hf-logo-outro",
    name: "Logo outro",
    description:
      "Cinematic logo assembly with tagline and URL pill — brand end card.",
    compositionId: "logo-outro",
    width: 1920,
    height: 1080,
    duration: 6,
    transparent: false,
    file: "logo-outro.html",
    sampleText: "Built for creators who ship.",
    sampleEmphasis: [],
    sampleVisual: "reel.studio",
    visualHint: "URL or domain pill",
  },
  {
    id: "instagram-follow",
    templateId: "hf-ig-follow",
    name: "Instagram follow",
    description:
      "Portrait Instagram follow card — production social CTA for Reels.",
    compositionId: "instagram-follow",
    width: 1080,
    height: 1920,
    duration: 4.5,
    transparent: true,
    file: "instagram-follow.html",
    sampleText: "Follow for the next breakdown.",
    sampleEmphasis: ["Follow"],
    sampleVisual: "Follow",
    visualHint: "Button label (optional)",
  },
  {
    id: "tiktok-follow",
    templateId: "hf-tt-follow",
    name: "TikTok follow",
    description: "Portrait TikTok follow card — social CTA for short-form ads.",
    compositionId: "tiktok-follow",
    width: 1080,
    height: 1920,
    duration: 4.5,
    transparent: true,
    file: "tiktok-follow.html",
    sampleText: "Follow for daily drops.",
    sampleEmphasis: ["Follow"],
    sampleVisual: "Follow",
  },
  {
    id: "yt-lower-third",
    templateId: "hf-yt-lower-third",
    name: "YouTube lower third",
    description:
      "Animated YouTube subscribe lower third with channel identity.",
    compositionId: "yt-lower-third",
    width: 1920,
    height: 1080,
    duration: 4.5,
    transparent: true,
    file: "yt-lower-third.html",
    sampleText: "Subscribe for more.",
    sampleEmphasis: ["Subscribe"],
    sampleVisual: "Subscribe",
  },
  {
    id: "carousel-circle-1",
    templateId: "hf-carousel-circle-v1",
    name: "Circle carousel",
    description: "Project images orbit through a responsive circular gallery.",
    compositionId: "carousel-circle-1",
    width: 1920,
    height: 1080,
    duration: 6,
    transparent: false,
    file: "carousel-circle-1.html",
    sampleText: "A collection built around your story.",
    sampleEmphasis: ["your story"],
    visualHint: "Requires at least three uploaded images",
    availableSinceRevision: "cfe5dcfad310ced2a5844998628daa2b8a0f53d7",
    requiresCarouselImages: true,
  },
  {
    id: "carousel-path-1",
    templateId: "hf-carousel-path-v1",
    name: "Path carousel",
    description: "Project images travel along a responsive editorial path.",
    compositionId: "carousel-path-1",
    width: 1920,
    height: 1080,
    duration: 6,
    transparent: false,
    file: "carousel-path-1.html",
    sampleText: "See the process from every angle.",
    sampleEmphasis: ["every angle"],
    visualHint: "Requires at least three uploaded images",
    availableSinceRevision: "cfe5dcfad310ced2a5844998628daa2b8a0f53d7",
    requiresCarouselImages: true,
  },
  {
    id: "carousel-vision-1",
    templateId: "hf-carousel-vision-v1",
    name: "Vision carousel",
    description: "Project images fan through a cinematic responsive stage.",
    compositionId: "carousel-vision-1",
    width: 1920,
    height: 1080,
    duration: 6,
    transparent: false,
    file: "carousel-vision-1.html",
    sampleText: "Bring the full vision into focus.",
    sampleEmphasis: ["into focus"],
    visualHint: "Requires at least three uploaded images",
    availableSinceRevision: "cfe5dcfad310ced2a5844998628daa2b8a0f53d7",
    requiresCarouselImages: true,
  },
];

const BY_TEMPLATE = new Map(
  HF_CATALOG_BLOCKS.map((b) => [b.templateId, b] as const),
);
const BY_ID = new Map(HF_CATALOG_BLOCKS.map((b) => [b.id, b] as const));

export function getCatalogBlockByTemplateId(
  templateId: string,
  catalogRevision?: string,
): HfCatalogBlockMeta | undefined {
  const block = BY_TEMPLATE.get(templateId);
  if (
    block?.availableSinceRevision &&
    catalogRevision &&
    block.availableSinceRevision !== catalogRevision
  ) {
    return undefined;
  }
  return block;
}

export function getCatalogBlockById(
  id: string,
): HfCatalogBlockMeta | undefined {
  return BY_ID.get(id as HfCatalogBlockId);
}

export function isCatalogTemplateId(templateId: string): boolean {
  return BY_TEMPLATE.has(templateId);
}

export const HF_CATALOG_TEMPLATE_IDS = HF_CATALOG_BLOCKS.map(
  (b) => b.templateId,
) as [string, ...string[]];
