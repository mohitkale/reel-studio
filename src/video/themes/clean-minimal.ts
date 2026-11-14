import type { Theme } from "./types";

export const cleanMinimal: Theme = {
  id: "clean-minimal",
  name: "Clean Minimal",
  description:
    "White space, one blue accent and calm type for products and plain explanations.",
  keywords: [
    "product",
    "launch",
    "app",
    "design",
    "simple",
    "minimal",
    "saas",
    "feature",
    "release",
    "new",
  ],
  palette: {
    background: "#FFFFFF",
    backgroundAccent: "#EEF2F7",
    foreground: "#101828",
    muted: "#475467",
    accent: "#1D4ED8",
    accentSecondary: "#0369A1",
    accentForeground: "#FFFFFF",
  },
  fonts: { heading: "Geist", body: "Geist" },
  type: { weight: 700, tracking: -0.03, uppercase: false },
  shape: { radius: 16, stroke: 2 },
  background: "flat",
  motion: "calm",
  captionStyle: "minimal",
  musicMood: "light ambient",
};
