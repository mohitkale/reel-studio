# Licensing & third-party terms

Transparency matters: **Reel Studio’s own code is MIT**, but several
dependencies and optional integrations are **not** MIT (and some are not
open-source at all). This document is the canonical summary. Always verify
upstream terms before commercial or enterprise use — they can change.

## Reel Studio (this repository)

| Item | License |
| --- | --- |
| Application source code, templates, UI, MCP server code | **MIT** — see [`LICENSE`](../LICENSE) |
| Bundled ambient music under `public/music/` | **CC0 / public domain** — see [`public/music/README.md`](../public/music/README.md) |
| Contributions | Accepted under the MIT License (see [`CONTRIBUTING.md`](../CONTRIBUTING.md)) |

The MIT License covers **our** code only. It does **not** relicense Remotion,
cloud APIs, stock/music providers, or VoiceForge model weights.

---

## Critical dependency: Remotion (not open-source)

**Remotion is the default video engine.** For Remotion projects, preview and MP4
export use Remotion (`remotion`, `@remotion/player`, `@remotion/renderer`,
`@remotion/bundler`, `@remotion/lottie`, `@remotion/three`,
`@remotion/transitions`, `@remotion/google-fonts`, `@remotion/cli`). New projects
can choose **HyperFrames** instead (see below); Remotion packages may still be
installed even if you only create HyperFrames projects.

