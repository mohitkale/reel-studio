/** Capture after Chrome has painted the seek, so two visits to a seam use the
 * same composited surface. HyperFrames' virtual clock exposes native callbacks
 * for this screenshot capture path. Keep moving background shapes on stable
 * layers when a scoped page omits other scenes. */
export const HYPERFRAMES_PAINT_BARRIER = `<style>.fx-deco i{will-change:transform}</style>
<script>
window.addEventListener("load", function () {
  const previous = window.__hfWaitForSeekCompletion;
  const clock = window.__HF_VIRTUAL_TIME__;
  window.__hfWaitForSeekCompletion = async function () {
    await previous?.();
    if (!clock?.originalRequestAnimationFrame) {
      throw new Error("Selective rendering needs a native browser paint clock.");
    }
    document.documentElement.getBoundingClientRect();
    await new Promise((resolve, reject) => {
      const timer = clock.originalSetTimeout(() => {
        reject(new Error("The browser did not paint the selective render frame."));
      }, 1000);
      clock.originalRequestAnimationFrame(() => clock.originalRequestAnimationFrame(() => {
        clock.originalClearTimeout(timer);
        resolve();
      }));
    });
  };
});
</script>`;
