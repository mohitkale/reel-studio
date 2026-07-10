# Build Brief: "Reel Studio" - a professional AI short-form video studio

Paste this whole file into Claude Code as the opening prompt. Build it from
scratch in a new folder. Treat this as a product spec, not a one-shot script:
plan, propose the stack, confirm key choices with me, then build in milestones.

> **Licensing note (current repo):** Reel Studio application code is MIT.
> Remotion (required for composition/render) is **not** OSI open-source — see
> [`docs/LICENSING.md`](./LICENSING.md). Do not document Remotion as MIT.

---

## 1. Mission

Build a local-first web app that lets one person produce premium, professional
vertical short-form videos (TikTok / Reels / Shorts) end to end:

1. Write a script (scene by scene).
2. Generate the voiceover with a pluggable AI voice provider (Cartesia or
   ElevenLabs to start, more later), choosing from that provider's default
   voices or my own cloned voices.
3. Compose the video with real motion design (Remotion + Lottie + Three.js +
   images, icons, emojis, avatars, infographics), not flat gradient slides.
4. Render to MP4 and manage everything in a clean, professional library UI.

The current prototype looked unfinished and had a weak dashboard. Start fresh.
You may reuse prior sample content (script beats, provider request shapes, and
WAV stitching logic) as reference, but rebuild the architecture and UI properly.

## 2. Non-negotiable qualities

- **Professional UX/UI.** Use a real design system and component library. The
  app should look like a polished SaaS tool: proper layout (top bar + sidebar),
  consistent spacing/typography, light and dark themes, loading/empty/error
  states, toasts, keyboard shortcuts, and WCAG 2.1 AA accessibility.
- **Premium video output.** Scenes should feel like a paid ad: motion graphics,
  Lottie animations, 3D accents (Three.js), iconography, infographic layouts,
  image and avatar support, tasteful transitions and easing. No reliance on
  plain gradient backgrounds as the main visual.
- **Extensible voice layer.** A clean provider abstraction (factory / strategy)
  so adding a new TTS vendor later is a small, isolated change.
- **Type-safe and tested.** TypeScript everywhere, linting, and tests on the
  core logic (provider layer, timing/sync, render pipeline).

## 3. Recommended stack (propose alternatives if you have better)

- **App:** Next.js (App Router) + TypeScript. One process serves UI and API.
- **UI:** Tailwind CSS + shadcn/ui (Radix primitives) for accessible components.
  Icons via lucide-react. Use a clean type scale and a small design-token set.
- **Video:** Remotion 4 (keep Remotion Studio available as a dev surface).
  - Lottie via `@remotion/lottie`.
  - 3D via `@remotion/three` (Three.js).
  - Audio via Remotion `<Audio>`, captions synced to measured voice timing.
- **Rendering:** server-side via `@remotion/renderer` (bundle + renderMedia) with
  a small job queue and progress reporting (SSE or polling). Remotion bundles
  ffmpeg, so no separate ffmpeg install.
- **Persistence:** SQLite via Prisma for metadata (projects, scripts, scenes,
  takes, renders, settings). Store binary assets (audio, video, images, Lottie
  JSON) on disk in a structured `media/` folder referenced by the DB.
- **State/data:** TanStack Query for client data fetching; Zod for validation of
  API inputs and provider responses.

Keep secrets out of git. API keys are entered in a Settings UI and stored in a
local, git-ignored location (e.g. `.env.local` or an encrypted local store),
never hardcoded.

## 4. Voice provider abstraction (the factory)

Define one interface and implement it per vendor. The UI talks only to the
interface, never to a vendor directly.

```ts
export type ProviderId = "cartesia" | "elevenlabs";

export interface VoiceSummary {
  id: string;
  name: string;
  category: "default" | "cloned" | "professional" | "shared";
  language?: string;
  previewUrl?: string;     // to play a sample without spending credits
  tags?: string[];
}

export interface SynthOptions {
  voiceId: string;
  modelId?: string;
  text: string;
  sampleRate?: number;     // normalize to 44100
  // optional expressive controls where supported:
  speed?: number; emotion?: string; stability?: number; similarity?: number;
}

export interface VoiceProvider {
  id: ProviderId;
  label: string;
  isConfigured(): boolean;                 // key present?
  listModels(): Promise<{ id: string; label: string }[]>;
  listVoices(): Promise<VoiceSummary[]>;   // MUST include default + my cloned voices
  synth(opts: SynthOptions): Promise<{ wav: Buffer; sampleRate: number }>; // return 16-bit PCM WAV
}

export function getProvider(id: ProviderId): VoiceProvider; // registry/factory
```

