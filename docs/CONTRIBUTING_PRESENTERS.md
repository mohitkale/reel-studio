# Adding a presenter character

A presenter is an animated host who speaks a clip with lip sync. Characters are
layered SVG rigs drawn by code, so one is a single entry in a table. This page
explains the rig, the mouth shapes and how to add a character.

## How the animation works

1. **Mouth.** The words of the narration come with times (from whisper.cpp or
   the voice). Each English word is turned into phonemes by the bundled eSpeak
   build, and each phoneme maps to one of twelve mouth shapes
   (`src/video/visemes.ts`). A word's time is divided among its phonemes: vowels
   are held about three times as long as stops. A word it cannot read (another
   script, a symbol) follows the loudness of the audio instead.
2. **Eyes, brows and head.** Blinks every 2.5 to 5.5 seconds, a head nod on
   emphasis words (numbers and strong words), raised eyebrows on a question, and
   a slow idle sway. All of it is seeded from the clip, so the same clip always
   gives the same animation.
3. **Timeline.** The result is a list of `set` and `to` calls on the
   composition's paused GSAP timeline (`src/engines/hyperframes/presenter/build-presenter.ts`),
   so every exported frame is the same on every render.

## The rig

A 400 × 500 box. `src/engines/hyperframes/presenter/characters.ts` draws, from
back to front: the body, the neck, the hair behind, the head (inside the group
`pres-head`, which the nods and sway move) and, inside it, the face. These ids
must exist in every character because the animation targets them:

| Id                                   | What it is                                  |
| ------------------------------------ | ------------------------------------------- |
| `pres-head`                          | Everything that nods and sways              |
| `pres-eyes-open`, `pres-eyes-closed` | The two eye states; a blink swaps them      |
| `pres-brows`                         | Both eyebrows, lifted on a question         |
| `pres-mouth-<shape>`                 | One group per mouth shape, only one visible |

The twelve shapes are `rest`, `ah`, `eh`, `ee`, `oh`, `oo`, `mbp`, `fv`, `l`,
`sz`, `r` and `sh`. Every shape is centred on (200, 316).

## Add one

1. Add an entry to `CHARACTERS` with an `id`, `name`, `style` (`flat`, `line`,
   `3d` or `mascot`), a default `voiceId`, colours, a `hairStyle` and an
   optional `accessory`.
2. If none of the existing hair styles or accessories fit, add a case in
   `faceLayer` or `backLayer`. Keep every shape inside the 400 × 500 box.
3. Run `npx vitest run src/engines/hyperframes/presenter`. It checks that every
   named part and all twelve mouth shapes exist and are different from each
   other.
4. Look at it: render a contact sheet of the twelve mouths and one short clip
   (**Recordings**, choose the presenter, make a draft clip) and attach frames to
   the pull request.

## Licence

Artwork must be original and released under the repository's MIT licence, or
public domain (CC0). Do not trace or adapt existing characters, brands or real
people's likenesses. The six characters here (Maya, Sam, Ada, Rex, Orb, Bolt)
were drawn for this project in code and are MIT-licensed with the rest of it.
