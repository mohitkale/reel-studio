# Creation and editing UX

The Projects page leads with two visible creation paths:

- **Create with AI** (recommended): describe an idea or paste a script. The
  configured provider writes and arranges editable scenes. Portrait,
  automatic scene count, and content-matched visual direction are ready to
  use. **Customize style and media** exposes the remaining controls.
- **Create production**: paste supplied content, import a public article, and
  optionally upload assets. **Build draft** uses the shown defaults immediately;
  **Customize options** opens output, style, brand, and narration workflow choices.
  Project naming is optional. This path works locally without an AI key.

Automatic direction chooses a preset family and a coherent palette for the
topic: botanical wellness, technical midnight, product blue, warm cinema,
creator violet, or paper and ink. Style and pacing can be chosen by AI.
An explicit preset/style/energy choice takes priority; customized brand kits keep
their colours. Themes are saved with the draft and completed revision, so export
does not choose a new look on every run.

Both paths open an editable draft. **Quick Produce**, off by default in AI
creation, optionally renders an MP4 automatically. Enabling it retains the
selected AI provider; deterministic planning is an explicit alternative for
supplied text. **Add local narration** is visible when Quick Produce is enabled
and stays off until selected. It uses local Kokoro voice `af_heart`, whose first
synthesis may download a model. Drafts can add/change voice in the editor.
Blank projects remain available beside the project library for manual setup.
Automatic media uses downloadable Pexels/Pixabay assets or animated backgrounds;
hotlink-only Unsplash selections remain explicit previews and cannot be staged
for MP4 export.

Quick Produce submits the existing durable production pipeline with an
idempotency key and opens `/results/<job-id>`. The result URL reconnects after
refresh and shows saved progress, errors/cancel/retry, verified downloads, MP4
playback, **Edit video**, and **Remix this video**. Remix uses supplied scene
narration with the local planner to generate a separate project/result. Existing
submitted outputs retain their frozen revision. Paid work is not replayed
by refreshing a result.

The editor opens **Full reel**, and keeps **Export MP4**, render status, **Visual
direction**, and **Visual review** visible. **Customize video** contains detailed
brand, voice/caption and export controls, which wrap within the
viewport. The scene timeline shows current narration or estimated timing,
selects preview positions and saves earlier/later scene ordering through the
existing scene API. It does not rewrite measured narration timestamps; duration
labels are informational. The editor uses its own player instead of duplicating
the result video. The sidebar version comes from package metadata.

![Projects creation choices](assets/reel-studio-home.png)
![Mobile Projects page](assets/reel-studio-home-mobile.png)
![Result and download](assets/reel-studio-result.png)
![Editor timeline and scene controls](assets/reel-studio-editor-current.png)

## Review a draft before production

Manual and configured AI planning persist through the same project repository,
adaptive resolver, subject registry, revision and render contracts. Both open
an editable draft before voice generation or export unless Quick Produce was
explicitly enabled.

Open **Contact sheet and animatic** in the editor to review actual local scene
previews, supplied copy, visual purpose, decision explanations and timing.
Four previews mount at a time; pagination keeps large drafts bounded. Timing is
labelled estimated until a usable take is selected. **Play animatic** opens the
shared Full reel player in draft preview quality and starts from the beginning.
The selected take, cover and current scenes remain the playback source; final
export keeps its existing quality settings.

**Visual direction** now opens a review before applying a family, pacing,
adaptive/sequence setting or **Try another composition**. Choose the whole
film, selected scene, or selected chapter from a saved outline. **Clean** offers
a quieter compatible direction. Review the change list, then **Apply direction**.
A scoped variation preserves film-wide settings and changes only eligible
scenes in that scope. Compatible content may have only one arrangement, so a
variation can produce no change. Subject identities and **Why this visual?**
remain available in the editor.

Variations preserve copy, narration, exact data, assets, brand and locks.
The existing **Whole scene** lock protects its layout, motion and subject
choices; Copy/Assets retain their regeneration meaning. A reviewed source hash
rejects applying a proposal after a later edit. **Undo last direction** stores
one previous direction in SQLite and survives browser/server restart. Later
scene or direction edits can invalidate undo; it never overwrites those edits.
This is one guarded direction undo, separate from the existing Undo AI action.

The existing `POST /api/scripts/:id/motion` also accepts `preview: true`, an
optional bounded `sceneIds` scope, and returns `sourceHash`, `settings.seed`
and a change list. Apply the same options with `expectedHash` and
`variationSeed: settings.seed` to reproduce the review. `{ undo: true }`
restores the last direction if its saved post-change hash still matches.
Existing direct callers remain compatible. No planner/provider runs here.

## Creation readiness

Projects → **Check creation readiness**, or **Production diagnostics**, shows:

- **Works immediately:** supplied text/manual planning; choose no automatic
  media and leave narration off for offline work. Rendering prerequisites have
  their own diagnostics. Voice weights must already be cached for offline voice.
- **Local AI:** selected model and last saved discovery, configured context/output
  bounds, and any successful structured-output probe with language requested,
  timestamp and latency. Opening this panel only reads saved configuration.
- **Optional connected generation:** configured cloud planners; the creator
  still selects a provider explicitly and existing paid-call budgets apply.

**Test local planning** runs a bounded planning test through the selected local
provider. It validates the real scene-plan response, offers cancel, and has a
60-second deadline. No model is installed or pulled. A passing probe is saved
locally and invalidated by configuration changes; a failed repeat clears it.
Context is configured capacity, not a measured capability. English, Hindi and
Hinglish are selectable test requests; schema success does not certify fluency,
factual accuracy or model-side cancellation. Model discovery remains in Settings.

`GET /api/creation-readiness` uses studio read authorization and returns saved
local status plus configured cloud summaries without tokens. Its web-only `POST`
accepts a local `providerId` and optional `language`; cloud IDs are rejected.

## Verification

Use [the walkthroughs](WALKTHROUGHS.md) on desktop/mobile. Check live AI brief → multi-scene draft, local content → draft, Quick Produce →
playback/download, persisted scene reordering, reconnect, and separate remix.
For Automatic direction, compare wellness, product, technical and supplied-data
briefs. Inspect both the preview and exported frames for topic fit, reading
space, contrast, meaningful motion and exact supplied chart values. Test a
custom brand and a locked scene; reopen a completed revision to verify the
saved palette and treatment decisions. Generated narration still needs a
factual review, including percentage versus percentage-point wording.
Regenerate preset examples with `npm run preset:previews` and installed Chrome.
Projects screenshots show the revised creation entry points; result/editor
screenshots are from v0.4.0. Each creator's source/brand determine the output.
Published browser evidence is in [release validation](production/RELEASE_VALIDATION.md).
