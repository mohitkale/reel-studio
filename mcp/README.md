# Reel Studio MCP server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that lets
external AI tools (Claude Code, Cursor, etc.) build and edit **video storyboards**
and **audio-only podcasts** in a running Reel Studio app.

It talks to the app **only over its REST API** with a bearer token — it never
touches the database directly. By design it can do everything an editor can
**except**:

- ❌ delete anything (projects, scenes, takes, renders, podcasts, dialogue turns)
- ❌ change configuration or secrets (API keys, defaults — website only)
- ⏸️ start a **video** render — `request_render` only _queues_ a render that a human must
  **approve in the web app** (Renders → "Approve & Render")
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

- **Read:** `list_projects`, `list_video_engines`, `get_script`, `list_takes`,
  `list_scene_clips`, `get_captions`, `list_renders`, `get_render`,
  `list_voice_providers`, `list_voices`, `list_voice_models`, `list_ai_providers`
- **Create / edit:** `create_project`, `ai_create_project`, `assign_brand_kit`,
  `update_script`, `set_music`, `add_scene`, `update_scene`, `reorder_scenes`,
  `ai_generate_scenes`, `create_voice_take`, `get_voice_job`,
  `generate_scene_clips`, `get_scene_clips_job`, `assemble_scene_clips`,
  `rename_take`, `rename_render`
- **Render (human-gated):** `request_render`, `download_render`

### Audio podcasts

- **Read:** `list_podcasts`, `get_podcast`, `list_podcast_takes`
- **Create / edit:** `create_podcast`, `update_podcast`,
  `replace_podcast_characters` (clears turns), `update_podcast_characters`,
  `ai_generate_podcast_script`, `import_podcast_script`, `insert_podcast_turn`,
  `update_podcast_turn`
- **Audio:** `create_podcast_take`, `get_podcast_take_job`, `download_podcast_take`

`create_project` / `ai_create_project` accept optional `videoEngine`
(`remotion` | `hyperframes`, default `remotion`). Engine is fixed at creation.
Call `list_video_engines` first to see each engine’s template catalog
(Remotion vs `hf-*` HyperFrames templates).

### Voice: oneshot vs per-scene (video)

| Mode | How to set | Generate audio |
| --- | --- | --- |
| `oneshot` (default) | omit or `update_script({ voiceMode: "oneshot" })` | `create_voice_take` → `get_voice_job` |
| `per_scene` | `update_script({ voiceMode: "per_scene" })` | `generate_scene_clips` → `get_scene_clips_job` → optional `assemble_scene_clips` |

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
4. `request_render` → ask the user to approve in the web app → poll `get_render`
   → `download_render`.

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
