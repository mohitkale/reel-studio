# Creation and editing UX

The home page starts with supplied text, six visual preset examples, a format
and one **Generate** action. It uses the deterministic director with zero paid
planner calls, stock-free animated backgrounds and narration off. Optional
configured local narration is explicit. **More creation options** retains blank
projects, the guided import/upload flow and configured AI planning.

Generate submits the existing durable production pipeline with an idempotency
key and opens `/results/<job-id>`. The result URL reconnects after refresh and
shows saved progress, errors/cancel/retry, verified downloads, MP4 playback,
**Edit video**, and **Remix this video**. Remix prefills the current editable
project's complete scene narration and generates a separate project/result.
Existing submitted outputs retain their frozen revision. Paid work is not
replayed automatically.

The editor keeps **Export MP4** visible. **Customize video** contains detailed
brand, motion, review, voice/caption and export controls, which wrap within the
viewport. The scene timeline shows current narration or estimated timing,
selects preview positions and saves earlier/later scene ordering through the
existing scene API. It does not rewrite measured narration timestamps; duration
labels are informational. The editor uses its own player instead of duplicating
the result video. The sidebar version comes from package metadata.

![Prompt-first home](assets/reel-studio-home.png)
![Mobile creation form](assets/reel-studio-home-mobile.png)
![Result and download](assets/reel-studio-result.png)
![Editor timeline and scene controls](assets/reel-studio-editor-current.png)

## Acceptance evidence

On 2026-10-03, browser walkthroughs at 1440×1000 and 390×844 passed against an
isolated populated database, supervised app and durable worker. Both completed
text → Generate → result → checksum-matching MP4 download → editor selection
and persisted reordering. The result reopened after navigation; actual MP4
playback and prefilled remix were inspected. A mobile remix selected Creator
Punch and square format, then completed a separate verified result. Expanded
editor controls and all three workflows fit the viewport without page overflow.
No new model download, voice synthesis or paid planner was used.

Reports/screens/exports: `.artifacts/m13-browser/`. Download SHA-256:

- Desktop portrait: `a3d6ccca5ad836dcece0cb189e1b9dbd972cbd0a8008bbb60b86a80a2b8a99d3`
- Mobile landscape: `c7b181b3a6fcd98630111887af1509edb922968f62781964e6d7c57c9f25c9a7`
- Mobile square remix: `5df50a84fdbed7fa46a25d8f0e10b537928c04743fcead58db67f1843c2080c1`

All 836 local tests passed, including the real audiogram smoke export. Focused
UI tests cover default no-paid/no-narration submission, preset/narration opt-in,
result navigation, selection and reorder boundaries. Typecheck, lint, secret
scan, release checks and production build accompany the milestone PR.

README formatting was normalized and its lead screenshots/workflow were
replaced with this verified UI. Regenerate actual preset examples with
`npm run preset:previews` and installed Chrome. These shipped examples show
preset treatments; each user's source and brand determine the final frames.
