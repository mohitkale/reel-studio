# Launch plan

How Reel Studio is announced, to whom, in what words, and what has to be true first.
Agents draft the text; **the maintainer posts it from their own accounts**. There is no
calendar date: launch waits for readiness (decided 13 Nov 2026). No paid promotion.

Status as of 19 Nov 2026. The checklists below are the working copy: tick a line with a link
to the post when it goes out.

## 1. Gates

| Launch                                                                                                                     | Starts when                | Where it stands                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Soft launch**: MCP directories, Show and tell post, one short thread with an agent-made video                            | v0.12 closes               | **Not yet.** Issues M1 to M9 (#110 to #118) are all still open: M1 (publish the npm package) needs the maintainer, and M9 (install guides verified in real clients, #118, #208 to #211) needs the real clients.                                                                  |
| **Main launch**: Show HN (Tue to Thu morning US Eastern), Reddit, X and LinkedIn the same day, Product Hunt the week after | Every v1.0 issue is closed | **Not yet.** Open: L1 (two-person test, clean-machine run), L3 (real-phone check), L4 (fresh-developer test), L5 (this plan), L6 release readiness (#139), L7 proof of the moat (#151, needs a real Ollama run), L8 showcase (#152), F7b social preview and funding file (#161). |

What is ready today: the [website](https://mohitkale.github.io/reel-studio/) (live; Lighthouse mobile 97 to 100),
the [README](../README.md) with a hero, gallery and recordings, the demo assets
(`npm run demo:assets`), the contributor on-ramp (`npm run scene:new`, 13 `good first issue`
tickets), the launch video and clips (section 4), and every draft below.

## 2. Positioning

**One sentence.** Reel Studio turns an idea into a finished short video or podcast on your own
computer: a small JSON storyboard goes in, and the voice, scenes, captions, music and MP4 come
out, free and the same way every time.

**The one thing to remember.** The only AI step is writing the storyboard. Everything after it is
ordinary software that runs locally.

### Three audiences

| Audience                           | What they want                                             | Message                                                                                                                              | Proof to show                                                       |
| ---------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Faceless-channel creators**      | Many short videos, cheaply, in a consistent style          | "Type an idea, get a finished video. No account, no per-video credits, and your series keeps one look."                              | The gallery, the batch and series features, the prompt-to-video GIF |
| **Developers using coding agents** | An agent that can make a video as easily as it writes code | "Add one MCP server and your agent writes the storyboard; the studio renders it. Same JSON in, same video out, so it can be tested." | The terminal recording, the storyboard schema, `reel-studio render` |
| **Local-AI enthusiasts**           | Useful things that run offline, with models they choose    | "Voice (Kokoro), scenes and rendering run on your machine; a local model (Ollama, LM Studio, llama.cpp) can write the storyboard."   | The local-first table, the licensing inventory, no-key quick start  |

## 3. What we can say, and what we cannot yet

Say only what has been checked. This table is the guard rail for every draft below.

| Say                                                               | Evidence                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Free; the app's code is MIT; no account or API key to start       | [LICENSE](../LICENSE), [getting started](GETTING_STARTED.md)             |
| Voice, scenes, captions, music and rendering run on your computer | [Architecture](ARCHITECTURE.md), the local-first table in the README     |
| An agent can make a video through MCP                             | The terminal recording is the real server making a video (`demo:assets`) |
| Twelve example storyboards, each with its video                   | [Gallery](https://mohitkale.github.io/reel-studio/gallery.html)          |
| Two-host podcasts, mastered to about -16 LUFS                     | The gallery episode measured -16.6 LUFS                                  |
| It makes motion-graphics videos, not avatars or generated footage | Said in the README and the website                                       |

| Do not say yet                                               | Why                                                                                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "`npx reel-studio`" as a way to install                      | Not published (M1). Say "clone and run".                                                                                                                     |
| "Works with Cursor, Codex, VS Code, Windsurf, Gemini CLI"    | The config shapes come from each client's docs; none was run in the real client yet (#208 to #211). Say "any MCP client; tested with the MCP SDK".           |
| "Open source" with no qualifier                              | The app is MIT; the runtime includes GSAP (a no-charge but non-OSI licence) and a GPL phonemizer. Say "MIT-licensed app" and link [licensing](LICENSING.md). |
| A number for how often local models write a valid storyboard | The 10-of-12 target is unmeasured; no real Ollama run yet (#191).                                                                                            |
| Non-English narration quality                                | The vendored eSpeak has the English dictionary only.                                                                                                         |
| The animated presenter, beat-aligned cuts, stings            | Nobody has watched or listened to them yet.                                                                                                                  |
| Local image generation                                       | No real ComfyUI run yet.                                                                                                                                     |
| "Works on Windows"                                           | Windows is tested in CI only.                                                                                                                                |

## 4. Assets

Made by `npm run launch:assets` (a running studio is needed) into `dist/launch/`:

| File                           | What                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launch-video.mp4`             | 87 s, 1080p landscape, with voice, captions and music, made by Reel Studio from [`launch/launch-video.storyboard.json`](launch/launch-video.storyboard.json). -14.2 LUFS. |
| `clip-1-how-it-works.mp4`      | Idea to video, in 23 s (the hook, "on your computer", the three steps).                                                                                                   |
| `clip-2-agent-and-compare.mp4` | 26 s: a scene of the JSON storyboard, the agent adding the server, and cloud tools next to Reel Studio.                                                                   |
| `clip-3-what-you-get.mp4`      | What you get, what it is not, and the call to action.                                                                                                                     |

A 31-second vertical teaser, also made by Reel Studio from
[`launch/teaser.storyboard.json`](launch/teaser.storyboard.json) (render it on a running studio like any
storyboard), for a "sneak peek" post the day before the showcase goes up.

Also ready: the hero and gallery GIFs, the MCP terminal recording, the prompt-to-video recording
and the screenshots, all from `npm run demo:assets` (hosted as assets of the `demo-assets`
release), and the Open Graph card (`site/assets/og.png`).

Still to make: a social preview image for the repository (F7b, #161), and a human pass over the
video's voice. Nobody has listened to it all the way through.

### Expected questions

**Why not avatars?** Because a talking face of a person who does not exist, or of someone who
does, raises questions of consent and trust, and it is a different product. Reel Studio draws
text, charts, lists, quotes and code with a voice, captions and music. You can bring your own
clips.

**How does it compare with cloud tools?** They do things Reel Studio does not: avatars,
generated footage, hosted templates and sharing. Reel Studio is free, runs offline, keeps your
content on your machine, and gives the same video from the same storyboard, which makes a video
testable and versionable. If you want a presenter, use a tool made for it.

**Is it really free?** The app is. Optional cloud providers (a cloud writer, ElevenLabs,
stock footage) are paid by you, directly, and only if you turn them on.

**Which licences?** The app is MIT. HyperFrames is Apache-2.0; Kokoro is Apache-2.0; GSAP has its
own no-charge licence; the speech phonemizer is GPL-3.0-or-later with its source shipped with
each release; bundled music is CC0. The full inventory is [LICENSING.md](LICENSING.md).

**Do I need an AI model?** No. A storyboard is a small JSON file you can write or paste. A model
(local or cloud) or your coding agent can write it for you; that is optional.

**Does it work offline?** Yes, with the bundled voice model and music. The first run downloads
the voice model once.

**What hardware?** Nothing special: voice and rendering run on the CPU. A draft of a three-scene
video took about 40 seconds on the maintainer's Mac; an 87-second standard-quality video took
about seven minutes (one run, 414 s).

**Is my data sent anywhere?** Not by Reel Studio. This site has no analytics. A provider you
enable sees what you send it.

## 5. Channels

Post from the maintainer's accounts. Read each community's rules first; many limit
self-promotion, and some want you to have taken part before posting. One new channel a day, and be
around for the first three hours to answer. Do not ask for upvotes, stars or shares.

### Show HN

- [ ] Posted: _link_

Title (limit 80): `Show HN: Reel Studio – type an idea, get a video, locally (MIT)`

URL: https://mohitkale.github.io/reel-studio/ (or the repository; pick the one with the video).

First comment:

> I built Reel Studio because I wanted short videos from an idea without a cloud service in the
> middle. You give it a small JSON file (the "storyboard"): scenes, what is shown, what is said.
> The voice (Kokoro), the scenes, the captions, the music and the MP4 are made on your computer,
> so the same storyboard gives the same video. The only AI step is writing that JSON, and you can
> write it yourself, use a local model, or let a coding agent do it through an MCP server.
>
> It makes motion-graphics videos (text, charts, lists, code, quotes) and two-host podcasts. It
> does not make avatars or generated footage, on purpose.
>
> What it is not good at yet: it has only been tested on macOS locally (Windows and Linux in CI),
> non-English narration is weak, and I have not yet measured how often local models write a valid
> storyboard on the first try. The app is MIT; the runtime has a few third-party licences,
> listed in the repo.
>
> There are twelve example storyboards with their videos in the gallery. I would most like to
> hear which scene types you would want that are missing. Adding one is a folder and about 15
> minutes: `npm run scene:new`.

### Reddit

Check each subreddit's rules and its self-promotion limits. Adapt, do not paste the same text.

- [ ] r/SideProject: _link_
- [ ] r/selfhosted: _link_ (frame it as a local app; mention Docker only if it has been tested)
- [ ] r/LocalLLaMA: _link_ (lead with the local writer and offline voice; do not claim benchmark numbers)
- [ ] r/opensource: _link_
- [ ] An MCP or coding-agent community: _link_ (lead with the agent making a video)

Title: `I made a local, free tool that turns a small JSON file into a finished video (voice, captions, music)`

Body:

> Reel Studio runs on your computer. You write (or have an agent write) a short storyboard in
> JSON, and it makes the voiceover, draws the scenes, adds captions and music, and exports an
> MP4. No account, no per-video fee, and the same storyboard gives the same video.
>
> There is a gallery of twelve examples with their JSON next to each: <site gallery link>.
> It makes motion-graphics videos and podcasts, not avatars.
>
> MIT-licensed app, a few third-party licences in the runtime (listed in the repo). I would love
> feedback on what is confusing in the first five minutes.

### Product Hunt (the week after the main launch)

- [ ] Posted: _link_

Name: Reel Studio. Tagline (limit 60): `Type an idea, get a finished video. Free, on your computer.`

Description (limit 260): `A local-first video and podcast factory. A small JSON storyboard goes in; the voice, scenes, captions, music and MP4 come out on your own machine. Free, no account, works from your coding agent through MCP. Motion graphics, not avatars.`

Topics: Open Source, Video, Artificial Intelligence, Developer Tools.

First comment:

> Hi, I am the maker. Reel Studio started from wanting to make short videos without paying per
> video or uploading my content. The idea is simple: the only AI step is writing a small
> storyboard. Everything after it runs locally and gives the same result every time.
>
> It is for motion-graphics videos and podcasts. It does not make avatars. If you try it, the
> thing I would most like to know is where the first five minutes lost you.

### X thread

- [ ] Posted: _link_ (attach `clip-1-how-it-works.mp4` to the first post)

1. Type an idea, get a finished video. Free, on your own computer. That is Reel Studio, and it is open source (MIT app). 🧵
2. The only AI step is writing a small JSON "storyboard". Voice, scenes, captions, music and the MP4 are made locally, so the same storyboard gives the same video.
3. Write the storyboard yourself, use a local model, or let your coding agent do it: one MCP server, and the agent can make a video from a prompt. (clip 2)
4. Twelve example storyboards, each with its video and its JSON beside it: https://mohitkale.github.io/reel-studio/gallery.html
5. It makes motion graphics (text, charts, lists, code) and two-host podcasts. It does not make avatars or generated footage, on purpose.
6. A new scene type is a folder and about 15 minutes: `npm run scene:new`. There are good first issues open.
7. Code and docs: https://github.com/mohitkale/reel-studio. If you try it, tell me where the first five minutes lost you.

### LinkedIn

- [ ] Posted: _link_ (attach `launch-video.mp4`)

> I built a tool that turns an idea into a finished short video or podcast, entirely on your own
> computer.
>
> You give it a small JSON file, a storyboard: which scenes, what is shown, what is said. The voice,
> the scenes, the captions, the music and the MP4 are made locally, so there is no cloud render, no
> account and no per-video fee, and the same storyboard gives the same video. The only AI step is
> writing the storyboard, and that can be you, a local model, or your coding agent through an MCP
> server.
>
> It makes motion-graphics videos and podcasts. It does not make avatars, and I want to be clear
> about that.
>
> It is free and the app is MIT-licensed. There are twelve examples with their videos here:
> https://mohitkale.github.io/reel-studio/gallery.html
>
> If you make videos for a team or a channel, I would value your honest feedback on the first five
> minutes.

### dev.to or Hashnode article

- [ ] Published: _link_

Title: `The only AI step is the JSON: building a video factory that runs on your laptop`

Outline: (1) The problem: videos from an idea without a cloud service in the middle. (2) The
split: a model writes a small, validated storyboard; deterministic code does the rest. (3) What a
storyboard looks like (the listicle example, with the frame it produces). (4) Why determinism
matters: tests, diffs, repeatable series. (5) Letting an agent drive it through MCP, with the
terminal recording. (6) What it will not do (avatars, generated footage) and what is not
finished (the honest list from section 3). (7) How to add a scene type in 15 minutes.

Opening paragraph:

> Most "AI video" tools put a model in the middle of everything and a meter on the door. I wanted
> the opposite: let a model do the one job it is good at, writing a short plan, and make everything
> after it ordinary software that runs on my laptop. The plan is a small JSON file. From it, the
> voice, the scenes, the captions, the music and the MP4 are made by code that gives the same
> result every time.

### MCP directories and awesome lists

Submit only after the npm package is published and the install guides are verified in real
clients (the soft-launch gate). Entries:

- Name: `reel-studio`. One line: `Make videos and podcasts from a storyboard, locally: voice, scenes, captions, music and MP4.`
- Long description: the first paragraph of the README; link the [MCP page](https://mohitkale.github.io/reel-studio/mcp.html).
- Install: `claude mcp add reel-studio -- node /path/to/reel-studio/bin/reel-studio.mjs mcp` (replace with `npx -y reel-studio mcp` once published).
- Tools: eight core tools (create_video, create_podcast, get_job, list_options, list_videos, open_studio, review_video, revise_video).
- Where: the official MCP registry (needs the published package), awesome-mcp-servers, mcp.so, PulseMCP, Glama and Smithery. Read each one's submission rules.

- [ ] Official MCP registry: _link_
- [ ] awesome-mcp-servers (pull request): _link_
- [ ] mcp.so, PulseMCP, Glama, Smithery: _links_

### HyperFrames and Kokoro communities

These two projects make Reel Studio possible; say thanks and show what was built, do not advertise.

- [ ] HyperFrames (HeyGen) community: _link_
- [ ] Kokoro (hexgrad) community or Hugging Face page: _link_

> Thank you for HyperFrames. Reel Studio uses it as its only render engine: a storyboard becomes
> a HyperFrames composition and an MP4. Here are twelve videos made that way, with their
> storyboards beside them: <gallery link>. We found a few rough edges along the way and would be
> glad to share them if useful.

(For Kokoro, replace the first sentences with: "Kokoro is the voice in every video here, running
on the CPU with no key. Here are twelve videos, and a two-host podcast made with it.")

## 6. Repository readiness

- [x] Roadmap issue pinned ([#140](https://github.com/mohitkale/reel-studio/issues/140)).
- [x] Issue templates: bug report, feature request, task, template request, voice provider request; blank issues off; security reports go to [SECURITY.md](../SECURITY.md).
- [x] Thirteen `good first issue` tickets open, including three scene types that use `npm run scene:new`.
- [x] A "Show and tell" Discussions category.
- [ ] Discussions welcome post (draft below): the maintainer posts it.
- [ ] Social preview image and funding file (F7b, #161).
- [x] Response-time expectation, in [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] Release `v1.0.0`, cut with `npm run release` once L6 passes (not before).

Discussions welcome post (category: Announcements, then pin it):

> **Welcome to Reel Studio.** This is a local-first video and podcast factory: a small JSON
> storyboard goes in, and the voice, scenes, captions, music and MP4 come out on your own
> computer. Start with the [website](https://mohitkale.github.io/reel-studio/) or the
> [README](https://github.com/mohitkale/reel-studio#readme).
>
> - Made something? Share it in **Show and tell**.
> - Stuck? Ask in **Q&A**; include what you ran and what you saw.
> - Want to help? Pick a `good first issue`; adding a scene type or a theme takes about 15 minutes.
>
> We reply within a few working days. We are honest about what is not finished: see the roadmap
> issue.

### Show and tell thread (seed it with the showcase)

Category: Show and tell. Post it once the showcase media is up; then pin it.

> **Thirty videos, thirty storyboards.** We made thirty example videos across ten kinds of channel
> (tech explained, coding tips, finance, fitness, history, productivity, product launches, language
> learning, science, book summaries). Each one has its storyboard JSON and the command that makes
> it again: https://mohitkale.github.io/reel-studio/showcase.html
>
> Made something with Reel Studio? Reply here with the video (or a link) and what you made it for.
> If you want it on the wall, open an issue with the `showcase` label and your storyboard. We add
> the ones that render cleanly and cite their sources.

## 7. Launch day

1. Check the gates (section 1) and the claims table (section 3). Re-run `npm run demo:assets` and
   `npm run launch:assets` if the product changed since these drafts.
2. Morning US Eastern, Tuesday to Thursday: Show HN first. Then Reddit, X and LinkedIn the same
   day, spaced out.
3. Stay available for the first three hours. Answer every question; say "not yet" plainly.
4. Log what people hit in the first five minutes as issues, labelled `launch-feedback`.
5. A week later: Product Hunt, the dev.to article, and a short thank-you in Show and tell.

There is no analytics on purpose. Measure by stars, forks, issues, discussions and the gallery
links people share.
