# Storyboard

This page is a placeholder until the single-document storyboard format ships
(roadmap issue [#92](https://github.com/mohitkale/reel-studio/issues/92)). It
will describe one JSON document that holds a whole video and turns into an MP4 in
one call.

What exists today:

- **Scene JSON.** The scene editor has a **JSON** mode, and MCP clients read the
  schema from the `reel://schema/scene` and `reel://authoring/rules` resources.
- **Film plan checkpoints.** `get_film_plan` and `save_film_plan` (REST:
  `/api/scripts/[id]/film-plan`) read and write a versioned JSON checkpoint of the
  direction plan for a project.
- **Podcast schema.** `reel://schema/podcast` describes dialogue documents.

The rule that applies to every format: an LLM writes the storyboard text, and
everything after it is local and deterministic. See [MCP](MCP.md) and
[Scenes and themes](SCENES_AND_THEMES.md).
