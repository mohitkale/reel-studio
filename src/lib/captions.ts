/**
 * Subtitle (caption) generation from a reel's beat timeline.
 *
 * Produces SRT or WebVTT from per-cue frame ranges. Pure and dependency-free so
 * it can run on the server (download endpoint) and be unit-tested. Word-level
 * timing isn't available from the TTS providers, so each scene/beat becomes one
 * cue spanning its spoken duration.
 */

export type CaptionFormat = "srt" | "vtt";

export interface CaptionCue {
  startFrame: number;
  endFrame: number;
  text: string;
}

function pad(n: number, len = 2): string {
  return String(Math.max(0, Math.floor(n))).padStart(len, "0");
}

/** Frame index → "HH:MM:SS,mmm" (srt) or "HH:MM:SS.mmm" (vtt). */
export function framesToTimestamp(
  frames: number,
  fps: number,
  format: CaptionFormat,
): string {
  const totalMs = fps > 0 ? Math.round((frames / fps) * 1000) : 0;
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const msSep = format === "srt" ? "," : ".";
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${msSep}${pad(ms, 3)}`;
}

/** Collapse internal whitespace/newlines so a cue is clean subtitle text. */
function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/** Build an SRT or WebVTT document from cues (skips empty / zero-length cues). */
export function buildCaptions(
  cues: CaptionCue[],
  fps: number,
  format: CaptionFormat,
): string {
  const valid = cues
    .map((c) => ({ ...c, text: cleanText(c.text) }))
    .filter((c) => c.text && c.endFrame > c.startFrame);

  const blocks = valid.map((c, i) => {
    const start = framesToTimestamp(c.startFrame, fps, format);
    const end = framesToTimestamp(c.endFrame, fps, format);
    return `${i + 1}\n${start} --> ${end}\n${c.text}`;
  });

  const body = blocks.join("\n\n");
  if (format === "vtt") {
    return `WEBVTT\n\n${body}${body ? "\n" : ""}`;
  }
  return body ? `${body}\n` : "";
}
