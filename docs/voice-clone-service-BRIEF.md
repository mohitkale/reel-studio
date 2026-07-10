# Build Brief: "VoiceForge" — a local-first, open-source voice cloning service

Paste this whole file into a fresh Cursor/Claude Code agent as the opening
prompt, in a **new, empty repository**. Treat it as a product spec, not a
one-shot script: plan, propose the stack, confirm key choices, then build in
milestones. "VoiceForge" is a placeholder name — rename freely.

This service is designed from day one to be consumed by **Reel Studio**
(a separate, existing Next.js app) as a self-hosted voice provider, but it
must also work as a fully standalone, general-purpose open-source project
with no dependency on Reel Studio.

---

## 1. Mission

Build a local-first web service that clones a person's voice from their own
recorded/uploaded audio and turns arbitrary text into speech in that voice —
the open-source, self-hosted alternative to ElevenLabs' and Cartesia's
paid voice-cloning APIs.

Two accuracy tiers, matching how these commercial products behave:

1. **Instant clone** — ~10–30 seconds of reference audio, zero training,
   result in seconds. Good but imperfect similarity (roughly "80%").
2. **High-fidelity clone** — a longer recording (a few minutes) processed
   through a short local training/fine-tuning step, producing a persistent
   per-voice model that sounds much closer to the source ("90%+"), reused for
   every future synthesis without re-uploading audio.

Non-negotiable qualities:

- **100% local-first.** No cloud TTS vendor, no API keys required to
  function, no per-character billing, no rate limits. Runs on a dev machine
  or a self-hosted VPS/GPU box you control.
- **Audio-only cloning.** Users record (browser mic) or upload an audio file.
  No video processing, no video-to-audio extraction.
- **Multi-engine, pluggable.** Several open-source cloning engines are
  supported behind one interface, and the user picks which engine to use per
  voice — no single vendor lock-in, and it lets users compare quality/speed
  trade-offs themselves.
- **API-first.** Every capability is exposed over HTTP so any client
  (Reel Studio, a CLI, curl, another app) can drive it. No feature is
  UI-only.
