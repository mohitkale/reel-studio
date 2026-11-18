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
voiceover. Regenerate with:

```bash
npm run gen:music
```

Users can also upload their own audio in the editor (Music control); uploaded
tracks become reusable assets across projects. You are responsible for the
licensing of any audio you upload.

For HyperFrames, Unsplash, Jamendo, and other third-party terms that apply to the
app as a whole, see [`docs/LICENSING.md`](../../docs/LICENSING.md).
