/**
 * LinkedIn “rejected a fresher” interview story — HyperFrames video seed.
 * Shortened to ~3.5–4 minutes of spoken dialogue for a LinkedIn-native cut.
 *
 * `visual: "Interviewer" | "Candidate"` drives speaker chips on classic templates.
 */

export const INTERVIEW_PROJECT_NAME = "Would you hire her? (LinkedIn)";
export const INTERVIEW_SCRIPT_NAME = "Five minutes is not enough";

/**
 * On-screen `text` = caption punch.
 * `spokenText` = full VO line (written for natural TTS pacing).
 *
 * Voice casting (Kokoro):
 * - Host / narrator (open + close) → am_michael
 * - Interviewer (in-room dialogue) → hm_omega (Hindi male)
 * - Candidate → af_heart
 */

export type InterviewVoiceRole = "host" | "interviewer" | "candidate";

export const INTERVIEW_VOICES = {
  host: { providerId: "kokoro-server" as const, voiceId: "am_michael" },
  interviewer: { providerId: "kokoro-server" as const, voiceId: "hm_omega" },
  candidate: { providerId: "kokoro-server" as const, voiceId: "af_heart" },
};

/** Resolve cast role from scene visual + spoken line. */
export function interviewVoiceRole(args: {
  visual?: string | null;
  spoken?: string | null;
  text?: string | null;
}): InterviewVoiceRole {
  const visual = (args.visual || "").trim();
  const spoken = String(args.spoken ?? args.text ?? "").trim();

  if (/^candidate$/i.test(visual)) return "candidate";
  if (
    /never asked|may i ask|chatgpt|mysql|nervous|opportunity|learning|excited|basics/i.test(
      spoken,
    )
  ) {
    return "candidate";
  }
  if (/^interviewer$/i.test(visual)) return "interviewer";

  // No speaker chip = host narration (cold open, disclaimer, moral, CTA).
  return "host";
}
export const INTERVIEW_SCENES = [
  {
    templateId: "hf-kinetic-slam",
    text: "I rejected a fresher in the first 5 minutes.",
    spokenText:
      "I rejected a fresher… in the first five minutes. Here's the interview recording. Would you hire her? Listen first. Then judge.",
    emphasis: ["rejected", "5 minutes"],
    mood: "dramatic" as const,
  },
  {
    templateId: "hf-statement",
    text: "Mock interview. No real candidate.",
    spokenText:
      "Quick note — this is a mock interview. No real candidate was involved.",
    emphasis: ["Mock interview"],
    mood: "calm" as const,
  },
  {
    templateId: "hf-opener",
    text: "Hi, thanks for joining. Let's get started.",
    spokenText: "Hi… thanks for joining. Let's get started.",
    visual: "Interviewer",
    emphasis: [],
    mood: "calm" as const,
  },
  {
    templateId: "hf-quote",
    text: "I'm a little nervous… but excited.",
    spokenText: "Thank you. I'm a little nervous… but excited.",
    visual: "Candidate",
    emphasis: ["nervous", "excited"],
    mood: "playful" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "Explain multithreading.",
    spokenText: "Explain multithreading.",
    visual: "Interviewer",
    emphasis: ["multithreading"],
    mood: "tech" as const,
  },
  {
    templateId: "hf-quote",
    text: "I know the basics… but I don't think I can explain it perfectly.",
    spokenText:
      "I know the basics… but I don't think I can explain it perfectly.",
    visual: "Candidate",
    emphasis: ["basics"],
    mood: "calm" as const,
  },
  {
    templateId: "hf-statement",
    text: "Hmm… okay.",
    spokenText: "Hmm… okay.",
    visual: "Interviewer",
    emphasis: [],
    mood: "calm" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "SQL vs NoSQL?",
    spokenText: "Difference between SQL… and NoSQL?",
    visual: "Interviewer",
    emphasis: ["SQL", "NoSQL"],
    mood: "tech" as const,
  },
  {
    templateId: "hf-quote",
    text: "I've mostly worked with MySQL… not MongoDB in a real project.",
    spokenText:
      "I've mostly worked with MySQL. I haven't used MongoDB… in any real project.",
    visual: "Candidate",
    emphasis: ["MySQL"],
    mood: "playful" as const,
  },
  {
    templateId: "hf-statement",
    text: "So… you don't know?",
    spokenText: "So… you don't know?",
    visual: "Interviewer",
    emphasis: ["don't know"],
    mood: "dramatic" as const,
  },
  {
    templateId: "hf-quote",
    text: "I know when I'd learn it. I just haven't had the opportunity yet.",
    spokenText:
      "I know when I'd learn it. I just… haven't had the opportunity yet.",
    visual: "Candidate",
    emphasis: ["learn"],
    mood: "inspiring" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "Have you built anything with AI?",
    spokenText: "Have you built anything… using AI?",
    visual: "Interviewer",
    emphasis: ["AI"],
    mood: "energetic" as const,
  },
  {
    templateId: "hf-quote",
    text: "I've used ChatGPT and Cursor while learning.",
    spokenText: "I've used ChatGPT and Cursor… while learning.",
    visual: "Candidate",
    emphasis: ["ChatGPT", "Cursor"],
    mood: "tech" as const,
  },
  {
    templateId: "hf-statement",
    text: "So… no production AI?",
    spokenText: "So… no production AI?",
    visual: "Interviewer",
    emphasis: ["production"],
    mood: "nature" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "I don't think you're ready.",
    spokenText: "I think that's enough. I don't think you're ready.",
    visual: "Interviewer",
    emphasis: ["ready"],
    mood: "dramatic" as const,
  },
  {
    templateId: "hf-quote",
    text: "May I ask one question before we end?",
    spokenText: "May I ask… one question… before we end?",
    visual: "Candidate",
    emphasis: ["one question"],
    mood: "calm" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "You asked what I know today. Not how fast I learn.",
    spokenText:
      "You asked me what I know today. But you never asked… how fast I learn.",
    visual: "Candidate",
    emphasis: ["how fast I learn"],
    mood: "energetic" as const,
  },
  {
    templateId: "hf-list",
    text: "You never asked what projects I built\nYou never asked why I chose engineering\nYou never asked what I do when I don't know",
    spokenText:
      "You never asked what projects I built. You never asked why I chose engineering. You never asked what I do when I don't know something. You only checked… whether I already knew the answers.",
    visual: "Candidate",
    emphasis: [],
    mood: "inspiring" as const,
  },
  {
    templateId: "hf-statement",
    text: "…",
    // Empty spoken line → silent hold between dialogue and reflection.
    spokenText: "",
    visual: "Interviewer",
    emphasis: [],
    mood: "calm" as const,
  },
  {
    templateId: "hf-logo-outro",
    text: "This interview never happened. But interviews like this happen every day.",
    spokenText:
      "This interview never happened. But interviews like this… happen every day.",
    visual: "reel.studio",
    emphasis: ["never happened"],
    mood: "dramatic" as const,
  },
  {
    templateId: "hf-kinetic-slam",
    text: "Great engineers learn the fastest.",
    spokenText:
      "Great engineers aren't always the people who know the most. Sometimes… they're the people who learn the fastest.",
    emphasis: ["learn the fastest"],
    mood: "inspiring" as const,
  },
  {
    templateId: "hf-ig-follow",
    text: "Five minutes rejects knowledge. Not potential.",
    spokenText:
      "Five minutes is enough to reject knowledge. It's rarely enough… to judge potential. Follow for more.",
    visual: "Follow",
    emphasis: ["potential"],
    mood: "inspiring" as const,
  },
] as const;
