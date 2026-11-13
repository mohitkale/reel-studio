# Feature inventory

Reel Studio is being simplified (see the roadmap, issue #140), but **nothing that
works today is removed**. This table is the guard: every page, REST handler, MCP
tool and MCP resource below exists in code, and `npm run test:parity` fails when
one disappears or when new ones appear without a row here.

## Rules

- Every capability has one disposition: **keep as is**, **keep and simplify the
  entry point**, or **keep behind Pro mode** (roadmap U9). There is no "remove".
- Removing or hiding a row needs a maintainer decision recorded in an issue. The
  PR then says so in its title and links the decision.
- Restructuring work (roadmap U1, U4, U5, M3) names the rows it touches and keeps
  them reachable from the UI, REST or MCP as listed.
- Adding a page, route, tool or resource means adding a row to the matching
  table below. `npm run test:parity -- --print` prints the code inventory.
- The parity check proves each handler module loads and exports a function and
  each MCP tool registers with a handler and schema. It does not call the
  handlers; behavior is covered by the tests named in the table.

## Capabilities

| ID      | Capability                                                      | Where it lives today                                               | Automated by default?                                 | Manual control                                                                     | Reach                 | Tests                                                                                                                                                                                                                                    | Disposition                       |
| ------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `PRJ01` | Projects and storyboard documents                               | Home (`/`) project grid; `/editor` list; editor header             | Created by the creation flows below                   | Rename, organize/archive, delete, edit title, format and orientation               | UI · REST 7 · MCP 4   | `src/library/repositories/projects.int.test.ts` `src/app/api/projects/route.test.ts` `src/app/api/scripts/[id]/route.test.ts`                                                                                                            | keep as is                        |
| `CRT01` | Guided creation: prompt creator, creation hub, readiness        | Home creation hub, prompt creator, readiness card                  | Yes: one prompt plans scenes, voice and motion        | Manual project path (`/api/projects/manual`), preset and option pickers            | UI · REST 3 · MCP 1   | `src/components/projects/prompt-creator.test.tsx` `src/components/projects/creation-flows.test.tsx` `src/app/api/creation-readiness/route.test.ts` `src/app/api/projects/ai/route.test.ts`                                               | keep and simplify the entry point |
| `AIP01` | AI providers, keys and local models                             | Settings: AI keys, local server config; provider and model pickers | Provider and model defaults are preselected           | Per-provider keys, local Ollama/LM Studio/llama.cpp endpoints, model choice        | UI · REST 7 · MCP 1   | `src/providers/ai/registry.test.ts` `src/server/local-ai-config.int.test.ts` `src/providers/ai/readiness.test.ts`                                                                                                                        | keep as is                        |
| `AIW01` | AI scene writing, enhancement and review                        | Editor: AI enhance dialog, review actions                          | Yes: LLM writes or rewrites scenes (the only AI step) | Accept, reject or edit every suggestion; write scenes by hand instead              | UI · REST 2 · MCP 1   | `src/app/api/scripts/[id]/ai/route.test.ts` `src/components/editor/ai-enhance-dialog.test.tsx` `src/app/api/scripts/[id]/review/route.test.ts`                                                                                           | keep as is                        |
| `RES01` | Web-grounded research and evidence                              | Creation flow research selection; MCP and REST jobs                | Opt-in job; Gemini and OpenAI providers               | Import evidence by hand, choose sources, plan from evidence                        | UI · REST 7 · MCP 7   | `src/library/research-service.int.test.ts` `src/server/research-api.int.test.ts` `src/library/research-mcp.test.ts` `src/components/projects/research-selection.test.tsx`                                                                | keep as is                        |
| `EDT01` | Editorial pipeline: brief, script, storyboard, review, revision | Creation flow (editorial); editor review panels; REST and MCP      | Yes: staged writing with budgets                      | Control and approve each stage; revise individual stages                           | UI · REST 6 · MCP 6   | `src/library/editorial-writing.int.test.ts` `src/library/editorial-storyboard.int.test.ts` `src/library/editorial-review.int.test.ts` `src/library/editorial-mcp.test.ts` `src/server/editorial-api.test.ts`                             | keep as is                        |
| `SCN01` | Scene editor: edit, add, reorder, history, undo                 | `/editor/[scriptId]` scene list, timeline and inspector            | Scenes arrive from the planner                        | Edit every field, add, delete, reorder, undo and view history                      | UI · REST 7 · MCP 3   | `src/components/editor/scene-timeline.test.tsx` `src/library/scene-history.int.test.ts` `src/app/api/scripts/[id]/undo/route.int.test.ts` `src/library/scene-append-service.int.test.ts`                                                 | keep as is                        |
| `STK01` | Stock media search, ranking and selection                       | Scene inspector media picker; Settings stock keys                  | Automatic stock selection with saved ranking reasons  | Search, pick or remove media per scene; own keys per provider                      | UI · REST 11          | `src/library/stock-media-services.int.test.ts` `src/library/media-ranking-service.int.test.ts` `src/providers/stock/registry.test.ts` `src/library/automatic-stock-media.test.ts`                                                        | keep as is                        |
| `CLP01` | Scene clips: upload, generate and assemble video clips          | Editor scene clip panel                                            | Optional generation job                               | Upload clips, assemble, delete                                                     | UI · REST 10 · MCP 4  | none yet (parity check loads the handlers)                                                                                                                                                                                               | keep as is                        |
| `VOI01` | Voiceover studio and takes                                      | `/voiceovers`, `/voiceovers/[scriptId]`; editor voice panel        | Yes: narration take generated by the default voice    | Pick voice and model, regenerate scenes, upload own takes, rename, delete, preview | UI · REST 8 · MCP 4   | `src/library/voice-timing.int.test.ts` `src/library/scene-voice-service.test.ts` `src/library/studio-workflows.int.test.ts` `src/lib/kokoro-chunks.test.ts`                                                                              | keep as is                        |
| `VOI02` | Voice providers and catalog                                     | `/voices`; provider and voice pickers                              | Local Kokoro default                                  | Browser, local server and cloud providers; VoiceForge custom voices                | UI · REST 9 · MCP 4   | `src/providers/voice/providers.test.ts` `src/lib/wav.test.ts`                                                                                                                                                                            | keep as is                        |
| `AUD01` | Waveform audio edits and narration cuts                         | Voiceover studio waveform editor                                   | Cut suggestions computed from timing                  | Manual cuts, trims and edit plans applied to takes                                 | UI · REST 3 · MCP 1   | `src/lib/audio-edit-plan.test.ts` `src/library/audio-edit-service.int.test.ts` `src/library/cut-suggestion-service.test.ts` `src/production/cut-suggestions.test.ts`                                                                     | keep as is                        |
| `CAP01` | Captions: generate, edit, import and export                     | Editor caption panel; export downloads                             | Yes: derived from narration word timing               | Edit cues and styles, import and export caption files                              | UI · REST 3 · MCP 1   | `src/lib/captions.test.ts` `src/lib/caption-style.test.ts` `src/lib/caption-render.test.ts` `src/library/caption-provenance.int.test.ts`                                                                                                 | keep as is                        |
| `CHP01` | Chapters, topic chapters and long-form direction                | Editor chapter timeline and topic chapter dialog                   | Chapters suggested from the script                    | Edit, save and regenerate individual chapters and drafts                           | UI · REST 5 · MCP 5   | `src/library/chapter-service.int.test.ts` `src/components/editor/chapter-timeline.test.tsx` `src/components/editor/topic-chapter-draft.test.tsx` `src/production/long-form.test.ts`                                                      | keep as is                        |
| `MUS01` | Music, soundtrack map and sound effects                         | Editor music and sound panel; Settings music keys                  | Music and SFX cues planned automatically              | Edit music map, edit SFX cues, choose or upload a track                            | UI · REST 8 · MCP 3   | `src/production/music-map.test.ts` `src/library/sfx-service.int.test.ts` `src/lib/sfx-cues.test.ts` `src/library/music-map-persistence.int.test.ts`                                                                                      | keep as is                        |
| `DIR01` | Motion direction, film plan and product proof                   | Editor direction workflow dialog                                   | Yes: director plans motion and sequence               | Replan, edit the film plan JSON, review visual findings                            | UI · REST 5 · MCP 3   | `src/library/direction-workflow.int.test.ts` `src/library/film-plan-service.int.test.ts` `src/production/director.test.ts` `src/components/editor/direction-workflow-dialog.test.tsx` `src/library/motion-direction-service.int.test.ts` | keep as is                        |
| `TPL01` | Templates, presets and video engines                            | `/templates`; studio presets; template and engine catalogs         | Preset chosen from the content                        | Browse and choose templates, motion systems and studio presets                     | UI · REST 2 · MCP 2   | `src/production/preset-template-map.test.ts` `src/engines/hyperframes/catalog/synchronizer.test.ts` `src/engines/hyperframes/build-composition.test.ts` `src/video/motion-library.test.ts`                                               | keep as is                        |
| `BRD01` | Brand kits                                                      | `/brand-kits`; project brand picker                                | Default kit applies to all projects                   | Create, edit, delete, set default, assign per project                              | UI · REST 5 · MCP 1   | `src/library/factory-service.int.test.ts`                                                                                                                                                                                                | keep as is                        |
| `AST01` | Assets library                                                  | `/assets`                                                          | Assets register when used or uploaded                 | Upload, delete, see usage                                                          | UI · REST 4           | `src/library/storage/local-disk.int.test.ts`                                                                                                                                                                                             | keep as is                        |
| `LNG01` | Language versions                                               | Editor language versions panel                                     | Translation proposal on request                       | Paste manually translated on-screen and spoken text, review, save                  | UI · REST 2           | none yet (parity check loads the handlers)                                                                                                                                                                                               | keep as is                        |
| `RND01` | Renders, results and downloads                                  | `/renders`, `/results/[id]`; editor export                         | Render queue with progress                            | Approve, rename, delete, download, inspect progress                                | UI · REST 7 · MCP 5   | `src/library/video-production-orchestrator.int.test.ts` `src/library/hyperframes-section-render.int.test.ts` `src/library/render-section-cache.int.test.ts` `src/lib/render-smoke.test.ts`                                               | keep as is                        |
| `PRD01` | Production jobs, batches and presets (Quick Produce)            | Quick Produce in creation hub; production queue                    | Yes: one call produces video, audio or podcast        | Review first, approve, retry, cancel, revise, download artifacts and bundles       | UI · REST 19 · MCP 13 | `src/library/production-jobs.int.test.ts` `src/library/production-batches.int.test.ts` `src/library/production-bundle.int.test.ts` `src/library/production-cancellation.int.test.ts` `src/production/quick-produce.test.ts`              | keep as is                        |
| `FAC01` | Content factory: series profiles, variants, packs               | `/factory`                                                         | Frozen format and cutdown variants per run            | Series profiles, resume, cancel, pack archives                                     | UI · REST 8 · MCP 6   | `src/library/factory-service.int.test.ts` `src/library/factory-api.test.ts` `src/library/factory-mcp.test.ts` `src/components/production/factory-panel.test.tsx`                                                                         | keep and simplify the entry point |
| `POD01` | Podcasts: dialogue, characters, takes, audio import             | `/podcasts`, `/podcasts/[id]`                                      | AI can write the dialogue script                      | Edit turns and characters, import a script or recording, record takes              | UI · REST 16 · MCP 14 | `src/library/podcast-import.int.test.ts` `src/library/podcast-schemas.test.ts` `src/library/podcast-presets.test.ts` `src/library/podcast-audio-cache.int.test.ts` `src/components/studio/audio-import.test.tsx`                         | keep as is                        |
| `POD02` | Podcast finishing: transcripts, clips, audiograms, exports      | Podcast take actions                                               | Transcript and clip suggestions on request            | Manual transcription, clip choices, audiogram and bundle exports                   | UI · REST 9           | `src/library/podcast-transcript.test.ts` `src/library/podcast-audiogram.test.ts` `src/library/podcast-finishing.test.ts` `src/providers/ai/podcast-clip-suggestions.test.ts`                                                             | keep as is                        |
| `GAL01` | Production gallery                                              | `/gallery`                                                         | Shipped example outputs and starter presets           | Browse examples, start from a preset                                               | UI                    | none yet (parity check loads the handlers)                                                                                                                                                                                               | keep as is                        |
| `SET01` | Settings: keys, defaults, MCP tokens                            | `/settings`                                                        | Sensible defaults                                     | Provider keys, default options, scoped MCP tokens                                  | UI · REST 9           | `src/server/auth.test.ts` `src/server/auth-routes.test.ts` `src/production/mcp-access.test.ts` `src/server/secrets.int.test.ts`                                                                                                          | keep and simplify the entry point |
| `DIA01` | Diagnostics and health                                          | `/diagnostics`                                                     | Checks run on open                                    | Inspect runtime, queue and worker state                                            | UI · REST 1           | `src/library/studio-diagnostics.int.test.ts` `src/library/worker-supervision.int.test.ts`                                                                                                                                                | keep as is                        |
| `TRN01` | Local transcription status                                      | Podcast and caption transcription flows                            | Status polled automatically                           | Choose local engine                                                                | REST 1                | `src/library/local-transcription.int.test.ts`                                                                                                                                                                                            | keep as is                        |
| `MED01` | Local media serving                                             | Media URLs used by editor, preview and downloads                   | Automatic                                             | None needed                                                                        | REST 1                | `src/app/media/[...path]/route.int.test.ts` `src/lib/media-signature.test.ts`                                                                                                                                                            | keep as is                        |
| `MCP01` | MCP authoring resources: rules, schemas, catalogs               | MCP clients read `reel://` resources                               | Read by the agent                                     | Read-only reference                                                                | MCP 4                 | none yet (parity check loads the handlers)                                                                                                                                                                                               | keep as is                        |

## Pages

Next.js pages under `src/app`.

| Item                     | Capability |
| ------------------------ | ---------- |
| `/assets`                | AST01      |
| `/brand-kits`            | BRD01      |
| `/diagnostics`           | DIA01      |
| `/editor/[scriptId]`     | SCN01      |
| `/editor`                | PRJ01      |
| `/factory`               | FAC01      |
| `/gallery`               | GAL01      |
| `/`                      | PRJ01      |
| `/podcasts/[id]`         | POD01      |
| `/podcasts`              | POD01      |
| `/renders`               | RND01      |
| `/results/[id]`          | RND01      |
| `/settings`              | SET01      |
| `/templates`             | TPL01      |
| `/voiceovers/[scriptId]` | VOI01      |
| `/voiceovers`            | VOI01      |
| `/voices`                | VOI02      |

## REST routes

HTTP handlers under `src/app` (`/api/**` and `/media`).

| Item                                                 | Capability |
| ---------------------------------------------------- | ---------- |
| `GET /api/ai/keys`                                   | AIP01      |
| `POST /api/ai/keys`                                  | AIP01      |
| `GET /api/ai/local-config`                           | AIP01      |
| `POST /api/ai/local-config`                          | AIP01      |
| `PUT /api/ai/local-config`                           | AIP01      |
| `GET /api/ai/providers/[id]/models`                  | AIP01      |
| `GET /api/ai/providers`                              | AIP01      |
| `DELETE /api/assets/[id]`                            | AST01      |
| `GET /api/assets/[id]/usage`                         | AST01      |
| `GET /api/assets`                                    | AST01      |
| `POST /api/assets`                                   | AST01      |
| `GET /api/audio-edits`                               | AUD01      |
| `POST /api/audio-edits`                              | AUD01      |
| `GET /api/brandkits/[id]`                            | BRD01      |
| `PATCH /api/brandkits/[id]`                          | BRD01      |
| `DELETE /api/brandkits/[id]`                         | BRD01      |
| `GET /api/brandkits`                                 | BRD01      |
| `POST /api/brandkits`                                | BRD01      |
| `GET /api/creation-readiness`                        | CRT01      |
| `POST /api/creation-readiness`                       | CRT01      |
| `GET /api/diagnostics`                               | DIA01      |
| `GET /api/factory/packs/[digest]`                    | FAC01      |
| `DELETE /api/factory/profiles/[id]`                  | FAC01      |
| `POST /api/factory/profiles`                         | FAC01      |
| `GET /api/factory/revisions/[id]`                    | FAC01      |
| `GET /api/factory`                                   | FAC01      |
| `GET /api/factory/runs/[id]`                         | FAC01      |
| `POST /api/factory/runs/[id]`                        | FAC01      |
| `POST /api/factory/runs`                             | FAC01      |
| `GET /api/kokoro-voice/[id]`                         | VOI02      |
| `GET /api/local-transcription/status`                | TRN01      |
| `GET /api/music/keys`                                | MUS01      |
| `POST /api/music/keys`                               | MUS01      |
| `GET /api/music/search`                              | MUS01      |
| `GET /api/podcast-audiograms/[jobId]`                | POD02      |
| `POST /api/podcast-takes/[id]/audiograms`            | POD02      |
| `GET /api/podcast-takes/[id]/bundle`                 | POD02      |
| `GET /api/podcast-takes/[id]/clip-suggestions`       | POD02      |
| `POST /api/podcast-takes/[id]/clip-suggestions`      | POD02      |
| `POST /api/podcast-takes/[id]/exports`               | POD02      |
| `DELETE /api/podcast-takes/[id]`                     | POD02      |
| `POST /api/podcast-takes/[id]/transcribe`            | POD02      |
| `GET /api/podcast-takes/[id]/transcript`             | POD02      |
| `POST /api/podcasts/[id]/ai`                         | POD01      |
| `PUT /api/podcasts/[id]/characters`                  | POD01      |
| `PATCH /api/podcasts/[id]/characters`                | POD01      |
| `POST /api/podcasts/[id]/import-audio`               | POD01      |
| `GET /api/podcasts/[id]`                             | POD01      |
| `PATCH /api/podcasts/[id]`                           | POD01      |
| `DELETE /api/podcasts/[id]`                          | POD01      |
| `GET /api/podcasts/[id]/takes/[jobId]/progress`      | POD01      |
| `GET /api/podcasts/[id]/takes/[jobId]`               | POD01      |
| `GET /api/podcasts/[id]/takes`                       | POD01      |
| `POST /api/podcasts/[id]/takes`                      | POD01      |
| `POST /api/podcasts/[id]/turns`                      | POD01      |
| `PATCH /api/podcasts/[id]/turns`                     | POD01      |
| `DELETE /api/podcasts/[id]/turns`                    | POD01      |
| `GET /api/podcasts`                                  | POD01      |
| `POST /api/podcasts`                                 | POD01      |
| `POST /api/production-batches/[id]/approve`          | PRD01      |
| `GET /api/production-batches/[id]/bundle`            | PRD01      |
| `POST /api/production-batches/[id]/cancel`           | PRD01      |
| `POST /api/production-batches/[id]/retry`            | PRD01      |
| `GET /api/production-batches/[id]`                   | PRD01      |
| `GET /api/production-batches`                        | PRD01      |
| `POST /api/production-batches`                       | PRD01      |
| `POST /api/production-jobs/[id]/approve`             | PRD01      |
| `GET /api/production-jobs/[id]/artifacts/[outputId]` | PRD01      |
| `POST /api/production-jobs/[id]/cancel`              | PRD01      |
| `GET /api/production-jobs/[id]/events`               | PRD01      |
| `POST /api/production-jobs/[id]/produce-current`     | PRD01      |
| `POST /api/production-jobs/[id]/retry`               | PRD01      |
| `POST /api/production-jobs/[id]/revision`            | PRD01      |
| `GET /api/production-jobs/[id]`                      | PRD01      |
| `GET /api/production-jobs`                           | PRD01      |
| `POST /api/production-jobs`                          | PRD01      |
| `GET /api/production-presets`                        | PRD01      |
| `PATCH /api/projects/[id]`                           | PRJ01      |
| `DELETE /api/projects/[id]`                          | PRJ01      |
| `POST /api/projects/ai`                              | CRT01      |
| `POST /api/projects/editorial`                       | EDT01      |
| `POST /api/projects/manual`                          | PRJ01      |
| `GET /api/projects`                                  | PRJ01      |
| `POST /api/projects`                                 | PRJ01      |
| `GET /api/providers/[id]/models`                     | VOI02      |
| `GET /api/providers/[id]/voices`                     | VOI02      |
| `GET /api/providers`                                 | VOI02      |
| `POST /api/renders/[id]/approve`                     | RND01      |
| `GET /api/renders/[id]/progress`                     | RND01      |
| `GET /api/renders/[id]`                              | RND01      |
| `PATCH /api/renders/[id]`                            | RND01      |
| `DELETE /api/renders/[id]`                           | RND01      |
| `GET /api/renders`                                   | RND01      |
| `POST /api/renders`                                  | RND01      |
| `GET /api/research/capabilities`                     | RES01      |
| `POST /api/research/evidence/[id]/plan`              | RES01      |
| `GET /api/research/evidence/[id]`                    | RES01      |
| `POST /api/research/evidence`                        | RES01      |
| `POST /api/research/jobs/[id]/cancel`                | RES01      |
| `GET /api/research/jobs/[id]`                        | RES01      |
| `POST /api/research/jobs`                            | RES01      |
| `DELETE /api/scene-clips/[id]`                       | CLP01      |
| `GET /api/scenes/[id]/clips`                         | CLP01      |
| `POST /api/scenes/[id]/clips`                        | CLP01      |
| `POST /api/scenes/[id]/clips/upload`                 | CLP01      |
| `PATCH /api/scenes/[id]`                             | SCN01      |
| `DELETE /api/scenes/[id]`                            | SCN01      |
| `GET /api/scenes/[id]/stock-media`                   | STK01      |
| `POST /api/scenes/[id]/stock-media`                  | STK01      |
| `DELETE /api/scenes/[id]/stock-media`                | STK01      |
| `POST /api/scripts/[id]/ai`                          | AIW01      |
| `PATCH /api/scripts/[id]/captions/[cueId]`           | CAP01      |
| `GET /api/scripts/[id]/captions`                     | CAP01      |
| `POST /api/scripts/[id]/captions`                    | CAP01      |
| `POST /api/scripts/[id]/chapter-draft/generate`      | CHP01      |
| `POST /api/scripts/[id]/chapter-draft`               | CHP01      |
| `PATCH /api/scripts/[id]/chapter-draft`              | CHP01      |
| `POST /api/scripts/[id]/chapters`                    | CHP01      |
| `PATCH /api/scripts/[id]/chapters`                   | CHP01      |
| `POST /api/scripts/[id]/cut-suggestions`             | AUD01      |
| `GET /api/scripts/[id]/editorial/review`             | EDT01      |
| `POST /api/scripts/[id]/editorial/review`            | EDT01      |
| `GET /api/scripts/[id]/editorial`                    | EDT01      |
| `POST /api/scripts/[id]/editorial`                   | EDT01      |
| `POST /api/scripts/[id]/editorial/storyboard`        | EDT01      |
| `GET /api/scripts/[id]/film-plan`                    | DIR01      |
| `POST /api/scripts/[id]/film-plan`                   | DIR01      |
| `GET /api/scripts/[id]/history`                      | SCN01      |
| `POST /api/scripts/[id]/history`                     | SCN01      |
| `GET /api/scripts/[id]/language-versions`            | LNG01      |
| `POST /api/scripts/[id]/language-versions`           | LNG01      |
| `GET /api/scripts/[id]/media-ranking/[jobId]`        | STK01      |
| `POST /api/scripts/[id]/media-ranking/[jobId]`       | STK01      |
| `GET /api/scripts/[id]/media-ranking`                | STK01      |
| `POST /api/scripts/[id]/media-ranking`               | STK01      |
| `POST /api/scripts/[id]/motion`                      | DIR01      |
| `POST /api/scripts/[id]/music-map`                   | MUS01      |
| `PATCH /api/scripts/[id]/music-map`                  | MUS01      |
| `POST /api/scripts/[id]/produce`                     | PRD01      |
| `GET /api/scripts/[id]/product-proof`                | DIR01      |
| `POST /api/scripts/[id]/product-proof`               | DIR01      |
| `POST /api/scripts/[id]/review`                      | AIW01      |
| `GET /api/scripts/[id]`                              | PRJ01      |
| `PATCH /api/scripts/[id]`                            | PRJ01      |
| `GET /api/scripts/[id]/scene-clips/[jobId]/progress` | CLP01      |
| `GET /api/scripts/[id]/scene-clips/[jobId]`          | CLP01      |
| `POST /api/scripts/[id]/scene-clips/assemble`        | CLP01      |
| `GET /api/scripts/[id]/scene-clips`                  | CLP01      |
| `POST /api/scripts/[id]/scene-clips`                 | CLP01      |
| `POST /api/scripts/[id]/scene-clips/upload`          | CLP01      |
| `POST /api/scripts/[id]/scenes`                      | SCN01      |
| `PATCH /api/scripts/[id]/scenes`                     | SCN01      |
| `POST /api/scripts/[id]/sfx`                         | MUS01      |
| `PATCH /api/scripts/[id]/sfx`                        | MUS01      |
| `POST /api/scripts/[id]/soundtrack`                  | MUS01      |
| `GET /api/scripts/[id]/takes/[jobId]/progress`       | VOI01      |
| `GET /api/scripts/[id]/takes/[jobId]`                | VOI01      |
| `GET /api/scripts/[id]/takes`                        | VOI01      |
| `POST /api/scripts/[id]/takes`                       | VOI01      |
| `POST /api/scripts/[id]/takes/upload`                | VOI01      |
| `POST /api/scripts/[id]/undo`                        | SCN01      |
| `POST /api/settings/defaults`                        | SET01      |
| `GET /api/settings/keys`                             | SET01      |
| `POST /api/settings/keys`                            | SET01      |
| `GET /api/settings/mcp-token`                        | SET01      |
| `POST /api/settings/mcp-token`                       | SET01      |
| `DELETE /api/settings/mcp-token`                     | SET01      |
| `DELETE /api/settings/mcp-tokens/[id]`               | SET01      |
| `GET /api/settings/mcp-tokens`                       | SET01      |
| `POST /api/settings/mcp-tokens`                      | SET01      |
| `GET /api/stock/keys`                                | STK01      |
| `POST /api/stock/keys`                               | STK01      |
| `GET /api/stock/providers`                           | STK01      |
| `POST /api/stock/search`                             | STK01      |
| `GET /api/studio-presets`                            | TPL01      |
| `POST /api/studio-presets`                           | TPL01      |
| `PATCH /api/takes/[id]`                              | VOI01      |
| `DELETE /api/takes/[id]`                             | VOI01      |
| `POST /api/voice-preview`                            | VOI01      |
| `GET /api/voiceforge/engines`                        | VOI02      |
| `GET /api/voiceforge/voices/[id]/events`             | VOI02      |
| `GET /api/voiceforge/voices/[id]/preview`            | VOI02      |
| `GET /api/voiceforge/voices/[id]`                    | VOI02      |
| `POST /api/voiceforge/voices`                        | VOI02      |
| `GET /media/[...path]`                               | MED01      |

## MCP tools

Tools registered by `mcp/src/tools.ts`, `editorial-tools.ts` and `research-tools.ts`.

| Item                           | Capability |
| ------------------------------ | ---------- |
| `get_research_capabilities`    | RES01      |
| `start_research_job`           | RES01      |
| `get_research_job`             | RES01      |
| `cancel_research_job`          | RES01      |
| `get_research_evidence`        | RES01      |
| `import_research_evidence`     | RES01      |
| `plan_from_research_evidence`  | RES01      |
| `create_editorial_project`     | EDT01      |
| `get_editorial_script`         | EDT01      |
| `control_editorial_script`     | EDT01      |
| `control_editorial_storyboard` | EDT01      |
| `get_editorial_review`         | EDT01      |
| `control_editorial_revision`   | EDT01      |
| `get_film_plan`                | DIR01      |
| `save_film_plan`               | DIR01      |
| `list_factory`                 | FAC01      |
| `save_series_profile`          | FAC01      |
| `create_factory_run`           | FAC01      |
| `get_factory_run`              | FAC01      |
| `control_factory_run`          | FAC01      |
| `get_factory_revision`         | FAC01      |
| `list_projects`                | PRJ01      |
| `get_script`                   | PRJ01      |
| `list_takes`                   | VOI01      |
| `get_captions`                 | CAP01      |
| `list_renders`                 | RND01      |
| `get_render`                   | RND01      |
| `list_voice_providers`         | VOI02      |
| `list_voices`                  | VOI02      |
| `list_voice_models`            | VOI02      |
| `list_ai_providers`            | AIP01      |
| `create_project`               | PRJ01      |
| `create_production_draft`      | PRD01      |
| `ai_create_project`            | CRT01      |
| `list_video_engines`           | TPL01      |
| `list_production_presets`      | PRD01      |
| `produce_content`              | PRD01      |
| `produce_batch`                | PRD01      |
| `get_production_batch`         | PRD01      |
| `cancel_production_batch`      | PRD01      |
| `retry_production_batch`       | PRD01      |
| `download_production_batch`    | PRD01      |
| `get_production_job`           | PRD01      |
| `get_production_job_events`    | PRD01      |
| `cancel_production_job`        | PRD01      |
| `retry_production_job`         | PRD01      |
| `download_production_artifact` | PRD01      |
| `assign_brand_kit`             | BRD01      |
| `replan_motion_direction`      | DIR01      |
| `suggest_chapters`             | CHP01      |
| `save_chapters`                | CHP01      |
| `suggest_narration_cuts`       | AUD01      |
| `edit_music_map`               | MUS01      |
| `edit_sfx_cue`                 | MUS01      |
| `update_script`                | PRJ01      |
| `set_music`                    | MUS01      |
| `add_scene`                    | SCN01      |
| `update_scene`                 | SCN01      |
| `reorder_scenes`               | SCN01      |
| `plan_topic_chapters`          | CHP01      |
| `generate_topic_chapter`       | CHP01      |
| `save_topic_chapter_draft`     | CHP01      |
| `ai_generate_scenes`           | AIW01      |
| `create_voice_take`            | VOI01      |
| `get_voice_job`                | VOI01      |
| `list_scene_clips`             | CLP01      |
| `generate_scene_clips`         | CLP01      |
| `get_scene_clips_job`          | CLP01      |
| `assemble_scene_clips`         | CLP01      |
| `rename_take`                  | VOI01      |
| `rename_render`                | RND01      |
| `request_render`               | RND01      |
| `download_render`              | RND01      |
| `list_podcasts`                | POD01      |
| `get_podcast`                  | POD01      |
| `create_podcast`               | POD01      |
| `update_podcast`               | POD01      |
| `replace_podcast_characters`   | POD01      |
| `update_podcast_characters`    | POD01      |
| `ai_generate_podcast_script`   | POD01      |
| `import_podcast_script`        | POD01      |
| `insert_podcast_turn`          | POD01      |
| `update_podcast_turn`          | POD01      |
| `list_podcast_takes`           | POD01      |
| `create_podcast_take`          | POD01      |
| `get_podcast_take_job`         | POD01      |
| `download_podcast_take`        | POD01      |

## MCP resources

Resources registered by `mcp/src/resources.ts`.

| Item                       | Capability |
| -------------------------- | ---------- |
| `reel://authoring/rules`   | MCP01      |
| `reel://authoring/podcast` | MCP01      |
| `reel://schema/scene`      | MCP01      |
| `reel://schema/podcast`    | MCP01      |
| `reel://catalog/templates` | TPL01      |
| `reel://catalog/voices`    | VOI02      |