| Fact | Detail |
| --- | --- |
| License name | **Remotion License** (proprietary / source-available) |
| OSI open-source? | **No** — [Remotion FAQ](https://www.remotion.dev/docs/license-pricing-compliance/faq) |
| Upstream terms | [remotion.dev/license](https://www.remotion.dev/license) · [remotion.pro/terms](https://www.remotion.pro/terms) · [remotion.pro/license](https://www.remotion.pro/license) |

### Who can use Remotion for free?

Per Remotion’s published terms (verify current wording upstream), the **Free
License** typically covers:

- Individuals
- For-profit organizations with **up to 3 employees**
- Non-profit / not-for-profit organizations (as defined by Remotion)
- Evaluation before commercial adoption

For-profit organizations with **4 or more employees** generally need a paid
**Company License** (Creators and/or Automators options).

### What this means for Reel Studio users

1. **Cloning and running this repo** makes you a Remotion user. Your
   eligibility for Remotion’s Free vs Company License is **your**
   responsibility, independent of Reel Studio’s MIT license.
2. Reel Studio calls `renderMedia()` for exports — that is an **automation**
   under Remotion’s definitions. Larger companies typically need the
   **Remotion for Automators** option when they fall under the Company License.
3. Building a video editor on Remotion (drag-and-drop UI, no “upload arbitrary
   Remotion projects for cloud render”) is an **allowed** use case per
   Remotion’s FAQ/terms.
4. The Remotion Player in the editor uses `acknowledgeRemotionLicense` as
   required by Remotion’s Player API.

We do **not** sell, relicense, or sublicense Remotion. Do not imply that
shipping or using Reel Studio under MIT removes Remotion’s company-size or
usage obligations.

---

## Optional video engine: HyperFrames (Apache 2.0)

Projects can choose **HyperFrames** instead of Remotion at creation time
(`videoEngine: "hyperframes"`). Preview and MP4 export then use HeyGen’s
open-source HTML→video stack (`@hyperframes/producer` and related packages).

| Fact | Detail |
| --- | --- |
| License | **Apache License 2.0** (OSI-approved) |
| Upstream | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) · [hyperframes.heygen.com](https://hyperframes.heygen.com/) |
| Commercial use | Allowed at any scale on the self-hosted OSS stack — no Remotion company/automator seat fees |
| Runtime | Node.js **≥ 22**, Chrome/Chromium, FFmpeg (bundled/auto-downloaded by the producer) |
| Hosted MCP | HeyGen’s cloud MCP (`mcp.heygen.com`) is **optional / external** and uses HeyGen credits — Reel Studio does **not** require it; local render goes through `@hyperframes/producer` |

HyperFrames does **not** replace Remotion for existing Remotion projects. Engine
choice is per-project and fixed at creation.

---

## Local / permissive runtime dependencies (selected)

These are commonly used with Reel Studio and are generally permissive. Confirm
each package’s `LICENSE` file in `node_modules` for the exact text.

| Dependency | Typical license | Role |
| --- | --- | --- |
| Next.js, React, React DOM | MIT | App framework |
| Prisma / `@prisma/client` | Apache-2.0 | Database |
| Tailwind / Radix UI / lucide-react | MIT | UI |
| TanStack Query, Zod, Three.js | MIT | Data / 3D |
| `kokoro-js` / Kokoro model | Apache-2.0 | Local TTS |
| `@modelcontextprotocol/sdk` | MIT / Apache-2.0 (see package) | MCP server |
| `@hyperframes/producer` (optional engine) | Apache-2.0 | HyperFrames HTML→MP4 export |

---

## Optional cloud & media providers

These are **not** part of the MIT grant. Using them means you accept **their**
terms, pricing, and attribution rules. Keys are optional; the app runs without
them.

| Provider | What it powers | Notes |
| --- | --- | --- |
| **Unsplash** | Optional AI stock backgrounds | [Unsplash License](https://unsplash.com/license) + [API guidelines](https://unsplash.com/api/terms) (attribution / download ping). Hotlinked CDN URLs; photographer credit is stored when available. |
| **Jamendo** | Optional Creative Commons music search | Tracks carry their own **CC** licenses (shown via attribution strings). Follow Jamendo’s API/developer terms. |
| **Cartesia** | Cloud TTS / cloning | Vendor commercial ToS + usage limits |
| **ElevenLabs** | Cloud TTS | Vendor commercial ToS + usage limits |
| **Google Gemini** | Optional AI scene planning | Google AI / Gemini terms |
| **OpenAI** | Optional AI scene planning | OpenAI terms |

**Web Speech API** (browser preview) is provided by the browser vendor; it is
preview-only and is not used for final MP4 voice tracks.

---

## Optional: VoiceForge (separate project)

Voice cloning via [VoiceForge](https://github.com/mohitkale/voiceforge) is an
**optional** HTTP integration (`VOICEFORGE_SERVICE_URL`). VoiceForge is a
separate repository with its own MIT code license and **engine-specific model
licenses**.

| Engine | Likeness | Speed on CPU | License (typical) | Notes |
| --- | --- | --- | --- | --- |
| **OpenVoice V2** | Weak | Fastest | MIT (commercial OK) | Good for demos; not a close personal clone |
| **F5-TTS** | Strong | Very slow / may OOM | Apache-2.0 / CC (permissive) | Prefer GPU for real use |
| **XTTS-v2** | Strong | Very slow / may OOM | **CPML — non-commercial** | Do not use commercially |
| **RVC** | Highest (after train) | Needs training | MIT | GPU recommended; not zero-shot |

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

## Summary checklist

| Question | Answer |
| --- | --- |
| Can I open-source / fork Reel Studio under MIT? | **Yes** — for this repo’s code. |
| Is Remotion MIT / OSI open-source? | **No.** |
| Can I avoid Remotion License obligations by choosing HyperFrames? | **Yes for those projects** — preview/export use Apache-2.0 HyperFrames. Remotion deps may still be present in `node_modules`. |
| Can an individual use Remotion via Reel Studio for free? | **Usually yes** under Remotion’s Free License (verify upstream). |
| Can a 10-person company use Remotion via Reel Studio for free? | **Usually no** — they need a Remotion Company License (or use HyperFrames projects). |
| Does MIT on this repo waive Remotion fees for downstream users? | **No.** |
| Are Unsplash / Jamendo / cloud TTS “free forever, any use”? | **No** — follow each provider’s terms. |
| Is VoiceForge XTTS-v2 OK for commercial products? | **No** (CPML non-commercial); prefer F5-TTS / OpenVoice / RVC as documented there. |

When in doubt, read the upstream license pages linked above or ask Remotion /
the relevant vendor for written clarification for your entity size and use case.
