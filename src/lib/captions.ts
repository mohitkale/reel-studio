/**
 * Subtitle (caption) generation from a reel's beat timeline.
 *
 * Produces SRT or WebVTT from per-cue frame ranges. Pure and dependency-free so
 * it can run on the server (download endpoint) and be unit-tested. Word-level
 * timing isn't available from the TTS providers, so each scene/beat becomes one
 * cue spanning its spoken duration.
 */

export type CaptionFormat = "srt" | "vtt";
export type CaptionTimingSource =
  "provider" | "local-transcription" | "estimated" | "imported";

export interface CaptionWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface CaptionCue {
  id?: string;
  startFrame: number;
  endFrame: number;
  text: string;
  words?: CaptionWord[];
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

function timestampToFrames(value: string, fps: number): number {
  const match = value
    .trim()
    .match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[,.](\d{3})$/);
  if (!match) throw new Error(`Invalid caption timestamp: ${value}`);
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);
  if (minutes > 59 || seconds > 59) {
    throw new Error(`Invalid caption timestamp: ${value}`);
  }
  return Math.max(
    0,
    Math.round(
      (hours * 3600 + minutes * 60 + seconds + milliseconds / 1000) * fps,
    ),
  );
}

/** Parse user-supplied SRT or WebVTT into frame-based editable cues. */
export function parseCaptions(
  source: string,
  fps: number,
  format?: CaptionFormat,
): CaptionCue[] {
  if (!Number.isFinite(fps) || fps <= 0)
    throw new Error("FPS must be positive");
  const normalized = source
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const detected = format ?? (normalized.startsWith("WEBVTT") ? "vtt" : "srt");
  const body =
    detected === "vtt"
      ? normalized.replace(/^WEBVTT[^\n]*\n?/, "").trim()
      : normalized;
  if (!body) return [];

  return body
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (detected === "srt" && /^\d+$/.test(lines[0]?.trim() ?? "")) {
        lines.shift();
      } else if (
        detected === "vtt" &&
        lines.length > 1 &&
        !lines[0]?.includes("-->")
      ) {
        lines.shift();
      }
      const timing = lines.shift();
      const match = timing?.match(/^\s*([^\s]+)\s+-->\s+([^\s]+)(?:\s+.*)?$/);
      if (!match)
        throw new Error("Caption block is missing a valid time range");
      const startFrame = timestampToFrames(match[1]!, fps);
      const endFrame = timestampToFrames(match[2]!, fps);
      const text = cleanText(lines.join(" "));
      if (!text) throw new Error("Caption cue text cannot be empty");
      if (endFrame <= startFrame) {
        throw new Error("Caption cue must end after it starts");
      }
      return { startFrame, endFrame, text };
    })
    .sort((a, b) => a.startFrame - b.startFrame);
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
