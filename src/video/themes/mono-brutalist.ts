import type { Theme } from "./types";

export const monoBrutalist: Theme = {
  id: "mono-brutalist",
  name: "Mono Brutalist",
  description:
    "Black on grey, mono type, thick strokes and square corners. No decoration.",
  keywords: [
    "brutalist",
    "mono",
    "raw",
    "manifesto",
    "opinion",
    "critique",
    "essay",
    "stark",
    "protest",
    "design critique",
  ],
  palette: {
    background: "#EDEDED",
    backgroundAccent: "#D9D9D9",
    foreground: "#000000",
    muted: "#2B2B2B",
    accent: "#000000",
    accentSecondary: "#9A3412",
    accentForeground: "#FFFFFF",
  },
  fonts: { heading: "JetBrains Mono", body: "JetBrains Mono" },
  type: { weight: 700, tracking: -0.04, uppercase: true },
  shape: { radius: 0, stroke: 6 },
  background: "flat",
  motion: "hard",
  captionStyle: "technical",
  musicMood: "minimal percussion",
};
