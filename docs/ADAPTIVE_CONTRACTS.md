# Adaptive film contracts

M1 supplies versioned contracts and a compatibility adapter. M2 adds six
[adaptive recipes](ADAPTIVE_RECIPES.md), resolved geometry and local previews.
M3 adds [sequence direction and subject continuity](SEQUENCE_DIRECTION.md).
M4 adds the [creation workflow](CREATION_UX.md), and M5 adds
[lesson direction](LONG_FORM_DIRECTION.md). M6 adds [factory workflows](FACTORY_WORKFLOWS.md) on the same revision and batch services.

## Recipe manifests

`src/video/adaptive-recipe.ts` defines a strict, engine-neutral manifest:
versioned identity, semantic intents, typed inputs, duration/density ranges,
aspect strategies, token slots, events, continuity ports, resource class,
fallback references, provenance, and fixture IDs. Unknown executable fields,
duplicate identifiers, invalid ranges, and self-fallbacks are rejected.

A manifest describes capabilities; it does not install or execute a renderer.
The initial `saved-scene@1.0.0` adapter delegates to the existing renderer. Its
ranges describe the compatibility envelope, not aesthetic certification or
resource guarantees. It has no new continuity ports or choreography events.
Six bundled M2 manifests are admitted by resolver `1.1.0` as adaptive plans.
Their shots include validated geometry, type sizes and timing; unavailable inputs
retain `saved-scene` with an explicit fallback reason.

## Resolved film plans

`src/video/resolved-film-plan.ts` defines the version-1 compatibility/adaptive plan.
`src/production/film-plan.ts` adapts an existing captured video snapshot without
replanning. Each shot binds to a complete scene by ID and SHA-256, preserving
copy, narration, chart data, media, saved motion/direction, and locks. The source
hash covers the complete snapshot except the derived plan itself. Canonical
hashes survive JSON serialization and object-key reordering.

The plan records the canvas, seed, catalog revision, estimated/take/mixed frame
timing, and exact recipe manifest hash. IDs, references, shot order, timing,
and versions are validated. Shot frames are relative to content; the cover
is accounted for separately. An independently rounded final legacy beat is
bounded to the existing export end without changing its source or renderer.

**Compatibility plans freeze existing decisions, not new layer geometry.**
`layout: existing-renderer` explicitly delegates geometry and choreography to
current authored treatments. The immutable source retains all rendering inputs;
M2 can introduce fully adaptive resolution without pretending legacy layouts
have been converted into an editable scene graph.

New snapshot capture and production revision creation include `filmPlan`.
Old snapshots omit it and remain readable without rewriting stored JSON. The
existing revision hash excludes this derived metadata so old outputs do not
become stale merely because the contract was added. Actual source edits still
change the revision hash. The film plan has its own source/manifest digests.

The submitted plan is provenance. Worker media localization and generated audio
may produce later resolved inputs; they do not rewrite that submitted plan.
The existing prepared-composition artifacts own final render inputs. Preview/
export preparation uses the captured catalog revision when present. Old plans
are not silently upgraded; unsupported future resolver versions fail validation.

## Editor, REST, and MCP

Under **Customize video → Film plan JSON**, load the selected take's current
plan (or estimated timing), download it, paste it back, and **Save revision**.
This checkpoints the existing design. Use ordinary scene controls for edits,
then reload the plan. The saved revision ID identifies an immutable document.

- `GET /api/scripts/:id/film-plan` returns a `reel-studio-film-plan` version-1
  document containing the captured snapshot and plan.
- Optional `voiceTakeId` selects a take belonging to that script.
- Optional `revisionId` reads a frozen revision belonging to that script;
  it cannot be combined with `voiceTakeId`. An old revision gets a derived
  compatibility view without changing its stored bytes.
- `POST /api/scripts/:id/film-plan` accepts `{ document }` and returns
  `{ revisionId, sourceHash }` with HTTP 201. It validates the document against
  the current captured source. Changed sources return 409; forged plan/source
  bindings return 400. It never overwrites current scenes or invokes a provider.
- MCP `get_film_plan` and `save_film_plan` use these same endpoints/contracts.
- Reads use `studio:read`; saves use the existing studio write authorization.
  Existing bounded JSON request handling applies.

This is a same-script checkpoint round-trip, not an arbitrary-project importer,
a media archive, or an editable animation graph. URLs and asset references do
not embed their bytes. Production-result restoration continues through the
existing restoration service, retaining saved scene choices and remapping scene
IDs; a subsequent capture resolves a new plan for those new IDs.

## Verification

Focused tests cover JSON round-trips, source/manifest tampering, unknown versions,
shot constraints, revision-hash compatibility, SQLite persistence/restoration,
API authorization and errors, MCP forwarding, and unchanged compiled HTML in
portrait, landscape, and square.

```sh
npm run test:unit -- src/production/film-plan.test.ts src/library/film-plan-service.test.ts src/library/film-plan-mcp.test.ts 'src/app/api/scripts/[id]/film-plan/route.test.ts' --maxWorkers=2
```

The [M1 validation record](production/ADAPTIVE_M1_VALIDATION.md) records the
implementation acceptance evidence. Rendering remains on the isolated worker;
M1 does not install models, use paid providers, or change export quality.

M3 opt-in sequence plans use resolver `1.2.0`, retaining the M2 recipe versions.
The plan freezes subject definitions, typed panel ports and handoff/fallback
boundaries; saved scene motion retains source-bound choice explanations. Old
plans without sequence direction continue using their previous resolver.

## Lesson metadata compatibility

Chapter-plan and writing-draft version `1.0.0` accept optional
`longForm: { version: "1.0.0", targetSeconds: 180..600 }`. Chapters optionally
carry `direction: { goal, phase, callbackChapterId? }`. Phase is `develop`,
`example`, or `recap`; recap requires a callback, and all callbacks reference
an earlier chapter. Explicit lesson policy requires direction on every chapter.
Unknown policy versions, executable fields, and invalid references are rejected.
Old plans omit these fields and retain their existing limits without a rewrite.

Generated draft callbacks resolve to saved outline IDs at the atomic scene
append. Snapshot/revision capture and restoration retain lesson policy, goals,
callbacks and the saved subject registry. Optimistic draft comparisons use
canonical JSON so harmless serialization key order changes do not block resume.

## Factory lineage and compatibility

Factory snapshots optionally carry `factory` version 1: parent revision ID/hash,
pack digest, optional profile digest, operation kind and original selected scene
IDs. Aspect and cutdown revisions are immutable children; mutable master edits
and newer profile versions do not rewrite their source. Restored projects retain
this historical lineage and frozen brand tokens. Explicitly choosing another
brand kit releases the restored token override.

Historical revisions sometimes hashed undefined in-memory fields that JSON
omitted. Factory reads retain these through their canonical M1 film/source
binding. New factory children hash their serialized snapshot and enforce the
stored digest as well as the film binding. Absent factory metadata does not
change legacy captures or batched current-revision hashing.
