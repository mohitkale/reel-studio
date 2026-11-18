import { buildShareCaption } from "@/lib/share-caption";

/**
 * A title, description and hashtags for posting, built from the storyboard's own
 * words (roadmap A6). No AI: the same video always gives the same kit.
 */
export interface KitSource {
  title: string;
  /** What the writer chose for posting; these win over the built-from-text defaults. */
  publish?: {
    title?: string;
    description?: string;
    hashtags?: string[];
    thumbnailText?: string;
  };
  scenes: { headline?: string; narration?: string }[];
  sources?: { title: string; url: string }[];
}

export interface PublishingKit {
  /** Big words for the thumbnail. */
  thumbnailText: string;
  title: string;
  description: string;
  hashtags: string[];
  /** The hashtags on one line, for pasting. */
  hashtagLine: string;
}

export interface PlatformLimit {
  id: string;
  label: string;
  /** Characters the platform has accepted for each field. Limits change; check before relying on them. */
  title?: number;
  description: number;
  hashtags?: number;
}

export const PLATFORM_LIMITS: readonly PlatformLimit[] = [
  {
    id: "youtube",
    label: "YouTube",
    title: 100,
    description: 5000,
    hashtags: 15,
  },
  {
    id: "shorts",
    label: "YouTube Shorts",
    title: 100,
    description: 5000,
    hashtags: 15,
  },
  { id: "reels", label: "Instagram Reels", description: 2200, hashtags: 30 },
  { id: "tiktok", label: "TikTok", description: 2200 },
  { id: "linkedin", label: "LinkedIn", description: 3000 },
];

const trimTo = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

export function buildPublishingKit(source: KitSource): PublishingKit {
  const share = buildShareCaption(source);
  const chosen = source.publish;
  const points = source.scenes
    .map((scene) => scene.headline?.trim())
    .filter((headline): headline is string => Boolean(headline))
    .slice(1, 7);
  const opening =
    chosen?.description?.trim() ||
    source.scenes
      .map((scene) => scene.narration?.trim())
      .find((narration): narration is string => Boolean(narration)) ||
    share.caption;
  const hashtags = chosen?.hashtags?.length
    ? chosen.hashtags.map((tag) => `#${tag.replace(/^#+/, "")}`)
    : share.hashtags;
  const body = [
    opening,
    ...(points.length
      ? ["", "In this video:", ...points.map((p) => `- ${p}`)]
      : []),
    ...(source.sources?.length
      ? ["", "Sources:", ...source.sources.map((s) => `- ${s.title}: ${s.url}`)]
      : []),
  ].join("\n");
  return {
    thumbnailText: trimTo(
      chosen?.thumbnailText?.trim() || source.title.trim(),
      40,
    ),
    title: trimTo((chosen?.title ?? source.title).trim(), 100),
    description: `${body}\n\n${hashtags.join(" ")}`.trim(),
    hashtags,
    hashtagLine: hashtags.join(" "),
  };
}

export interface PlatformFit {
  id: string;
  label: string;
  ok: boolean;
  /** What is over, in plain words; empty when it fits. */
  problems: string[];
}

export function checkPlatforms(kit: PublishingKit): PlatformFit[] {
  return PLATFORM_LIMITS.map((platform) => {
    const problems: string[] = [];
    if (platform.title && kit.title.length > platform.title)
      problems.push(
        `title is ${kit.title.length} of ${platform.title} characters`,
      );
    if (kit.description.length > platform.description)
      problems.push(
        `description is ${kit.description.length} of ${platform.description} characters`,
      );
    if (platform.hashtags && kit.hashtags.length > platform.hashtags)
      problems.push(
        `${kit.hashtags.length} hashtags, at most ${platform.hashtags}`,
      );
    return {
      id: platform.id,
      label: platform.label,
      ok: problems.length === 0,
      problems,
    };
  });
}
