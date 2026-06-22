/**
 * Built-in sample script seeded on first run so the editor is demoable without
 * spending TTS credits (pair it with a placeholder/silent take). Plain English,
 * no em-dashes.
 */
export interface SampleScene {
  templateId: string;
  text: string;
  emphasis?: string[];
}

export const SAMPLE_PROJECT_NAME = "AI Unstuck";
export const SAMPLE_SCRIPT_NAME = "Episode 1: Getting Unstuck";

export const SAMPLE_SCENES: SampleScene[] = [
  {
    templateId: "placeholder",
    text: "Stuck on a blank page? Here is how to get moving in under a minute.",
    emphasis: ["blank page", "under a minute"],
  },
  {
    templateId: "placeholder",
    text: "Step one. Say what you want in one plain sentence. No jargon.",
    emphasis: ["one plain sentence"],
  },
  {
    templateId: "placeholder",
    text: "Step two. Give a real example of good and bad, so the model learns your taste.",
    emphasis: ["good and bad"],
  },
  {
    templateId: "placeholder",
    text: "Step three. Ask for three options, then pick the one that feels right.",
    emphasis: ["three options"],
  },
  {
    templateId: "placeholder",
    text: "That is it. Small, clear asks beat one giant prompt every time.",
    emphasis: ["Small, clear asks"],
  },
  {
    templateId: "placeholder",
    text: "Follow for one practical AI tip every week. You have got this.",
    emphasis: ["every week"],
  },
];
