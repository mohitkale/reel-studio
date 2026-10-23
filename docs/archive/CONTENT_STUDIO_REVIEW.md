# Content studio implementation record (historical)

Historical implementation record for `feature/content-creation-factory`, pending maintainer
PR review. Current usage belongs in the [creator guide](../CREATOR_GUIDE.md),
[advanced editing](../ADVANCED_EDITING.md), and [factory guide](../FACTORY_WORKFLOWS.md).

## Delivered scope

- Responsive navigation, wrapping tabs, bounded dialogs, preview-first editor,
  keyboard-labelled controls and retry states that retain cached content.
- Video, podcast, voiceover and repurpose entry points; automatic, assisted and
  manual creation; project search, status/series filters, archive/restore and
  content-based previews.
- Dedicated voiceover paragraphs, take comparisons, supported speaking rates,
  voice favorites, shared speech presets and pronunciation previews. Up to ten
  supplied scripts/language versions can be saved as an approval-gated batch.
- Actual audio waveforms, keep/remove selections, split ranges, speaker gains,
  cleanup audition, edited WAV and edit-manifest download; podcast recording,
  import and episode packages.
- Transactional, persistent undo/redo for manual scene fields, up to 100 edits,
  with concurrent-change protection. Existing selective regeneration remains
  available for voice and visual work.
- Provider/content-use summaries; editable chart grids preserving multiple
  series; deterministic paged multi-series output; text reveal timing/easing;
  preview scene selection and in-frame safe-zone guides.
- Central factory page exposing existing masters, review gates, series profiles,
  recipe packs, lineage and selective retries, plus source-staleness indicators,
  aggregate output budgets and asset-reference inspection.

## Explicit boundaries

Audio workbench edits are browser-local plans and downloadable derivatives; they
are not substituted into immutable takes or video exports. Session undo/redo for
these plans is separate from database-backed scene history. Partially trimmed
transcript segments require text review. Imported recordings have no fabricated
transcript. Microphone access remains an explicit browser permission.

Multilingual batches use supplied translations and supported provider voices;
there is no automatic translation promise. Speaking rate is offered only where
implemented by the provider. Provider billing is disclosed without invented cost
estimates. Dense multi-series data pages carry reading-time warnings.

Scene history excludes create/delete/reorder and whole-script changes. Frozen
production revisions remain the separate checkpoint mechanism. Asset usage
lists current references and warns that frozen revisions may still reference an
asset. No new dependencies or provider/model downloads are required.

## Validation evidence

- Full unit/integration suite: 204 files, 1,004 tests passed.
- TypeScript, ESLint and secret scan passed; production build passed.
- Final chart regressions passed (six focused tests); voiceover creation preserves
  paragraphs and avoids stock-provider requests (five focused service tests).
- Both database migrations applied through the existing backup-aware migration
  tool; transaction rollback, undo conflicts and preset merging have coverage.
- Actual isolated-renderer MP4 export inspected: custom text timing plus both
  supplied chart series, all values and attribution visible. Deterministic
  forward/backward page seeking has regression coverage.
- Active-database examples are labelled **Factory review**. Browser checks covered
  saved voiceover edits/reload/undo, placeholder audio, trim/audition and a batch
  remaining **awaiting approval** without synthesis. A 390-pixel editor viewport
  had no horizontal overflow; mobile design tabs, safe zones and preview scene
  selection were verified.
- Browser import converted a synthetic two-second WAV into a saved podcast take.
  The downloaded episode archive contained audio, transcript, chapters, show notes
  and a manifest. Imported audio retained empty transcript timing.
- `node --import tsx scripts/verify-content-factory.ts` creates another local
  review project and verified export using silent placeholder narration. It
  requires the app's installed renderer and a running server on port 3020.

No paid generation, new model downloads, microphone permission, release or merge
is part of this review fixture.

Synthetic UI evidence: [voiceover workspace](../assets/content-studio-voiceover.png)
and [phone editor](../assets/content-studio-mobile.png).
