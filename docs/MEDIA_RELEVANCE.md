# Media relevance and supplied proof

Automatic stock selection ranks the bounded provider results by available subject
terms, retained crop area, target resolution, text space, exact duplicates and known
film style hints. Stable asset IDs break ties; a hash no longer chooses the final
result. Supplied uploads/selections take priority and never trigger stock search.

Descriptions, tags and source slugs are metadata, not pixel verification. Unknown
text space/style remain neutral and visible. The immutable selection snapshot saves
its score components, reasons and up to five alternatives; the stock picker shows
rank reasons and the saved decision. Provider terms, attribution, hotlink exclusion
for automatic productions, materialization and usage-reporting rules still apply.

## Optional vision scoring

The stock picker can score up to six public previews through OpenAI, using an
explicit image-capable model and a **separate one-call budget**. Metadata ranking
makes no model call. Opting in sends the previews and current scene copy to OpenAI;
image inputs consume provider tokens. Model/account compatibility is not assumed.
Unsupported models fail without fallback, repair or automatic paid retry.

This uses the documented [Responses image-input contract](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses), checked 30 October 2026.
The app makes one bounded POST, caps output, validates exact candidate IDs and keeps
provider errors redacted. Tests use HTTP fixtures; no paid acceptance calls are run.

Scoring jobs live in `MediaRankingJob`, independently of writing/research budgets.
Durable unique request keys reconnect to prior work. Cancel and deadline block late
results; only unspent work can resume. A new explicit scoring request grants a new
one-call budget. A film/candidate change invalidates a scored selection. Asset and
whole-scene locks are enforced again inside the atomic selection transaction.

REST: read context at `GET /api/scripts/:id/media-ranking?sceneId=...`, create a job
with POST (idempotency key, current source hash, stock search/candidate IDs, explicit
model and budget), then read/control `/api/scripts/:id/media-ranking/:jobId`.
Selection can reference the ready `rankingJobId`; the server repeats the provider
search and rejects stale or changed candidates before materialization/apply.

The additive migration uses the existing database backup/upgrade runner. Saved
videos remain compatible; existing snapshots without ranking metadata still load.
