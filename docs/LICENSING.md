# Licensing & third-party terms

Transparency matters: **Reel Studio’s own code is MIT**, but several
dependencies and optional integrations are **not** MIT (and some are not
open-source at all). This document is the canonical summary. Always verify
upstream terms before commercial or enterprise use — they can change.

## Reel Studio (this repository)

| Item                                                    | License                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Application source code, templates, UI, MCP server code | **MIT** — see [`LICENSE`](../LICENSE)                                               |
| Bundled ambient music under `public/music/`             | **CC0 / public domain** — see [`public/music/README.md`](../public/music/README.md) |
| Contributions                                           | Accepted under the MIT License (see [`CONTRIBUTING.md`](../CONTRIBUTING.md))        |

The MIT License covers **our** code only. It does **not** relicense dependencies,
cloud APIs, stock/music providers, or VoiceForge model weights.

Quick Produce changes orchestration, not licensing. Its immutable revision keeps
the selected engine, model/provider identifiers, media attribution snapshots,
and output metadata, but it does not grant new rights to any input or provider
output. The deterministic planner adds no model license. Server-side Kokoro uses
the same Apache-2.0 model listed below; Ollama, LM Studio, and llama.cpp users remain
responsible for the selected local model's terms.

---

## Video runtime

HyperFrames is the sole preview/export engine, licensed
[Apache-2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE).
Remotion dependencies and runtime support have been removed. Existing MP4 files
and immutable production provenance are retained; new exports use HyperFrames.

