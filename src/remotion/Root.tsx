import { Composition } from "remotion";

import { ReelComposition } from "../compositions/ReelComposition";
import {
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
  reelDurationFrames,
  type ReelProps,
} from "../compositions/types";
import { defaultBrandTokens } from "../compositions/tokens";
import {
  PodcastAudiogramComposition,
  type PodcastAudiogramProps,
} from "../compositions/PodcastAudiogramComposition";

// One scene per template, for tinkering in Remotion Studio (no audio).
const scenes = [
  {
    id: "s1",
    templateId: "kinetic",
    text: "Stop scrolling. This is how to get unstuck.",
    emphasis: ["get unstuck"],
  },
  {
    id: "s2",
    templateId: "lottie",
    text: "Say what you want in one plain sentence.",
    emphasis: ["one plain sentence"],
  },
  {
    id: "s3",
    templateId: "three",
    text: "Small, clear asks beat one giant prompt.",
    emphasis: ["Small, clear asks"],
  },
];

const timeline = [
  { sceneId: "s1", startFrame: 0, durationFrames: 90 },
  { sceneId: "s2", startFrame: 99, durationFrames: 90 },
  { sceneId: "s3", startFrame: 198, durationFrames: 90 },
];

const defaultProps: ReelProps = {
  scenes,
  timeline,
  tokens: defaultBrandTokens,
};

const defaultAudiogramProps: PodcastAudiogramProps = {
  title: "A practical idea worth sharing",
  presetLabel: "Podcast",
  audioUrl: "",
  width: 1080,
  height: 1920,
  fps: REEL_FPS,
  durationInFrames: 150,
  colors: {
    background: "#0F172A",
    foreground: "#F8FAFC",
    accent: "#A78BFA",
    muted: "#94A3B8",
  },
  waveform: Array.from({ length: 48 }, (_, i) => 0.2 + ((i * 17) % 10) / 12),
  beats: [
    {
      turnId: "sample",
      speaker: "Host",
      text: "Select any podcast turns and turn the original audio into a shareable clip.",
      startFrame: 0,
      durationFrames: 150,
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={ReelComposition}
        durationInFrames={288}
        fps={REEL_FPS}
        width={REEL_WIDTH}
        height={REEL_HEIGHT}
        defaultProps={defaultProps}
        // Dimensions/fps come from input props so one composition serves every
        // orientation; render-service and the editor pass the script's values.
        calculateMetadata={({ props }) => ({
          width: props.width ?? REEL_WIDTH,
          height: props.height ?? REEL_HEIGHT,
          fps: props.fps ?? REEL_FPS,
          durationInFrames: reelDurationFrames(props),
        })}
      />
      <Composition
        id="PodcastAudiogram"
        component={PodcastAudiogramComposition}
        durationInFrames={defaultAudiogramProps.durationInFrames}
        fps={defaultAudiogramProps.fps}
        width={defaultAudiogramProps.width}
        height={defaultAudiogramProps.height}
        defaultProps={defaultAudiogramProps}
        calculateMetadata={({ props }) => ({
          width: props.width,
          height: props.height,
          fps: props.fps,
          durationInFrames: props.durationInFrames,
        })}
      />
    </>
  );
};
