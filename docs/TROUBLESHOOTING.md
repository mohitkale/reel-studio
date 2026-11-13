# Troubleshooting

Start with `npm run doctor`. It checks Node, FFmpeg/FFprobe, the browser used for
exports and writable storage, and reports optional components (such as
whisper.cpp) as warnings. **Diagnostics** in the app shows the same plus queue and
worker state.

## Setup and environment

- **Wrong Node version.** Use Node 24 LTS, minimum 24.15 (`nvm use`).
- **Export cannot find a browser.** Install Chrome or Chromium. Verification
  scripts accept `REEL_VERIFY_CHROME` to select an executable.
- **FFmpeg missing.** Install FFmpeg and FFprobe on `PATH`, then rerun the doctor.
- **Local AI server unreachable.** Use manual or deterministic planning while you
  fix its endpoint in Settings; Reel Studio starts without these servers.
- **Heavy machines.** Run no more than two test workers, and avoid running video
  matrices and the full test suite together.
- Keep `.env.local`, `.data/`, SQLite/WAL/SHM files and `media/` out of Git.

## Database and upgrades

Stop the app and worker before database changes. Use `npm run db:migrate` (or
`npm run setup`), never `db:push`. Back up the database and `media/` together
before upgrading; see [Getting started](GETTING_STARTED.md#upgrading-and-rolling-back).

## Rendering and jobs

- A render interrupted by a development reload can be retried after the reload.
- Queued cancellation is immediate; active cancellation stops the renderer
  process tree. After a crash the supervisor restarts the worker (five attempts,
  bounded backoff). If both processes stop, restart with `npm run dev` or
  `npm run start`.
- Interrupted local renders recover their lease; audio and provider work needs an
  explicit **Retry** so paid requests are never replayed automatically.
- Do not run a second worker for normal use.
- `npm run test:production-worker` runs an isolated real export plus a cancellation
  check; `npm run test:video-sections` covers chaptered exports.

## Voice and captions

- Long text is split into sentence chunks of at most 220 characters and joined in
  order; one failed chunk fails the request. A full server queue returns a
  retryable 503. Server model load, queue wait and synthesis share a 120-second
  deadline.
- Cloud synthesis deadlines are two minutes; VoiceForge synthesis ten minutes.
- ElevenLabs free/Starter plans reject 44.1 kHz WAV; Reel Studio falls back to
  24 kHz and resamples.
- Provider word timing is used only when every word matches the current script and
  frame rate. Otherwise captions are labeled **estimated** and keep no word
  timing. Optional whisper.cpp supplies measured timing.
- Podcast generation needs a server voice (`kokoro-server`); browser-only
  providers are rejected.

## Limits you may hit

Ordinary video 3 minutes, chaptered video 5 minutes (lesson direction 10), podcast
10 minutes, recorded or imported podcast audio 15 minutes, waveform editing 128 MiB
and 30 minutes, ordinary JSON 4 MiB, asset uploads 25 MiB, remote export assets
250 MiB. Remote assets must be public HTTP(S); local media is copied into the
render automatically. Unsplash hotlinks are preview-only; exports ask for a
licensed download instead.

Remote browser hosting is not supported without your own authentication layer;
see [SECURITY.md](../SECURITY.md). Report problems at
[GitHub issues](https://github.com/mohitkale/reel-studio/issues) with steps, OS,
Node version and redacted logs.
