import type { Theme } from "./types";

export const retroTerminal: Theme = {
  id: "retro-terminal",
  name: "Retro Terminal",
  description:
    "Amber text, monospaced headings and a dark grid for retro computing and console stories.",
  keywords: ["retro", "retro terminal", "hacker", "console", "80s", "8 bit"],
  palette: {
    background: "#100E0A",
    backgroundAccent: "#261C0D",
    foreground: "#FFE0A8",
    muted: "#D5A66B",
    accent: "#FFB746",
    accentSecondary: "#FFD183",
    accentForeground: "#100E0A",
  },
  fonts: { heading: "JetBrains Mono", body: "Inter" },
  type: { weight: 700, tracking: -0.01, uppercase: false },
  shape: { radius: 2, stroke: 2 },
  background: "grid",
  motion: "hard",
  captionStyle: "minimal",
  musicMood: "retro electronic",
};
