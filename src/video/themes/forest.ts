import type { Theme } from "./types";

export const forest: Theme = {
  id: "forest",
  name: "Forest",
  description:
    "Deep green, sage text and warm amber for nature, gardens, hiking and wellness.",
  keywords: ["forest", "nature", "garden", "hiking", "trail", "wellness"],
  palette: {
    background: "#102218",
    backgroundAccent: "#1B3828",
    foreground: "#EAF1E3",
    muted: "#BDD1BC",
    accent: "#F4BA6C",
    accentSecondary: "#A2CB9D",
    accentForeground: "#102218",
  },
  fonts: { heading: "EB Garamond", body: "Inter" },
  type: { weight: 700, tracking: -0.01, uppercase: false },
  shape: { radius: 16, stroke: 2 },
  background: "blobs",
  motion: "calm",
  captionStyle: "cinematic",
  musicMood: "calm acoustic",
};
