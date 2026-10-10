import { z } from "zod";
import type { ProductionPresetId } from "./presets";
import type { BrandTokens } from "@/video/tokens";

export const VISUAL_THEME_IDS = [
  "paper",
  "botanical",
  "circuit",
  "studio",
  "signal",
  "ember",
] as const;
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const visualThemeSchema = z
  .object({
    version: z.literal("1.0.0"),
    id: z.enum(VISUAL_THEME_IDS),
    name: z.string().min(1).max(60),
    palette: z
      .object({
        background: hex,
        backgroundAccent: hex,
        foreground: hex,
        muted: hex,
        accent: hex,
        accentSecondary: hex,
        accentForeground: hex,
      })
      .strict(),
  })
  .strict();
export type VisualTheme = z.infer<typeof visualThemeSchema>;

function theme(
  id: VisualTheme["id"],
  name: string,
  colours: readonly string[],
): VisualTheme {
  const [
    background,
    backgroundAccent,
    foreground,
    muted,
    accent,
    accentSecondary,
    accentForeground,
  ] = colours;
  return visualThemeSchema.parse({
    version: "1.0.0",
    id,
    name,
    palette: {
      background,
      backgroundAccent,
      foreground,
      muted,
      accent,
      accentSecondary,
      accentForeground,
    },
  });
}

/** Curated readable themes, chosen once and frozen with the draft. No generated CSS. */
export const VISUAL_THEMES = {
  paper: theme("paper", "Paper & ink", [
    "#F5F0E6",
    "#E7DFD0",
    "#232B35",
    "#53606C",
    "#9B402E",
    "#276467",
    "#FFFFFF",
  ]),
  botanical: theme("botanical", "Botanical", [
    "#EEF3E8",
    "#DCE6D3",
    "#19392F",
    "#476255",
    "#2F6B50",
    "#8E5130",
    "#FFFFFF",
  ]),
  circuit: theme("circuit", "Midnight circuit", [
    "#081525",
    "#10283C",
    "#EDF6FF",
    "#AFCCDF",
    "#55D5E8",
    "#9EA9FF",
    "#081525",
  ]),
  studio: theme("studio", "Studio blue", [
    "#F0F3FC",
    "#E0E6F7",
    "#172A51",
    "#4E6080",
    "#3457BC",
    "#8754A3",
    "#FFFFFF",
  ]),
  signal: theme("signal", "Electric violet", [
    "#191129",
    "#2B1B45",
    "#F8F0FF",
    "#D2BFE5",
    "#D4A5FF",
    "#F5CE70",
    "#191129",
  ]),
  ember: theme("ember", "Warm cinema", [
    "#201814",
    "#38271D",
    "#FFF3DF",
    "#D4BFA1",
    "#F0BC78",
    "#CBB997",
    "#201814",
  ]),
} satisfies Record<VisualTheme["id"], VisualTheme>;

/** Content fit outranks variety. No random colour changes between scenes. */
export function resolveCreativeDirection(
  brief: string,
  presetId?: ProductionPresetId,
) {
  const text = brief.toLowerCase();
  const data = /(?:^|\n)\s*[^:\n]{2,60}:\s*\d+(?:\.\d+)?\s*%?\s*(?:$|\n)/m.test(
    text,
  );
  const technical =
    /\b(code|coding|developer|api|database|debug|typescript|python|terminal|software engineering)\b/.test(
      text,
    );
  const technologyTopic =
    technical ||
    /\b(ai|artificial intelligence|machine learning|robotics|cybersecurity)\b/.test(
      text,
    );
  const launch = /\b(launch|introduce|product|saas|app|demo)\b/.test(text);
  const nature =
    /\b(garden|forest|nature|sustainable|sustainability|plant|plants|ocean|wellness|mindful|mindfulness|meditation|breathing|yoga)\b/.test(
      text,
    );
  const cinema =
    /\b(cinematic|cinema|luxury|craft|craftsmanship|heritage|travel|journey|artisan)\b/.test(
      text,
    );
  const punch =
    /\b(punchy|energetic|fitness|workout|challenge|motivation|motivational)\b/.test(
      text,
    );
  const preset =
    presetId ??
    (data
      ? "data-story"
      : technical
        ? "developer-demo"
        : launch
          ? "product-launch"
          : cinema
            ? "cinematic-brand"
            : punch
              ? "creator-punch"
              : "editorial-explainer");
  const id: VisualTheme["id"] = nature
    ? "botanical"
    : technologyTopic || data
      ? "circuit"
      : launch
        ? "studio"
        : cinema
          ? "ember"
          : punch
            ? "signal"
            : preset === "developer-demo" || preset === "data-story"
              ? "circuit"
              : preset === "product-launch"
                ? "studio"
                : preset === "creator-punch"
                  ? "signal"
                  : preset === "cinematic-brand"
                    ? "ember"
                    : "paper";
  return { presetId: preset, theme: VISUAL_THEMES[id] };
}

export function applyVisualTheme(
  tokens: BrandTokens,
  visualTheme?: VisualTheme,
): BrandTokens {
  return visualTheme ? { ...tokens, ...visualTheme.palette } : tokens;
}
