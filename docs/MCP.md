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
  (same as the web Generate button; cloud providers may use TTS credits)

## Setup

Add the server to your AI tool and ask for a video. Nothing else is needed: the first time
it runs, `reel-studio mcp` finds a studio engine on this computer or starts one in the
background, and authenticates with a per-install secret kept in `.data/local-secret`
(mode 0600; `REEL_STUDIO_HOME` moves the data directory). Two clients at once share one
engine, and the studio UI opened later shows the same projects. Because you launched the
client on this computer, rendering is allowed by default; paid providers stay off unless
you enable them in Settings.

From a clone, the config is (also `.mcp.json.example`, with the path to your clone):

```json
{
  "mcpServers": {
    "reel-studio": {
      "command": "node",
      "args": ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"]
    }
  }
}
```

Logs go to stderr and to `.data/mcp.log` (the engine's own output is in `.data/engine.log`);
stdout carries only protocol messages. The server reports the version from `package.json`.

For a remote or shared studio, use a token instead: in the app open **Settings → AI tools /
MCP**, **Generate token**, and run the server with `REEL_STUDIO_URL` and
`REEL_STUDIO_MCP_TOKEN` set (`npm run mcp` still works). Renders from a token wait for
approval unless the token is scoped for automatic production. Not built yet: stopping an
engine that the MCP server started after an idle timeout, and the published `npx` command.

## Add it to your client

Every client below runs the same command, `node /path/to/reel-studio/bin/reel-studio.mjs mcp`
(replace the path with your clone; once the package is published this becomes
`npx -y reel-studio mcp`). The config shapes come from each client's own documentation; **none
of them has been run against a real install of that client yet**, so the status column says
what was actually checked. The server itself was checked with the MCP SDK's stdio client on
macOS on 17 Nov 2026.

| Client         | Where the config goes                          | Status                    |
| -------------- | ---------------------------------------------- | ------------------------- |
| Claude Code    | `claude mcp add` (below)                       | not run in the client yet |
| Claude Desktop | `claude_desktop_config.json`                   | not run in the client yet |
| Cursor         | `~/.cursor/mcp.json` or `.cursor/mcp.json`     | not run in the client yet |
| Codex CLI      | `~/.codex/config.toml`                         | not run in the client yet |
| VS Code        | `.vscode/mcp.json`                             | not run in the client yet |
| Windsurf       | `~/.codeium/windsurf/mcp_config.json`          | not run in the client yet |
| Gemini CLI     | `~/.gemini/settings.json`                      | not run in the client yet |
| T3 Code        | its MCP settings (standard stdio server entry) | not run in the client yet |

**Claude Code**

```bash
claude mcp add reel-studio -- node /path/to/reel-studio/bin/reel-studio.mjs mcp
```

**Claude Desktop, Cursor, Windsurf, Gemini CLI** (an `mcpServers` object):

```json
{
  "mcpServers": {
    "reel-studio": {
      "command": "node",
      "args": ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"]
    }
  }
}
```

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.reel-studio]
command = "node"
args = ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"]
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "reel-studio": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/reel-studio/bin/reel-studio.mjs", "mcp"]
    }
  }
}
```

Then try the prompt `make-short` (in Claude Code: `/mcp__reel-studio__make-short`) or just ask
for a video. Set the client's tool timeout to at least 10 minutes. Listing in the official MCP
registry and the community directories waits for the published package.

## Core tools

Seven high-level tools cover the common path, so an agent does not have to learn the
94-tool surface (about 35,300 tokens of definitions; the seven core tools are about 1,100).

| Tool           | Use                                                                                     |
| -------------- | --------------------------------------------------------------------------------------- |
| `create_video` | Storyboard v1 JSON in; waits (default) and returns the finished video link, or a job id |
| `get_job`      | State, progress percent, stage and the video link of a job                              |
| `list_options` | Themes, scene types, formats, qualities, recommended voices and music ids               |
| `review_video` | Findings as suggested storyboard edits, pacing per scene, the latest contact sheet      |
| `revise_video` | Apply scene edits (update, replace, insert, remove, move) and make the video again      |
| `list_videos`  | Recent projects                                                                         |
| `open_studio`  | The local studio address, or one video's editor address                                 |

`create_video` and `get_job` return, once the video is done: the video link, the local file
path (when the engine is on this computer), duration, resolution, size, the studio page, and an
**image block with the contact sheet** (one labelled frame per scene, under 1 MB) so an agent that
can see images can look at its work. While `create_video` waits it sends MCP progress
notifications (stage and percent) if the client supplied a progress token. If your client times
out first, the job keeps running: call `get_job`; a render can take several minutes, so set the
client's tool timeout to at least 10 minutes. A failed job returns the failing stage, the cause and
a specific fix (for example: the voice model is missing, run `npm run voice:download`).

These seven are the default. Set `REEL_STUDIO_MCP_TOOLS=all` in the server's environment to
expose every other tool as well (research, editorial, podcasts, factory, voice takes and the rest;
nothing is removed). Still to come in this set: `create_podcast` (podcast storyboards are not produced by
`create_video` yet) and re-rendering only the scenes a revision changed.

## Storyboard resources and prompts

Resources `reel://storyboard/schema`, `reel://storyboard/guide` (the writer guide),
`reel://storyboard/examples` (an explainer, a list and a myth check) and `reel://options`
(themes, scene types, voices, music) give the agent what the built-in writer gets. Prompts
`make-short`, `make-explainer`, `make-podcast`, `repurpose` and `series` appear as slash
commands in clients that support MCP prompts (in Claude Code: `/mcp__reel-studio__make-short`).
Each asks the agent to research time-sensitive topics itself and put the sources in
`storyboard.sources`. The server `instructions` give the four-sentence workflow. The older
`reel://authoring/*` resources stay.

