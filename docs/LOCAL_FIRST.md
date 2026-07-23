# Local-first model

Reel Studio keeps **projects, assets, and renders on your machine by default**.
Optional AI, stock, and premium voice integrations only send data when you
configure a provider key and use that feature.

## What stays local

| Capability | Local behaviour |
| --- | --- |
| Projects & scripts | SQLite database under `prisma/` |
| Uploaded assets & renders | Files under `media/` (git-ignored) |
| HyperFrames / Remotion preview & MP4 export | Runs on your machine (or in Docker on localhost) |
| Kokoro TTS | In-browser or `kokoro-server` — no vendor API key |
| Web Speech preview | Browser-only |
| Bundled music | CC0 files in `public/music/` |
| Podcast scripts & takes | Local DB + `media/` audio |

## Optional cloud features

| Feature | Local option | Optional cloud |
| --- | --- | --- |
| Voice preview | Web Speech | — |
| Voice generation | Kokoro / VoiceForge | ElevenLabs, Cartesia |
| Video engine | HyperFrames (Apache-2.0) or Remotion | — (both render locally) |
| AI scene / podcast planning | Manual editing | Gemini, OpenAI |
| Backgrounds | Local upload / mood gradients | Unsplash |
| Music | Bundled CC0 / user upload | Jamendo |

## What leaves your machine

Only when you explicitly configure and use a provider:

- **Gemini / OpenAI** — script brief and planning prompts you submit
- **Unsplash** — search queries for stock backgrounds
- **ElevenLabs / Cartesia** — text (and cloning samples if you use those features)
- **Jamendo** — music search queries

Nothing is sent for analytics or telemetry. See [SECURITY.md](../SECURITY.md).

## VoiceForge

[VoiceForge](https://github.com/mohitkale) (separate repo when published) can be
connected as an optional self-hosted voice backend. It is not required to use
Reel Studio. Engine licenses inside VoiceForge vary — check that project’s docs.