GSAP uses the [Standard License](https://gsap.com/community/standard-license/),
a custom no-charge license with restrictions, rather than an OSI license.
Therefore this runtime is not wholly Apache-2.0 or wholly OSI open source.
Reel Studio's own MIT license does not relicense dependencies or model weights.

The frozen browser/render runtime in `public/reel-runtime/` also bundles Geist,
Geist Mono, Inter, EB Garamond, Archivo Black and JetBrains Mono under OFL-1.1.
Their complete notices accompany the assets; the manifest records installed
source versions and checksums. Font aliases are rendered by genuine bundled
faces, rather than relabeling a sans font as a serif. See [export fidelity](EXPORT_FIDELITY.md).

## Local / permissive runtime dependencies (selected)

These are commonly used with Reel Studio and are generally permissive. Confirm
each package’s `LICENSE` file in `node_modules` for the exact text.

| Dependency                  | Typical license | Role                        |
| --------------------------- | --------------- | --------------------------- |
| Next.js, React, React DOM   | MIT             | App framework               |
| Prisma / `@prisma/client`   | Apache-2.0      | Database                    |
| Tailwind / Radix UI         | MIT             | UI                          |
| TanStack Query, Zod         | MIT             | Data validation             |
| lucide-react                | ISC             | Icons                       |
| Geist variable fonts        | OFL-1.1         | Typography                  |
| `kokoro-js` / Kokoro model  | Apache-2.0      | Local TTS                   |
| `@modelcontextprotocol/sdk` | MIT             | MCP server                  |
| `@hyperframes/producer`     | Apache-2.0      | HyperFrames HTML→MP4 export |

---

## Optional cloud & media providers

These are **not** part of the MIT grant. Using them means you accept **their**
terms, pricing, and attribution rules. Keys are optional; the app runs without
them.

| Provider          | What it powers                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unsplash**      | Optional AI stock backgrounds          | [Unsplash License](https://unsplash.com/license) + [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Returned CDN URLs remain hotlinked with `ixid`; attribution and the returned download-event endpoint are stored. Selection triggers that endpoint once and persists the known outcome. The reviewed terms do not establish a render-staging exception. Unsplash remains hotlinked in previews, is not copied into the generic local store, and exports using it are gated because the hardened renderer requires local staging.    |
| **Pexels**        | Optional stock photos and videos       | [Pexels License](https://www.pexels.com/license/) + [API documentation and guidelines](https://www.pexels.com/api/documentation/). Search results retain creator and Pexels source links; selected render renditions are validated and stored in the local media store.                                                                                                                                                                                                                                                                                                        |
| **Pixabay**       | Optional stock images and videos       | [Pixabay Content License](https://pixabay.com/service/license-summary/) + [API documentation](https://pixabay.com/api/docs/). API responses are cached for 24 hours; remote image URLs are temporary previews, while selected images and videos are validated and stored locally with contributor/source metadata.                                                                                                                                                                                                                                                             |
| **Coverr**        | Disabled stock-video adapter           | **License gate closed as of 2026-09-15.** The [API introduction](https://api.coverr.co/docs) says free API access cannot be used commercially, while the [developer page](https://coverr.co/developers) and [general license](https://coverr.co/license) say commercial use is allowed. The [API start page](https://api.coverr.co/docs/start/) describes demo and paid production tiers but does not resolve which terms govern Reel Studio's API use. Coverr remains disabled and no key is accepted or request made until API-specific clarification resolves the conflict. |
| **Jamendo**       | Optional Creative Commons music search | Tracks carry their own **CC** licenses (shown via attribution strings). Follow Jamendo’s API/developer terms.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Cartesia**      | Cloud TTS / cloning                    | Vendor commercial ToS + usage limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **ElevenLabs**    | Cloud TTS                              | Vendor commercial ToS + usage limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Google Gemini** | Optional AI scene planning             | Google AI / Gemini terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **OpenAI**        | Optional AI scene planning             | OpenAI terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Ollama**        | Optional local AI planning adapter     | Reel Studio sends prompts to the user-configured Ollama server. The user is responsible for the selected model's license and usage terms.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **LM Studio**     | Optional local AI planning adapter     | Reel Studio sends prompts to the user-configured LM Studio server. The user is responsible for LM Studio and the selected model's license and usage terms.                                                                                                                                                                                                                                                                                                                                                                                                                     |

llama.cpp planning uses the user-configured server; the integration's code is MIT.
The server and each selected model retain their own licenses. No model or server
binary is bundled by this adapter. See the [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

**Web Speech API** (browser preview) is provided by the browser vendor; it is
preview-only and is not used for final MP4 voice tracks.

---

## Optional: VoiceForge (separate project)

Voice cloning via [VoiceForge](https://github.com/mohitkale/voiceforge) is an
**optional** HTTP integration (`VOICEFORGE_SERVICE_URL`). VoiceForge is a
separate repository with its own MIT code license and **engine-specific model
licenses**.

| Engine           | Likeness              | Speed on CPU        | License (typical)            | Notes                                      |
| ---------------- | --------------------- | ------------------- | ---------------------------- | ------------------------------------------ |
| **OpenVoice V2** | Weak                  | Fastest             | MIT (commercial OK)          | Good for demos; not a close personal clone |
| **F5-TTS**       | Strong                | Very slow / may OOM | Apache-2.0 / CC (permissive) | Prefer GPU for real use                    |
| **XTTS-v2**      | Strong                | Very slow / may OOM | **CPML — non-commercial**    | Do not use commercially                    |
| **RVC**          | Highest (after train) | Needs training      | MIT                          | GPU recommended; not zero-shot             |

- Reel Studio surfaces each engine’s license + quality notes in the clone UI and
  engine picker (`src/providers/voice/voiceforge-engines.ts`).
- See VoiceForge’s **Licensing & responsible use** section before commercial use.
- Only clone voices you have the right to clone.

---

## User-uploaded content

Anything you upload (audio, images, logos, brand assets) remains **your**
responsibility. Reel Studio does not grant you rights to third-party material
you import. Bundled starter music is CC0; uploaded and Jamendo tracks are not
automatically cleared for every commercial scenario — check each track’s
license.

---

## Local-first expansion policy snapshot

The [PR 1 snapshot](production/archive/LOCAL_FIRST_TASKS.md#api-and-licensing-snapshot-2026-09-13)
records the earlier stock API research and release gates. The renderer restricts Unsplash
to hotlinked previews because the reviewed API guidance does not authorize a
video-render staging exception; its exports remain gated. Coverr remains disabled pending resolution of its API license gate.

## Verified bundled components (2026-10-03)

The locked `phonemizer` dependency now points to `vendor/phonemizer`, version
`1.2.1-reel.1`. Its linked eSpeak NG engine/data are **GPL-3.0-or-later**;
the Reel Studio adapter and C binding are MIT. This replaces the opaque engine
in the original Apache-labelled `phonemizer@1.2.1` package, whose exact build
provenance could not be verified. No claim is made that the old binary was built
from the new source revision.

The replacement was built on an isolated GitHub runner from eSpeak NG commit
`0dfd1d77dd7f96ef1ea6856c9fa5cfac01599582`, with Emscripten **3.1.30** and
emsdk commit `91f8563a9d1a4a0ec03bbb2be23485367d85a091`. The committed
[provenance manifest](../vendor/phonemizer/provenance.json) records source,
compiler and engine/adapter/binding/build-script hashes. The corresponding
[notice](../vendor/phonemizer/NOTICE), GPL, Apache, BSD, Unicode and Emscripten
license texts accompany the engine. Node and offline browser verification match
26 reference phoneme cases and eight English voices for Kokoro's American
`en-us` and British `en` language contract. Other language dictionaries are not
bundled. This test does not download or evaluate model weights.

The [v0.4.0 release](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0)
provides `reel-phonemizer-corresponding-source.tar.gz`: complete pinned eSpeak
source, voice/dictionary sources, the adapter/binding, build instructions,
compatibility fixture, and embedded Emscripten library/runtime source and notices.
Redistribution of the engine must preserve its GPL terms and provide matching
corresponding source; an Apache-only or MIT-only notice is insufficient. The app
installer uses the prebuilt engine and does not install a compiler or rebuild it.
The source archive is a separate release asset, not an app runtime download.

`npm run release:check` verifies the committed component hashes and notices;
`npm run test:phonemizer` verifies actual Kokoro dependency resolution and output.
The isolated source workflow rebuilds and compares the reference outputs before
producing the matching source asset. Before publication, additionally run
`node scripts/check-phonemizer-provenance.mjs --distribution`.

Kokoro's [model card](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/README.md)
declares Apache-2.0 for its weights; that does not change the phonemizer's terms.
This component inventory does not relabel the entire application or other
components under one license.

Optional XTTS-v2 weights and their outputs have non-commercial restrictions under
[CPML 1.0](https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt). They are not
bundled here. Other VoiceForge engines keep their individual model terms; the
integration's code license does not replace them. FFmpeg terms depend on the
installed build and enabled components; verify `ffmpeg -L` for distributed builds.

Run `npm run security:inventory` to list every lockfile package location, version
and declared license, including nested copies, together with the lockfile SHA-256.
Undeclared metadata and embedded components still require review. The security
reachability snapshot is in [PORTABILITY_HARDENING.md](PORTABILITY_HARDENING.md).