## Tools

### Video storyboards

- **Read:** `list_projects`, `list_video_engines`, `list_production_presets`, `get_script`, `list_takes`,
  `list_scene_clips`, `get_captions`, `list_renders`, `get_render`,
  `list_voice_providers`, `list_voices`, `list_voice_models`, `list_ai_providers`
  (Gemini, OpenAI, Ollama, LM Studio, and llama.cpp when configured)
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
- **Research:** `get_research_capabilities`, `start_research_job`,
  `get_research_job`, `cancel_research_job`, `get_research_evidence`,
  `import_research_evidence`, `plan_from_research_evidence`.
  Use explicit supplied/web mode and separate provider/search budgets. Reconnect
  with the same key; only explicit refresh can incur another research charge.
  Pass `evidenceId` to `ai_create_project` to reuse a revision. Imported packs
  validate all references and remain external/unverified. See the
  [research guide](archive/guides/RESEARCH.md) for scopes and provenance.

### Audio podcasts

- **Read:** `list_podcasts`, `get_podcast`, `list_podcast_takes`
- **Create / edit:** `create_podcast`, `update_podcast`,
  `replace_podcast_characters` (clears turns), `update_podcast_characters`,
  `ai_generate_podcast_script`, `import_podcast_script`, `insert_podcast_turn`,
  `update_podcast_turn`
- **Audio:** `create_podcast_take`, `get_podcast_take_job`, `download_podcast_take`

`create_project` / `ai_create_project` accept optional `videoEngine`
(`hyperframes`, the sole supported engine). Call `list_video_engines` to see
the `hf-*` template catalog.

`ai_create_project` also accepts an optional `quickProduce` object. When present,
it creates the editable project, records a saved production revision, and
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
- `reel://catalog/templates` — HyperFrames scene templates
- `reel://catalog/voices` — live voice-provider status

## Typical flows

### Video

