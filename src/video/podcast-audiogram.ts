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
