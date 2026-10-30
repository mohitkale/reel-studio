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

## Supplied product proof

The editor's **Product proof and recurring subjects** panel maps image/video uploads
to explicit feature labels, scenes and recurring subjects. Save the mapping, preview
the visual diff, then apply. Replacements retain copy, narration and existing voice;
asset/whole-scene locks are enforced. Missing proof stays a visible finding and can
use a typography fallback. An upload is labelled supplied and unverified: it never
establishes a customer outcome or generates a substitute product interface.

Device frames contain the entire supplied artifact, reveal briefly and hold for
the saved scene timing. Video mappings include a checked start cue in seconds.
Preview and export use the same cue. Short recordings and short estimated reading
holds produce warnings. Mapped assets remain referenced for deletion protection;
frozen revisions retain the mapping and restoration remaps scene IDs. Generic
background replacement clears the displayed proof provenance when the URL changes.

REST: `GET/POST /api/scripts/:id/product-proof` uses guarded `save`, `preview` and
`apply` actions. This local workflow has no provider budget. Saved edit history
supports grouped undo. Run `node --import tsx scripts/verify-product-proof.ts` only
when intentionally creating three named examples and exports in the active app.

Acceptance on 30 October 2026 used actual app screenshots with synthetic source
data and a labelled screenshot-sequence video, not a recorded user session. Three
silent 9.9-second MP4s passed decoding at 30 FPS (297 frames each): portrait
1080×1920, landscape 1920×1080, square 1080×1080. Both scenes were inspected in
each [decoded frame](assets/visual-quality-m5/proof-frame-grid.jpg); supplied UI is
contained and captions visible. Recording starts at 10 seconds. Active projects
are named **M5 Proof · Real supplied UI · {orientation}**. Export checksums:

| Format    | SHA-256                                                            |
| --------- | ------------------------------------------------------------------ |
| Portrait  | `df81f61ae4d7dc66ab746999a44b8906f804840544c41a1542fa8bbfb674d3f5` |
| Landscape | `0967dc56ad781f0c00d7732070db82b495ff1567170d061f0fb1f00df88fd9fe` |
| Square    | `eaa5e4899908711927628e94acdfe096a0903e91d8af2cf746c416e0555e95ee` |

The editor preview was checked against these exports, including the visual-only
diff and retained narration. Detailed UI text is illustrative at film scale;
critical claims belong in readable captions. No paid calls, new models or external
assets were used.
