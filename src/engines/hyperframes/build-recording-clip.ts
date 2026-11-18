import { escapeHtml as escape } from "@/lib/html";
import type { RecWord } from "@/lib/recording-clips";

/**
 * A clip from a recording (roadmap P4): the speaker's own video or a waveform,
 * styled word-synced captions and a hook card at the start. The audio and the
 * video file are owned by HyperFrames; nothing here is random.
 */
export interface RecordingClipProps {
  title: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  /** A video file next to the page is shown; without one a waveform is drawn. */
  hasVideo: boolean;
  /** "blur" shows landscape video whole over a blurred copy; "fill" crops to the frame. */
  reframe: "fill" | "blur";
  words: RecWord[];
  waveform: number[];
  colors: {
    background: string;
    foreground: string;
    accent: string;
    accentForeground: string;
    muted: string;
  };
}

const HEX = /^#[a-f\d]{6}$/i;

/** Lines of at most `maxWords` words and `maxChars` characters, broken after punctuation when possible. */
export function captionGroups(
  words: readonly RecWord[],
  maxWords = 5,
  maxChars = 28,
): RecWord[][] {
  const groups: RecWord[][] = [];
  let current: RecWord[] = [];
  const length = (list: RecWord[]) => list.map((w) => w.text).join(" ").length;
  for (const word of words) {
    const gap = current.length
      ? word.start - current[current.length - 1]!.end
      : 0;
    if (
      current.length &&
      (current.length >= maxWords ||
        length([...current, word]) > maxChars ||
        gap > 0.8)
    ) {
      groups.push(current);
      current = [];
    }
    current.push(word);
    if (/[.?!]$/.test(word.text)) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

export function buildRecordingClipHtml(props: RecordingClipProps): string {
  if (Object.values(props.colors).some((c) => !HEX.test(c)))
    throw new Error("Invalid clip palette");
  const duration = Math.max(0.5, props.durationSeconds);
  const portrait = props.height > props.width;
  const square = props.width === props.height;
  const font = portrait ? 78 : square ? 64 : 58;
  const groups = captionGroups(props.words);
  let wordIndex = 0;
  const captions = groups
    .map((group, g) => {
      const start = group[0]!.start;
      const next = groups[g + 1]?.[0]?.start;
      // A line stays up until the next begins, or a moment after its last word.
      const end = Math.min(
        duration,
        next ?? group[group.length - 1]!.end + 0.4,
      );
      const spans = group
        .map(
          (word) => `<span id="w-${wordIndex++}">${escape(word.text)}</span>`,
        )
        .join(" ");
      return `<div class="clip cap" data-start="${start.toFixed(3)}" data-duration="${Math.max(0.1, end - start).toFixed(3)}" data-track-index="3"><p>${spans}</p></div>`;
    })
    .join("");
  const c = props.colors;
  const captionTop = portrait ? 60 : 72;
  const hookEnd = Math.min(2.6, duration);
  const video = props.hasVideo
    ? `${
        props.reframe === "blur"
          ? `<video class="clip bgblur" src="clip.mp4" data-start="0" data-duration="${duration.toFixed(3)}" data-media-start="0" data-track-index="0" muted playsinline preload="auto"></video>`
          : ""
      }<video class="clip main ${props.reframe}" src="clip.mp4" data-start="0" data-duration="${duration.toFixed(3)}" data-media-start="0" data-track-index="1" muted playsinline preload="auto"></video>`
    : `<div class="wave">${props.waveform
        .map(
          (l, i) =>
            `<span id="bar-${i}" style="height:${Math.max(8, Math.min(100, l * 100))}%"></span>`,
        )
        .join("")}</div>`;
  const timings: string[] = [];
  props.words.forEach((word, i) => {
    // The word being said sits on an accent pill; once said it stays fully bright.
    timings.push(
      `tl.set('#w-${i}',{opacity:1,backgroundColor:'${props.colors.accent}',color:'${props.colors.accentForeground}'},${word.start.toFixed(3)});`,
      `tl.set('#w-${i}',{backgroundColor:'rgba(0,0,0,0)',color:'${props.colors.foreground}'},${Math.max(word.start + 0.05, word.end).toFixed(3)});`,
    );
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=${props.width},height=${props.height}">
<title>${escape(props.title)}</title><script src="_runtime/gsap.min.js"></script>
<style>
@font-face{font-family:Geist;src:url('_runtime/geist.woff2') format('woff2');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:${props.width}px;height:${props.height}px;overflow:hidden}
#clip{position:relative;width:${props.width}px;height:${props.height}px;color:${c.foreground};font-family:Geist,sans-serif;background:${c.background}}
.bgblur{position:absolute;inset:-6%;width:112%;height:112%;object-fit:cover;filter:blur(38px) brightness(.55)}
.main{position:absolute;inset:0;width:100%;height:100%}
.main.fill{object-fit:cover}.main.blur{object-fit:contain}
.wave{position:absolute;left:8%;right:8%;top:30%;height:22%;display:flex;align-items:center;gap:7px}
.wave span{flex:1;min-width:2px;border-radius:999px;background:${c.muted}80}
.shade{position:absolute;left:0;right:0;bottom:0;height:46%;background:linear-gradient(to top,${c.background}d0,transparent)}
.cap{position:absolute;z-index:8;left:6%;right:6%;top:${captionTop}%;display:flex;justify-content:center;text-align:center}
.cap p{margin:0;font-size:${font}px;line-height:1.14;font-weight:800;letter-spacing:-.02em;color:${c.foreground};background:${c.background}d9;padding:.28em .5em;border-radius:.4em}.cap p span{display:inline-block;padding:0 .08em;border-radius:.2em;opacity:.55}
.hook{position:absolute;z-index:9;left:7%;right:7%;top:${portrait ? "9%" : "8%"};padding:${portrait ? 34 : 24}px ${portrait ? 40 : 30}px;border-radius:26px;background:${c.accent};color:${c.background};font-size:${portrait ? 58 : 44}px;line-height:1.08;font-weight:820;letter-spacing:-.02em;text-align:center}
.progress{position:absolute;left:0;bottom:0;height:8px;width:100%;background:${c.muted}40}#bar{height:100%;background:${c.accent};transform-origin:left center}
</style></head><body><div id="clip" data-composition-id="clip" data-start="0" data-duration="${duration.toFixed(3)}" data-width="${props.width}" data-height="${props.height}" data-fps="${props.fps}">
${video}<div class="shade"></div>
<div class="clip hook" data-start="0" data-duration="${hookEnd.toFixed(3)}" data-track-index="4">${escape(props.title)}</div>
${captions}
<div class="progress"><div id="bar"></div></div>
<audio id="narration" src="audio.wav" data-start="0" data-duration="${duration.toFixed(3)}" data-track-index="10" data-volume="1"></audio></div>
<script>window.__timelines=window.__timelines||{};const tl=gsap.timeline({paused:true});
tl.fromTo('.hook',{opacity:0,y:-24,scale:.96},{opacity:1,y:0,scale:1,duration:.35,ease:'power3.out'},0);
tl.to('.hook',{opacity:0,y:-16,duration:.3,ease:'power2.in'},${Math.max(0.4, hookEnd - 0.3).toFixed(3)});
tl.fromTo('#bar',{scaleX:0},{scaleX:1,duration:${duration.toFixed(3)},ease:'none'},0);
${props.hasVideo ? "" : props.waveform.map((_, i) => `tl.set('#bar-${i}',{backgroundColor:'${c.accent}'},${((duration * i) / Math.max(1, props.waveform.length - 1)).toFixed(3)});`).join("")}
${timings.join("\n")}
window.__timelines.clip=tl;</script></body></html>`;
}
