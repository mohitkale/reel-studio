# Dependency upgrade assessment

Reviewed 2026-10-02 on Node 24.18.1. This milestone updates packages and the
lockfile; security behavior and engine removal have their own PRs.

All direct versions remain exact. Node types stay on Node 24, the Next framework
and lint config move together, React/React DOM move together, and the Remotion
packages stay synchronized until their removal milestone.

## Direct updates

| Package | Before | After |
| --- | --- | --- |
| `@hyperframes/producer` | 0.8.40 | 0.8.111 |
| `@remotion/bundler` | 4.0.523 | 4.0.532 |
| `@remotion/cli` | 4.0.523 | 4.0.532 |
| `@remotion/google-fonts` | 4.0.523 | 4.0.532 |
| `@remotion/lottie` | 4.0.523 | 4.0.532 |
| `@remotion/player` | 4.0.523 | 4.0.532 |
| `@remotion/renderer` | 4.0.523 | 4.0.532 |
| `@remotion/three` | 4.0.523 | 4.0.532 |
| `@remotion/transitions` | 4.0.523 | 4.0.532 |
| `@tanstack/react-query` | 5.102.8 | 5.104.0 |
| `@types/three` | 0.185.4 | 0.186.0 |
| `esbuild` | 0.25.12 | 0.28.2 |
| `gsap` | 3.14.2 | 3.15.0 |
| `lucide-react` | 1.44.0 | 1.49.0 |
| `next` | 16.3.4 | 16.3.8 |
| `react` | 19.2.8 | 19.3.0 |
| `react-dom` | 19.2.8 | 19.3.0 |
| `remotion` | 4.0.523 | 4.0.532 |
| `tailwind-merge` | 3.6.0 | 3.7.0 |
| `three` | 0.186.0 | 0.186.1 |
| `zod` | 4.5.4 | 4.6.5 |
| `@modelcontextprotocol/sdk` | 1.30.0 | 1.31.0 |
| `@types/node` | 24.13.4 | 24.19.1 |
| `@vitejs/plugin-react` | 5.2.0 | 6.1.1 |
| `eslint-config-next` | 16.3.4 | 16.3.8 |
| `hyperframes` | 0.8.40 | 0.8.110 |
| `jsdom` | 30.0.1 | 30.1.1 |
| `prettier` | 3.9.6 | 3.9.9 |
| `tsx` | 4.23.13 | 4.23.15 |
| `vite` | 7.3.5 | 8.3.2 |
| `vitest` | 5.0.0 | 5.0.3 |

## Versions deliberately retained

- **ESLint 9.39.5:** the current `eslint-plugin-react` and `eslint-plugin-jsx-a11y`
  peer ranges exclude ESLint 10. Keep working lint rules rather than forcing peers.
- **TypeScript 6.0.3:** `typescript-eslint` requires TypeScript `<6.1.0`;
  TypeScript 7 is outside the supported compiler range.
- **Prisma 7.10.0:** npm's `latest` tag is `8.0.0-rc.19`, a prerelease. The stable
  `prev` tag is still 7.10.0. Keep client, adapter, and CLI on the same stable line.
- **Node type major 24:** `@types/node` 26 describes APIs absent from the required
  Node 24 runtime; update within major 24 instead.

React 19.3 needs React Three Fiber 9.8.1 (its peers accept React `<19.4`);
refresh compatible transitive dependencies rather than retaining Fiber 9.6.1,
which excludes React 19.3. Vite 8 and React plugin 6 are upgraded as a pair;
Vitest 5 explicitly accepts Vite 8. No forced peer installation is used.

Sources: [Next 16.3.8](https://github.com/vercel/next.js/releases/tag/v16.3.8),
[Vite 8 migration](https://vite.dev/guide/migration.html),
[ESLint 10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0).
Peer constraints and dist-tags were checked against npm package metadata.

## Licensing

HyperFrames is [Apache-2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE).
Reel Studio's own source remains MIT. GSAP has a
[custom no-charge license](https://gsap.com/community/standard-license/),
so removing Remotion does not make every runtime dependency Apache-2.0 or OSI
open source. The HyperFrames-only milestone must keep README/license claims
accurate; a fully OSI runtime also needs a decision about GSAP and optional models.

## Validation

Clean `npm ci`, peer-tree integrity (`npm ls --all`), typecheck, lint, all 650 tests,
secret scan, and release metadata/capability checks passed. The suite includes a
real three-second Remotion MP4 export. A HyperFrames type-impact portrait fixture
also exported successfully with readable text and foreground checks; its V2
section planning/chunk/assembly path produced H.264, 1080×1920, 30 fps, 3.000s.
The upgraded CLI's browser `check` passed with no errors. It reported overlapping
GSAP tween, `force3D`, and decorative overflow warnings; those belong to M9's
choreography/fidelity work. This does not claim frame-identical output across
producer versions. The Next 16.3.8 production webpack build passed. A browser
smoke check loaded the project list and an existing HyperFrames editor/preview
with no console warnings or errors; no production jobs were launched.
The older production dependency snapshot remains historical evidence.

## Remaining audit findings

The refreshed lockfile reduces `npm audit` from 13 findings (one critical, nine
high, two moderate, one low) to seven high findings, with no critical, moderate,
or low findings. These are dependency counts, not seven distinct exploits.

- `sharp` and its `@huggingface/transformers` / `kokoro-js` dependents: upstream
  native image-decoder advisories remain in the model runtime's dependency
  range. npm reports no compatible fix. This is not a claim that all image
  decoding paths are safe; M8 owns the remaining reachability assessment.
- Prisma and `@prisma/config` bring in `deepmerge-ts` and `mysql2`. The
  [recursive-object merge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
  requires recursive object graphs, which ordinary API JSON cannot express.
  Prisma configuration is maintained local code. This project uses the SQLite
  adapter, not a MySQL connection; the MySQL protocol advisories are retained in
  the installed tree rather than exercised by that adapter.

Do not use `npm audit fix --force`: its suggested Prisma 6.19.3 downgrade changes
the adapter/client architecture. Do not force incompatible native dependency
majors merely to suppress audit output. Track upstream compatible fixes in M8.
