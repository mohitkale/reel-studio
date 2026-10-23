# Content factory

Open **Customize video → Factory** in the editor, or **Renders → Content factory**.
Freeze the current film as a master, including the selected narration take, or
choose an existing saved revision. Changes to the editable master afterward do
not change an already submitted run.

Choose full-story formats and optionally a cutdown. **Review before rendering**
is enabled by default. Create the run, review its frozen plans, and approve it
when ready. Runs use the existing durable batch queue, progress, output verification
and bundle download. No AI planning, voice synthesis or stock search is triggered.
Source media already referencing an external URL still follows normal guarded
render staging; use local supplied assets for a completely offline run.

## Series profiles

A profile captures the master's brand tokens, whole-film look, energy, visual theme
and production preset, together with format/quality defaults and a pinned bundled
recipe pack. It preserves each new film's actual copy, narration, scene motion,
locks and subject registry. A different series design is rejected when the film
contains a whole-scene lock. Requested aspect reflow still follows the output canvas.

Profiles have a stable key and sequential versions (1–20). Saving the same version
with different content returns a conflict; publish the next version instead.
Archiving hides a profile from new-run choices while retaining historical runs
and their exact profile digest. Profile edits never rewrite existing revisions.

## Full stories and cutdowns

- **Aspect adaptation** retains every source scene in order, its complete copy,
  narration, facts, assets, locks and subject identities, and resolves layout for
  portrait, landscape or square. Series styling is applied only when selected.
- **Cutdowns** select 1–20 complete source scenes in their original order, remove
  at least one scene, and fit within three minutes including any cover. The editor
  offers a first/last scene range; REST/MCP also support nonadjacent selections.
  Every cutdown gets its own immutable revision and explicit parent lineage.

Measured cutdowns splice the selected parts of the existing local normalized
44.1 kHz mono, 16-bit PCM WAV. They do not synthesize replacement narration or
silently discard a mismatched take. Estimated, unnarrated masters remain unnarrated.
Selected caption cues and word timing are rebased; a cue crossing removed material
must be split first. Scene sound cues and media follow the selected scenes.
Cutdowns omit the original long-form chapter navigation/writing draft, since the
editorial selection is a new short story; the parent revision retains that outline.

Use **Edit copy** beside a completed variant when you need an editable
copy. Factory restoration retains captions and copies the selected narration
independently, so deleting that restored take cannot remove the master’s audio.

Completed outputs remain available when other variants are cancelled or fail.
**Resume incomplete** repairs missing submissions and retries incomplete jobs;
completed jobs keep their identity and artifacts. Saved review policies and MCP
automatic-render permissions remain in force when retrying. Approvals happen in
the first-party studio. Reuse the exact request and idempotency key to resume a
submission after a lost response; changing its payload requires a new key.

## Bundled packs and retention

Adaptive Core `1.0.0` contains the compatibility manifest, six adaptive recipe
manifests, catalog revision, local runtime/font assets, checksums and license
notices. The archive records MIT/OFL notices and GSAP's bundled copyright notice
and standard-license link; it does not relabel third-party assets as MIT.

Profiles and variants pin a pack digest. Archives are retained in the local media
store, and exports copy the pinned runtime/font bytes. Manifest and asset integrity
are checked before submission and render. Recipe implementations execute from the
compatible installed application; this is a data/asset pack system, not an
installer for executable third-party plugins. Unsupported recipe/catalog versions
fail explicitly. Developers must bump pack versions when bundled manifests/assets
change, and retain compatible implementations when supporting older recipes.

| Budget                                                 | Limit        |
| ------------------------------------------------------ | ------------ |
| Variants per run                                       | 6            |
| Aggregate scheduled output per run                     | 30 minutes   |
| Stored factory runs / profile versions / pack versions | 50 / 50 / 20 |
| Versions under one series key                          | 20           |
| Source or child snapshot                               | 4 MiB each   |
| Assets in one pack                                     | 64 MiB       |
| Source WAV admitted for splicing                       | 128 MiB      |

M5 video limits and scoped-token duration/batch limits still apply. Quotas stop
new admission rather than silently delete history or outputs. Archiving profiles
does not reclaim immutable version slots. Export/cache/media retention continues
to use the existing app storage controls; these bounds are not a global disk quota
for unrelated uploads or completed videos. There is no automatic history pruning.

## REST and MCP

| Operation                                | REST                                         | Scope                                                    |
| ---------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| List profiles, revisions, packs and runs | `GET /api/factory`                           | `studio:read`                                            |
| Publish profile version                  | `POST /api/factory/profiles`                 | `studio:write`                                           |
| Archive profile                          | `DELETE /api/factory/profiles/:id`           | `studio:write`                                           |
| Submit variants                          | `POST /api/factory/runs`                     | `production:submit`                                      |
| Inspect run                              | `GET /api/factory/runs/:id`                  | `studio:read`                                            |
| Cancel / resume / approve                | `POST /api/factory/runs/:id` with `{action}` | cancel: `production:cancel`; others: `production:submit` |
| Read frozen variant                      | `GET /api/factory/revisions/:id`             | `studio:read`                                            |
| Download pack archive                    | `GET /api/factory/packs/:digest`             | `artifacts:read`                                         |

MCP tools `list_factory`, `save_series_profile`, `create_factory_run`,
`get_factory_run`, `control_factory_run`, and `get_factory_revision` use the same
REST contracts. Approval remains studio-only. `create_factory_run` requires an
explicit idempotency key. Existing film-plan tools create master checkpoints;
existing batch bundle tools download verified outputs.

```json
{
  "idempotencyKey": "lesson-episode-01-v1",
  "sourceRevisionId": "saved-master-revision",
  "runMode": "approval",
  "variants": [
    {
      "kind": "aspect",
      "key": "landscape",
      "label": "Full lesson",
      "orientation": "landscape"
    },
    {
      "kind": "cutdown",
      "key": "short",
      "label": "Selected explanation",
      "orientation": "portrait",
      "sceneIds": ["first-source-scene", "later-source-scene"]
    }
  ]
}
```

Run `npm run db:migrate` for existing databases; the migration script makes a
consistent backup first. Stop app/worker connections if SQLite reports a migration
lock, then retry. Read [M6 acceptance evidence](production/ADAPTIVE_M6_VALIDATION.md)
for actual exports, recovery, compatibility and limitations.

## Factory workspace and safeguards

Open **Factory** from navigation to see saved masters, variants, approval queues,
individual jobs and output packages. Selecting a master compares it with its
editable source using the same narration take. **Check source again** refreshes
that comparison; a changed source does not silently change a frozen output.
Freeze a new master when you want the updated edit.

Set **Maximum combined output minutes** before submitting. The server rejects
runs whose variants exceed that budget; the absolute ceiling remains 30 minutes
and six variants. REST callers may supply `maxOutputSeconds` (1–1800); omission
retains the 1800-second ceiling. These factory variants reuse saved narration and
do not trigger AI calls. Voiceover batches are separate, explicitly approved
provider jobs. Retry preserves completed variants.

The asset library previews audio and video as playable media and shows current
scene, script and podcast references with stored provenance. It also scans frozen
revisions, jobs, profiles, podcast finishing snapshots and saved edit history,
including embedded JSON fields. Referenced assets cannot be deleted; the server
returns a conflict so saved content keeps its dependencies.
