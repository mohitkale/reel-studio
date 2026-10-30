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

## Review and scoped revisions

The contact sheet and animatic appear before the scene editor. Editorial review
flags unlinked or unsupported numeric claims, repeated narration, possible filler
and a potentially missing payoff. These checks are heuristics, not semantic fact
verification or publication approval.

Choose one scene, then **Make specific**, **Shorten**, **Replace visual**, or
**Keep copy / change direction**. Copy can be supplied locally; AI copy requires
checking the explicit one-call option and available budget. Supply concrete facts
for specificity. The selected saved writer/model and evidence are reused; repair
calls are disabled. Reserved failed/canceled calls remain counted, including after
reconnect. No other scenes, research or writing are regenerated.

Review the before/after diff, then apply. Changing any scene, settings or writing
invalidates the proposal. Whole-scene, copy and asset locks protect their scopes;
protected writing beats must also be unlocked. Visual edits preserve copy and voice
selection. Replaced stock selection metadata is retained in the proposal for undo.
Undo is guarded by the applied state and refuses to overwrite later edits.

`GET /api/scripts/:id/editorial/review` returns findings, source hash and durable
proposal. POST accepts preview with a unique key and explicit zero/one-call budget,
then apply/cancel/undo with the proposal ID and expected hash. Model failures are
redacted. Cancel/deadline prevent late results from publishing. MCP exposes the
same contracts through `create_editorial_project`, `get_editorial_script`,
`control_editorial_script`, `control_editorial_storyboard`, `get_editorial_review`
and `control_editorial_revision`; API scopes and quotas remain authoritative.

For offline acceptance with an already running local app:
`node --import tsx scripts/verify-editorial-pipeline.ts`. This opt-in command writes
a named synthetic example and verified MP4 into the active app without paid
calls or model downloads. The normal test suite uses isolated fixture databases.
