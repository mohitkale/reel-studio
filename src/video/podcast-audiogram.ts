/** One animated presenter in an audiogram: who, where, and what the face does over time. */
export interface AudiogramPresenter {
  characterId: string;
  /** Unique within the page, for element ids. */
  uid: string;
  box: { left: number; top: number; width: number; height: number };
  mouth: Array<{ viseme: string; start: number; end: number }>;
  blinks: Array<{ start: number; end: number }>;
  nods: number[];
}

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
  /** Up to two presenters, one per speaker. When set they replace the waveform. */
  presenters?: AudiogramPresenter[];
  beats: Array<{
    turnId: string;
    speaker: string;
    text: string;
    startFrame: number;
    durationFrames: number;
  }>;
}
