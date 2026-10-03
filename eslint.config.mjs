import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The standalone engine adapter is not a Next.js module.
  {
    files: ["vendor/phonemizer/index.js"],
    rules: { "@next/next/no-assign-module-variable": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Exact third-party runtime bytes are verified against the asset manifest.
    "public/reel-runtime/gsap.min.js",
    "vendor/phonemizer/engine.js",
    ".artifacts/**",
    "media/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
