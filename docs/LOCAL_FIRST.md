# Local-first model

Reel Studio keeps **projects, assets, and renders on your machine by default**.
Optional AI, stock, and premium voice integrations only send data when you
configure a provider key and use that feature.

## What stays local

| Capability                                  | Local behaviour                                   |
| ------------------------------------------- | ------------------------------------------------- |
| Projects & scripts                          | SQLite database under `prisma/`                   |
| Uploaded assets & renders                   | Files under `media/` (git-ignored)                |
| HyperFrames / Remotion preview & MP4 export | Runs on your machine (or in Docker on localhost)  |
| Kokoro TTS                                  | In-browser or `kokoro-server` — no vendor API key |
| Web Speech preview                          | Browser-only                                      |
| Bundled music                               | CC0 files in `public/music/`                      |
| Podcast scripts & takes                     | Local DB + `media/` audio                         |

## Optional cloud features

| Feature                     | Local option                         | Optional cloud            |
| --------------------------- | ------------------------------------ | ------------------------- |
| Voice preview               | Web Speech                           | —                         |
| Voice generation            | Kokoro / VoiceForge                  | ElevenLabs, Cartesia      |
| Video engine                | HyperFrames (Apache-2.0) or Remotion | — (both render locally)   |
| AI scene / podcast planning | Manual, Ollama, or LM Studio         | Gemini, OpenAI            |
| Backgrounds                 | Local upload / mood gradients        | Pexels, Pixabay, Unsplash |
| Music                       | Bundled CC0 / user upload            | Jamendo                   |

## What leaves your machine

Only when you explicitly configure and use a provider:

- **Gemini / OpenAI** — script brief and planning prompts you submit
- **Pexels / Pixabay / Unsplash** — stock search queries and the selected
  provider asset request. Download-policy selections are cached in local media;
  compliant hotlinks retain their provider URL and attribution snapshot.
- **ElevenLabs / Cartesia** — text (and cloning samples if you use those features)
- **Jamendo** — music search queries

Nothing is sent for analytics or telemetry. See [SECURITY.md](../SECURITY.md).

Caption timing and appearance remain local project data. Each styled track keeps
a versioned snapshot used by both Remotion and HyperFrames; older tracks with no
snapshot retain the 0.4 caption appearance.

Quick Produce is off by default and does not introduce a cloud service. An
enabled request creates the editable project plus an immutable local
`ProductionRevision`, then uses the same SQLite queue and local render engines.
The deterministic planner and stock-free fallback require no provider. Its
default server-side Kokoro voice may download the model weights on first use;
use voice-off Quick Produce when an initial model download is not acceptable.

Ollama and LM Studio prompts go only to the configured local endpoint. Loopback
is the default; private LAN endpoints require an explicit per-provider opt-in.
Hostnames are resolved before each request, redirects are rejected, and cloud
keys are never attached to local requests. Local server absence does not prevent
Reel Studio from starting or using manual, Gemini, or OpenAI workflows.

## VoiceForge

[VoiceForge](https://github.com/mohitkale/voiceforge) is an optional self-hosted
voice cloning backend. It is not required to use Reel Studio. Engine licenses
inside VoiceForge vary — check that project’s docs.
