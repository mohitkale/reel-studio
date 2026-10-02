# Critical review assessment and milestones

Assessed 2026-10-02 against `b2b3f57` (the same commit as the supplied review).
This is a code assessment, not a repeat of the review's Windows run or visual
benchmark. Reproduce environment-dependent claims in the owning milestone.

## Assessment

The review identifies real security and reliability defects. Its product critique
is directionally useful: the scene contract constrains composition, the editor
exposes too many technical choices, and maintaining authored visuals twice is
costly. The user approved HyperFrames-only support on 2026-10-02. Retire Remotion in
M3, migrate existing projects, and update README/setup/licensing documentation.
HyperFrames declares Apache-2.0; audit runtime dependencies and assets before
claiming that the entire distributed stack shares that license.

| Finding | Assessment / evidence | Milestone |
| --- | --- | --- |
| LAN bind, reconstructed localhost URL, forged Fetch Metadata, strict-mode bypass | Confirmed in `scripts/supervise.mjs` and `src/server/auth.ts`. Raw Host is not the client's IP; default loopback binding is the actual network boundary. | M1 |
| Missing API read / SSE auth | Confirmed: 33 GET handlers have no auth call. Guard handlers themselves; Next 16 uses `proxy.ts`, and its docs warn against relying on Proxy alone. | M1 |
| Render approval skips authorization | Incorrect: `renders/[id]/approve` already calls `requireWeb()`. Its protection still depends on fixing the shared auth bypass. | M1 regression |
| API-key dotenv injection | Confirmed: `writeEnvKey()` writes unescaped user values after trimming. Reject line breaks before trimming and dotenv metacharacters before any IO. Avoid brittle guesses at vendor key prefixes. | M1 |
| Lottie expressions execute uploaded code | Confirmed: asset preview imports the full player; installed player evaluates expressions. Use the expression-free light build, including for previously stored assets. | M1 |
| Next / transitive vulnerabilities | Next 16.3.4 is installed. Verify advisories and actual reachability; do not carry forward the report's audit counts or blindly run `audit fix`. Next 16.3.8 is a published security release. Dependency downloads require repository-mandated approval. | M2 |
| Local processes bypass scoped MCP and approve jobs | True under the documented single-user trust model: uncredentialed loopback requests act as web requests. Document it explicitly; strict bearer mode blocks uncredentialed API/media access but has no browser login. | M1 docs; M8 session design |
| Media reads and hashing buffer whole files | Media buffering confirmed through `AssetStore.get()`; streaming checksums need call-site verification. Preserve realpath containment while adding streaming. | M4 |
| Rejected Remotion bundle stays cached | Confirmed: clearing `bundlePromise` follows `await`, so rejection skips cleanup. Development invalidation also needs a defined policy. | M3 removes this path |
| Windows process-tree cancellation | POSIX-only cleanup confirmed in supervisor; verify all worker cancellation paths with Windows execution. The report's 17 failures are not independently reproduced. | M4 / M8 |
| Wrong 502 for invalid client input; catalog revision equality | Confirmed in `api-helpers.ts` and catalog `manifest.ts`. Separate client validation from provider-output validation; use explicit revision ordering, not string comparison. | M4 |
| Render cards stale; worker progress invisible; unsafe SSE; Maps never evict; three queues | Read/progress routes use process-local subscriptions. Verify component behavior and connection lifecycle, then converge editor work on durable jobs without replaying paid work. | M5 |
| Supervisor lifetime crash budget | Confirmed: restart count never resets after healthy uptime. Define a crash window and verify recovery. | M5 |
| Job list snapshot N+1 | Confirmed: each revision-bearing job calls `currentVideoRevisionHash()` through `productionJobViewWithRevision()`. Exact query counts require profiling. Cache by actual script revision or batch reads; a time-only cache risks stale approval decisions. | M6 |
| SQLite WAL / busy timeout; progress writes; heartbeat cancellation | Client initialization does not explicitly configure WAL/timeout. Verify adapter defaults and busy-error handling before changing lease semantics. | M6 |
| Kokoro truncation / global concurrency | `tts.generate(fullText)` confirmed; runtime truncation is not reproduced. Provider maxConcurrency is 1, but that is not a global inference gate. Check installed tokenizer/stream API before chunking. | M7 |
| Provider word timestamps; forced alignment; fetch timeouts | Review individual provider capabilities and request paths; don't equate provider timestamps with forced alignment. Keep estimated captions honestly labeled. | M7 |
| Windows paths / modes / CRLF; CI; scanner gaps; action pins / permissions | Windows results unverified locally. Add Windows CI and LF policies with platform-aware tests. Assess scanner patterns and Actions permissions without changing unrelated dependency majors. | M8 |
| Hostname-only render media checks, sandbox, upload buffering, CSP, Docker source mount | Separate defense layers from claims of exploitability. DNS-pinned source ingestion is stronger than render URL filtering. Require concrete threat-model fixtures; CSP must preserve previews, workers, and media. | M8 |
| HyperFrames transitions and font mismatch | Confirmed: producer omits preview seek code that sets transition CSS variables; serif render aliases use Geist sans. Native GSAP motion still exists, so “no motion” would overstate the finding. Preview/export parity needs rendered evidence. | M9 |
| Fixed layouts, line packing, hardcoded palettes, finite ambient loops | Confirmed constraints in the native implementation; measure overflow, brand propagation, and long-scene behavior before claiming all layouts fail. | M9 / M11 |
| Sparse scene model, duplicate engine treatments, token Three/Lottie, catalog look-alikes | Scene contract lacks a general layer graph; separate engine implementations exist. Native catalog adapters are real code rather than upstream block execution. LOC totals and visual-quality rankings are not acceptance criteria. Audit registry consumers before deletion. | M10 / M11 / M14 |
| Deterministic planner cannot recognize content; AI cannot direct shots | Planner emits empty emphasis and preset-role template mapping; constrained AI schema lacks graph composition. Detection should never invent numerical chart data. | M12 |
| Dashboard friction, preset previews, engine jargon, no timeline, oversized components | Product observations, not correctness proofs. Walk through the existing one-shot path and test responsive layouts. Prefer visible results over arbitrary component-size targets. | M13 |
| Version label, walkthrough mismatch, old README screenshot | Small verifiable UX/documentation fixes alongside the actual workflow redesign. | M13 |
| Provider extensibility / missing integrations; ceremony / duplicated helpers | Maintenance opportunities. Add a registry only after proving a second extension; choose new providers by capability and demand. Consolidate helpers when touching their owning paths. Archive old ledgers rather than adding more task ceremonies. | M7 / M14 |
| Remotion, phonemizer/espeak, XTTS licensing | Existing licensing docs need comparison with current upstream terms and distributed artifacts. Do not treat static license guesses as verified legal conclusions. | M3 retirement / M8 inventory |

