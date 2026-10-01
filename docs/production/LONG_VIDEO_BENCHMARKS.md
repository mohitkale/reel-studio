# Five-minute footage and finishing measurements

Measured on 2026-10-01 with Node 24.18.1, Remotion 4.0.523 and HyperFrames
0.8.40 on macOS, Intel Core i7-9750H, 12 logical CPUs and 16 GiB RAM.
Each row is a single sequential trial, not a portable throughput or memory limit.

Run `npm run benchmark:long-videos -- --finishing` to reproduce the six profiles.
Every fixture has 300 seconds, 24 fps, 7,200 frames and ten chapters. Alternating
media-device/media-cinematic and editorial scenes include captions, generated
640×360 eight-second test-pattern footage with final-frame holds, calibration
narration, music, SFX and balanced measured mastering. This evaluates output
scaling and mixed scene/media production; it does not characterize complex
live-action source decoding or natural speech.

| Engine | Profile | Encoded pixels | Cold seconds/video minute | Retry seconds/video minute | Cold peak MiB |
| --- | --- | --- | --- | --- | --- |
| remotion | draft-720 | 640×360 | 60.1 | 33.6 | 3270 |
| remotion | standard-720 | 1280×720 | 104.3 | 36.1 | 3756 |
| remotion | high-1080 | 2560×1440 | 261.0 | 36.6 | 4486 |
| hyperframes | draft-720 | 1280×720 | 60.3 | 15.6 | 2130 |
| hyperframes | standard-720 | 1280×720 | 62.6 | 15.3 | 2108 |
| hyperframes | high-1080 | 1920×1080 | 105.4 | 15.4 | 2490 |

Cold measurements include production planning/rendering, continuous audio
assembly, mastering and delivery probes; native review and finishing are separate.
All cold rows rendered ten sections; each unchanged retry reused all ten and
passed identical encoded video packet checks. Five rows also had identical
encoded audio; the HyperFrames high retry had 0.92% decoded waveform RMS drift,
within the existing 2% audio regression limit. Audio is freshly mixed, encoded and
mastered on every retry, so audio byte identity is not a release guarantee. Every delivery passed exact frame coverage, resolution, duration, mastered audio and boundary continuity.
Memory is sampled process-tree RSS once per second, including child renderers;
shared pages can be counted more than once. Other heavy local checks were paused.

Both engines use 1280×720 draft/standard and 1920×1080 high native canvases.
Remotion scales output by 0.5/1/4⁄3, while HyperFrames retains native dimensions;
compare encoded pixels rather than assuming quality labels are equivalent.

## Finishing decision

| Engine (high) | Extra seconds/video minute | Peak MiB |
| --- | --- | --- |
| remotion | 20.6 | 1885 |
| hyperframes | 9.8 | 1158 |

The explicit experiment blends three decoded frames with causal 1:2:1 weights,
resets history at each cut, re-encodes silent sections and copies the complete
encoded audio. Both five-minute outputs retained 7,200 frames, rate, dimensions,
duration and identical audio packets. Separate outputs preserve the source.
A real FFmpeg regression covers a clean red/green cut, overwrite protection and
cancellation cleanup.

Keep this outside default production: inspected comparisons show softer moving
copy and a one-frame visual lag, with clean first frames at cuts. It is temporal
smoothing, not subframe motion blur. The measured costs do not justify enabling
it for every export. No duration policy or normal production path changed.

## Findings and retained evidence

The matrix exposed landscape device clipping, cinematic copy/caption overlap,
and HyperFrames footage-only warm-retry misses. Device layouts now use adjacent
media/copy columns; cinematic hero copy reserves caption space. Version 4 native
keys canonicalize only a verified discarded workspace pathname, retaining frozen
source/frame hashes, timing, decoder metadata and encoder dependencies. The
Remotion timings precede the final cinematic padding and responsive brand-footer
adjustments; separate final native stills verify those changes on both canvases,
including held source frames. The footer scales with the layout and reserves a
gap below the default caption region.

Native source-playback stills cover all chapters and eight frames at a cut into
footage. Ten encoded chapter stills cover final-frame holds. HyperFrames 0.8.40's
snapshot CLI does not clamp seeks beyond a short video's source duration, so
those later holds are reviewed from the encoded delivery.

Local raw results, MP4s, mastering reports, native PNGs and encoded contact sheets
remain under `.artifacts/long-video-benchmark-1790838676660` (Remotion) and
`.artifacts/long-video-benchmark-1790842776981` (HyperFrames). The combined verified
index is `.artifacts/long-video-benchmark-completed-2026-10-01/results.json`.
Fixture databases are retained; exclusively created source media is cleaned.
These generated artifacts are ignored by Git; this document records the measured
results for reviewers without committing videos or private databases.
