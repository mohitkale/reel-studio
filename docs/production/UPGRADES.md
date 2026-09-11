# Dependency decisions

The frozen registry inventory is in `dependencies.json`. Install targets exclude prereleases, even when a publisher uses the latest tag for one.

- Runtime: Node 24 LTS (minimum 24.15), matching modern test tooling requirements. Node types use the 24 line instead of the registry latest tag's 22 line.
- React / React DOM: 19.2.8. Stable 19.3.0 is excluded because even React Three Fiber 9.7.0 declares `>=19 <19.3`. Preserve Three.js support; do not override its peer contract.
- Prisma: 7.10.0. The registry latest tag points to 8.0.0-rc.13, which is explicitly excluded.
- HyperFrames: producer 0.8.33 and CLI 0.8.27 are the compatible published targets. GSAP 3.14.2 is pinned and copied into each render workspace so frame capture does not fetch its motion runtime from the network.
- Remotion family: all direct packages target exactly 4.0.523.

## Remotion 4.0.523

All nine Remotion packages are pinned to the same exact release and the compatible Studio Zod version is pinned to 4.5.4. Zod 4 record schemas now declare their key schema explicitly, while the AI scene input type continues to accept an omitted optional visual without weakening parsed output validation.

The credential-free render regression encodes a Three.js-to-Lottie MP4 and renders a representative still from every registered legacy template. Each still selects its composition with the matching input props because Remotion stores calculated, resolved props on the selected composition; reusing a composition selected for different props would test the wrong template.

## Remaining direct packages and compatibility pins

All remaining direct runtime and development packages are exact-pinned to the frozen stable target unless an upstream peer contract prevents it. The first compatibility gate uses these newest compatible exceptions:

- `@vitejs/plugin-react` 5.2.0 and Vite 7.3.5: plugin-react 6.1.1 introduces an optional Rolldown Babel bridge that conflicts with Remotion's Babel 7 SVG toolchain. Vite 8 requires esbuild 0.27/0.28, while HyperFrames core 0.8.33 requires `^0.25.12`.
- esbuild 0.25.12: HyperFrames producer 0.8.33 imports esbuild at runtime but publishes it only through a core optional peer/development dependency. Reel Studio declares the tested version directly so clean installs can render.
- ESLint 9.39.5: the plugins bundled by `eslint-config-next` 16.3.4 do not declare ESLint 10 support.
- TypeScript 6.0.3: the TypeScript ESLint 8.70 stack bundled by `eslint-config-next` supports TypeScript below 6.1, excluding the frozen TypeScript 7 target.

Vitest 5 uses an `.mts` configuration so Vite loads its ESM syntax without the CommonJS compatibility warning. The remaining UI, MCP, Tailwind, provider, formatting, test, and utility packages use their frozen stable targets.

## Advisory review after safe fixes

`npm audit fix` removed every compatible advisory, including the critical `tar` issue. Ten findings remain: one low, two moderate, and seven high. None has a compatible upstream resolution in the validated graph:

- HyperFrames CLI 0.8.27 depends on affected `adm-zip`; no fix is published. This is a development/catalog tool, not an application request path.
- Prisma 7.10.0 includes affected `deepmerge-ts` and `mysql2`. Reel Studio uses SQLite, so the MySQL authentication and compression paths are not used. npm's proposed fix is an incompatible downgrade to Prisma 6.19.3.
- Kokoro 1.2.1 reaches the affected Sharp release through Hugging Face Transformers; no fix is published for the current provider package.
- Vite 7.3.5 requires the affected esbuild 0.27 line. The advisory applies to Vite's development server on Windows; moving to Vite 8 would violate HyperFrames' esbuild peer contract.

Recheck these exceptions when HyperFrames, Prisma, Kokoro, Next's lint stack, or TypeScript ESLint publishes a compatible update. Do not use `npm audit fix --force`, because its current proposal downgrades the migrated Prisma runtime.

## Baseline render finding

Both engines encoded three-second H.264 fixtures before upgrades. HyperFrames at 0.7.61 produced a background-only sampled frame; this is an existing visual failure, not an accepted baseline. The HyperFrames compatibility task must fix it before the first milestone passes.

HyperFrames 0.8.33 now receives a direct composition root, canonical clip IDs, and a root timeline under the composition ID. The regression harness rejects background-only frames, and the 0.8.27 checker reports no lint, runtime, layout, motion, or contrast findings for the generated fixture.

- Production builds explicitly use Next's supported Webpack path. Turbopack failed to launch its CSS evaluation subprocess in the validation environment, including an escalated retry. Webpack completes the same application compilation and type checks. Geist fonts are packaged locally so builds do not need Google Fonts.
