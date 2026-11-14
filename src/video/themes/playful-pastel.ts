import type { Theme } from "./types";

export const playfulPastel: Theme = {
  id: "playful-pastel",
  name: "Playful Pastel",
  description:
    "Soft pink, purple ink and big round shapes for friendly, light topics.",
  keywords: [
    "kids",
    "playful",
    "cute",
    "friendly",
    "lifestyle",
    "beauty",
    "wellness",
    "habit",
    "coffee",
    "recipe",
    "myth",
    "fun fact",
  ],
  palette: {
    background: "#FFF0F6",
    backgroundAccent: "#FBD6E8",
    foreground: "#3A1B52",
    muted: "#5E3C7A",
    accent: "#6D28D9",
    accentSecondary: "#BE185D",
    accentForeground: "#FFFFFF",
  },
  fonts: { heading: "Inter", body: "Inter" },
  type: { weight: 800, tracking: -0.02, uppercase: false },
  shape: { radius: 40, stroke: 3 },
  background: "blobs",
  motion: "bouncy",
  captionStyle: "karaoke",
  musicMood: "playful ukulele",
};
