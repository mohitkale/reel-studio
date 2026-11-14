/**
 * CSS for the registered scene types. Sizes are fractions of the frame height
 * (`--frame-h`) so one rule serves every format; the stage is a size container
 * so landscape can lay rows out side by side.
 */
const H = "var(--frame-h, 1920px)";
const px = (k: number) => `calc(${H} * ${k} * var(--sc-scale, 1))`;

export const SCENE_STYLES = `
  .fx-panelled .fx-dialogue:has(> .sc-steps, > .sc-checks, > .sc-timeline) { align-items: stretch; text-align: left; justify-content: center; }
  .fx-panelled .fx-dialogue:has(> .sc-compare, > .sc-flow) { align-items: stretch; text-align: left; }
  .fx-list-title.sc-center { text-align: center; width: 100%; }
  .fx-rv { opacity: 1; }

  .sc-kinetic { width: 100%; display: flex; flex-direction: column; align-items: center; gap: ${px(0.02)}; }
  .kinetic-stack .fx-line { font-family: "Anton", Impact, sans-serif; font-weight: 400; font-size: clamp(70px, 12cqw, 170px); letter-spacing: 0.02em; line-height: 1.05; text-transform: uppercase; }
  .kinetic-stack .fx-line-inner { font-size: inherit; line-height: 1.05; font-family: inherit; font-weight: inherit; letter-spacing: inherit; }

  .sc-steps, .sc-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: ${px(0.018)}; width: 100%; }
  .sc-step, .sc-check { display: flex; align-items: center; gap: ${px(0.022)}; font-weight: 700; line-height: 1.22; font-size: ${px(0.036)}; }
  .sc-step-num { flex: none; width: ${px(0.058)}; height: ${px(0.058)}; border-radius: 50%; display: grid; place-items: center; font-size: ${px(0.034)}; font-weight: 900; }
  .sc-tick { flex: none; width: ${px(0.052)}; height: ${px(0.052)}; border-radius: ${px(0.012)}; border: 3px solid; display: grid; place-items: center; font-size: ${px(0.036)}; font-weight: 900; }

  .sc-compare { display: grid; grid-template-columns: 1fr; gap: ${px(0.014)}; align-items: stretch; width: 100%; }
  .sc-card { border: 2px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: ${px(0.018)}; padding: ${px(0.022)} ${px(0.026)}; background: color-mix(in srgb, currentColor 5%, transparent); }
  .sc-card-label { margin: 0 0 ${px(0.008)}; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; font-size: ${px(0.03)}; }
  .sc-card-text { margin: 0; font-weight: 700; line-height: 1.22; font-size: ${px(0.036)}; }
  .sc-vs, .sc-arrow { justify-self: center; align-self: center; font-weight: 900; }
  .sc-vs { padding: ${px(0.006)} ${px(0.018)}; border-radius: 999px; font-size: ${px(0.03)}; }
  .sc-arrow { font-size: ${px(0.06)}; line-height: 1; transform: rotate(90deg); }
  .sc-before { border-style: dashed; }
  .sc-after { background: color-mix(in srgb, currentColor 10%, transparent); }

  .sc-timeline { list-style: none; margin: 0; padding: 0 0 0 ${px(0.014)}; display: grid; gap: ${px(0.022)}; width: 100%; border-left: 3px solid color-mix(in srgb, currentColor 25%, transparent); }
  .sc-moment { position: relative; display: block; padding-left: ${px(0.03)}; }
  .sc-dot { position: absolute; left: ${px(-0.0205)}; top: ${px(0.012)}; width: ${px(0.022)}; height: ${px(0.022)}; border-radius: 50%; }
  .sc-moment-body { display: grid; gap: ${px(0.004)}; }
  .sc-moment-label { font-size: ${px(0.042)}; font-weight: 900; }
  .sc-moment-text { font-size: ${px(0.032)}; font-weight: 600; line-height: 1.25; }

  .sc-define { width: 100%; display: grid; gap: ${px(0.018)}; text-align: left; }
  .sc-define-kicker { margin: 0; padding: ${px(0.005)} ${px(0.014)}; border-radius: ${px(0.008)}; align-self: start; justify-self: start; font-size: ${px(0.03)}; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
  .sc-define-term { margin: 0; font-family: "Instrument Serif", Georgia, serif; font-size: ${px(0.09)}; line-height: 1; font-weight: 400; overflow-wrap: normal; word-break: normal; }
  .sc-define-meaning { margin: 0; font-size: ${px(0.04)}; font-weight: 600; line-height: 1.28; }

  .sc-term { width: 100%; height: 100%; display: flex; flex-direction: column; border-radius: ${px(0.016)}; overflow: hidden; background: #0a0d14; border: 2px solid color-mix(in srgb, #fff 16%, transparent); text-align: left; }
  .sc-term-bar { flex: none; display: flex; align-items: center; gap: ${px(0.008)}; padding: ${px(0.014)} ${px(0.018)}; background: #161b26; color: #fff; font-size: ${px(0.03)}; font-weight: 700; }
  .sc-term-bar i { width: ${px(0.016)}; height: ${px(0.016)}; border-radius: 50%; background: #ff5f57; }
  .sc-term-bar i:nth-child(2) { background: #febc2e; }
  .sc-term-bar i:nth-child(3) { background: #28c840; margin-right: ${px(0.01)}; }
  .sc-term-body { margin: 0; flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center; gap: ${px(0.008)}; padding: ${px(0.02)} ${px(0.022)}; font-family: "Geist Mono", "JetBrains Mono", ui-monospace, monospace; font-size: ${px(0.027)}; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
  .sc-term-line.sc-out { opacity: .78; }

  .sc-flow { display: grid; grid-template-columns: 1fr; gap: ${px(0.01)}; width: 100%; align-items: stretch; }
  .sc-node { border: 3px solid; border-radius: ${px(0.016)}; padding: ${px(0.012)} ${px(0.022)}; text-align: center; background: color-mix(in srgb, currentColor 6%, transparent); }
  .sc-node-label { margin: 0; font-weight: 900; font-size: ${px(0.036)}; line-height: 1.1; }
  .sc-node-text { margin: ${px(0.006)} 0 0; font-size: ${px(0.034)}; font-weight: 600; line-height: 1.25; opacity: .85; }
  .sc-flow-arrow { justify-self: center; font-size: ${px(0.04)}; line-height: 0.5; transform: rotate(90deg); font-weight: 900; }

  .sc-split, .sc-device { width: 100%; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: ${px(0.022)}; text-align: left; }
  .sc-split-copy, .sc-device-copy { min-width: 0; width: 100%; align-self: center; }
  .sc-media-art { border-radius: ${px(0.016)}; background-size: cover; background-position: center; min-height: 0; }
  .sc-media-none { background: linear-gradient(135deg, var(--a), color-mix(in srgb, var(--a) 25%, #0b0b12)); }
  .sc-caption { margin: ${px(0.012)} 0 0; font-size: ${px(0.028)}; font-weight: 600; opacity: .85; }
  .sc-device { justify-items: center; text-align: center; }
  .sc-phone { position: relative; height: 100%; aspect-ratio: 9 / 18; max-width: 56%; border-radius: ${px(0.034)}; border: ${px(0.007)} solid #1b1f2a; background: #05070d; overflow: hidden; box-shadow: 0 ${px(0.012)} ${px(0.04)} rgba(0,0,0,.45); }
  .sc-phone-notch { position: absolute; top: ${px(0.008)}; left: 50%; width: 28%; height: ${px(0.014)}; transform: translateX(-50%); border-radius: 999px; background: #1b1f2a; z-index: 2; }
  .sc-phone-art { position: absolute; inset: 0; background-size: cover; background-position: center; }
  .sc-phone-none { background: linear-gradient(160deg, color-mix(in srgb, var(--a) 55%, #05070d), #05070d); display: grid; place-items: center; font-weight: 800; font-size: ${px(0.036)}; text-align: center; padding: ${px(0.02)}; }

  @container (min-aspect-ratio: 4 / 3) {
    .sc-compare { grid-template-columns: 1fr auto 1fr; }
    .sc-arrow, .sc-flow-arrow { transform: none; }
    .sc-flow { grid-template-columns: repeat(var(--n, 3), 1fr); }
    .sc-flow:has(.sc-flow-arrow) { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: 1fr auto; }
    .sc-timeline { grid-template-columns: repeat(var(--n, 3), 1fr); border-left: 0; border-top: 3px solid color-mix(in srgb, currentColor 25%, transparent); padding: ${px(0.02)} 0 0; }
    .sc-dot { left: 0; top: ${px(-0.0125)}; }
    .sc-moment { padding-left: 0; padding-top: ${px(0.02)}; }
    .sc-define { grid-template-columns: 1fr 1.3fr; align-items: center; column-gap: ${px(0.05)}; }
    .sc-define-kicker, .sc-define .fx-rule { grid-column: 1 / -1; }
    .sc-define-term { grid-column: 1; grid-row: 2; }
    .sc-define-meaning { grid-column: 2; grid-row: 2; }
    .sc-split, .sc-device { grid-template-rows: none; grid-template-columns: 1fr 1fr; }
    .sc-device { justify-items: stretch; text-align: left; }
    .sc-phone { justify-self: center; }
  }
  @container (min-aspect-ratio: 9 / 10) and (max-aspect-ratio: 11 / 10) {
    .sc-device { grid-template-rows: none; grid-template-columns: 1fr 1.2fr; text-align: left; }
  }
`;

export const CHART_STYLES = `
  .fx-chart-svg { width: 100%; flex: 1 1 auto; min-height: 0; overflow: visible; }
  .fx-chart-svg text { font-family: inherit; font-weight: 700; fill: currentColor; }
  .fx-donut { display: flex; align-items: center; justify-content: center; gap: ${px(0.03)}; flex: 1 1 auto; min-height: 0; width: 100%; }
  .fx-donut svg { height: 100%; max-height: ${px(0.36)}; aspect-ratio: 1; flex: none; }
  .fx-donut-legend { list-style: none; margin: 0; padding: 0; display: grid; gap: ${px(0.012)}; font-size: ${px(0.03)}; font-weight: 700; text-align: left; }
  .fx-donut-legend i { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 3px; margin-right: 0.5em; vertical-align: -0.05em; }
`;