Requirements:

- A provider **registry** maps `ProviderId -> implementation`. Adding a vendor =
  add one file + register it. The UI lists configured providers dynamically.
- `listVoices()` must merge the vendor's **default/library voices** and the
  user's **cloned/owned voices**, tagged via `category`, with search and filter
  in the UI, plus inline preview playback.
- `synth()` returns a normalized 16-bit PCM WAV at 44100 Hz so the rest of the
  pipeline is vendor-agnostic. Convert from whatever the vendor returns.

### Provider facts to implement against (verify against live docs first)

**Cartesia** (I already use this; I have a cloned voice named "mohit").
- Auth: `Authorization: Bearer <key>` + header `Cartesia-Version: 2025-04-16`.
- TTS: `POST https://api.cartesia.ai/tts/bytes` with body
  `{ model_id, transcript, voice:{mode:"id",id}, output_format:{container:"wav",encoding:"pcm_s16le",sample_rate:44100} }`.
  Default model `sonic-2`.
- Voices: `GET https://api.cartesia.ai/voices?is_owner=true&q=<name>` for my
  cloned voices; without `is_owner` for the public library. Fields include
  `id, name, is_owner, is_public, language`.
- Docs: https://docs.cartesia.ai/api-reference/tts/bytes and
  https://docs.cartesia.ai/api-reference/voices/list

**ElevenLabs** (add as a second provider).
- Auth: header `xi-api-key: <key>`.
- TTS: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` (optionally
  `/with-timestamps` for word timing). Default model `eleven_multilingual_v2`;
  also `eleven_turbo_v2_5`, `eleven_flash_v2_5`, `eleven_v3`.
- Voices: `GET https://api.elevenlabs.io/v2/voices` (my voices, incl. cloned;
  `category` distinguishes cloned/professional/premade); shared library via
  `GET https://api.elevenlabs.io/v1/shared-voices`. Models via `GET /v1/models`.
- Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert and
  https://elevenlabs.io/docs/api-reference/voices

Always confirm the exact current request/response shapes from the live docs
before coding, and write the parser around the real response.

## 5. Voiceover timing (caption sync)

Generate audio **per scene/beat** so each clip's exact duration is known
(measure the returned WAV; no external tools needed). Store per-beat
`startFrame` and `durationFrames`, then stitch the beats (with small gaps) into
one track. The video reads this timing so captions always match the voice.
Support multiple takes per script (compare and pick); never auto-delete a take
(credits cost money).

## 6. Video composition system (the premium part)

Replace "one gradient template" with a **scene-based composition engine**:

- A script is a list of **scenes**; each scene has a layout/template, text, and
  an asset set (images, icons, Lottie, 3D element, avatar, emoji, chart/infographic).
- Build a **library of professional scene templates** (start with ~10) that use
  real motion design, for example:
  - Kinetic typography with masked reveals and variable-font weight animation.
  - Lottie-driven explainer scenes (animated icons, checkmarks, arrows).
  - 3D accent scenes via Three.js (rotating device mockup, extruded logo, depth
    parallax) used tastefully, not as a gimmick.
  - Infographic scenes: animated stats, bar/line charts, comparison tables.
  - Chat / messaging scenes (the cover-letter example) with realistic bubbles.
  - Image-led scenes with Ken Burns + grain + duotone treatments.
  - Avatar/talking-head slot (image or Lottie avatar) with lower-thirds.
- A shared **design-token system** (palettes, fonts, spacing, shadow, radius) so
  templates are consistent and re-skinnable as "brand kits."
- Smooth transitions between scenes (`@remotion/transitions`) with proper
  spring easing. Add subtle sound-design hooks later (optional).
- An **asset manager**: upload/import images, Lottie JSON, pick icons (lucide),
  emojis, and store them in the library for reuse across videos.

Output: 1080x1920, 30fps, MP4, with the chosen voice take muxed in.

