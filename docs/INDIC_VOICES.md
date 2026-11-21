# Indian-language voice evaluation

## Decision

The v1.1 release shortlist is empty as of 21 November 2026. Indic Parler-TTS,
IndicF5, and two Telugu Piper voices warrant another look when their documented
blockers are resolved. An optional provider needs release-gate evidence before
it appears in the app. Kokoro is the default voice. [Evaluation #237](https://github.com/mohitkale/reel-studio/issues/237) · [Release gate #242](https://github.com/mohitkale/reel-studio/issues/242)

| Candidate                  | Verdict                                                                                           | Published coverage and weight size                                                    | Release blocker                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AI4Bharat Indic Parler-TTS | Watch                                                                                             | 18 languages, 3.75 GB safetensors                                                     | Full training-data terms and a pinned, audited offline runtime                                              |
| AI4Bharat IndicF5          | Watch                                                                                             | 11 languages, 1.40 GB safetensors                                                     | Published loader uses `trust_remote_code=True`. Reference recordings require documented consent and rights. |
| Kenpath Svara-TTS v1       | Excluded for v1.1                                                                                 | 19 languages, 13.20 GB across three safetensors shards                                | Large CPU download, unfrozen decoder dependency and incomplete training-data rights                         |
| Rhasspy Piper Indic voices | Watch Telugu Padmavathi and Venkatesh. Exclude the six other reviewed voices from this shortlist. | Hindi, Malayalam and Telugu, approximately 63–64 MB per ONNX voice                    | Per-voice weight and training lineage needs confirmation, and Tamil is absent in this revision.             |
| Verba-TTS-Indic-Zero       | Excluded for v1.1                                                                                 | 12 languages and 7.6 MB stated by the demo                                            | No public weight files, model card or release licence found                                                 |
| Meta MMS-TTS               | Excluded                                                                                          | Hindi checkpoint 145 MB, with safetensors and PyTorch alternatives                    | Weights are CC BY-NC 4.0.                                                                                   |
| Coqui XTTS-v2              | Excluded                                                                                          | 17 languages, including Hindi. Main `.pth` is 1.87 GB.                                | Non-commercial model terms and PyTorch checkpoints                                                          |
| Bodhan AI Indic-Speak      | Excluded for v1.1                                                                                 | 22 Indian languages and English, 6.60 GB safetensors plus a 467 MB decoder checkpoint | The published decoder uses `.pt`. Model use is subject to a custom licence and upstream terms.              |

## Code, weights, and training-data evidence

Sizes are decimal bytes from the publishers' asset inventories. Dates below
are the model repositories' reported last update at the time of this review.
Published sample audio provides playback evidence. Local CPU synthesis speed
remains unmeasured across these candidates because their runtimes were not
installed or run. Hardware and quantization claims from different projects
cannot substitute for a comparable local real-time factor.

- **Indic Parler-TTS.** AI4Bharat's 6 October 2026 revision `660bc53` lists
  Apache-2.0 weights and a single safetensors file. The Parler inference
  library is also Apache-2.0. The AIKosh listing instead labels the model MIT.
  The model card lists IndicTTS, LIMMITS and Rasa as CC BY 4.0 for fine-tuning,
  and its pretraining card also lists IndicVoices and IndicVoices-R. The GLOBE
  row says `CC V1`. The source GLOBE card says CC0 1.0, while the published
  annotated corpus has no licence in its card. Confirm the annotation terms
  and any attribution obligations for commercial inference. The advertised
  workflow uses named voices and text descriptions. A version-pinned Python
  and PyTorch environment and offline execution evidence remain pending.
  [Model card](https://huggingface.co/ai4bharat/indic-parler-tts) · [Pinned files](https://huggingface.co/ai4bharat/indic-parler-tts/tree/660bc53c64ae83150613264111708a0465211237) · [Engine licence](https://github.com/huggingface/parler-tts/blob/main/LICENSE) · [AIKosh](https://aikosh.indiaai.gov.in/home/models/details/ai4bharat_indic_parler_tts_text_to_speech_model.html) · [Pretraining sources](https://huggingface.co/ai4bharat/indic-parler-tts-pretrained) · [GLOBE](https://huggingface.co/datasets/MushanW/GLOBE) · [Annotated GLOBE](https://huggingface.co/datasets/ai4b-hf/GLOBE-annotated)
- **IndicF5.** AI4Bharat's 6 October 2026 revision `fb652a9` lists MIT weights.
  The separate GitHub repository has no repository-level licence file. The
  model card names Rasa, IndicTTS, LIMMITS and
  IndicVoices-R. The Rasa and IndicVoices-R cards declare CC BY 4.0. Confirm
  the exact terms of the other source releases and every proposed reference WAV.
  The published path takes an example voice and its transcript, and the card
  requires explicit permission to clone that voice. A vetted offline loader
  and consent records for any reference voice are required to proceed.
  [Code](https://github.com/ai4bharat/IndicF5) · [Card and reference terms](https://huggingface.co/ai4bharat/IndicF5) · [Pinned files](https://huggingface.co/ai4bharat/IndicF5/tree/fb652a96e508091045890dae5bb99fe511facbcf) · [Rasa](https://huggingface.co/datasets/ai4bharat/Rasa) · [IndicVoices-R](https://huggingface.co/datasets/ai4bharat/indicvoices_r)
- **Svara-TTS v1.** Kenpath Labs' 27 October 2025 revision `db8a02f` and the
  separate inference toolkit are Apache-2.0. The card names SYSPIN, Rasa,
  IndicTTS and SPICOR across more than 2,000 hours. The exact subsets and
  downstream rights remain unverified. The published demo fetches a separate
  SNAC decoder at startup and its checkpoint is a PyTorch `.bin` file. The published
  CPU deployment uses GGUF, outside the approved formats for this milestone.
  [Model card](https://huggingface.co/kenpath/svara-tts-v1) · [Pinned weights](https://huggingface.co/kenpath/svara-tts-v1/tree/db8a02fc1e4eab827ff6dda5bed3b56d4d2dd51e) · [Inference code](https://github.com/Kenpath/svara-tts-inference) · [Demo loader](https://huggingface.co/spaces/kenpath/svara-tts/blob/main/app.py) · [Decoder files](https://huggingface.co/hubertsiuzdak/snac_24khz/tree/main)
- **Piper.** The original Rhasspy engine is MIT and archived. OHF-Voice
  maintains the successor under GPL-3.0-or-later. Its licensing guide says
  each voice's card describes that voice's recordings and the base may have
  separate terms. In the reviewed inventory `e9c8a39`, Hindi Pratham
  and Priyamvada cite CC BY-NC-SA 4.0 datasets. Hindi Rohan, Malayalam Arjun
  and Meera, and Telugu Maya cite Lessac lineage. Telugu Padmavathi and
  Venkatesh cite CC BY 4.0 IndicVoices-R and name their trainer, but do not
  state their base lineage or separate weight grant. Neither appears on the
  maintainer's verified commercial lineage list. Confirm both before proposing
  these as optional downloads. Each needs the ONNX and its matching JSON config.
  [Archived runtime](https://github.com/rhasspy/piper) · [Maintained runtime](https://github.com/OHF-Voice/piper1-gpl) · [Voice licensing](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md) · [Commercial lineage list](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/COMMERCIAL_USE.md) · [Hindi cards](https://huggingface.co/rhasspy/piper-voices/tree/e9c8a39444359388adaa94255becb37a5a2b8e51/hi/hi_IN) · [Malayalam cards](https://huggingface.co/rhasspy/piper-voices/tree/e9c8a39444359388adaa94255becb37a5a2b8e51/ml/ml_IN) · [Telugu cards](https://huggingface.co/rhasspy/piper-voices/tree/e9c8a39444359388adaa94255becb37a5a2b8e51/te/te_IN)
- **Verba-TTS-Indic-Zero.** The author's hosted demo describes a 1.8M-parameter
  research model. The code, training data, weight format, revision, usage rights
  and comparable local runtime speed remain unverified. [Author demo](https://verba-tts.suryatk.in/)
- **MMS-TTS.** Meta's Hindi revision `1d83b22`, dated 6 September 2023,
  publishes both safetensors and `.bin`. The weight terms restrict commercial
  use regardless of format. The documented Transformers inference library is
  Apache-2.0. Meta's MMS paper describes the multilingual speech corpora.
  Commercial rights to the full training-data chain were not established.
  [Model card](https://huggingface.co/facebook/mms-tts-hin) · [Pinned files](https://huggingface.co/facebook/mms-tts-hin/tree/1d83b223ec78e30b944f7d96bd117eb3d7023303) · [Inference code licence](https://github.com/huggingface/transformers/blob/main/LICENSE) · [MMS paper](https://arxiv.org/abs/2305.13516)
- **XTTS-v2.** Coqui's 11 December 2023 revision `6c2b0d7` lists `.pth` weights.
  The code is MPL-2.0 and the Coqui Public Model License limits the model and
  its output to non-commercial use. The checkpoint card does not establish
  the full training-data terms. Voice cloning also requires consent to use a
  reference recording.
  [Code licence](https://github.com/coqui-ai/TTS/blob/dev/LICENSE.txt) · [Model licence](https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt) · [Pinned files](https://huggingface.co/coqui/XTTS-v2/tree/6c2b0d75eae4b7047358e3b6bd9325f857d43f77)
- **Indic-Speak.** AI4Bharat recommends this successor to IndicF5. Bodhan AI's
  7 September 2026 revision `76e0814` lists a main safetensors file and
  `vocos/best.pt`, alongside an inference script. Its Indic Open Model
  License v1.0 has conditions on hosting and redistribution. The card also
  calls out Llama, SNAC and Vocos terms and states its library voices were
  recorded by consenting artists. The full training-data rights chain and
  any separate grant for the bundled inference code are unverified.
  [Publisher card and terms](https://huggingface.co/bodhan-ai/indic-speak) · [Pinned files](https://huggingface.co/bodhan-ai/indic-speak/tree/76e0814f189321efe550011850cd288dae366aad)

## Sample playback and measurements

The three pinned Kenpath samples each completed in the built-in browser.
FFprobe measured duration and format. FFmpeg `loudnorm` reported the input
levels below. Every file is mono, 24 kHz, 16-bit PCM. Installed multilingual
Whisper returned speech text for each, with the language supplied. That check
gives no word error rate without the publisher's reference text. Native-speaker
ratings for pronunciation, pacing, and naturalness remain pending. [Publisher samples at `db8a02f`](https://huggingface.co/kenpath/svara-tts-v1/tree/db8a02fc1e4eab827ff6dda5bed3b56d4d2dd51e/examples)

| Language | Publisher sample     | Duration | Integrated loudness |  True peak |
| -------- | -------------------- | -------: | ------------------: | ---------: |
| Hindi    | `happy_hindi.wav`    |   2.73 s |         −17.93 LUFS | +0.19 dBTP |
| Tamil    | `surprise_tamil.wav` |   2.99 s |         −14.54 LUFS | +0.12 dBTP |
| Telugu   | `clear_telugu.wav`   |   4.44 s |         −21.20 LUFS | +0.61 dBTP |

## Security evidence for a future candidate

The published package advisories illustrate why the whole chain matters. PyTorch
has advisories for loading malicious checkpoints, including releases that use
`weights_only=True`. ONNX parsers still need an audited, pinned runtime even
when the model is a plain ONNX file. A dependency advisory check belongs to the
actual sidecar lockfile. Publisher inventory metadata supplies expected hashes,
and the release gate must verify the downloaded bytes before loading them.
[PyTorch advisories](https://github.com/pytorch/pytorch/security/advisories) · [ONNX Runtime release notes](https://github.com/microsoft/onnxruntime/releases) · [Release gate #242](https://github.com/mohitkale/reel-studio/issues/242)

## Release gate checklist

Complete one checklist for each proposed model and decoder. Publish the
review evidence against the exact runtime build and model revisions.

- [ ] All weights are ONNX or safetensors, including secondary decoders.
      The reviewed loader uses `trust_remote_code=False` and opens only local
      files. Any required script is part of the reviewed runtime build.
- [ ] The optional downloader pins every artifact to an immutable revision
      and checks SHA-256 before committing the download. On mismatch it discards
      its own temporary file and reports the failed artifact. Staged files and
      their hashes are recorded in the manifest.
- [ ] Observe the sidecar listening on `127.0.0.1`. Confirm the packaged
      sandbox denies outbound network access and writes outside the model data
      directory. Link evidence for the supported platforms and runtime build.
- [ ] Review code, weight and training-data rights for the planned commercial
      use. Record the actual terms and attribution in [Licensing](LICENSING.md).
      Deliver weights as an optional download under their own terms.
- [ ] Run `npm run audit:check` and audit the precise sidecar lockfile. Link
      both reports and record the sidecar lockfile's SHA-256.
- [ ] Confirm the model uses no reference recordings or link consent and
      licence evidence for every proposed reference. The feature must not
      impersonate a real person.

Stage the files and the reviewed manifest in one directory, then run:

```sh
npm run voice:gate -- path/to/model-manifest.json
```

| Manifest field   | Required contents                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model`          | Model name and version for the report                                                                                                                                   |
| `artifacts[]`    | `path` relative to the manifest, `kind` (`weights` or `data`), `sha256`, `revision` (full Git hash), and `source` (HTTPS URL containing the revision as a path segment) |
| `terms`          | HTTPS sources `code`, `weights`, and `trainingData` (array), plus `commercialUseAllowed: true` and `delivery: "optional-download"`                                      |
| `runtime`        | `bindHost: "127.0.0.1"`, `outboundNetwork: false`, `writesOutsideData: false`, `trustRemoteCode: false`, `runtimeDownloads: false`, and an HTTPS `evidence` link        |
| `audits`         | HTTPS report links `app` and `sidecar` plus `lockfile` containing its relative `path` and `sha256`                                                                      |
| `referenceAudio` | `{ "kind": "none" }` or `{ "kind": "consented", "evidence": "https://…" }`                                                                                              |

The command checks declared formats, revision pins, staged files, hashes, and
the presence of the documented evidence links. Review the linked licence,
sandbox, consent and audit evidence before approval. The v1.1 shortlist
currently has no candidate ready for that review.
