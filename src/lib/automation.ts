/**
 * Which steps run by themselves for a new video (roadmap U9). Each switch is a
 * default that one video can override. "Review before making" stops the video
 * once for an OK after the storyboard is checked; the rest turn a step off.
 */
export interface Automation {
  /** Look the topic up on the web before writing (needs Gemini or OpenAI). */
  research: boolean;
  /** Narrate with the local voice. Off makes a silent video with captions. */
  voice: boolean;
  /** Add background music. */
  music: boolean;
  /** Show captions made from the narration. */
  captions: boolean;
}

export const DEFAULT_AUTOMATION: Automation = {
  research: true,
  voice: true,
  music: true,
  captions: true,
};

export function resolveAutomation(
  stored: Partial<Automation> | undefined,
): Automation {
  return { ...DEFAULT_AUTOMATION, ...stored };
}
