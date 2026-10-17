# Lesson direction

Use **Chapters → Enable lesson direction** on a saved outline, or select a
3-, 5-, or 10-minute lesson while planning a topic writing draft. Review each
chapter's goal and narrative phase: **develop**, **example**, or **recap**.
A recap must return to an earlier saved chapter. Goals and returns remain
editable until that draft chapter has been generated.

A writing draft generates one chapter per explicit provider request. Generated
chapters retain their progress across reloads; callbacks resolve to the saved
chapter IDs. On an existing storyboard, enable lesson direction on its saved
outline before adding a lesson writing draft. Supplied facts remain the source;
an example phase never authorizes invented data or outcomes.

Chapter writing receives the current brief, nearby scene context, a compact
outline, saved subject labels/aliases, and up to three earlier callback excerpts.
It develops the explanation without restarting the whole film with another
short-form hook or call to action. Subject IDs, symbols and colors remain part
of the saved motion plan. Whole-scene and copy locks still apply to rewrites.
Lesson rewrites select one chapter at a time, including individual selections
inside that chapter; earlier and unrelated chapters stay saved.

The editor groups scenes into collapsible chapters with a persistent overview.
Select a chapter to seek to its first scene. Timing distinguishes narration
from estimates and shows the duration target separately. The target guides
writing; it does not stretch, truncate, or silently pad narration.

## Bounded production

| Resource                               | Limit                                         |
| -------------------------------------- | --------------------------------------------- |
| Lesson video, including cover          | 600 seconds at 24/30/60 FPS                   |
| Chapters / scenes per film             | 12 / 240                                      |
| Scenes in a chapter / provider request | 20                                            |
| Global continuity / subject context    | 6,000 / 2,000 characters                      |
| Callback excerpts                      | First three scenes, up to 500 characters each |
| Compiled lesson HTML                   | 16 MiB                                        |
| Visual render section                  | 30 seconds                                    |

Only a valid saved outline with explicit lesson policy and a goal/phase for
every chapter enables the 600-second allowance. Existing chapter outlines keep
their 300-second allowance; unstructured videos and standalone audio keep
180 seconds. Existing token scopes can impose a smaller allowance. Outputs over
ten minutes remain rejected. Export still uses the isolated worker, dependency
aware section cache, continuous audio assembly and frozen production revision.
A retry reuses valid sections without lowering final output correctness.

Limits bound work, not hardware requirements. Dense media, narration, resolution
and recipes change render time and memory. The [M5 validation record](production/ADAPTIVE_M5_VALIDATION.md)
records actual 3-, 5-, and 10-minute synthetic exports and recovery checks.
These silent fixtures verify visual/timing/recovery behavior, not speech quality
or a representative model-written lesson. No schema migration, dependency,
model download or paid call is required for this feature.
