/** Palette and typography propagate across the authored library, including media. */
export const MOTION_LIBRARY_STYLES = `
  .ml-backplate { position:absolute; inset:0; background:var(--brand-background); }
  [data-motion-recipe] .fx-line { overflow:visible; }
  [data-motion-recipe] .fx-stage { background:var(--brand-background); color:var(--brand-foreground); font-family:var(--brand-font); }
  [data-motion-recipe] .fx-line-inner, [data-motion-recipe] .dm-value, [data-motion-recipe] .dm-row-label, [data-motion-recipe] .dm-row-label b { color:var(--brand-foreground); font-family:var(--brand-font); line-height:1.2; }
  [data-motion-recipe] .sm-copy, [data-motion-recipe] .sm-label, [data-motion-recipe] .sm-brand { line-height:1.2; }
  [data-motion-recipe] .dm-source, [data-motion-recipe] .sm-marker { color:var(--brand-muted); }
  [data-motion-recipe] .tm-index, [data-motion-recipe] .gm-number { color:var(--brand-accent-foreground); }
  [data-motion-recipe] .tm-paper { background:radial-gradient(circle at 84% 23%, color-mix(in oklab,var(--accent) 18%,transparent),transparent 44%); }
  [data-motion-recipe] .sm-panel, [data-motion-recipe] .gm-card { color:var(--brand-foreground); background:color-mix(in oklab,var(--brand-foreground) 8%,var(--brand-background)); border-radius:var(--motion-radius); }
  [data-motion-recipe] .sm-panel:nth-child(2) { background:color-mix(in oklab,var(--brand-foreground) 14%,var(--brand-background)); }
  [data-motion-recipe] .sm-ring, [data-motion-recipe] .sm-brand-frame .sm-brand { border-color:var(--brand-muted); }
  [data-motion-recipe] .tm-impact-content, [data-motion-recipe] .tm-editorial-content, [data-motion-recipe] .dm-bars-content, [data-motion-recipe] .gm-content { gap:var(--motion-gap); }
  [data-motion-recipe] .pl-stage, [data-motion-recipe] .cb-stage { color:var(--brand-foreground); background:var(--brand-background); }
  .media-cinematic .cb-scrim { background:linear-gradient(180deg,color-mix(in oklab,var(--brand-background) 24%,transparent),color-mix(in oklab,var(--brand-background) 94%,transparent)); }
  .media-device .pl-media img, .media-device .pl-media video { background:var(--brand-background); }
  .ml-ambient { position:absolute; pointer-events:none; left:-15%; top:-30%; width:90%; height:90%; border-radius:50%; background:radial-gradient(ellipse,color-mix(in oklab,var(--accent) 38%,transparent),transparent 68%); }
`;
