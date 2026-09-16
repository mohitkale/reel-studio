# Reel Studio MCP server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that lets
external AI tools build and edit **video storyboards**, **audio**, **podcasts**, and
**audiograms** in a running Reel Studio app.

It talks to the app **only over its REST API** with a bearer token — it never
touches the database directly. By design it can do everything an editor can
**except**:

- ❌ delete anything (projects, scenes, takes, renders, podcasts, dialogue turns)
- ❌ change configuration or secrets (API keys, defaults — website only)
- ⏸️ legacy tokens keep video rendering behind web approval
- ✅ named scoped tokens can opt into bounded unattended rendering, with provider,
  duration, batch, and finite paid-request limits
- ✅ podcast audio generation **does** run when you call `create_podcast_take`
  (same as the web Generate button; costs TTS credits)

## Setup

1. Start the app: `npm run dev` (defaults to `http://127.0.0.1:3000`).
2. In the app, open **Settings → AI tools / MCP** and **Generate token**. Copy it.
3. Add the server to your AI tool. Copy `.mcp.json.example` to `.mcp.json` and
   paste the token, or run it directly:

   ```bash
   REEL_STUDIO_MCP_TOKEN=<token> npm run mcp
   ```

   Config (`.mcp.json`):

   ```json
   {
     "mcpServers": {
       "reel-studio": {
         "command": "npx",
         "args": ["tsx", "mcp/src/index.ts"],
         "env": {
           "REEL_STUDIO_URL": "http://127.0.0.1:3000",
           "REEL_STUDIO_MCP_TOKEN": "<token>"
         }
       }
     }
   }
   ```

## Tools

### Video storyboards

- **Read:** `list_projects`, `list_video_engines`, `list_production_presets`, `get_script`, `list_takes`,
  `list_scene_clips`, `get_captions`, `list_renders`, `get_render`,
  `list_voice_providers`, `list_voices`, `list_voice_models`, `list_ai_providers`
  (Gemini, OpenAI, Ollama, and LM Studio when configured)
- **Create / edit:** `create_project`, `ai_create_project`, `assign_brand_kit`,
  `update_script`, `set_music`, `add_scene`, `update_scene`, `reorder_scenes`,
  `ai_generate_scenes`, `create_voice_take`, `get_voice_job`,
  `generate_scene_clips`, `get_scene_clips_job`, `assemble_scene_clips`,
  `rename_take`, `rename_render`
- **Compatibility render flow:** `request_render`, `download_render`
- **Durable production:** `produce_content`, `get_production_job`,
  `get_production_job_events`, `cancel_production_job`, `retry_production_job`,
  `download_production_artifact`, `produce_batch`, `get_production_batch`,
  `cancel_production_batch`, `retry_production_batch`, `download_production_batch`

### Audio podcasts

- **Read:** `list_podcasts`, `get_podcast`, `list_podcast_takes`
- **Create / edit:** `create_podcast`, `update_podcast`,
  `replace_podcast_characters` (clears turns), `update_podcast_characters`,
  `ai_generate_podcast_script`, `import_podcast_script`, `insert_podcast_turn`,
  `update_podcast_turn`
- **Audio:** `create_podcast_take`, `get_podcast_take_job`, `download_podcast_take`

`create_project` / `ai_create_project` accept optional `videoEngine`
(`remotion` | `hyperframes`, default `hyperframes`). Engine is fixed at creation.
Call `list_video_engines` first to see each engine’s template catalog
(Remotion vs `hf-*` HyperFrames templates).

`ai_create_project` also accepts an optional `quickProduce` object. When present,
it creates the editable project, records an immutable production revision, and
returns the durable video job immediately. Omit it for the normal review-first
flow; Quick Produce is never enabled implicitly.

### Voice: oneshot vs per-scene (video)

| Mode                | How to set                                        | Generate audio                                                                   |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `oneshot` (default) | omit or `update_script({ voiceMode: "oneshot" })` | `create_voice_take` → `get_voice_job`                                            |
| `per_scene`         | `update_script({ voiceMode: "per_scene" })`       | `generate_scene_clips` → `get_scene_clips_job` → optional `assemble_scene_clips` |

TTS always uses each scene’s `spokenText ?? text`.

## Resources

- `reel://authoring/rules` — how to write valid, high-retention scenes
- `reel://authoring/podcast` — podcast cast / script / take workflow
- `reel://schema/scene` — field types and enums the API enforces
- `reel://schema/podcast` — podcast cast, turns, length
- `reel://catalog/templates` — Remotion scene templates (use `list_video_engines`
  for HyperFrames `hf-*` templates)
- `reel://catalog/voices` — live voice-provider status

## Typical flows

### Video

1. Optionally `list_video_engines`, then `ai_create_project` / `create_project`.
2. `ai_generate_scenes` with mode `append` (or `add_scene` / `update_scene`).
3. Add narration (oneshot **or** per-scene).
4. `produce_content` → poll `get_production_job` →
   `download_production_artifact`. A legacy or approval-only token pauses video
   jobs until the operator approves them on the Renders page.

For repeat production, `produce_batch` accepts up to ten JSON rows. Video and
audiogram rows default to separately reflowed portrait, square, and landscape
outputs. Poll `get_production_batch`; partial failures keep successful files and
`download_production_batch` returns a tar.gz bundle with a JSON manifest.

