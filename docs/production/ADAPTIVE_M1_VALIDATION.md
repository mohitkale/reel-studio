# M1 compatibility validation

Historical acceptance record, 2026-10-16. Current behavior is documented in
[adaptive film contracts](../ADAPTIVE_CONTRACTS.md); the retained
[upgrade plan](../ADAPTIVE_CONTENT_FACTORY_PLAN.md) distinguishes later work.

## Automated checks

- Full local unit suite: 185 files, 931 tests passed.
- After catalog pinning, the film-plan, semantic-render-context, and production
  orchestrator suites passed: 36 tests.
- Two additional regressions cover 24fps final-frame rounding and propagation of
  the frozen catalog revision; all 20 film-plan tests passed afterward.
- TypeScript, ESLint, secret scan, and production webpack build passed.
- SQLite integration tests exercised immutable checkpoint persistence, restored
  scene choices and remapped IDs, stale/forged rejection without writes, and old
  revision reads without rewriting stored bytes.
- API authorization/error handling and MCP forwarding passed. Compatibility
  fixtures compile to identical HTML with and without plan metadata in all three
  aspect ratios.

## Editor and actual exports

The active app database contains **M1 · Film plan compatibility**, with a saved
script **M1 · Saved scene, motion and semantic graphic**. Its scenes exercise a
legacy title, locked authored type motion, and a semantic showpiece. The editor
loaded the JSON document and successfully saved an immutable revision.

Three draft exports completed through the isolated HyperFrames worker and are
registered in the app's render library:

| Export                       | Dimensions  | Probed duration | Result |
| ---------------------------- | ----------- | --------------- | ------ |
| M1 compatibility · portrait  | 1080 × 1920 | 4.600 s         | Passed |
| M1 compatibility · landscape | 1920 × 1080 | 4.600 s         | Passed |
| M1 compatibility · square    | 1080 × 1080 | 4.600 s         | Passed |

Frames were extracted at 0.8, 2.4, and 4.1 seconds per export. Representative
portrait motion, landscape semantic, and square title frames were visually
inspected. These were silent compatibility fixtures; no paid provider or model
download was used. Local media artifacts stay outside Git.

## Scope and release assessment

This validates metadata and preservation of existing render decisions. It is not
an adaptive-recipe quality certification, a long-form benchmark, or the M0
visual-baseline corpus. M1 provides a same-script checkpoint round-trip; arbitrary
JSON scene-graph editing and cross-project imports are not implemented.

No database migration or dependency change is required. The contract foundation
accumulates toward the next feature release after v0.5.0; it does not justify a
standalone release. Latest-head Linux/Windows Quality and Security checks remain
the merge gate, independently of this local acceptance record.
