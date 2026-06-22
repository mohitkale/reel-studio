import { loadFont } from "@remotion/google-fonts/Inter";

// Inter across the weights the templates use (kicker, body, heavy emphasis).
const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const interFontFamily = fontFamily;
