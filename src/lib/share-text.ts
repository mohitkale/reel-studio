/**
 * The line a person can paste next to a video they made: its title, what made it
 * and the repository. Plain code: the same title always gives the same text.
 * Sharing is the person's choice; nothing here is added to the video itself.
 */
export const REPO_URL = "https://github.com/mohitkale/reel-studio";

export function buildShareText(title: string): string {
  const clean = title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  const head = clean.length > 90 ? `${clean.slice(0, 89).trimEnd()}…` : clean;
  return `${head || "My video"}. Made with Reel Studio, free and on my own computer: ${REPO_URL}`;
}
