/** Measure complete authored lines after shared fonts settle, independently of
 * animation seeks. Keep all copy; expose a warning when the fit becomes small. */
export function buildTextFitScript(): string {
  return `<script>
(function () {
  function fitText() {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    if (!context) return;
    document.querySelectorAll('.fx-stack').forEach(function (stack) {
      var stage = stack.closest('.fx-stage');
      var lines = Array.from(stack.querySelectorAll('.fx-line-inner'));
      if (!stage || !lines.length || !stack.clientWidth) return;
      var width = stack.clientWidth * 0.96;
      var height = stage.clientHeight * 0.62;
      var stackStyle = getComputedStyle(stack);
      var widest = 0;
      var totalHeight = stack.offsetHeight;
      var sizes = lines.map(function (line) {
        var style = getComputedStyle(line);
        var size = parseFloat(style.fontSize);
        var textWidth = 0;
        // Emphasis can use another weight. Measure each actual styled text run.
        function measure(node) {
          if (node.nodeType === 3) {
            var run = getComputedStyle(node.parentElement);
            var text = node.textContent || '';
            if (run.textTransform === 'uppercase') text = text.toUpperCase();
            if (run.textTransform === 'lowercase') text = text.toLowerCase();
            context.font = run.fontStyle + ' ' + run.fontWeight + ' ' + run.fontSize + ' ' + run.fontFamily;
            textWidth += context.measureText(text).width + (parseFloat(run.letterSpacing) || 0) * text.length;
          } else Array.from(node.childNodes).forEach(measure);
        }
        measure(line);
        widest = Math.max(widest, textWidth + (parseFloat(style.paddingRight) || 0));
        return { inner: size, outer: parseFloat(getComputedStyle(line.parentElement).fontSize) };
      });
      var scale = Math.min(1, width / Math.max(1, widest), height / Math.max(1, totalHeight));
      stack.style.fontSize = (parseFloat(stackStyle.fontSize) * scale).toFixed(3) + 'px';
      lines.forEach(function (line, index) {
        line.style.fontSize = (sizes[index].inner * scale).toFixed(3) + 'px';
        line.parentElement.style.fontSize = (sizes[index].outer * scale).toFixed(3) + 'px';
      });
      stack.dataset.textFitScale = scale.toFixed(3);
      if (Math.min.apply(null, sizes.map(function (size) { return size.inner * scale; })) < 22)
        stack.dataset.textFitWarning = 'Split this copy into shorter scenes for readable text.';
    });
  }
  if (document.fonts) document.fonts.ready.then(fitText); else fitText();
})();
</script>`;
}
