# Reel Studio MCP server

A stdio [Model Context Protocol](https://modelcontextprotocol.io) server that lets
external AI tools (Claude Code, Cursor, etc.) build and edit storyboards in a
running Reel Studio app.

It talks to the app **only over its REST API** with a bearer token — it never
touches the database directly. By design it can do everything an editor can
**except**:

- ❌ delete anything (projects, scenes, takes, renders)
- ❌ change configuration or secrets (API keys, defaults — website only)
- ⏸️ start a render — `request_render` only _queues_ a render that a human must
  **approve in the web app** (Renders → "Approve & Render")

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

- **Read:** `list_projects`, `get_script`, `list_takes`, `get_captions`,
  `list_renders`, `get_render`, `list_voice_providers`, `list_voices`,
  `list_voice_models`, `list_ai_providers`
- **Create / edit:** `create_project`, `ai_create_project`, `assign_brand_kit`,
  `update_script`, `set_music`, `add_scene`, `update_scene`, `reorder_scenes`,
  `ai_generate_scenes`, `create_voice_take`, `rename_take`, `rename_render`
- **Render (human-gated):** `request_render`, `download_render`

## Resources

- `reel://authoring/rules` — how to write valid, high-retention scenes
- `reel://schema/scene` — field types and enums the API enforces
- `reel://catalog/templates` — the seven scene templates
- `reel://catalog/voices` — live voice-provider status

## Typical flow

1. `ai_create_project` (or `create_project`) for the first chunk.
2. `ai_generate_scenes` with mode `append` (or `add_scene` / `update_scene`) to
   extend the storyboard in parts — using your own web search to add current facts.
3. `create_voice_take` to add narration.
4. `request_render` → ask the user to approve in the web app → poll `get_render`
   → `download_render`.

## Licensing

The MCP server code in this folder is part of Reel Studio and is MIT-licensed
with the rest of the app. Rendering still goes through Remotion (Remotion
License). See [`docs/LICENSING.md`](../docs/LICENSING.md).
