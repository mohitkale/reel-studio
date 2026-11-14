import type { Theme } from "./types";

export const midnightTech: Theme = {
  id: "midnight-tech",
  name: "Midnight Tech",
  description:
    "Deep navy, a cyan accent, mono headings and a faint grid for developers.",
  keywords: [
    "code",
    "developer",
    "api",
    "programming",
    "software",
    "terminal",
    "debug",
    "javascript",
    "typescript",
    "engineering",
    "tech",
    "ai",
  ],
  palette: {
    background: "#070B14",
    backgroundAccent: "#0F1B33",
    foreground: "#E6F1FF",
    muted: "#9FB3CC",
    accent: "#38BDF8",
    accentSecondary: "#A78BFA",
    accentForeground: "#04111D",
  },
  fonts: { heading: "JetBrains Mono", body: "Inter" },
  type: { weight: 700, tracking: -0.02, uppercase: false },
  shape: { radius: 10, stroke: 2 },
  background: "grid",
  motion: "snappy",
  captionStyle: "technical",
  musicMood: "focused electronic",
};
