// The only script on the site: a Copy button on every code block.
document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const code = button.parentElement.querySelector("code");
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = "Copied";
    } catch {
      // Clipboard access can be blocked; select the text so Ctrl+C works.
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = "Press Ctrl+C";
    }
    setTimeout(() => (button.textContent = "Copy"), 2000);
  });
});

// The hero video starts by itself only where that costs little: a wide screen, no
// reduced-motion or data-saver setting, and after the page has finished loading.
// Elsewhere it shows its poster and the player's own controls.
const hero = document.querySelector(".hero-video");
if (
  hero &&
  matchMedia("(min-width: 900px)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !(navigator.connection && navigator.connection.saveData)
) {
  window.addEventListener("load", () => {
    setTimeout(() => hero.play().catch(() => {}), 1500);
  });
}
