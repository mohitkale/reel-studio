import type { PodcastAudiogramProps } from "@/video/podcast-audiogram";

function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Timed speaker cards and waveform share one seekable timeline; audio is owned
 * by HyperFrames. Narration is the original selected podcast recording. */
export function buildAudiogramHtml(props: PodcastAudiogramProps): string {
  const duration = props.durationInFrames / props.fps;
  const landscape = props.width > props.height;
  const square = props.width === props.height;
  const colors = props.colors;
  if (Object.values(colors).some((color) => !/^#[a-f\d]{6}$/i.test(color)))
    throw new Error("Invalid audiogram palette");
  const cards = props.beats
    .map((beat, index) => {
      const end = props.beats[index + 1]?.startFrame ?? props.durationInFrames;
      const text =
        beat.text.length > 210
          ? `${beat.text.slice(0, 209).trimEnd()}…`
          : beat.text;
      return `<section class="clip speaker-card" data-start="${beat.startFrame / props.fps}" data-duration="${(end - beat.startFrame) / props.fps}" data-track-index="1"><div class="speaker">${escape(beat.speaker)}</div><p>${escape(text)}</p></section>`;
    })
    .join("");
  const bars = props.waveform
    .map(
      (level, index) =>
        `<span id="bar-${index}" style="height:${Math.max(8, Math.min(100, level * 100))}%"></span>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=${props.width},height=${props.height}">
<title>${escape(props.title)}</title><script src="_runtime/gsap.min.js"></script>
<style>
@font-face{font-family:Geist;src:url('_runtime/geist.woff2') format('woff2');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:${props.width}px;height:${props.height}px;overflow:hidden}
#audiogram{position:relative;width:${props.width}px;height:${props.height}px;color:${colors.foreground};font-family:Geist,sans-serif}
.fill{position:absolute;inset:0;background:${colors.background};background-image:radial-gradient(circle at 15% 12%,${colors.accent}35,transparent 38%),radial-gradient(circle at 88% 82%,${colors.accent}20,transparent 35%)}
.content{position:absolute;inset:${landscape ? 74 : 82}px;display:flex;flex-direction:column;justify-content:space-between}
.label{font-size:${landscape ? 27 : 30}px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${colors.muted}}
.copy{position:relative;flex:1;min-height:0;margin:40px 0;display:flex;flex-direction:column;max-width:${landscape ? "76%" : "100%"}}
.cards{position:relative;flex:1;min-height:0}
h1{flex-shrink:0;margin:0 0 36px;font-size:${square ? 62 : landscape ? 76 : 82}px;line-height:1.02;font-weight:760;overflow-wrap:anywhere}
.speaker-card{position:absolute;inset:0}
.speaker{color:${colors.accent};font-size:30px;font-weight:750;text-transform:uppercase;letter-spacing:.08em}
p{font-size:${square ? 42 : landscape ? 45 : 52}px;line-height:1.16;letter-spacing:-.025em;margin:18px 0 0;overflow-wrap:anywhere}
.waveform{height:${square ? 100 : landscape ? 118 : 150}px;display:flex;align-items:center;gap:${landscape ? 9 : 7}px;margin-bottom:22px}
.waveform span{flex:1;min-width:2px;border-radius:999px;background:${colors.muted}70}
.progress{height:6px;background:${colors.muted}45;overflow:hidden;border-radius:999px}
#progress{height:100%;background:${colors.accent};transform-origin:left center}
</style></head><body><div id="audiogram" data-composition-id="audiogram" data-start="0" data-duration="${duration}" data-width="${props.width}" data-height="${props.height}" data-fps="${props.fps}">
<div class="fill"></div><div class="content"><div class="label">${escape(props.presetLabel)} · Reel Studio</div><div class="copy"><h1>${escape(props.title)}</h1><div class="cards">${cards}</div></div><div><div class="waveform">${bars}</div><div class="progress"><div id="progress"></div></div></div></div>
<audio id="narration" src="audio.wav" data-start="0" data-duration="${duration}" data-track-index="10" data-volume="1"></audio></div>
<script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
tl.fromTo('.content',{opacity:0,y:28},{opacity:1,y:0,duration:Math.min(.5,${duration}),ease:'power2.out'},0);
tl.fromTo('#progress',{scaleX:0},{scaleX:1,duration:${duration},ease:'none'},0);
${props.waveform.map((_, index) => `tl.set('#bar-${index}',{backgroundColor:'${colors.accent}'},${(duration * index) / Math.max(1, props.waveform.length - 1)});`).join("")}
window.__timelines.audiogram=tl;</script></body></html>`;
}
