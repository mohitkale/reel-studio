# M5 lesson direction validation

Acceptance run: 2026-10-17. These are synthetic timing/continuity fixtures,
not model-quality or narration-quality benchmarks. No paid calls, model downloads,
new packages or hosted rendering were used. Linux/Windows delivery checks are
recorded on the milestone PR; this record describes local evidence.

## Actual exports and recovery

`node --import tsx scripts/verify-adaptive-long-form.ts` creates the clearly named
**M5 · 3-minute lesson**, **M5 · 5-minute lesson**, and **M5 · 10-minute lesson**
projects, silent timing takes, immutable revisions and MP4 render rows in the
active app database. `--resume` reuses the saved examples and persisted section
cache after interruption. Local `.artifacts/adaptive-m5/examples.json` records
IDs, timing, memory samples, section events, output size and video packet hashes.

All exports use local adaptive graphics, 1280×720, 24 FPS, and 15-second scenes.
FFprobe confirmed exact durations and 4,320 / 7,200 / 14,400 video frames.
The recurring Capture → Review → Publish diagram retains its subjects and
returns in each chapter, including the final recap.

| Length                 | Scenes / chapters | Sections  | HTML bytes | MP4 bytes  | Accepted run time    | Sampled peak RSS      |
| ---------------------- | ----------------- | --------- | ---------- | ---------- | -------------------- | --------------------- |
| 3 minutes              | 12 / 3            | 6         | 183,016    | 6,709,610  | 122.9 s              | 1.85 GiB              |
| 5 minutes              | 20 / 5            | 10        | 201,854    | 11,186,942 | 190.5 s              | 1.91 GiB              |
| 10 minutes             | 40 / 10           | 20        | 248,952    | 22,412,974 | 109.6 s after resume | 2.03 GiB after resume |
| 10-minute cached retry | same              | 20 reused | same       | 22,412,974 | 26.1 s               | 1.02 GiB              |

Machine: Intel Core i7-9750H, 12 logical CPUs, 16 GiB RAM, macOS x64.
Runtime: Node 24.18.1, pinned producer 0.8.111 and HyperFrames CLI 0.8.110.
RSS samples sum this verification process and its descendants once per second;
they exclude the editor and other apps and can miss between-sample peaks.
These measurements are observations, not portable requirements or ceilings.

The 3-minute cold run was deliberately cancelled after section 0 completed;
its next export reused that section and rendered the remaining five. The initial
10-minute process ended before assembly; `--resume` reused 17 saved sections,
rendered the remaining three and completed assembly. Its recorded time/RSS cover
the resumed run only, so it is **not a cold 10-minute benchmark**. A subsequent
retry reused all 20 sections. Both 10-minute outputs have identical video packet
SHA-256 `062b92424bc59c5983646defee55d7e66ccc6c9f47a3a2a8258426179b1e3c40`.
Audio assembly still runs on every retry; the fixtures use silent local WAVs.

Opening, early chapter-boundary and final recap frames were inspected from every
MP4. Text remains inside the canvas; the familiar process returns without losing
labels. The 60.25-second captures show the chapter entrance in progress.

| Film       | Opening                                        | Chapter boundary                                        | Recap                                        |
| ---------- | ---------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| 3 minutes  | [frame](../assets/adaptive-m5/180-opening.jpg) | [frame](../assets/adaptive-m5/180-chapter-boundary.jpg) | [frame](../assets/adaptive-m5/180-recap.jpg) |
| 5 minutes  | [frame](../assets/adaptive-m5/300-opening.jpg) | [frame](../assets/adaptive-m5/300-chapter-boundary.jpg) | [frame](../assets/adaptive-m5/300-recap.jpg) |
| 10 minutes | [frame](../assets/adaptive-m5/600-opening.jpg) | [frame](../assets/adaptive-m5/600-chapter-boundary.jpg) | [frame](../assets/adaptive-m5/600-recap.jpg) |

## Behavioral gates

Focused tests cover opt-in duration policy and cover bounds, callback ordering,
unknown policy versions, compiled HTML budget, bounded whole-record subject
context, dedicated lesson prompts, selected chapter rewrite scope, locked scene
direction, chapter navigation, and global scene numbering.

A real SQLite integration test saves a lesson writing draft, generates its first
chapter through a loopback fixture provider, disconnects/reconnects, and generates
the recap. The callback resolves to the saved chapter ID; earlier scenes remain
identical and saved subject aliases survive. Snapshot/revision restoration retains
goals, callbacks and the registry. No configured provider account is called.

Local checks passed: 195 test files / 974 tests, followed by 23 affected tests
after final prompt and local-validation fixes; TypeScript, ESLint, secret scan,
release metadata/offline composition checks and production build.

Browser review of the production build confirmed saved ten-minute policy, chapter
goals and recap callbacks after reload, navigation to 9:00, end-to-start seeking,
and valid saves. Clearing a recap callback shows a specific local error and
disables Save. The [editor capture](../assets/adaptive-m5/editor-recap.png) shows
the persistent overview and global scene numbering beside the final recap.

## Scope and release assessment

The production ceiling stays ten minutes. Existing outlines remain at five
minutes and unstructured video/audio at three minutes. The new 16 MiB compiled
lesson HTML guard complements existing scene, request and section limits.
No schema migration or dependency changes are needed. Real narration, dense
media, every resolution/FPS and unconstrained model writing need their own QA.

M1–M5 form a coherent user-facing feature set for a future minor release. A
release is due for assessment, but publication remains gated by fresh full
release-matrix, upgrade/rollback and licensing checks against the exact release
commit. These lesson fixtures alone do not fulfill those gates. M6 remains
separately authorized work.
