/**
 * Per-type arrangements (roadmap V11b).
 *
 * `data-arrange="1|2|3"` on a scene (chosen by the variety engine) re-arranges
 * that scene type's own content: a list is rows, a stair, or hairline rows; a
 * comparison stacks, staggers, or favours one side; a quote sits left, centred
 * or behind a rule. Arrangement 1 is each type's classic design and needs no
 * CSS. Rules only touch alignment, order, spacing, borders and fills, never
 * transforms, because the entrance animations own those.
 */
const H = "var(--frame-h, 1920px)";
const px = (k: number) => `calc(${H} * ${k} * var(--sc-scale, 1))`;
const A2 = '.scene[data-arrange="2"]';
const A3 = '.scene[data-arrange="3"]';

export const ARRANGEMENT_STYLES = `
  /* —— lists: rows (1), a stair (2), hairline rows (3) —— */
  ${A2} .sc-step:nth-child(2), ${A2} .sc-check:nth-child(2), ${A2} .fx-check-item:nth-child(2) { margin-left: ${px(0.02)}; }
  ${A2} .sc-step:nth-child(3), ${A2} .sc-check:nth-child(3), ${A2} .fx-check-item:nth-child(3) { margin-left: ${px(0.04)}; }
  ${A2} .sc-step:nth-child(4), ${A2} .sc-check:nth-child(4), ${A2} .fx-check-item:nth-child(4) { margin-left: ${px(0.06)}; }
  ${A2} .sc-step:nth-child(5), ${A2} .sc-check:nth-child(5), ${A2} .fx-check-item:nth-child(5) { margin-left: ${px(0.04)}; }
  ${A2} .sc-step:nth-child(6), ${A2} .sc-check:nth-child(6), ${A2} .fx-check-item:nth-child(6) { margin-left: ${px(0.02)}; }
  ${A2} .sc-step-num { border-radius: ${px(0.012)}; }
  ${A3} .fx-check-item, ${A3} .sc-step, ${A3} .sc-check { flex-direction: row-reverse; justify-content: space-between; background: none; border: 0; border-bottom: 2px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 0; padding: ${px(0.008)} 0; }
  ${A3} .fx-check-num { font-size: 1.4em; opacity: .9; }
  ${A3} .sc-step-num { width: auto; height: auto; background: none !important; color: var(--fx-c, currentColor) !important; font-size: ${px(0.044)}; line-height: 1; border-radius: 0; }
  ${A3} .sc-tick { border-radius: 50%; }

  /* —— timeline: rail left (1), rail right (2), cards (3) —— */
  ${A2} .sc-timeline { box-sizing: border-box; border-left: 0; border-right: 3px solid color-mix(in srgb, currentColor 25%, transparent); padding: 0 ${px(0.026)} 0 0; text-align: right; }
  ${A2} .sc-moment { padding-left: 0; padding-right: ${px(0.03)}; }
  ${A2} .sc-dot { left: auto; right: ${px(-0.0205)}; }
  ${A3} .sc-timeline { box-sizing: border-box; border-left: 0; padding-left: 0; }
  ${A3} .sc-moment { padding: ${px(0.012)} ${px(0.02)}; border: 2px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: ${px(0.014)}; background: color-mix(in srgb, currentColor 6%, transparent); }
  ${A3} .sc-dot { display: none; }

  /* —— comparison and before/after: stacked (1), staggered (2), one side leads (3) —— */
  ${A2} .sc-compare .sc-card:first-child { margin-right: 14%; }
  ${A2} .sc-compare .sc-card:last-child { margin-left: 14%; }
  ${A2} .sc-card { border-radius: ${px(0.03)} ${px(0.006)} ${px(0.03)} ${px(0.006)}; }
  ${A3} .sc-compare .sc-card:first-child { opacity: .72; border-style: dashed; background: none; }
  ${A3} .sc-compare .sc-card:last-child { border-width: ${px(0.005)}; background: color-mix(in srgb, var(--fx-c, currentColor) 20%, transparent); }

  /* —— definition: left (1), centred (2), term in a rule (3) —— */
  ${A2} .sc-define { text-align: center; justify-items: center; }
  ${A2} .sc-define-kicker { justify-self: center; align-self: center; }
  ${A3} .sc-define-term { border-left: ${px(0.012)} solid var(--fx-c, currentColor); padding-left: ${px(0.022)}; }
  ${A3} .sc-define-meaning { padding-left: ${px(0.034)}; opacity: .92; }

  /* —— terminal: dark (1), light window (2), glowing (3) —— */
  ${A2} .sc-term { background: #f6f7fb; border-color: #d4d8e3; }
  ${A2} .sc-term-bar { background: #e6e9f2; color: #1b2030; }
  ${A2} .sc-term-body { color: #1b2030; }
  ${A2} .sc-term-line.sc-out { color: #4b5368 !important; }
  ${A2} .sc-term-line.sc-cmd { color: #0b6bcb !important; }
  ${A3} .sc-term { border-color: var(--fx-c, #7dd3fc); box-shadow: 0 0 0 ${px(0.004)} var(--fx-c, #7dd3fc), 0 0 ${px(0.05)} color-mix(in srgb, var(--fx-c, #7dd3fc) 55%, transparent); }
  ${A3} .sc-term-bar { background: color-mix(in srgb, var(--fx-c, #7dd3fc) 22%, #0a0d14); }

  /* —— diagram: boxes (1), pills (2), staircase (3) —— */
  ${A2} .sc-node { border-radius: 999px; padding-left: ${px(0.03)}; padding-right: ${px(0.03)}; background: color-mix(in srgb, var(--fx-c, currentColor) 18%, transparent); }
  ${A3} .sc-node:nth-of-type(even) { margin-left: 14%; }
  ${A3} .sc-node:nth-of-type(odd) { margin-right: 14%; }
  ${A3} .sc-node { text-align: left; border-width: 0 0 0 ${px(0.008)}; border-radius: ${px(0.006)}; }

  /* —— picture scenes: picture first (1), copy first (2), framed picture (3) —— */
  ${A2} .sc-split-copy, ${A2} .sc-device-copy { order: -1; }
  ${A3} .sc-media-art { border: ${px(0.006)} solid var(--fx-c, currentColor); border-radius: ${px(0.03)}; }
  ${A3} .sc-phone { box-shadow: 0 0 0 ${px(0.006)} var(--fx-c, currentColor), 0 0 ${px(0.05)} color-mix(in srgb, var(--fx-c, currentColor) 50%, transparent); }
  @container (max-aspect-ratio: 4 / 3) {
    ${A2} .sc-split { grid-template-rows: auto minmax(0, 1fr); }
  }
  @container (max-aspect-ratio: 9 / 10) {
    ${A2} .sc-device { grid-template-rows: auto minmax(0, 1fr); }
  }
  @container (min-aspect-ratio: 4 / 3) {
    ${A2} .sc-split .sc-media-art, ${A2} .sc-device .sc-phone { order: -2; }
    ${A2} .sc-split-copy, ${A2} .sc-device-copy { order: 1; }
    ${A3} .sc-split .sc-media-art { order: 2; }
  }

  /* —— kinetic type: centred (1), left (2), right (3) —— */
  ${A2} .sc-kinetic { align-items: flex-start; }
  ${A2} .kinetic-stack, ${A2} .kinetic-stack .fx-line { text-align: left; align-items: flex-start; justify-content: flex-start; }
  ${A3} .sc-kinetic { align-items: flex-end; }
  ${A3} .kinetic-stack, ${A3} .kinetic-stack .fx-line { text-align: right; align-items: flex-end; justify-content: flex-end; }

  /* —— statement: centred, rule below (1), left with a bar (2), rule above (3) —— */
  ${A2} .fx-dlg-statement { align-items: flex-start; text-align: left; }
  ${A2} .fx-dlg-statement .fx-stack { align-items: flex-start; text-align: left; }
  ${A2} .fx-dlg-statement .fx-rule { display: none; }
  ${A2} .fx-dlg-statement .statement-stack { position: relative; }
  ${A2} .fx-dlg-statement .statement-stack::before { content: ""; position: absolute; left: ${px(-0.024)}; top: 0; bottom: 0; width: ${px(0.012)}; background: var(--fx-c, currentColor); }
  ${A3} .fx-dlg-statement .fx-icon-badge { order: -2; }
  ${A3} .fx-dlg-statement .fx-rule { order: -1; margin-bottom: ${px(0.02)}; }

  /* —— quote: left (1), centred (2), ruled (3) —— */
  ${A2} .fx-dlg-quote { align-items: center !important; text-align: center; }
  ${A2} .fx-dlg-quote .fx-stack { align-items: center; text-align: center; }
  ${A3} .fx-dlg-quote .quote-stack { position: relative; }
  ${A3} .fx-dlg-quote .quote-stack::before { content: ""; position: absolute; left: ${px(-0.024)}; top: 0; bottom: 0; width: ${px(0.01)}; background: var(--fx-c, currentColor); }
  ${A3} .fx-dlg-quote .fx-qmark { font-size: 0.7em; margin-bottom: 0; }

  /* —— stat: number first (1), left aligned (2), label first (3) —— */
  ${A2} .fx-dlg-stat { align-items: flex-start; text-align: left; }
  ${A2} .fx-dlg-stat .fx-stack { align-items: flex-start; text-align: left; }
  ${A3} .fx-dlg-stat .fx-icon-badge { order: -3; }
  ${A3} .fx-dlg-stat .fx-stack { order: -2; margin-bottom: ${px(0.012)}; }
  ${A3} .fx-dlg-stat .fx-money-num { order: -1; }

  /* —— call to action: text then button (1), button first (2), left aligned (3) —— */
  ${A2} .fx-dlg-cta .fx-cta-btn { order: -1; margin-bottom: ${px(0.02)}; }
  ${A3} .fx-dlg-cta { align-items: flex-start; text-align: left; }
  ${A3} .fx-dlg-cta .fx-stack { align-items: flex-start; text-align: left; }

  /* —— opener and b-roll plates: left (1), right (2), centred with a top edge (3) —— */
  ${A2} .fx-lt-plate { text-align: right; align-items: flex-end !important; border-left: 0; border-right: 6px solid var(--accent, var(--fx-c)); border-radius: 28px 4px 4px 28px; }
  ${A2} .fx-lt-plate .fx-stack, ${A2} .fx-lt-plate .fx-line { text-align: right; align-items: flex-end; }
  ${A3} .fx-lt-plate { text-align: center; align-items: center !important; border-left: 0; border-top: 6px solid var(--accent, var(--fx-c)); border-radius: 4px 4px 28px 28px; }
  ${A3} .fx-lt-plate .fx-stack, ${A3} .fx-lt-plate .fx-line { text-align: center; align-items: center; }

  /* —— chart: title above (1), title below (2), left aligned header (3) —— */
  ${A2} .fx-dlg-chart .fx-chart-title { order: 5; margin-top: ${px(0.012)}; }
  ${A3} .fx-dlg-chart .fx-chart-title, ${A3} .fx-dlg-chart .fx-chart-line { text-align: left; }
  ${A3} .fx-dlg-chart .fx-chart-title { border-left: ${px(0.008)} solid var(--fx-c, currentColor); padding-left: ${px(0.016)}; }

  /* —— hook slam: centred (1), left (2), bottom (3) —— */
  ${A2} .fx-content-slam { align-items: flex-start; text-align: left; }
  ${A2} .fx-content-slam .slam-stack, ${A2} .fx-content-slam .fx-line { text-align: left; align-items: flex-start; }
  ${A3} .fx-content-slam { justify-content: flex-end; padding-bottom: 24%; }
`;
