import type { Theme } from "./types";

export const highContrast: Theme = {
  id: "high-contrast",
  name: "High Contrast",
  description:
    "White text and a yellow accent on dark panels for clear, readable video.",
  keywords: ["high contrast", "accessibility", "readability", "large text"],
  palette: {
    background: "#080A0D",
    backgroundAccent: "#14181E",
    foreground: "#FFFFFF",
    muted: "#D8DBE1",
    accent: "#FFDC4A",
    accentSecondary: "#FFDC4A",
    accentForeground: "#080A0D",
  },
  fonts: { heading: "Geist", body: "Inter" },
  type: { weight: 700, tracking: 0, uppercase: false },
  shape: { radius: 8, stroke: 3 },
  background: "flat",
  motion: "calm",
  captionStyle: "minimal",
  musicMood: "minimal ambient",
};
