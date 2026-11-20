# Bundled music

These background tracks are **synthesized from scratch** by
`scripts/generate-music.mjs` and released as **CC0 / public domain** — there is
no third-party licensing attached, so they are safe to ship and use commercially.

There are twenty tracks. Each loops seamlessly over 16 seconds and holds a whole
number of beats, so its tempo is exact (see `src/lib/music-library.ts` for the name,
mood tags, energy and BPM of every track). Seven came first; thirteen more are built
by one parameterised builder in the same script. They are original, generated
compositions, so the licence is simply CC0: nothing here is sampled or taken from a
third party. They have not been mastered by an engineer; check the loudness under a
voice before relying on one for a client.

They are intentionally soft, loopable ambient beds meant to sit (ducked) under a
voiceover. Automatic storyboard music uses the selected theme's mood tags.
Cinematic picks Cinematic Rise, Mono Brutalist picks Tech Grid for its light
percussion, and Clean Minimal picks Ambient Glow.

The twenty WAVs add 20.48 MB (19.53 MiB) to the unpacked package. The WAVs ship
with the studio so automatic music can work offline. Inspect the package
contents with `npm pack --dry-run --json`.

Regenerate the WAVs with this command.

```bash
npm run gen:music
```

Users can also upload their own audio in the editor (Music control); uploaded
tracks become reusable assets across projects. You are responsible for the
licensing of any audio you upload.

For HyperFrames, Unsplash, Jamendo, and other third-party terms that apply to the
app as a whole, see [`docs/LICENSING.md`](../../docs/LICENSING.md).
