# Command line

`bin/reel-studio.mjs` turns a Storyboard v1 file into an MP4 without opening the app. It is
for scripts, CI and agents that do not speak MCP, and it makes bug reports reproducible:
attach the JSON. From a clone, run it as `node bin/reel-studio.mjs …` (the package `bin`
name is `reel-studio`; publishing it is tracked in the npm package issue).

```bash
node bin/reel-studio.mjs examples                 # copy the golden storyboards here
node bin/reel-studio.mjs lint explainer.json      # check one (no engine needed)
node bin/reel-studio.mjs schema > storyboard.schema.json
node bin/reel-studio.mjs render explainer.json -o out/explainer.mp4 --quality draft
cat story.json | node bin/reel-studio.mjs render - --format 9:16 --no-voice --json
```

`render` options: `-o` output path (default: a file named after the title), `--format
9:16|16:9|1:1`, `--theme <id>`, `--quality draft|standard|high`, `--no-voice` (silent with
captions), `--json` (one JSON object per progress line on stdout). It lints first, then
sends the storyboard to the studio engine and downloads the finished file. The engine is
`REEL_STUDIO_URL` (default `http://127.0.0.1:3000`); start it with `npm run dev`.
`REEL_STUDIO_MCP_TOKEN` is sent as a bearer token when set.

| Exit code | Meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| 0         | Done; the output path is printed                                  |
| 1         | Usage error (unknown command or option, missing file)             |
| 2         | Invalid storyboard: path, message, expected and example per error |
| 3         | The engine is not running or a dependency is missing              |
| 4         | The render failed                                                 |

`doctor` reports Node, FFmpeg, FFprobe, a browser, disk space, the voice model and optional
Whisper. `doctor --fix` offers to download what is missing into the data directory, one question
per download (`--yes` or `REEL_STUDIO_AUTO_INSTALL=1` answers for you): a pinned,
checksum-verified FFmpeg (a tampered file is deleted and rejected), Chrome through Puppeteer's
installer, and the voice model. A system FFmpeg is always preferred when present. Exit code 1
when something required is missing.

`npm run cli:verify` runs a shell test of every exit code. Not built yet: starting the engine
for you when it is not running (the self-starting MCP server issue) and the published
`npx` entry.
