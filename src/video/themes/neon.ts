import type { Theme } from "./types";

export const neon: Theme = {
  id: "neon",
  name: "Neon",
  description:
    "Near-black violet with magenta and cyan glow for nightlife, gaming and energy.",
  keywords: [
    "gaming",
    "game",
    "night",
    "music",
    "party",
    "esports",
    "streamer",
    "cyber",
    "retro",
    "synth",
    "club",
  ],
  palette: {
    background: "#0A0014",
    backgroundAccent: "#1A0033",
    foreground: "#F5F0FF",
    muted: "#C9BEF5",
    accent: "#FF4FE0",
    accentSecondary: "#22E4F5",
    accentForeground: "#0A0014",
  },
  fonts: { heading: "Archivo Black", body: "Inter" },
  type: { weight: 900, tracking: 0.01, uppercase: true },
  shape: { radius: 18, stroke: 3 },
  background: "glow",
  motion: "punchy",
  captionStyle: "karaoke",
  musicMood: "synthwave",
};
