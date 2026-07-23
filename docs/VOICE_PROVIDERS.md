# Voice providers

| Provider | Where it runs | API key | Notes |
| --- | --- | --- | --- |
| **Web Speech** | Browser | No | Instant preview only |
| **Kokoro** | Browser (WASM) | No | Apache-2.0; upload takes to the server |
| **Kokoro server** | Local Node | No | Same model; used for podcast takes / server jobs |
| **Cartesia** | Cloud | Yes | Vendor commercial terms; cloning available |
| **ElevenLabs** | Cloud | Yes | Vendor commercial terms; free tier supported with WAV fallback |
| **VoiceForge** | Self-hosted | Optional token | Separate project; engine licences vary |

## Modes (video)

- **Oneshot** — one take for the whole reel
- **Per-scene** — generate/select clips per scene, then assemble

## Podcasts

Podcast takes run on the server. Prefer `kokoro-server` for a no-key local demo.
Client-only providers (`kokoro`, `webspeech`) are rejected for podcast generation.

## Licensing reminder

Generated and cloned voices may be restricted by provider terms. Do not assume
unrestricted commercial rights. See [LICENSING.md](LICENSING.md).
