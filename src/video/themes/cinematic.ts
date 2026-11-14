import type { Theme } from "./types";

export const cinematic: Theme = {
  id: "cinematic",
  name: "Cinematic",
  description:
    "Near-black with letterbox bars, warm ivory type and a gold accent for brand films.",
  keywords: [
    "cinematic",
    "brand",
    "film",
    "trailer",
    "luxury",
    "premium",
    "launch film",
    "teaser",
    "epic",
    "motivation",
    "inspiration",
  ],
  palette: {
    background: "#05060A",
    backgroundAccent: "#11131C",
    foreground: "#F3EFE6",
    muted: "#C4BEAF",
    accent: "#D4AF55",
    accentSecondary: "#8FA3BA",
    accentForeground: "#05060A",
  },
  fonts: { heading: "Geist", body: "EB Garamond" },
  type: { weight: 600, tracking: 0.02, uppercase: false },
  shape: { radius: 4, stroke: 1 },
  background: "cinema",
  motion: "slow",
  captionStyle: "cinematic",
  musicMood: "cinematic ambient",
};
