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
