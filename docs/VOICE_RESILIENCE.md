# Voice resilience and timing

## Complete local synthesis

Installed `kokoro-js` 1.2.1 calls its tokenizer with truncation enabled for a
single `generate()` input. Both browser and server now split sentences, cap text
chunks at 220 characters, and disable truncation on the exact phoneme tokenizer
call. Inputs above 510 encoded tokens split again before inference; all successful
chunk PCM is concatenated in order. A failed chunk fails the complete request.
Sentence boundaries can change prosody compared with one short utterance.

One gate owns each loaded server session/browser worker, with at most 64 pending
calls. Canceled queued calls immediately release their inputs; a full server
queue reports a retryable 503. Cancellation rejects
the caller promptly but cannot interrupt an already running native ONNX call;
the gate stays occupied until that call settles. Subsequent chunks check the
signal before and after inference. Server model load, queue wait and synthesis
share a 120-second deadline. Durable jobs do not automatically retry paid or
interrupted voice work.

## Bounded provider IO

HTTP deadlines remain active until EOF, cancellation or failure, including when
a caller signal is also supplied. Unread/stalled bodies are canceled on timeout;
responses are capped at 128 MiB. Metadata, music search and ordinary VoiceForge
proxy requests use 30 seconds; Cartesia/ElevenLabs synthesis uses 120 seconds;
VoiceForge synthesis uses ten minutes and progress streams twenty minutes.
Production cancellation reaches synthesis requests. Persistence checks prevent
late output from a provider that ignores cancellation from becoming a new take.

## Timing and known-script alignment evaluation

Cartesia's [SSE speech endpoint](https://docs.cartesia.ai/api-reference/tts/sse)
requests word timestamps alongside raw PCM. ElevenLabs'
[with-timestamps endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps/)
returns character alignment, grouped into Unicode words; plan-gated 44.1 kHz WAV
still falls back to 24 kHz and resamples without changing timestamp seconds.
Validated timing is saved alongside cached audio and selected scene clips, then
converted using sample-derived beat offsets and FPS. Podcast intro frames are
added to both beats and words. Take JSON retains the words across reconnects.
Older entries without sidecars continue with estimated captions.

Caption creation accepts provider timing only when every cue's words match the
current spoken script and the take uses the current FPS. This lexical completeness
check tolerates punctuation/case, but rejects missing words, expanded numbers,
stale scripts and partial takes; it does not generate or acoustically align times.
Mixed measured/estimated results are labeled estimated and discard word timings.
Measured tracks keep take/FPS provenance for karaoke and speech-aware SFX.

Configured whisper.cpp remains optional ASR with native token timing. ASR or a
known-text prompt does not implement forced alignment of the supplied script.
A separate acoustic aligner would require an additional model/runtime, language
coverage and mismatch/confidence evaluation. Reel Studio preserves real timing
and honest estimates without adding an unverified aligner or model downloads.

## Verification

Fixtures cover long text through its final word, actual tokenizer truncation
options and recursive splitting, concurrent/canceled inference, stalled headers
and bodies, caller abort, unread body cleanup and timer release. Provider fixtures
exercise Cartesia PCM/timestamps and ElevenLabs alignment plus plan fallback.
Isolated SQLite/audio fixtures exercise cache reuse/reconnect, scene assembly,
word offsets, schema roundtrips, caption provenance, omissions, stale text/FPS,
partial takes and cancellation before persistence.

No paid speech requests or new model downloads are used by these checks. Cached
PyTorch Kokoro weights are not the ONNX model used by this app; native Kokoro
acoustic quality is therefore not claimed by the fixture tests. Real HyperFrames
export/cancellation and the complete repository checks remain regression gates.

Published integration evidence is in [release validation](production/RELEASE_VALIDATION.md).