- **Non-commercial / demo-friendly.** This is a personal open-source project
  for a GitHub portfolio, not a commercial SaaS. Favor permissively licensed
  engines where practical, but it's acceptable to include engines with
  research/non-commercial licenses (e.g. Coqui's CPML) as long as this is
  documented clearly in the README and enforced by an honesty-based consent
  step, not a hard legal gate.
- **GPU available, CPU fallback.** Assume the operator has (or will buy) an
  NVIDIA GPU (8GB+ VRAM realistic target, e.g. RTX 3060/4060 Ti or better),
  but every engine should also run on CPU (slower) so the project is usable
  without one.

---

## 2. Why a separate service, not part of Reel Studio

Reel Studio is a TypeScript/Next.js app. Its existing local TTS (Kokoro) runs
via `kokoro-js` (ONNX) directly in Node/browser because Kokoro is small and
has a JS port. Real voice-cloning engines (XTTS-v2, OpenVoice, RVC, F5-TTS,
...) are PyTorch models with heavy native/CUDA dependencies and multi-GB
checkpoints — there is no realistic JS port. They belong in their own
Python process, packaged as a standalone service with its own Docker image,
release cycle, and README, consumed by Reel Studio (or anything else) purely
over HTTP. This also makes VoiceForge independently useful and a much
stronger open-source artifact on its own.

---

## 3. High-level architecture

```
┌─────────────────────┐        HTTP (REST + SSE)        ┌───────────────────────────┐
│   Reel Studio (or    │ ───────────────────────────────▶│  VoiceForge service        │
│   any other client)  │◀─────────────────────────────── │  (FastAPI, Python)         │
└─────────────────────┘        WAV bytes / JSON          │                             │
                                                          │  ┌───────────────────────┐  │
                                                          │  │ Engine registry        │  │
                                                          │  │ (pluggable, like Reel  │  │
                                                          │  │ Studio's VoiceProvider)│  │
                                                          │  └──────────┬────────────┘  │
                                                          │             │               │
                                                          │   ┌─────────┼─────────┐     │
                                                          │   ▼         ▼         ▼     │
                                                          │ XTTS-v2  OpenVoice  F5-TTS   │
                                                          │  RVC (voice-conversion tier) │
                                                          │                             │
                                                          │  SQLite (voice metadata)     │
                                                          │  data/ (samples, embeddings, │
                                                          │        checkpoints, cache)   │
                                                          └───────────────────────────┘
```

Single Python process (FastAPI + Uvicorn), background tasks for
training/fine-tuning jobs, SQLite for metadata (this is a single-user,
local-first tool — no need for Postgres/Redis unless you want them later),
and a `data/` directory on disk for audio samples, speaker embeddings, and
trained checkpoints — mirroring how Reel Studio treats its own `media/`
folder as the source of truth alongside a lightweight DB.

---

## 4. Engine abstraction (the core design decision)

Define one Python interface, implement it once per engine — exactly the
same "factory / strategy" pattern Reel Studio already uses for its voice
providers (`src/providers/voice/*.ts` in the Reel Studio repo — read that
folder for the reference pattern if you have access to it). The API and any
UI must talk only to this interface, never to a specific engine's SDK.

```python
class CloneCapabilities(BaseModel):
    zero_shot: bool                 # can clone from a short sample instantly
    fine_tunable: bool              # supports a training step for higher fidelity
    min_sample_seconds: float
    recommended_sample_seconds: float
    languages: list[str]
    requires_gpu: bool              # strongly recommended / practically required
    license: str                    # e.g. "MIT", "Apache-2.0", "CPML (non-commercial)"
    approx_vram_gb: float | None

class CloneEngine(Protocol):
    id: str                         # "xtts-v2", "openvoice-v2", "f5-tts", "rvc"
    label: str
    capabilities: CloneCapabilities

    def is_ready(self) -> bool:
        """Model weights downloaded/loaded and usable right now."""

    async def create_voice(
        self, voice_id: str, sample_paths: list[Path], tier: Literal["instant", "high_fidelity"]
    ) -> VoiceArtifact:
        """
        Instant tier: extract a speaker embedding/conditioning latent, store it.
        High-fidelity tier: kick off a background fine-tune/training job;
        caller polls status or listens over SSE.
        """

    async def synthesize(
        self, voice_id: str, text: str, opts: SynthesizeOptions
    ) -> bytes:
        """Return 16-bit PCM WAV bytes."""
```

An **engine registry** (`app/engines/registry.py`) maps engine id → instance,
exactly like Reel Studio's `registry.ts`. Adding a new engine later = one new
file + one registry entry, nothing else changes.

### Recommended engines (build in this order)

| Priority | Engine | Type | License | Zero-shot | Fine-tune | Notes |
|---|---|---|---|---|---|---|
| 1 (MVP) | **XTTS-v2** (Coqui) | TTS | CPML (non-commercial) | Yes, 6–30s ref | Community fine-tune recipes exist | Most mature, best docs/community, multilingual, streaming-capable. Use the maintained community fork (`coqui-tts` on PyPI) since original Coqui Inc. is defunct. |
| 2 | **F5-TTS** | TTS | Apache-2.0/CC | Yes, ~10s ref | — | Newer, benchmarks above XTTS-v2 on similarity/naturalness in several evals, permissive license — good default once validated. |
| 3 | **OpenVoice V2** (MyShell) | TTS + tone/style transfer | MIT | Yes, short ref | — | Genuinely permissive, lighter weight, decent quality, good CPU fallback candidate. |
| 4 (high-fidelity tier) | **RVC** (Retrieval-based Voice Conversion) | Voice conversion (not TTS) | MIT | No — needs a short per-voice training run (minutes, GPU) | Yes (that's its whole design) | Pipeline: any base TTS engine generates speech in a neutral voice → RVC model (trained on the user's longer sample) converts timbre to the target voice. This is the realistic path to "90%+" similarity, and it's the same technique behind most AI voice-cover tools. |

Start with **XTTS-v2 only** for the MVP (milestone M1). Add the others behind
the same interface once the core plumbing (upload → embed → synthesize →
serve) is proven end to end.

### Two-tier flow, concretely

- **Instant tier** (any zero-shot engine): user uploads/records 10–30s →
  service extracts a speaker embedding/conditioning latent (seconds, no
  training) → voice is immediately usable via `/synthesize`.
- **High-fidelity tier**: user uploads a longer sample (a few minutes,
  ideally clean single-speaker audio) → service either (a) re-runs zero-shot
  conditioning with the longer/cleaner reference (some quality gain, still
  fast), and/or (b) trains an RVC model on it in the background (a genuine
  fine-tuning job, minutes on GPU / much longer on CPU) → once ready, that
  voice is flagged `high_fidelity` and future synthesis routes through the
  trained model instead of re-reading the raw sample.

### Measuring "80%" / "90%+" objectively

Don't rely on subjective judgement alone — build a small quality-check
script (`scripts/benchmark_quality.py`) using a speaker-verification
embedding model (e.g. SpeechBrain's ECAPA-TDNN or Resemblyzer) to compute
cosine similarity between the reference audio and generated samples, plus a
Whisper-based transcription check for intelligibility/WER. Track these
numbers per engine/tier in the README so the "80% / 90%+" claims are
demonstrable, not marketing language.

---

## 5. API contract

REST + one SSE endpoint for training progress. Keep response shapes close to
Reel Studio's own `SynthResult`/`VoiceSummary` types so the client-side
adapter is a thin mapping, not a translation layer.

```
GET  /healthz
GET  /v1/engines
     -> [{ id, label, capabilities, ready, configured }]

POST /v1/voices                     (multipart/form-data)
     fields: name, engine_id, tier ("instant" | "high_fidelity"),
             consent=true (required), audio file(s)
     -> { id, name, engineId, tier, status: "processing" | "ready" | "failed" }

GET  /v1/voices                     -> [{ id, name, engineId, tier, status,
                                            createdAt, previewUrl? }]
GET  /v1/voices/{id}                -> full detail incl. training progress
DELETE /v1/voices/{id}              -> deletes voice + its samples/checkpoints

POST /v1/voices/{id}/samples        (multipart) -> add more reference audio to
                                       an existing voice (progressive improvement,
                                       e.g. upgrade instant -> high_fidelity later)

GET  /v1/voices/{id}/events         (SSE) -> training/processing progress events

POST /v1/synthesize
     body: { voiceId, text, sampleRate?, speed?, language? }
     -> audio/wav bytes (streamed)

GET  /v1/voices/{id}/preview        -> a short cached sample clip (no text needed)
```

Auth: a single bearer token (`VOICEFORGE_API_TOKEN`), same pattern as Reel
Studio's `MCP_API_TOKEN` — required whenever the service is reachable beyond
localhost (e.g. on a VPS), optional for pure localhost dev. CORS locked down
to configured origins.

---

## 6. Suggested repo layout

```
voiceforge/
├── README.md
├── LICENSE
├── pyproject.toml            # or requirements.txt if you prefer plain pip
├── .env.example
├── docker/
│   ├── Dockerfile.cpu
│   ├── Dockerfile.gpu        # CUDA base image, nvidia runtime
│   └── docker-compose.yml    # both a cpu and gpu profile
├── app/
│   ├── main.py               # FastAPI app, CORS, auth middleware
│   ├── config.py             # env/settings (pydantic-settings)
│   ├── db.py                 # SQLite via SQLModel/SQLAlchemy
│   ├── api/
│   │   ├── voices.py
│   │   ├── engines.py
│   │   ├── synth.py
│   │   └── events.py         # SSE progress
│   ├── engines/
│   │   ├── base.py           # CloneEngine protocol + shared types
│   │   ├── registry.py
│   │   ├── xtts_v2.py
│   │   ├── openvoice.py
│   │   ├── f5_tts.py
│   │   └── rvc.py
│   ├── jobs/                 # background training/processing tasks
│   └── storage.py            # sample/embedding/checkpoint file layout
├── data/                     # git-ignored: db.sqlite, voices/{id}/samples,
│                              #   embeddings, checkpoints
├── models/                   # git-ignored: downloaded HF checkpoints cache
├── scripts/
│   ├── download_models.py
│   └── benchmark_quality.py
└── tests/
```

---

## 7. Tech stack

- **Language/runtime:** Python 3.11, FastAPI, Uvicorn.
- **ML:** PyTorch (CUDA build when GPU present, CPU build otherwise —
  Dockerfile picks the right one), Hugging Face Hub for model downloads
  (cache in `models/`, a named Docker volume so containers don't re-download
  gigabytes on every rebuild).
- **DB:** SQLite via SQLModel (or plain SQLAlchemy) — one file, zero ops,
  matches Reel Studio's own "SQLite is enough for a local-first single-user
  tool" choice.
- **Background jobs:** plain `asyncio` background tasks / a simple in-process
  queue is enough for a single-user local tool. Don't reach for
  Celery/Redis unless multi-worker scaling actually becomes necessary.
- **Audio:** `torchaudio`/`soundfile` for I/O and resampling; ship WAV out at
  a normalized sample rate (mirror Reel Studio's `TARGET_SAMPLE_RATE`
  convention from `src/lib/wav.ts` so no extra resampling is needed
  downstream).
- **Packaging:** `uv` or `pip-tools` for reproducible installs; pin PyTorch
  and each engine's dependencies carefully — this is the single biggest
  source of pain in ML repos.

---

## 8. Docker & deployment

Two image variants, since "works locally and on a VPS" has to cover both
GPU and CPU-only hosts:

- `Dockerfile.gpu` — CUDA-enabled base (e.g. `pytorch/pytorch:2.x-cudaXX.X-cudnn-runtime`),
  used with `docker-compose`'s `deploy.resources.reservations.devices` (NVIDIA
  Container Toolkit required on the host).
- `Dockerfile.cpu` — slim Python base, CPU-only torch wheel, works anywhere
  (a small/cheap VPS) but expect XTTS-v2/F5-TTS synthesis to take several
  seconds per sentence and RVC training to be impractically slow — document
  this clearly rather than pretending CPU is a full substitute.

```yaml
# docker/docker-compose.yml (sketch)
services:
  voiceforge:
    build:
      context: ..
      dockerfile: docker/Dockerfile.gpu   # swap to Dockerfile.cpu for CPU-only hosts
    ports: ["8089:8089"]
    environment:
      - VOICEFORGE_API_TOKEN=${VOICEFORGE_API_TOKEN}
    volumes:
      - ../data:/app/data
      - models-cache:/app/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
volumes:
  models-cache:
```

Reel Studio and VoiceForge stay **two independently deployed services**,
connected only by an HTTP URL — run both on one machine (`localhost:8089`),
or split them across a laptop + a GPU VPS, or run VoiceForge on a home GPU
box and point a cloud-hosted Reel Studio at it over a private
network/tunnel. No shared filesystem or process required.

---

## 9. Responsible-use considerations (worth doing even for a personal/demo project)

- Require an explicit `consent: true` field on voice creation ("I have the
  right to use this voice") — cheap to add, sets the right tone for an
  open-source release.
- Consider an optional inaudible watermark on generated audio (e.g. Meta's
  AudioSeal) as a "nice to have" — a good talking point in the README and
  genuinely responsible for a cloning tool, even non-commercial.
- Document clearly in the README that this is for personal/demo use and
  that engines like XTTS-v2 carry non-commercial license terms.

---

## 10. Milestones

- **M0 — Scaffold:** FastAPI skeleton, `/healthz`, SQLite models, Docker CPU
  image, empty engine registry, README with setup instructions.
- **M1 — MVP clone (XTTS-v2 only):** upload/record → instant zero-shot
  voice → `/synthesize` returns WAV. Manual quality check.
- **M2 — Quality benchmarking:** `scripts/benchmark_quality.py` (speaker
  similarity + WER), tune reference-audio preprocessing (trim silence,
  denoise, normalize loudness) since input quality drives output quality.
- **M3 — Multi-engine:** add F5-TTS and OpenVoice V2 behind the same
  interface; `GET /v1/engines` lets a client pick.
- **M4 — High-fidelity tier:** RVC training pipeline (base-TTS → RVC
  conversion), SSE training-progress events, "upgrade this voice" flow.
- **M5 — GPU packaging:** `Dockerfile.gpu`, docker-compose GPU profile,
  model-cache volume, a short VPS deployment doc.
- **M6 — Reel Studio integration:** see §11 below.
- **M7 — Polish & release:** consent flow, optional watermarking, demo
  GIF/video, LICENSE, GitHub release notes.

---

## 11. Reel Studio integration plan (do this in the Reel Studio repo, after M1+)

Reel Studio already has a clean `VoiceProvider` abstraction
(`src/providers/voice/types.ts`) that every vendor (Cartesia, ElevenLabs,
Kokoro) implements identically. Adding VoiceForge is additive and small:

1. **New provider file** `src/providers/voice/voiceforge.ts` implementing
   `VoiceProvider`:
   - `id: "voiceforge"`, `runtime: "server"`, `keyless: false` (needs the
     shared bearer token once the service isn't pure localhost).
   - `isConfigured()` → `VOICEFORGE_SERVICE_URL` is set (token optional for
     localhost-only setups).
   - `listVoices()` → `GET {url}/v1/voices`, map to `VoiceSummary` with
     `category: "cloned"`.
   - `listModels()` → `GET {url}/v1/engines`, expose engine choice as the
     model dropdown for the *clone-creation* flow (not per-synthesis, since a
     given cloned voice is already tied to the engine it was created with).
   - `synth(opts)` → `POST {url}/v1/synthesize`, parse the returned WAV with
     the existing `parseWav` helper from `src/lib/wav.ts`, same as
     `cartesia.ts` does today.
2. **Register it** in `src/providers/voice/registry.ts` and add
   `"voiceforge"` to `PROVIDER_IDS` in `types.ts`.
3. **Env vars** in `.env.example`: `VOICEFORGE_SERVICE_URL`,
   `VOICEFORGE_API_TOKEN` (optional). No changes needed to `secrets.ts`
   beyond adding these two keys.
4. **New UI flow** — a "Clone a voice" screen (new route or a panel inside
   `/voices`) that:
   - Records via the browser mic (`MediaRecorder`, reuse patterns already
     established in the client TTS worker code) or accepts a file upload.
   - Lets the user pick an engine from `GET /v1/engines` and a tier
     (instant vs. high-fidelity).
   - Submits to VoiceForge, shows progress (poll or subscribe to the SSE
     endpoint — Reel Studio already has an SSE pattern for render progress
     in `render-service.ts`/the render queue to copy from).
   - Once ready, the voice shows up automatically in the existing voice
     browser (`src/app/voices/page.tsx`) under the `voiceforge` provider,
     usable from the voiceover panel exactly like any other voice — no
     special-casing needed elsewhere in the app.
5. **Docker Compose:** keep them separate (per §8) — add a short note in
   Reel Studio's README pointing at the VoiceForge repo and the
   `VOICEFORGE_SERVICE_URL` env var, rather than merging the two
   `docker-compose.yml` files.

---

## 12. Open decisions to confirm with the user before/while building

- Final project name (placeholder used throughout: "VoiceForge").
- Whether M1's MVP engine should be XTTS-v2 (most mature) or F5-TTS
  (newer, better license) — recommend starting with XTTS-v2 for tooling
  maturity, re-evaluate after M2's quality benchmarks.
- Target GPU (once purchased) — VRAM budget changes which engines can run
  concurrently and whether RVC training is minutes or longer.
- Whether the RVC high-fidelity pipeline is in scope for the first public
  release or a fast-follow (it's meaningfully more complex than the
  zero-shot engines).
