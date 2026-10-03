# Reproducible launch walkthroughs

These four workflows use shipped fixtures or local providers. Run `npm run setup`
and `npm run dev` first. Open **Diagnostics** and resolve every required check;
whisper.cpp may remain an optional warning.

## 1. Text to MP4 without a key or model

1. On the home page, paste: “Start with one clear idea. Show how it works.
   Share the finished result.”
2. Choose **Editorial Explainer** and **Portrait**. Leave narration off.
3. Select **Generate**. The result page follows the durable job automatically.
4. When **Ready to download** appears, play the video and select **Download MP4**.
5. Refresh the result URL to confirm recovery, then choose **Edit video**.
6. Select the second scene in **Timeline** and move it earlier. Preview the
   changed order; open **Customize video** for brand, voice and caption controls.
7. Return to the result and open **Remix this video**. Choose another format
   and generate a separate result. The original submitted export stays intact.

The shipped defaults require no AI key, stock provider or voice model. To import
an asset instead, expand **More creation options** and use **Create production**.
For a bundled command-line render, run `npm run sample:export`.

## 2. Exact data story in three formats

This fixture proves that chart labels, values, units, and source attribution are
preserved while the layout reflows.

```bash
npm run test:render:data-story -- --orientation=portrait
npm run test:render:data-story -- --orientation=landscape
npm run test:render:data-story -- --orientation=square
```

The source is `tests/fixtures/data-story-reel.json`. Inspect its structured
`chart` fields, then inspect the HyperFrames outputs under
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
5. Choose a timestamp-grounded suggestion or manually select a contiguous group
   of turns, choose portrait, square, or landscape, and create the audiogram from
   the completed take. Local suggestions require no AI key; asking a configured
   provider is an explicit paid-provider action.
6. Follow the durable job on **Renders**, then play and download the verified
   H.264/AAC output.

Use `npm run test:podcast-audiogram -- <take-id>` to repeat the audiogram render
from the command line with a local take ID.

## 4. Credential-free Quick Produce with revision recovery

This proves the off-by-default control, unattended durable stages, immutable
revision reporting, and editable result without a cloud or stock key.

1. On the home page, expand **More creation options**, choose **Create with AI**, and confirm **Quick Produce** is
   initially off.
2. Enable it, choose the **Deterministic (no key)** planner, set stock media to
   **None**, select **Editorial Explainer** and **Portrait**.
3. Use this brief: “Explain why immutable inputs make a local video pipeline
   easier to retry, inspect, and trust.” Choose **Create and produce**.
4. The editor opens immediately. Follow the persisted plan, media, audio,
   caption/timing, composition, render, and verification stages. Refresh during
   the run and confirm the same job/revision reconnects.
5. Edit one scene while the submitted revision runs. The completed artifact must
   retain the submitted hash; the editor should report that the current project
   differs, without discarding either version.
6. Download the verified MP4, open the completed revision as a new editable
   project, then use **Produce current revision** to create a separate job from
   the newer edit.

Quick Produce uses server-side Kokoro by default, which may download its model
on first use. The equivalent REST/MCP fixture can set `voice.enabled` to `false`
when validating on a host where that initial download is intentionally disabled.
Duplicate idempotency, worker restart, cancellation/retry, and partial batch
cases are covered by the production contract suite.

## What these examples cover

The release target covers videos up to three minutes and podcasts up to ten
minutes. Existing longer projects still open and render, but they are outside
the 0.4 acceptance matrix. AI planning and paid providers are optional; their
live smoke tests run only when the corresponding credentials and usage allowance
are configured.
