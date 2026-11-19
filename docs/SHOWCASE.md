# The niche showcase

Thirty videos across ten kinds of channel, so that someone looking at Reel Studio can think _I
could post that_. They are in [`examples/niches`](../examples/niches), three for each of: tech
explained, coding tips, finance explained, fitness, history facts, productivity, product
launches, language learning, science and book summaries. [`examples/niches.json`](../examples/niches.json)
lists each with the brief it was written from. On the website they are the
[showcase wall](https://mohitkale.github.io/reel-studio/showcase.html), with the video, the
storyboard and the command beside each.

## How they were made

An AI model wrote each storyboard from its brief; the voice, scenes, captions, music and video were
made by Reel Studio on a computer and are the same every time. To make one yourself:

```bash
npm run dev                                   # the studio, in one terminal
node bin/reel-studio.mjs render examples/niches/science-why-do-we-have-seasons.json \
  -o seasons.mp4 --quality standard           # in another
```

or ask an agent with the MCP server to call `create_video` with that file.

## What was checked

| Check                         | Command                                                 | What it holds                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The storyboards               | `npm run niches:check`                                  | Thirty, three per niche; each lints with no repair and no warning, runs 20 to 90 seconds, and cites sources when it states facts; sample products say they are fictional; formats, themes, voices and presenters are mixed. |
| The frames                    | `node --import tsx scripts/frame-lint.mjs --set niches` | One frame per scene: fill, smallest text, contrast, safe area, headline against caption. All 30 pass.                                                                                                                       |
| Variety across the set        | `npm run niches:variety`                                | A layout fingerprint of each video's first four scenes; no two share a template. Ten of ten themes, three of three formats, 17 of 21 scene types.                                                                           |
| The renders                   | `npm run showcase -- --set niches`                      | Renders each at standard quality with voice, captions, music and its theme, measures loudness, and writes `media/showcase-niches/index.html` with the frame-check result and a score box per video.                         |
| Media for the site and README | `npm run demo:assets`                                   | An MP4 and a poster per video, and a 45-second montage of nine of them.                                                                                                                                                     |

### Facts

Every factual claim was checked against the source it cites, in a real browser, on 19 November
2026 (that date is each source's `accessed`). Checking changed several videos: a statistic that the
cited page did not state was removed or replaced, an unverifiable mnemonic was dropped, and one
source was swapped for a page that actually says what the video says. The product videos are
fictional and say so. Finance and fitness videos are general information, not advice.

### What a person still has to do

The 20-point rubric in [QUALITY.md](QUALITY.md) is a human review, and nobody has scored these
videos yet; the machine checks above are necessary, not sufficient. Nobody has listened to all
thirty voices through.

## Add yours

Made something with Reel Studio you are proud of? Share it in
[Show and tell](https://github.com/mohitkale/reel-studio/discussions/categories/show-and-tell), or
open an issue with the `showcase` label and the storyboard JSON. A submission that renders cleanly,
passes `npm run examples:lint-frames` and cites its sources can be added to the wall.
