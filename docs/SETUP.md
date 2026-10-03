# Setup and troubleshooting

## Requirements

- Node **24 LTS**, minimum **24.15** (`.nvmrc` selects major 24).
- Locked npm dependencies; use `npm ci` for reproducible installs.
- FFmpeg and FFprobe available on `PATH`.
- An installed supported Chrome/Chromium browser for local exports.
- Writable local SQLite and media directories.

```bash
npm ci
npm run setup
npm run doctor
npm run dev
```

Setup creates missing `.env.local` configuration, safely migrates recognized
databases, and seeds examples. It does not overwrite existing configuration.
Open `http://localhost:3000`; narration is off for the default Generate flow.
Kokoro fetches and caches its model weights on first synthesis if absent. Local AI
servers and whisper.cpp remain optional and separately managed.

## Useful commands

| Command                           | Purpose                                 |
| --------------------------------- | --------------------------------------- |
| `npm run demo`                    | Setup and supervised development launch |
| `npm run doctor`                  | Required/optional runtime diagnostics   |
| `npm run sample:export`           | Credential-free example export          |
| `npm run build` / `npm run start` | Build/run the production app and worker |
| `npm run seed:gallery`            | Install bundled gallery examples        |
| `npm run mcp`                     | Start the stdio agent integration       |

The normal launcher supervises the web app and one durable production worker.
Do not start another worker for ordinary use. See [runtime](RUNTIME.md).

## Configuration and local AI

Setup supplies the SQLite `DATABASE_URL`. Optional variables are documented in
[`.env.example`](../.env.example); keep real credentials in private `.env.local`.

In **Settings → Local AI director**, save an existing server endpoint, check its
connection, discover/select a model, then save again:

| Server    | Default endpoint         |
| --------- | ------------------------ |
| Ollama    | `http://127.0.0.1:11434` |
| LM Studio | `http://127.0.0.1:1234`  |
| llama.cpp | `http://127.0.0.1:8080`  |

Choose a model supporting the server's schema-constrained chat API. Reel Studio
does not install, start, or download these servers/models. Loopback is the
default; private LAN endpoints need explicit per-provider opt-in. Configuration
is stored in owner-protected `.data/local-ai-config.json`, separate from cloud keys.

Optional transcription uses your installed whisper.cpp via `WHISPER_CPP_BIN`
and `WHISPER_CPP_MODEL`. Caption editing and estimated timing work without it.

## Docker development

```bash
cp .env.example .env.local
docker compose up --build
```

- Compose publishes `127.0.0.1:3000` and supervises app plus worker.
- Named volumes hold Linux dependencies, database, build cache, and media.
- Source is mounted writable for hot reload; container code can modify host source.
- Rendering consumes host CPU/memory. This setup is for trusted development.
- For host model servers, use `host.docker.internal` with explicit provider LAN
  opt-in. Public media ingestion still rejects private-network sources.

## Troubleshooting and upgrades

- Run `npm run doctor`; check Node, FFmpeg/FFprobe, browser, and writable storage.
- If a local AI server is unavailable, use deterministic planning while repairing its configuration.
- Limit heavy local checks to two workers; avoid running video matrices and the full suite together on a small machine.
- Keep `.env.local`, `.data/`, SQLite/WAL/SHM files, and `media/` out of Git.
- Stop app/worker before database changes. Use `npm run db:migrate`, not `db:push`.
- Follow [v0.4.0 upgrade/rollback notes](RELEASE_0.4.0.md); back up both database and media.
- Remote browser hosting needs a designed authentication layer; read [SECURITY.md](../SECURITY.md).
