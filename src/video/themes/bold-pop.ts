import type { Theme } from "./types";

export const boldPop: Theme = {
  id: "bold-pop",
  name: "Bold Pop",
  description:
    "Loud yellow, heavy type and hard colour blocks for creator hooks.",
  keywords: [
    "creator",
    "hook",
    "viral",
    "tiktok",
    "reels",
    "shorts",
    "punchy",
    "fun",
    "growth",
    "hack",
    "tips",
  ],
  palette: {
    background: "#FFE14D",
    backgroundAccent: "#FFC400",
    foreground: "#111111",
    muted: "#33302A",
    accent: "#A81038",
    accentSecondary: "#1F3FCC",
    accentForeground: "#FFFFFF",
  },
  fonts: { heading: "Archivo Black", body: "Inter" },
  type: { weight: 900, tracking: -0.02, uppercase: false },
  shape: { radius: 28, stroke: 4 },
  background: "blocks",
  motion: "punchy",
  captionStyle: "pop",
  musicMood: "upbeat pop",
};
