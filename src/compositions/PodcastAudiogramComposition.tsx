import { AbsoluteFill, Audio, interpolate, useCurrentFrame } from "remotion";

export interface PodcastAudiogramProps {
  [key: string]: unknown;
  title: string;
  presetLabel: string;
  audioUrl: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
  };
  waveform: number[];
  beats: Array<{
    turnId: string;
    speaker: string;
    text: string;
    startFrame: number;
    durationFrames: number;
  }>;
}

function readableExcerpt(text: string, max = 210): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export const PodcastAudiogramComposition: React.FC<PodcastAudiogramProps> = (
  props,
) => {
  const frame = useCurrentFrame();
  const landscape = props.width > props.height;
  const active =
    props.beats.find(
      (beat) =>
        frame >= beat.startFrame &&
        frame < beat.startFrame + beat.durationFrames,
    ) ?? props.beats.at(-1);
  const progress = Math.max(
    0,
    Math.min(1, frame / Math.max(1, props.durationInFrames - 1)),
  );
  const entrance = interpolate(
    frame,
    [0, Math.max(1, props.fps * 0.5)],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        background: props.colors.background,
        color: props.colors.foreground,
        fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 15% 12%, ${props.colors.accent}35, transparent 38%), radial-gradient(circle at 88% 82%, ${props.colors.accent}20, transparent 35%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: landscape ? 74 : 82,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: entrance,
          transform: `translateY(${(1 - entrance) * 28}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              background: props.colors.accent,
              boxShadow: `0 0 28px ${props.colors.accent}`,
            }}
          />
          <div
            style={{
              fontSize: landscape ? 27 : 30,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: props.colors.muted,
            }}
          >
            {props.presetLabel} · Reel Studio
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: landscape ? 36 : 48,
            maxWidth: landscape ? "76%" : "100%",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: landscape ? 76 : 82,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              fontWeight: 760,
            }}
          >
            {props.title}
          </h1>
          <div style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                fontSize: landscape ? 26 : 30,
                fontWeight: 750,
                color: props.colors.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {active?.speaker ?? "Podcast"}
            </div>
            <div
              style={{
                fontSize: landscape ? 45 : 52,
                lineHeight: 1.16,
                letterSpacing: "-0.025em",
                fontWeight: 560,
              }}
            >
              {readableExcerpt(active?.text ?? "")}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <div
            style={{
              height: landscape ? 118 : 150,
              display: "flex",
              alignItems: "center",
              gap: landscape ? 9 : 7,
            }}
          >
            {props.waveform.map((level, index) => {
              const position = index / Math.max(1, props.waveform.length - 1);
              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    minWidth: 2,
                    height: `${Math.max(8, level * 100)}%`,
                    borderRadius: 999,
                    background:
                      position <= progress
                        ? props.colors.accent
                        : `${props.colors.muted}70`,
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 999,
              background: `${props.colors.muted}45`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: props.colors.accent,
              }}
            />
          </div>
        </div>
      </div>
      <Audio src={props.audioUrl} />
    </AbsoluteFill>
  );
};
