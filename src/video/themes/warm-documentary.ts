import type { Theme } from "./types";

export const warmDocumentary: Theme = {
  id: "warm-documentary",
  name: "Warm Documentary",
  description:
    "Brown-black film grain, cream type and amber light for stories and people.",
  keywords: [
    "documentary",
    "story",
    "journey",
    "memory",
    "family",
    "travel",
    "food",
    "craft",
    "human",
    "personal",
    "life",
    "lighthouse",
  ],
  palette: {
    background: "#1E1712",
    backgroundAccent: "#2E2218",
    foreground: "#FBF1E3",
    muted: "#DCC8AA",
    accent: "#F2A65A",
    accentSecondary: "#F28B63",
    accentForeground: "#1E1712",
  },
  fonts: { heading: "EB Garamond", body: "Inter" },
  type: { weight: 600, tracking: -0.005, uppercase: false },
  shape: { radius: 8, stroke: 2 },
  background: "cinema",
  motion: "slow",
  captionStyle: "cinematic",
  musicMood: "warm piano",
};
