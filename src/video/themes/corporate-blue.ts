import type { Theme } from "./types";

export const corporateBlue: Theme = {
  id: "corporate-blue",
  name: "Corporate Blue",
  description:
    "Navy, white type and a gold accent for data, reports and business updates.",
  keywords: [
    "business",
    "data",
    "report",
    "market",
    "finance",
    "quarter",
    "revenue",
    "sales",
    "growth",
    "statistics",
    "population",
    "economy",
  ],
  palette: {
    background: "#0B2A5B",
    backgroundAccent: "#123A7A",
    foreground: "#FFFFFF",
    muted: "#C3D5F3",
    accent: "#FFC857",
    accentSecondary: "#6CB8FF",
    accentForeground: "#0B2A5B",
  },
  fonts: { heading: "Inter", body: "Inter" },
  type: { weight: 800, tracking: -0.025, uppercase: false },
  shape: { radius: 14, stroke: 2 },
  background: "flat",
  motion: "smooth",
  captionStyle: "minimal",
  musicMood: "corporate uplifting",
};
