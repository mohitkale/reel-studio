# Reel Studio

A local-first web app for producing premium, professional vertical short-form
videos (TikTok / Reels / Shorts) end to end: write a scene-by-scene script,
generate AI voiceover, compose with real motion design (Remotion + Lottie +
Three.js), render to MP4, and manage everything in a clean SaaS-style library.

> Status: **Milestone 1 complete** (scaffold + design system). See
> `docs/ai-reel-studio-BRIEF.md` for the full product spec and the milestone plan.

## Stack

- **App:** Next.js (App Router) + TypeScript (strict), one process for UI + API.
- **UI:** Tailwind CSS v4, shadcn-style components on Radix, lucide-react icons,
  light/dark theming via next-themes, toasts via sonner.
- **Data/state:** TanStack Query (client), Zod for validation.
- **Video (later milestones):** Remotion 4 with Lottie, Three.js and transitions.
- **Persistence (later milestones):** Prisma + SQLite, behind a repository layer;
  binary assets on disk via a pluggable AssetStore.
- **Tooling:** ESLint, Prettier, Vitest.

## Architecture (plug-and-play)

Three layers are designed to be extended with one isolated file each:

1. **Voice providers** (`src/providers/voice/`) - one interface + a registry;
   adding a TTS vendor is one new file. Cartesia + ElevenLabs land in M2.
2. **Template / video engine** (`src/compositions/`) - a `TemplateRegistry` of
   self-describing scene templates. Lands in M4-M6.
3. **Storage** (`src/library/storage/`) - an `AssetStore` interface (local disk
   now, cloud-ready later) plus a DB repository layer.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### API keys

Provider keys are entered in the in-app **Settings** screen (from M2) and written
to a git-ignored `.env.local`. You can also copy `.env.example` to `.env.local`
and fill them in manually. Keys never leave your machine and are never committed.

## Scripts

| Script              | Purpose                         |
| ------------------- | ------------------------------- |
| `npm run dev`       | Start the dev server            |
| `npm run build`     | Production build                |
| `npm run start`     | Run the production build        |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run format`    | Format with Prettier            |
| `npm run test`      | Run unit tests (Vitest)         |

## Project layout

```
src/
  app/              # Routes (client editor) + /api route handlers (later)
  components/
    ui/             # Design-system primitives (button, card, ...)
    shell/          # App shell (sidebar, topbar, page header)
  lib/              # Utilities, nav config
  providers/voice/  # Voice provider interface + registry (M2)
  compositions/     # Remotion templates + registry (M4+)
  library/          # DB repositories + storage (M3+)
docs/               # Product brief
```
