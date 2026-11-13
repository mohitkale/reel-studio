# Quality

How a Reel Studio video is judged. Two parts: ten criteria a person scores, and a
frame check that measures what a machine can.

## The rubric (20 points)

Score each criterion 0, 1 or 2 on the finished MP4, with sound. A video ships at
**16 of 20 or more**.

| #   | Criterion                | 2 means                                                                                  | Measured by                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Frame fill               | Every scene uses the frame: content fills at least 45% of the safe area                  | frame check                                   |
| 2   | Hierarchy                | One thing to look at first in every scene; the headline wins                             | review                                        |
| 3   | Legibility at phone size | No text under 2.2% of frame height (9:16); contrast 4.5 to 1, or 3 to 1 for large type   | frame check                                   |
| 4   | Text fit                 | Nothing cut, nothing outside the safe area, no lone last word                            | frame check, `npm run test:copy-fit`          |
| 5   | Motion with purpose      | Motion explains or emphasizes; nothing moves for its own sake                            | review                                        |
| 6   | Pacing                   | Beats alternate fast and slow; no scene feels stuck or rushed                            | review                                        |
| 7   | Variety across scenes    | Neighbouring scenes differ in layout and motion; no near-identical frames                | frame check (near-identical), review          |
| 8   | Caption sync             | The highlighted word is within 80 ms of the spoken word; captions never repeat the title | spot check, frame check (headline vs caption) |
| 9   | Audio balance            | Narration is clear over music; loudness about −14 LUFS                                   | listen, loudness measurement                  |
| 10  | The first three seconds  | Something moves and something is legible before second three                             | review                                        |

1 means acceptable with a clear flaw; 0 means a viewer would scroll past. Record
scores in the PR that changes a video, next to the contact sheet.

## The frame check

`npm run examples:lint-frames` compiles each golden storyboard (`examples/storyboards`)
exactly as production would (same scene plan, same motion plan, estimated timing, no
voice), renders one frame per scene at 60% of the hold in the render browser, and
measures it. It takes about two minutes for the set.

| Check                      | Fails when                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| `frame-fill`               | the content's bounding box is under 45% of the safe area                    |
| `smallest-text`            | text height is under 2.2% of frame height (9:16), 2.6% (16:9), 2.4% (1:1)   |
| `contrast`                 | text against the pixels around it is under 4.5 to 1 (3 to 1 for large type) |
| `outside-safe-area`        | text leaves the safe area                                                   |
| `headline-equals-caption`  | the caption repeats the on-screen text (80% of its words)                   |
| `near-identical-neighbour` | two adjacent scenes differ in 3 bits or fewer of an 8 by 8 perceptual hash  |

The safe area keeps platform UI clear: on 9:16 the bottom 18% and right 12%, plus 7.8%
at the top and 6% on the left; 16:9 and 1:1 use 7.5% to 10% margins. Content means text,
images, charts and visible blocks; background layers, glows, grain and the progress bar are
ignored. The 2.6% and 2.4% minimums for 16:9 and 1:1 are decisions (the roadmap fixes only
9:16); contrast follows WCAG, with large type at 4% of frame height.

Options: `--only <name>`, `--all-formats` (every example in all three formats),
`--out <dir>`, `--write-baseline`, and `--gate` (exit 1 on any failure). Output is
`frame-lint.json` (scene, check, measured value, threshold) and an annotated contact
sheet per example: green dashed is the safe area, cyan the content box, red a failing scene.

Today the check reports only. It gates at the end of the visual-quality milestone.
Baseline numbers from before the layout work are in
[quality/baseline.json](quality/baseline.json).
