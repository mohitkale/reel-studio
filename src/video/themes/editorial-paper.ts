import type { Theme } from "./types";

export const editorialPaper: Theme = {
  id: "editorial-paper",
  name: "Editorial Paper",
  description:
    "Warm paper, ink-dark serif headings and a brick accent for explainers and essays.",
  keywords: [
    "explainer",
    "history",
    "essay",
    "science",
    "news",
    "recap",
    "learn",
    "why",
    "how",
    "story",
    "culture",
    "book",
  ],
  palette: {
    background: "#F6F1E7",
    backgroundAccent: "#EAE2D2",
    foreground: "#1F2328",
    muted: "#4B4740",
    accent: "#9B2C1F",
    accentSecondary: "#1D4E5F",
    accentForeground: "#FFFFFF",
  },
  fonts: { heading: "EB Garamond", body: "Geist" },
  type: { weight: 600, tracking: -0.01, uppercase: false },
  shape: { radius: 6, stroke: 2 },
  background: "paper",
  motion: "calm",
  captionStyle: "editorial",
  musicMood: "gentle acoustic",
};
