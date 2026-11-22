# Architecture

Reel Studio is a local-first Next.js app with Prisma/SQLite storage,
HyperFrames rendering, and optional AI/voice/media providers.

![System architecture](architecture.svg)

## Boundaries

| Area                      | Responsibility                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| `src/app`, `src/server`   | Pages, authenticated/validated API handlers, progress streams     |
| `src/library`             | Repositories, assets, render/take orchestration                   |
| `src/production`          | Saved specifications/revisions, durable jobs, stages, policies    |
| `src/providers`           | AI, voice, stock, and music transports                            |
| `src/engines/hyperframes` | Catalog, HTML composition, authored motion, isolated export       |
| `src/video`               | Engine-neutral scene, timing, brand, motion, and layout contracts |
| `mcp`                     | Stdio tools calling the same REST API with scoped credentials     |
| `scripts`                 | Supervision, render workers, setup, migration, and verification   |

## From source to output

![Production flow](render-flow.svg)

1. Manual/deterministic or configured AI planning creates an editable project.
2. Generate freezes a production revision and queues the durable stages.
3. Stages resolve/copy eligible media, reuse or generate audio, prepare timing,
   compile the composition, render, and verify the artifact.
4. SQLite stores progress/results; reconnect reads durable state.
5. Outputs retain their submitted revision while later edits remain independent.

Preview/export share resolved layout, timing, brand, caption, and local runtime
inputs. HyperFrames is the only supported engine. Existing legacy projects map
to current templates; saved historical provenance and existing MP4s remain intact.

## Runtime, jobs and recovery

- `npm run dev` and `npm run start` supervise Next.js and one production worker.
  `npm run production:worker` is for explicitly managed deployments only.
- Projects, revisions and jobs live in SQLite (WAL mode, five-second busy
  timeout); takes, uploads, caches and outputs live under `media/`.
- Voice, editor export, podcast and production work share persisted job state.
  Submission locks the script, brand, caption, take and eligible media inputs, so
  editing cannot change a submitted output. Reconnecting reads saved progress.
- Retries reuse valid stages and checksum-verified artifacts. Interrupted or
  uncertain provider work needs an explicit retry so paid work is never replayed
  by accident. Queued cancellation is immediate; active cancellation aborts IO and
  ends the owned renderer process tree.
- The supervisor restarts a crashed worker with bounded backoff (five attempts,
  reset after a minute of healthy uptime) and stops both processes if the web
  process fails.
- Chapter exports render in 30-second sections at 24/30/60 FPS and reuse verified
  cached frames when inputs are unchanged. Eligible short standard and high
  exports use five-second sections that retain global timing and include any
  dependent scene transitions. A failed selective render retries as a full
  export. Inactive render caches expire after
  seven days and trim toward 1 GiB. Final audio is mixed once and muxed once.
- MCP tokens: legacy tokens keep human approval for video renders; named scoped
  tokens may allow bounded automation (see [MCP](MCP.md)).

## Render speed

`npm run benchmark:render` renders silent golden storyboards at draft, standard and high
quality through the real pipeline and writes `docs/quality/render-benchmark.json`.
Use `npm run benchmark:render -- --one-scene-edit` for the six-scene portrait edit benchmark.
It records the full render and one-headline edit times in `.artifacts/render-benchmark.json`.
Measured on an Intel i7-9750H laptop (12 cores, 16 GB, Node 24), a 22.5 s 9:16 video
(`motivation`), development server on the same machine:

| Quality       | Render time | Render s per video s |
| ------------- | ----------: | -------------------: |
| draft, 30 fps |       132 s |                 5.85 |
| draft, 15 fps |       101 s |                 4.49 |
| standard      |       124 s |                 5.53 |
| high          |   133–200 s |            5.90–8.87 |

A draft preview captures a quarter of the pixels (a 540 by 960 canvas; the layout is authored at
full size and scaled as a whole, so nothing reflows) at half the frame rate. That brings a draft to
about 1.3 to 1.5 render seconds per video second end to end, including linting, planning, mastering
and the contact sheet:

| Draft (15 fps, half-size capture) |  Video | Render time | Render s per video s |
| --------------------------------- | -----: | ----------: | -------------------: |
| `motivation`                      | 22.5 s |     31-34 s |            1.37-1.53 |
| `how-to`                          | 49.9 s |        66 s |                 1.31 |

So a 45 s draft takes about 60 s on this machine; the fixed overhead is about 10 s. Frame capture
(the headless browser screenshotting each frame) is still most of the time. Standard and high
quality are unchanged and still capture full-size frames. Other capture modes (drawElement,
forcing screenshots off) made no difference here. Short native compositions up to 100 seconds
can reuse verified five-second sections. Each section includes the scenes and handoffs needed
for its frames. Drafts, imported HyperFrames blocks, and exports with 30-second section plans
keep their existing render paths.

## Bounds and safety

- Request bodies are counted from the real stream: 4 MiB for ordinary JSON,
  96 MiB for browser voice uploads, 25 MiB for asset uploads.
- Media GETs open one authorized regular file under the storage root, read it with
  backpressure and support ranges; traversal and symlink escapes are rejected.
- Remote export assets are downloaded before Chromium starts: HTTP(S) only, public
  addresses only, every redirect re-checked, 60-second deadline, 250 MiB cap,
  image/audio/video types only. Local http(s) media is copied into the render
  project as relative assets.
- Provider HTTP calls have deadlines (30 seconds for metadata, two minutes for
  cloud synthesis) and responses are capped at 128 MiB. Cloud keys are never
  attached to local-server requests.
- This is a single-user local application, not a hostile-code sandbox. Remote
  browser hosting needs its own authentication layer; read [SECURITY.md](../SECURITY.md).

Detailed contracts and the original hardening notes:
[production contracts](archive/release-evidence/CONTRACTS.md),
[bounded IO](archive/guides/IO_RECOVERY.md),
[portability and hardening](archive/guides/PORTABILITY_HARDENING.md). To add a
template, treatment or provider, see [Contributing scenes](CONTRIBUTING_SCENES.md).
