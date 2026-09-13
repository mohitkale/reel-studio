# Reproducible launch walkthroughs

These three workflows use shipped fixtures or local providers. Run `npm run setup`
and `npm run dev` first. Open **Diagnostics** and resolve every required check;
whisper.cpp may remain an optional warning.

## 1. Product launch without a cloud key

This proves the normal guided path from a supplied brief and screenshot to a
portrait video.

1. Open **Projects**, choose **Create production**, and select polished video.
2. Paste this source content:

   > Release work should not disappear into status meetings. Orbit turns the
   > plan, owner, and current proof into one reviewable timeline. Import the
   > work, compare the change, and share one clean launch update.

3. Upload the shipped `docs/assets/reel-studio-editor.png` as the visual asset.
4. Choose **Product Launch**, **HyperFrames**, **Portrait**, the default brand
   kit, and **One full take**. Build the deterministic draft.
5. Review the hook, screenshot demo, feature, comparison, and CTA. In Voice,
   create a **Silent placeholder**; create estimated captions if you do not have
   an SRT/VTT file.
6. Choose **Produce reel**, follow the job on **Renders**, approve it if the
   current flow asks, and download the verified MP4.

The result should be 1080×1920 H.264 with a placeholder audio track. The
uploaded editor screenshot remains the source for the proof scene. For a
one-command render of the bundled equivalent, run `npm run sample:export`.

## 2. Exact data story in both engines and three formats

This fixture proves that chart labels, values, units, and source attribution are
preserved while the layout reflows.

```bash
npm run test:render:data-story -- --orientation=portrait
npm run test:render:data-story -- --orientation=landscape
npm run test:render:data-story -- --orientation=square
```

The source is `tests/fixtures/data-story-reel.json`. Inspect its structured
`chart` fields, then compare the two engine outputs under
`.artifacts/render-regression/data-story/`. Each MP4 must retain the supplied
values and attribution. No value is inferred to fill a layout.

To edit the same shape in the app, open a Data Story project, choose **JSON** in
the scene editor, and paste scenes containing a `chart` object with labels,
series values, units, and optional source attribution. The editor validates the
data before saving.

## 3. Two-host podcast to audiogram

This proves cached turn-level speech, audio exports, transcript metadata, and a
video excerpt that uses the original podcast audio.

1. Run `npm run seed:demo-podcast`, then open **Podcasts** and the seeded show.
2. Confirm **Two-host discussion** is selected. Assign a local Kokoro voice to
   each host and generate the take. Initial Kokoro setup may install its model.
3. Change one line, select only that turn for regeneration, and generate again.
   Confirm the other completed turns show reuse rather than new synthesis.
4. Download WAV, MP3, transcript, and chapters. The chapter boundaries should
   match the dialogue turns.
5. Select a contiguous group of turns, choose portrait, square, or landscape,
   and create the audiogram from the completed take.
6. Follow the durable job on **Renders**, then play and download the verified
   H.264/AAC output.

Use `npm run test:podcast-audiogram -- <take-id>` to repeat the audiogram render
from the command line with a local take ID.

## What these examples cover

The release target covers videos up to three minutes and podcasts up to ten
minutes. Existing longer projects still open and render, but they are outside
the 0.4 acceptance matrix. AI planning and paid providers are optional; their
live smoke tests run only when the corresponding credentials and usage allowance
are configured.
