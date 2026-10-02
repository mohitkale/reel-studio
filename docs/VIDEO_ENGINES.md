# Video rendering

HyperFrames is the only supported preview and export engine. New projects use
HTML templates and a seekable timeline; rendering runs in an isolated local
producer process. No engine choice is required.

Remotion packages, compositions, player, bundler and studio support are removed.
`npm run setup` (or `npm run db:migrate` with the worker stopped) backs up and
migrates legacy projects and template ids. Content, narration, media and existing
MP4 files are preserved. The read adapter also maps legacy ids before migration. Text/emoji scenes map
to the native opener, statistic/list/quote scenes to their native treatments, and
retired Lottie/Three.js scenes to a statement without requiring new assets.
New scenes default to the native opener; existing HyperFrames template ids stay valid.
Existing exports remain downloadable. Future exports use the corresponding
HyperFrames treatment, so their appearance can differ from historical exports.
Immutable production revisions are retained as provenance; create a fresh draft
and approve it before regenerating an old production under the new engine.

HyperFrames itself is Apache-2.0; application code remains MIT. GSAP and optional
models/media have separate terms. See [LICENSING.md](LICENSING.md).