A bounded automatic video request looks like this after a project exists:

```json
{
  "kind": "video",
  "scriptId": "<script-id>",
  "orientation": "portrait",
  "quality": "standard",
  "runMode": "automatic",
  "idempotencyKey": "launch-demo-v1-portrait"
}
```

To freeze and produce that prepared script as a Quick Produce revision, add:

```json
{
  "quickProduce": {
    "enabled": true,
    "planner": "deterministic",
    "mediaPreference": "none",
    "voice": {
      "enabled": true,
      "providerId": "kokoro-server",
      "voiceId": "af_heart"
    }
  }
}
```

For an existing script the planner fields are revision metadata; planning has
already happened. Use the same object with `ai_create_project` to select the
deterministic, Ollama, LM Studio, Gemini, or OpenAI planner for the original
brief. Job responses include the submitted revision hash and current-project
hash so an agent can report conflicts without overwriting either version.

Create a named token with `production:create`, `production:read`,
`production:download`, and `production:automatic` only when the caller should
render without browser approval. Set its allowed providers, maximum duration,
batch size, and paid-request budget in **Settings → AI tools / MCP**. Server-side
checks also apply to compatibility routes.

For independent format variants, call `produce_batch`:

```json
{
  "idempotencyKey": "launch-formats-v1",
  "runMode": "automatic",
  "rows": [
    {
      "key": "launch",
      "kind": "video",
      "scriptId": "<script-id>",
      "orientations": ["portrait", "landscape", "square"],
      "quality": "standard",
      "quickProduce": {
        "enabled": true,
        "planner": "deterministic",
        "mediaPreference": "none",
        "voice": { "enabled": false }
      }
    }
  ]
}
```

Each expanded Quick Produce format receives its own immutable revision/job.
Duplicate batch and job idempotency keys return the original work; partial
failure preserves completed siblings and their downloadable artifacts.

### Podcast

1. `create_podcast` → `update_podcast_characters` (set TTS voices).
2. `ai_generate_podcast_script` (or `import_podcast_script` / `insert_podcast_turn`).
3. `create_podcast_take` → poll `get_podcast_take_job` → `download_podcast_take`.

## Examples

### AI project with Detailed voice scripts + Style/Energy

```json
{
  "providerId": "gemini",
  "mode": "idea",
  "brief": "3 habits that compound quietly for creators",
  "sceneCount": 6,
  "scriptStyle": "detailed",
  "styleId": "bold-hook",
  "energy": "normal",
  "videoEngine": "remotion"
}
```

`scriptStyle: "detailed"` produces short on-screen `text` plus longer `spokenText`
for narration. `"short"` keeps a single punchy line (voice inherits `text`).

### No-key Quick Produce from a brief

```json
{
  "mode": "idea",
  "brief": "Explain why immutable release inputs make local rendering safer",
  "productionPresetId": "editorial-explainer",
  "videoEngine": "hyperframes",
  "mediaPreference": "none",
  "idempotencyKey": "immutable-inputs-v1",
  "quickProduce": {
    "enabled": true,
    "planner": "deterministic",
    "mediaPreference": "none",
    "voice": {
      "enabled": true,
      "providerId": "kokoro-server",
      "voiceId": "af_heart"
    }
  }
}
```

This path requires no cloud key. Server-side Kokoro may fetch its Apache-2.0
model weights on first use. Set `voice.enabled` to `false` for a silent local
run, or choose a server-capable provider allowed by the named token.

### Override a scene’s voice script

```json
{
  "sceneId": "<id>",
  "text": "Stop scrolling past this tip.",
  "spokenText": "Stop scrolling past this tip. Most people ignore the one habit that actually compounds — here is the simple version."
}
```

Pass `"spokenText": null` to clear the override so TTS uses `text` again.

### Switch to per-scene voice clips

```json
{ "scriptId": "<id>", "voiceMode": "per_scene" }
```

Then generate all clips (server providers: `cartesia` | `elevenlabs` | `voiceforge`):

```json
{
  "scriptId": "<id>",
  "providerId": "elevenlabs",
  "voiceId": "<voice>",
  "placeholder": false
}
```

Poll `get_scene_clips_job` with the returned `jobId` until `status` is `done`.
To re-stitch after changing `selectedVoiceClipId` on a scene, call
`assemble_scene_clips`.

### Set Style / Energy on an existing script

```json
{
  "scriptId": "<id>",
  "styleId": "clean-story",
  "energy": "calm"
}
```

### Create a podcast and generate audio

```json
{ "title": "Why Rest Is Productive", "length": "short" }
```

Then patch voices (`update_podcast_characters` with ids from `get_podcast`), generate:

```json
{
  "podcastId": "<id>",
  "providerId": "gemini",
  "brief": "Two hosts discuss why deliberate rest improves deep work",
  "length": "short"
}
```

Then `create_podcast_take` with `{ "podcastId": "<id>" }` and poll
`get_podcast_take_job`.

## Licensing

The MCP server code in this folder is part of Reel Studio and is MIT-licensed
with the rest of the app. Rendering goes through **Remotion** or **HyperFrames**
depending on the project’s `videoEngine`. See [`docs/LICENSING.md`](../docs/LICENSING.md).
