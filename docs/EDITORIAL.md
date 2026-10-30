# Editorial creation

Choose **Review editorial script before scene layouts** in AI creation to write
before designing. The progressive brief captures intent, audience, goal, language,
duration, tone and takeaway. Product, explainer, news, data and brand intents use
different writing arcs. Duration is an estimate, never permission to pad facts.

The draft is saved in the project before any scene exists. Review narration,
evidence links, missing evidence and timing; save protected beats before continuing.
References identify provenance and require human review. Numeric admission is a
conservative source check, not semantic fact verification.

Writing has a visible budget of one provider call, a deadline and cancellation.
Reconnects reuse the same request key. Resume is available only for unspent work;
failed or canceled paid work is never retried automatically. Writer and model are
saved with the draft. Existing direct draft/QuickProduce paths remain available.

API: `POST /api/projects/editorial` accepts the creative brief, writer, optional
saved evidence, explicit budget and idempotency key. Read/control the saved stage at
`/api/scripts/:id/editorial`. Saves require the current revision. Unlock a protected
beat in one save before editing its copy in another. These endpoints use the same
studio authentication and provider quota rules as existing creation.

## Storyboard compilation

After saving writing, **Preview storyboard** compiles each beat into purpose,
exact narration, screen copy, evidence links, asset needs and a supported visual.
This stage uses existing local preset/semantic directors with **zero provider
calls**: initial writing remains capped at one call. The explicit total budget (1–3 calls,
default 1) reserves only opted-in additional calls for requested copy revisions.
Compilation, cancellation and resume never spend those reserved calls. Missing
product screenshots are listed as asset needs; typography is used without
fabricating UI, customers or results. Directors admit chart values only from
literal supplied datasets. The preview explains these choices.

The cache is bound to the writing revision, evidence, format and current scenes.
A changed source invalidates apply. Cancel discards the pending preview; resume
recompiles locally without replaying research or writing. Apply is transactional,
honors copy/assets/whole-scene locks and refuses to delete or reorder protected
scenes. Grouped storyboard history can undo a successful apply. Frozen production
revisions retain the approved writing and compiled provenance.

`POST /api/scripts/:id/editorial/storyboard` supports `compile` (expected writing
revision and explicit zero-call budget), `apply` and `cancel` (expected source
hash). Retrying an unchanged compile reuses its cache. This is a local compiler;
it does not fetch assets or spend a second model call to make layout choices.