1. Optionally `list_video_engines`, then `ai_create_project` / `create_project`.
2. `ai_generate_scenes` with mode `append` (or `add_scene` / `update_scene`).
   With a valid saved outline, pass `chapterTitle` to append a named chapter;
   omit it to extend the last chapter. Each generation supports 1–20 scenes
   (Auto asks for 3–5), with at most 12 chapters / 240 total scenes / 20 scenes
   per chapter. Earlier work stays intact. If the storyboard changes during
   generation, the entire append is rejected; reload before requesting a retry.
   `plan_topic_chapters` saves topic writing briefs in one bounded request.
   Inspect `get_script` → `script.chapterDraft`, then edit it with
   `save_topic_chapter_draft` using the complete expected and new drafts.
   Planning preserves scenes. `generate_topic_chapter` writes the next pending
   chapter in order with the saved expected draft and `maxProviderCalls:1`.
   Scenes, boundary and progress save together; failed work stays pending for an
   explicitly requested retry. Completed chapters cannot append twice; use the
   chapter-scoped rewrite. Provider/token quotas stay unchanged. No automatic
   multi-call execution, retry or production launch is enabled.
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
deterministic, Ollama, LM Studio, llama.cpp, Gemini, or OpenAI planner for the original
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

Each expanded Quick Produce format receives its own saved revision and job.
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
  "videoEngine": "hyperframes"
}
```

`scriptStyle: "detailed"` produces short on-screen `text` plus longer `spokenText`
for narration. `"short"` keeps a single punchy line (voice inherits `text`).

### No-key Quick Produce from a brief

```json
{
  "mode": "idea",
  "brief": "Explain why fixed release inputs make local rendering safer",
  "productionPresetId": "editorial-explainer",
  "videoEngine": "hyperframes",
  "mediaPreference": "none",
  "idempotencyKey": "fixed-inputs-v1",
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
with the rest of the app. Rendering uses **HyperFrames**; GSAP and media retain their own terms. See [`docs/LICENSING.md`](LICENSING.md).

`replan_motion_direction` accepts `chapterMotifs:true` to apply alternating
Sweep/Rise type choreography from a valid saved outline and seed. Turning it off
replans unlocked scenes to standard choreography. Locks, copy, narration, media
and audio anchors remain intact; no provider request is made. Appended chapters
inherit the saved setting, and saved production revisions freeze each choice.

### Film plan checkpoints

`get_film_plan` reads the current versioned compatibility/adaptive plan (optional `voiceTakeId`) or a saved `revisionId`. Pass the returned document to `save_film_plan` with the same `scriptId` to checkpoint it. Changed source content returns a conflict; this does not overwrite scenes or generate media. See [adaptive contracts](archive/guides/ADAPTIVE_CONTRACTS.md).

`replan_motion_direction` accepts optional `adaptiveRecipes` to enable or disable
the six bundled content-aware recipes. Existing locks and semantic illustrations
remain authoritative. See [adaptive recipes](archive/guides/ADAPTIVE_RECIPES.md).

`replan_motion_direction` also accepts `sequenceDirection` and a validated
`subjectRegistry` replacement. Identity aliases are explicit; locks, source copy
and narration remain protected. See [sequence direction](archive/guides/SEQUENCE_DIRECTION.md).

## Content factory

Use `list_factory` to choose a saved master revision and optional versioned
series profile. `save_series_profile` publishes versioned brand/design and
delivery defaults. `create_factory_run` accepts up to six aspect or explicit
whole-scene cutdown variants and requires an idempotency key. Inspect lineage
with `get_factory_run` / `get_factory_revision`, and cancel or resume through
`control_factory_run`. Saved review policy and scoped automatic-render rules
remain active; approval stays in the studio. Download output bundles with the
existing batch tools. See [factory contracts and limits](archive/guides/FACTORY_WORKFLOWS.md).

Editorial creation and revision tools share the REST stage contracts. See the
[editorial guide](archive/guides/EDITORIAL.md) for creative briefs, call budgets, cached
storyboards, scope locks and guarded apply/undo. Start with
`create_editorial_project`, inspect `get_editorial_script`, then preview the
storyboard or a scoped revision before applying its current source hash.
