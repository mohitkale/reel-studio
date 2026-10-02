import type { MotionShot } from "@/video/motion-spec";
import type { BrandTokens } from "@/video/tokens";

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The prototype accepts data only, never arbitrary CSS, JS, selectors or HTML. */
export function compileMotionShot(
  shot: MotionShot,
  tokens: BrandTokens,
  fps: number,
  start: number,
  duration: number,
  transitionClass: string,
): string | null {
  if (
    shot.layers.some((layer) =>
      layer.elements.some((element) => element.kind === "legacy-scene"),
    )
  )
    return null;
  const layers = [...shot.layers]
    .sort((a, b) => a.order - b.order)
    .map(
      (layer) =>
        `<div data-motion-layer="${escape(layer.id)}" style="position:absolute;inset:0;z-index:${layer.order}">${layer.elements
          .map((element) => {
            if (element.kind === "legacy-scene") return "";
            const box = element.box;
            const paint = escape(tokens[element.color]);
            const style = `position:absolute;box-sizing:border-box;left:${box.x * 100}%;top:${box.y * 100}%;width:${box.width * 100}%;height:${box.height * 100}%;`;
            const appearance =
              element.kind === "text"
                ? `color:${paint};font-size:${element.fontSize}px;text-align:${element.align};font-weight:700;line-height:1.1;overflow-wrap:anywhere;display:flex;align-items:center;justify-content:${element.align === "left" ? "flex-start" : element.align === "right" ? "flex-end" : "center"}`
                : `background:${paint};border-radius:${element.shape === "ellipse" ? "50%" : "0"}`;
            return `<div data-graph-element="${escape(element.id)}" data-graph-tracks="${escape(JSON.stringify(element.tracks))}" style="${style}${appearance}">${element.kind === "text" ? escape(element.text) : ""}</div>`;
          })
          .join("")}</div>`,
    )
    .join("");
  return `<section id="scene-${escape(shot.id)}" class="clip scene graph-scene ${transitionClass}" data-scene-id="${escape(shot.id)}" data-start="${start.toFixed(3)}" data-duration="${duration.toFixed(3)}" data-track-index="1"><div data-graph-shot="${escape(shot.id)}" data-graph-fps="${fps}" style="position:absolute;inset:0;background:${escape(tokens.background)}">${layers}</div></section>`;
}

/** Executed inside the existing native boot, before the shared root is assembled. */
export const GRAPH_TIMELINE_BOOT = `
    document.querySelectorAll('[data-graph-shot]').forEach(function(stage) {
      var scene = stage.closest('.scene');
      var fps = Number(stage.dataset.graphFps);
      var tl = gsap.timeline({ paused: true });
      stage.querySelectorAll('[data-graph-element]').forEach(function(element) {
        JSON.parse(element.dataset.graphTracks).forEach(function(track) {
          var keys = track.keyframes;
          var initial = {}; initial[track.property] = keys[0].value;
          tl.set(element, initial, 0);
          for (var i = 1; i < keys.length; i++) {
            var from = {}; from[track.property] = keys[i - 1].value;
            var to = { duration: (keys[i].frame - keys[i - 1].frame) / fps, ease: { linear: 'none', in: 'power2.in', out: 'power2.out', 'in-out': 'power2.inOut' }[keys[i].ease], immediateRender: false };
            to[track.property] = keys[i].value;
            tl.fromTo(element, from, to, keys[i - 1].frame / fps);
          }
        });
      });
      var duration = Number(scene.dataset.duration);
      tl.to({}, { duration: duration }, 0);
      window.__timelines[stage.dataset.graphShot] = tl;
      compositionTimelines.push({ timeline: tl, start: Number(scene.dataset.start), scene: scene, duration: duration });
    });
`;
