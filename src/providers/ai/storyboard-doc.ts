import { STORYBOARD_WRITER_PROMPT } from "./storyboard-prompt";
import { storyboardWriterSchema } from "./storyboard-schema";

/** docs/prompts/storyboard-writer.md, generated so it can never drift from the code. */
export function storyboardWriterPromptDocument(): string {
  return `# Storyboard writer prompt

The one prompt Reel Studio gives every model to write a storyboard. Paste it into
any chat app (ChatGPT, Claude, Gemini, a local model), then send your brief. The
reply is a Storyboard v1 JSON document: post it to \`POST /api/storyboards\` or
\`POST /api/storyboards/lint\`. Fields and limits: [Storyboard](../STORYBOARD.md).

This file is generated from \`src/providers/ai/storyboard-prompt.ts\` by
\`npm run storyboard:schema\`; do not edit it by hand.

## 1. Prompt

\`\`\`text
${STORYBOARD_WRITER_PROMPT}
\`\`\`

## 2. Your brief

Send this after the prompt, with your own values. Only \`topic\` is required.

\`\`\`json
{
  "task": "Write the storyboard for this brief.",
  "brief": {
    "topic": "Why sleep is a skill",
    "audience": "busy adults",
    "targetSeconds": 60,
    "format": "9:16",
    "tone": "clear and friendly",
    "researchNotes": [
      { "title": "Page title", "url": "https://example.com/page", "accessed": "2026-11-13", "notes": "Facts you want used." }
    ]
  }
}
\`\`\`

## 3. JSON Schema

Apps that support structured output can take this schema directly; otherwise paste
it after the prompt. It lists every field with its limit and an example. The full
schema with all limits is [schemas/storyboard.v1.json](../../schemas/storyboard.v1.json).

\`\`\`json
${JSON.stringify(storyboardWriterSchema())}
\`\`\`
`;
}
