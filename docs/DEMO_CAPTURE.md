# README demo and screenshots

The README's `assets/script-to-video.gif` shows **real v0.4.0 home/result
screenshots and a verified local HyperFrames export**. It is a screen/output
montage, not a recording of the full Generate interaction.

## Sources and provenance

- `assets/reel-studio-home.png` and `assets/reel-studio-result.png`: desktop UI
  from the verified prompt-first walkthrough.
- `reel-studio-0.4.0-editorial-explainer-landscape.mp4`: actual 12-second release
  matrix output in the [v0.4.0 release](https://github.com/mohitkale/reel-studio/releases/tag/v0.4.0).
- `assets/readme-demo.json`: source/output hashes, canvas, timing, and conversion parameters.

The GIF is silent and loops; target under 5 MiB. Link the full MP4 for playback
and audio. Show supplied text → motion → a downloadable result within seconds.

## Regenerate

Use installed FFmpeg and the verified local source MP4. From the repository root:

```bash
ffmpeg -y -loop 1 -t 2 -i docs/assets/reel-studio-home.png \
  -i .artifacts/release-v0.4.0/reel-studio-0.4.0-editorial-explainer-landscape.mp4 \
  -loop 1 -t 2 -i docs/assets/reel-studio-result.png \
  -filter_complex_threads 1 \
  -filter_complex "[0:v]fps=10,scale=960:600:force_original_aspect_ratio=decrease,pad=960:600:(ow-iw)/2:(oh-ih)/2:color=0x101012,setsar=1,setpts=PTS-STARTPTS[a];[1:v]trim=duration=8,fps=10,scale=960:600:force_original_aspect_ratio=decrease,pad=960:600:(ow-iw)/2:(oh-ih)/2:color=0x101012,setsar=1,setpts=PTS-STARTPTS[b];[2:v]fps=10,scale=960:600:force_original_aspect_ratio=decrease,pad=960:600:(ow-iw)/2:(oh-ih)/2:color=0x101012,setsar=1,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,split[p][q];[p]palettegen=max_colors=128[pal];[q][pal]paletteuse=dither=bayer:bayer_scale=3[out]" \
  -map "[out]" -an -loop 0 docs/assets/script-to-video.gif
```

Probe duration/dimensions/size, inspect beginning/middle/end frames, and update
the manifest when sources change. Do not advertise a current renderer with an
old-engine clip.

## Future screen recording

For an interaction recording, use an isolated synthetic project:

1. Run setup, doctor, and the supervised app with installed tools.
2. Record prompt → preset → Generate → result → download. Label cuts/time compression.
3. Capture current home, mobile home, result, and editor screenshots.
4. Replace the montage after checking readability and secret-free content.

Do not include keys, tokens, real user data, private URLs, or unlicensed media.
Keep screenshots authentic and regenerate them when the UI changes.
