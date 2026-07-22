import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

/**
 * Remotion's webpack bundler does not read tsconfig `paths`. Map `@/*` → `src/*`
 * so compositions can import shared modules the same way as the Next.js app.
 */
export const remotionWebpackOverride: WebpackOverrideFn = (currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias ?? {}),
        "@": path.join(process.cwd(), "src"),
      },
    },
  };
};
