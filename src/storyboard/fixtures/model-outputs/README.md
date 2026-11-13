# Recorded model outputs

Twenty raw replies used as linter fixtures (see `../../lint.test.ts`).

- `*-schema-*.json`: the model was given only `schemas/storyboard.v1.json`.
- `*-chat-*.txt`: the model was asked in plain words, without the schema, as when
  a person pastes a request into a chat app. Replies keep their code fences and
  prose.
- Models: Claude Sonnet 5.5 and Claude Haiku 5.5, recorded 2026-11-13. All twenty
  are from one vendor; replace or extend with other providers as keys allow.

The files are untouched model output. Do not reformat them.
