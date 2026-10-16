# Adaptive film contracts

M1 supplies versioned contracts and a compatibility adapter. M2 adds six
[adaptive recipes](ADAPTIVE_RECIPES.md), resolved geometry and local previews.
Sequence direction remains a later milestone in the
[upgrade plan](ADAPTIVE_CONTENT_FACTORY_PLAN.md).

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
