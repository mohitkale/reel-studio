import type { Theme } from "./types";

export const sunset: Theme = {
  id: "sunset",
  name: "Sunset",
  description:
    "Orange and magenta light on dark plum for travel, photography and summer evenings.",
  keywords: [
    "sunset",
    "golden hour",
    "summer",
    "evening",
    "travel",
    "photography",
    "coast",
  ],
  palette: {
    background: "#211225",
    backgroundAccent: "#3A1938",
    foreground: "#FFF2E6",
    muted: "#EAC7D5",
    accent: "#FF9A58",
    accentSecondary: "#F47AAF",
    accentForeground: "#211225",
  },
  fonts: { heading: "EB Garamond", body: "Inter" },
  type: { weight: 700, tracking: -0.01, uppercase: false },
  shape: { radius: 14, stroke: 2 },
  background: "glow",
  motion: "smooth",
  captionStyle: "cinematic",
  musicMood: "warm ambient",
};