Source for the patch target:
[Next.js 16.3.8 release](https://github.com/vercel/next.js/releases/tag/v16.3.8).
Use current primary advisories in M8 rather than the pasted report's frozen table.

## Execution policy

Each milestone has one focused PR and a `feature/` branch. The user authorized
the full sequential cycle: implement, validate, open the PR, wait for required
CI/build checks on the latest head, merge, switch locally to `main`, and pull the
latest changes before starting the next milestone. Fix failed checks on the
owning branch and respect required reviews and branch protection. Do not leave
an unmerged PR and advance or implicitly stack milestones. M2 upgrades packages
in its own PR; M3 retires Remotion and updates README with the user's approval.
Future rows remain separate milestones, not changes bundled into M1.
The user requested a new GitHub release on 2026-10-02 after final verification.
M15 is the last milestone and depends on M1–M14 being merged and verified;
release publication is part of that milestone, after its PR/checks/merge/main-pull cycle.

Every code PR runs typecheck, relevant lint, behavior tests, and secret scan.
Rendering changes additionally require preview/export keyframes and actual
fixture renders. Never accept a passing string/snapshot test as visual evidence.

| Milestone / branch | Scope and acceptance gate |
| --- | --- |
| **M1: security boundary** `feature/review-m1-security` | Loopback by default; explicit container bind; raw Host allowlist before all auth; strict bearer enforcement; auth in every API/media handler including reads and progress; expression-free Lottie; safe key persistence; regressions for forged Host/Fetch Metadata/Origin, read scopes and approval denial. Dependency upgrades belong exclusively to M2. Document local trust and strict-mode limitations. |
| **M2: package upgrades** `feature/review-m2-dependency-upgrades` | Next 16.3.8 and all applicable stable package updates, grouped by compatibility. Inspect peer/runtime/API changes; keep retained render-engine packages aligned until M3 removes Remotion. Gate: lockfile integrity, typecheck/lint/tests/security/build, real engine smoke exports, no blind audit fixes or unsupported major migration. User approved dependency downloads on 2026-10-02. |
| **M3: HyperFrames-only** `feature/review-m3-hyperframes-only` | Remove Remotion runtime/bundler/player/CLI dependencies and implementations, migrate project engine values and legacy template IDs, move shared scene/token/timing types out of Remotion folders, replace previews/gallery/demo/CI scripts, remove the engine picker, and update README/setup/license docs. Gate: existing-project migration, no Remotion imports/dependencies, complete create-preview-export/download workflow with HyperFrames; Apache-2.0 verified for HyperFrames itself. |
| **M4: bounded IO and recovery** `feature/review-m4-io-recovery` | Stream bounded media ranges through storage without weakening containment; stream checksums; Windows process-tree termination; distinguish 400 input errors from provider 502; revision ordering. Gate: range/suffix/invalid/abort cases, bounded-memory large-file probe, Windows cancellation. Retired Remotion bundle caching is resolved by M3 removal. |
| **M5: durable editor jobs and progress** `feature/review-m5-durable-progress` | Route editor render/voice work through durable jobs; reconcile interrupted render rows; source progress from durable state; shared SSE lifecycle with cancel/abort/unsubscribe; resync cards; bounded queue retention; reset supervisor crash budget after stable uptime. Gate: restart/reconnect/cancel/terminal-state tests, no paid automatic replay, no lingering EventSources. |
| **M6: SQLite and polling cost** `feature/review-m6-database-polling` | WAL/busy timeout verified against actual adapter; throttle progress writes; batch revision reads or cache using durable revision invalidation; handle transient heartbeat contention without false cancellation. Gate: simultaneous web/worker test and query-count comparison for 50 jobs; current revision changes visible immediately. |
| **M7: voice and provider resilience** `feature/review-m7-voice-resilience` | Sentence/token-bounded Kokoro chunks and global inference gate; bounded cloud/VoiceForge/music requests; request supported word timing and preserve it; evaluate known-script alignment. Gate: long script with full narration retained, concurrent calls, timeout/cancel, timestamp-caption fixtures. No new model downloads without approval. |
| **M8: portability and hardening** `feature/review-m8-portability-hardening` | Windows CI, portable file/path/process assertions, LF vendored assets, scanner coverage, SHA-pinned Actions and minimal permissions; verified dependency/license inventory and targeted patch updates; render URL resolution/upload buffering/frame policy threat tests; clarify remote browser/session requirements and Docker mount tradeoff. Gate: Linux + Windows CI and audit reachability notes. |
| **M9: export fidelity** `feature/review-m9-export-fidelity` | Producer-safe transitions; real matching preview/export fonts with script coverage and local GSAP; duration-aware ambient motion; brand ink/background propagation; measured text fitting. Gate: exported boundary frames, serif/non-Latin/long-copy fixtures, offline preview. Preserve current projects. |
| **M10: motion spec and compiler** `feature/review-m10-motion-spec` | Small versioned shot/layer/element/timing schema; legacy scene migration adapter; deterministic compiler prototype; keep all composition props engine-neutral after the M3 migration. Gate: legacy round trip and preview/export seeks. The user has approved engine removal in M3; extend that compiler rather than reintroducing a second engine. |
| **M11: authored motion library** `feature/review-m11-motion-library` | First coherent set of ~15 blocks (kinetic text, supplied-data charts, product, diagrams, brand); shared type/spacing/motion tokens; duration-aware sequences. Gate: reviewed contact sheets and actual 9:16/16:9 exports with readable copy, continuous motion, deliberate handoffs and supplied data only. Grow to 40–60 only after quality passes. |
| **M12: director pipeline** `feature/review-m12-director` | Content-aware no-key beat/shot planning first; constrained local/frontier AI over the same schema; script/voice/word timing integration; bounded visual critique/fix loop. Gate: numbers/lists/quotes/comparisons, stable seeds, no fabricated data, explicit paid-call budgets. |
| **M13: creation and editing UX** `feature/review-m13-creation-ux` | Prompt-first home, visual presets, one Generate action and downloadable result; sane defaults; results/remix; advanced technical controls; timeline customization; responsive toolbar; refresh docs/version/screenshots. Gate: browser walkthrough on small/large viewports and complete no-key prompt-to-download path. |
| **M14: extension and simplification** `feature/review-m14-extensions` | Typed provider/block registration demonstrated with real extensions; keep only used catalog artifacts; extract duplicate escaping/queue/SSE helpers; archive obsolete ledgers and remove genuinely unused compatibility layers. Gate: extensions added without core enum edits; existing projects/providers still work. |
| **M15: final verification and release** `feature/review-m15-release` | Depends on completed M1–M14. Verify the integrated release from a clean install and populated v0.3.0 upgrade; run the full checks, platform CI, browser workflows and actual render matrix. Prepare consistent version metadata, changelog, upgrade/license notes and release evidence in one PR. After successful latest-head CI, merge, refresh local `main`, verify its exact commit, tag it and publish a stable GitHub release. Gate: all release checks pass, upgrade data/media are preserved, release assets are verified, and the published tag/commit/notes are confirmed. |

## Final release gate (M15)

Verified on 2026-10-02: the latest published stable release is
[v0.3.0, published 2026-08-05](https://github.com/mohitkale/reel-studio/releases/tag/v0.3.0).
The repository currently declares `0.4.0`, so `v0.4.0` is the tentative release
target. Recheck published releases, drafts and remote tags when M15 starts;
choose the version for the final scope and never overwrite an existing tag.

1. Confirm every earlier milestone is merged into updated `main`, with its
   acceptance evidence recorded. Reproduce remaining critical-review findings
   and confirm their fixes; documented limitations and deferred work must be
   explicit. Fix failed gates before publishing.
2. Verify a clean locked dependency install, typecheck, lint, unit/integration
   tests, secret scan, release checks and production build. Require the Linux
   and Windows CI added in M8, including cancellation and recovery checks.
   Review the current dependency/security and license inventory; document
   upstream limitations and block publication on unresolved exploitable
   security defects or core workflow regressions.
3. Exercise fresh setup and a populated upgrade from the published v0.3.0
   schema in isolated fixtures, including backup/restore. Preserve project
   copy, media, audio takes, captions and historical exports; verify the
   HyperFrames migration and explain changed future render appearance.
4. Complete browser creation, editing, voice generation, preview, export and
   download, plus podcast/audiogram and scoped MCP approval workflows. Render
   the six presets and representative media/caption/motion cases in portrait,
   landscape and square; inspect exported keyframes and audio. Include a long
   video, retry, interruption and cancellation. Reuse approved local models
   and credential-free fixtures; paid calls and new model downloads retain
   their existing permission requirements.
5. In the dedicated release PR, synchronize package/lockfile version, visible
   app version, release-check expectations and current release metadata.
   Write the dated changelog, v0.3.0 upgrade instructions, current screenshots
   and concise release notes. Generate current evidence without relabeling
   historical matrices as new verification. Check any attached samples or
   archives for secrets/private media, licenses and checksums. Keep application
   MIT, HyperFrames Apache-2.0 and GSAP/model/media terms distinct.
6. Wait for required checks on the final release PR head, merge it, switch to
   local `main` and pull with `--ff-only`. Confirm the merged commit matches
   the validated release content; repeat affected checks if it has changed.
   Create the version tag at that exact commit and publish the stable GitHub
   release with the reviewed notes and verified assets. Confirm its public
   URL, tag, target commit and downloads. Do not publish early or leave the
   milestone complete with only a draft release.

## Execution status

- M1 merged after successful latest-head checks: [PR #29](https://github.com/mohitkale/reel-studio/pull/29), merge `3664568`. Local `main` was pulled before M2.
- M2 merged after successful latest-head checks: [PR #30](https://github.com/mohitkale/reel-studio/pull/30), merge `906dac0`. Local `main` was pulled before M3. Current package decisions and verification are recorded in [dependency upgrades](DEPENDENCY_UPGRADES.md).
- M3 merged after successful latest-head checks: [PR #31](https://github.com/mohitkale/reel-studio/pull/31), merge `c973cc1`. Local `main` was pulled after merging. One HyperFrames preview/export path, safe project/template migration, neutral shared contracts, local audiogram renderer, and updated setup/runtime/license documentation. Migration preserves historical MP4s, original takes and immutable provenance. Native opener/statistic/list/quote/statement mappings avoid requiring new assets. Browser export reproduced clipped catalog text; native templates are the migration/new-scene default, while broad catalog fidelity remains M9.
- M15 is planned after M1–M14; release preparation and publication have not started.
- M4 merged after successful latest-head checks: [PR #33](https://github.com/mohitkale/reel-studio/pull/33), merge `8c141b2`. Local `main` was pulled before M5. Local acceptance evidence is recorded in [bounded IO and recovery](IO_RECOVERY.md); focused Linux/Windows process-cancellation gates passed. Wider Windows application coverage remains M8.

- M5 merged after successful latest-head checks: [PR #34](https://github.com/mohitkale/reel-studio/pull/34), merge `6e6f37e`. Local `main` was pulled before M6. Implementation: editor exports and voice operations now use durable jobs; MCP render approval retains submitted settings. Database-backed progress and completion DTO reconstruction survive reconnects. Interrupted provider work requires explicit retry; canceled/failed jobs reconcile active render cards, and legacy orphan renders become retryable errors. SSE cleanup covers terminal state, abort and body cancellation, with bounded buffering; client waits close on unmount/deadline and propagate terminal polling errors. Supervisor crash budget resets after stable uptime; the remaining render progress cache is bounded. Acceptance includes isolated SQLite worker/reconnect/approval/cancellation fixtures, stream lifecycle tests, real HyperFrames export/active cancellation, and the full checks. Its 692 tests, real exports and latest-head CI/build gates passed.

- M6 merged after successful latest-head checks: [PR #35](https://github.com/mohitkale/reel-studio/pull/35), merge `72e75c5`. Local `main` was pulled before M7. Implementation: verified adapter-level WAL/five-second busy timeout; coalesced serialized progress with terminal flushing; fresh batched revision reads; indexed render reconciliation with no idle update statements; bounded lease-aware contention handling. The isolated 50-distinct-script comparison fell from 500 queries to 10, with edits visible on the next read. Separate-process write-lock and two-client read/heartbeat tests verify contention without false cancellation. Its full local checks, real export/cancellation verification, and latest-head CI/build gates passed.

- M7 implementation: complete Kokoro chunk synthesis guarded by the exact tokenizer and a session-wide inference gate; provider deadlines include body reads and cancellation; Cartesia/ElevenLabs measured words persist through caches, clips, takes and podcast offsets. Caption creation uses measured provenance only for a complete, current script at matching FPS. Known-script alignment evaluation and verification boundaries are recorded in [voice resilience](VOICE_RESILIENCE.md). Latest-head CI/build gates must pass before merge.
