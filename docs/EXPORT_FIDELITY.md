# Preview and export fidelity

The native compiler uses one paused GSAP root timeline for editor seeks and
producer capture. Scene entrances overlap the outgoing visual tail by up to
650 ms; narration, captions, beat starts and the composition endpoint retain
their original timing. Each scene has its own CSS stacking context. Scoped
visual caches retain the preceding scene through its transition tail.

Preview and export use the same checked-in GSAP 3.15.0 and font bytes under
`public/reel-runtime/`. Export copies the runtime into its isolated project.
`npm run sync:hf-runtime` regenerates it from installed locked packages without
downloads; `manifest.json` records versions, notices, subset CSS and SHA-256
checksums. Vendored GSAP is excluded from application lint and checked by its
byte checksum instead. The application remains MIT, fonts OFL-1.1 and GSAP under
its custom Standard License; see [licensing](LICENSING.md).

Supported families are Geist, Geist Mono, Inter, EB Garamond, Archivo Black and
JetBrains Mono. Historical family choices resolve to genuine bundled faces
(for example Instrument Serif/Georgia → EB Garamond, DM Sans → Inter and
Anton/Impact → Archivo Black). Unknown brand families fall back to Geist on
both paths. Included subsets cover Latin and, where supplied by the family,
Cyrillic, Greek and Vietnamese. Devanagari, CJK and other missing scripts still
need an explicitly bundled font; system fallback is not verified export parity.

Native backgrounds and foregrounds consume brand tokens together. Complete
text groups wrap across the actual viewport, and fitting measures styled text
after font readiness, including case, tracking, emphasis, spacing and height.
Copy is never truncated to seven lines. Fits below 22 authored pixels expose
`data-text-fit-warning`; split overly long copy into more scenes. Ambient loops
derive their finite repeats and periods from the scene duration.

## Reproduce the visual gate

Run `npm run test:export-fidelity` using installed Chromium and FFmpeg. Set
`REEL_VERIFY_CHROME` to an installed executable when Puppeteer's default browser
is unavailable. `-- --preview-only` skips exports. The verifier does not install
a browser or model. Evidence goes to ignored `.artifacts/m9-fidelity/`.

Verified 2026-10-03 on local Chromium 153: offline same-origin iframe `srcDoc`
preview with external requests blocked; identical native callback-suppressed,
backward and repeated seeks; real EB Garamond Cyrillic/Greek subset loads;
complete long copy; brand ink/background; continuing ambient motion at local
six seconds. Actual isolated portrait 540×960 and landscape 960×540 H.264 exports
each contain 450 frames at 30 fps (15 seconds). Exported scene-boundary and
settled-copy frames were inspected. These are native composition fixtures;
the broader catalog, media and release matrix remains the final release gate.
The 803-test local suite, typecheck, lint, secret scan, release checks, production
build and isolated real export/active cancellation gate passed.