## 7. Data model (Prisma sketch - refine as needed)

- `Project` (id, name, brandKitId, createdAt)
- `BrandKit` (palette, fonts, logo asset, handle, cta defaults)
- `Script` (id, projectId, name, fps, brand overrides)
- `Scene` (id, scriptId, order, templateId, text, emphasis, layout JSON, assetRefs)
- `VoiceTake` (id, scriptId, providerId, voiceId, modelId, totalFrames, timing JSON, audioPath, createdAt)
- `Render` (id, scriptId, voiceTakeId, templateSetId, status, progress, outputPath, createdAt)
- `Asset` (id, type[image|lottie|audio|3d|avatar], path, meta)
- `ProviderSetting` (providerId, hasKey, defaultModel) - key stored securely, not in DB plaintext

## 8. UX / screens

- **Dashboard / Projects:** grid of projects with thumbnails, create/duplicate.
- **Editor (per script):** left scene list (reorderable), center preview player
  (Remotion Player for live preview), right inspector (scene text, template,
  assets, brand). Top bar: project name, provider/voice selector, Render button.
- **Voice panel:** provider tabs (Cartesia / ElevenLabs), searchable voice list
  split into "My voices" and "Library", inline preview, model picker, Generate;
  takes list with players and "use this take".
- **Template gallery:** real animated thumbnails/previews, not color swatches.
- **Asset library:** manage images, Lottie, icons, avatars.
- **Render queue:** progress bars, logs, output players, download.
- **Settings:** enter/rotate API keys per provider; pick default provider/model;
  theme.
- Keep **Remotion Studio** runnable too (`npm run studio`) for deep tweaks.

## 9. Engineering standards

- TypeScript strict. ESLint + Prettier. Zod-validate all API and provider IO.
- Clear module boundaries: `providers/`, `render/`, `library/` (db), `app/` (ui),
  `compositions/` (Remotion), `assets/`.
- Tests: unit tests for the provider factory (mock HTTP), timing/sync math, and
  the render-props builder. One smoke test that renders a 3-second composition.
- Robust error handling surfaced in the UI (provider 4xx/5xx, missing key, render
  failure) with actionable messages.
- Never commit secrets. Provide `.env.example`. Document setup in a README.

## 10. Milestones (build in this order, each independently runnable)

1. **Scaffold + design system.** Next.js + Tailwind + shadcn, theming, layout
   shell, empty states. Acceptance: app runs, looks professional, navigable.
2. **Provider layer.** Interface + factory + Cartesia and ElevenLabs
   implementations + Settings to store keys. Acceptance: list default + cloned
   voices for each configured provider, play previews.
3. **Scripts + scenes + voice takes.** Editor, per-scene voicing, timing, multi
   take. Acceptance: write a script, generate a take, see synced timing.
4. **Composition engine + 3 premium templates** (one kinetic, one Lottie, one
   3D). Live preview in the Player. Acceptance: switch templates, preview synced
   to audio.
5. **Render pipeline + queue.** Server render with progress, library of outputs.
   Acceptance: 1-click render to MP4 with audio, downloadable.
6. **Asset manager + remaining templates (to 10) + brand kits.**
7. **Polish:** accessibility pass, keyboard shortcuts, light/dark, error states.

## 11. Seed content to migrate

Reuse the **AI Unstuck Episode 1** script as the first project's first script.
If migrating from another project, import the existing beat JSON and any local
sample WAV file as the first take to avoid spending credits during early tests.

## 12. My setup / preferences

- I will paste Cartesia and ElevenLabs API keys into the app's Settings screen,
  so build that screen early. Do not hardcode keys.
- Plain, simple English in any user-facing copy. Avoid em-dashes.
- Ask me to confirm the stack and milestone 1 scope before writing lots of code,
  then proceed milestone by milestone, showing me a runnable result each time.

## 13. Definition of done (MVP)

I can: open the app, enter a provider key in Settings, pick a provider and a
voice (default or my cloned one), write a multi-scene script, generate a synced
voice take, choose a premium template that uses motion design (Lottie or 3D),
preview it live, render an MP4 with my voice, and download it - all from a clean,
professional UI, with the voice layer structured so a new provider can be added
with one new file.
