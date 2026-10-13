/** Measure complete authored lines after shared fonts settle, independently of
 * animation seeks. Keep all copy; expose a warning when the fit becomes small. */
export function buildTextFitScript(): string {
  return `<script>
(function () {
  function fitText() {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    if (!context) return;
    document.querySelectorAll('[data-graph-text]').forEach(function (element) {
      var initial = Number(element.dataset.graphFontSize);
      var span = element.firstElementChild;
      if (!span || !initial) return;
      element.style.fontSize = initial + 'px';
      for (var i = 0; i < 60; i++) {
        var range = document.createRange(); range.selectNodeContents(span);
        var bounds = range.getBoundingClientRect();
        var box = element.getBoundingClientRect();
        if (bounds.width <= box.width * .98 && bounds.height <= box.height * .95) break;
        element.style.fontSize = Math.max(8, initial * Math.pow(.95, i + 1)) + 'px';
      }
      if (parseFloat(element.style.fontSize) < 22)
        element.dataset.textFitWarning = 'Split this copy into shorter scenes for readable text.';
    });
    // Fit curated design blocks before render seeks. offset/client metrics are
    // independent of GSAP transforms, so reverse seeking cannot change typography.
    document.querySelectorAll('[data-design-block],[data-semantic-block]').forEach(function (stage) {
      var container = stage.querySelector('.am-spread,.am-poster,.am-window,.am-list-content,.am-ledger-content,.am-gallery-content,.sg-frame');
      if (!container) return;
      var text = Array.from(container.querySelectorAll('.fx-line-inner,.am-item-copy,.am-value,.am-cell-label,.am-source,.sg-headline,.sg-label,.sg-detail'));
      var sizes = text.map(function (el) { return parseFloat(getComputedStyle(el).fontSize); });
      var layout = getComputedStyle(container);
      function fits() {
        var height = container.clientHeight - parseFloat(layout.paddingTop || 0) - parseFloat(layout.paddingBottom || 0);
        var children = Array.from(container.children).filter(function (el) { return getComputedStyle(el).position !== 'absolute'; });
        var gap = parseFloat(layout.rowGap) || 0;
        var total = children.reduce(function (sum, el) { return sum + el.offsetHeight; }, 0) + gap * Math.max(0, children.length - 1);
        if (container.classList.contains('am-spread')) {
          total = children[0].offsetHeight + Math.max(children[1].offsetHeight, children[2].offsetHeight) + children[3].offsetHeight + gap * 2;
        } else if (container.classList.contains('am-gallery-content') && layout.flexDirection === 'row') {
          total = Math.max.apply(null, children.map(function (el) { return el.offsetHeight; }));
        }
        var semantic = container.querySelector('.sg-visual');
        var semanticFits = !semantic || Array.from(semantic.querySelectorAll('.sg-node')).every(function (node) {
          var style = getComputedStyle(node);
          var parts = Array.from(node.children).filter(function (el) { return getComputedStyle(el).position !== 'absolute'; });
          var padding = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);
          var heights = parts.map(function (el) { return el.offsetHeight === undefined ? el.clientHeight : el.offsetHeight; });
          var contentHeight = style.flexDirection === 'column' ? heights.reduce(function (a,b) { return a+b; },0) + (parseFloat(style.rowGap) || 0) * Math.max(0,parts.length-1) : Math.max.apply(null,heights);
          return contentHeight <= node.clientHeight - padding + 1;
        });
        return total <= height + 1 && semanticFits && text.every(function (el) { return el.scrollWidth <= el.clientWidth + 1; });
      }
      for (var iteration = 1; iteration <= 32 && !fits(); iteration++) {
        text.forEach(function (el, index) { el.style.fontSize = Math.max(Math.min(sizes[index], el.classList.contains('am-source') ? 16 : 22), sizes[index] * Math.pow(.96, iteration)).toFixed(3) + 'px'; });
      }
      if (!fits()) stage.dataset.textFitWarning = 'Split this copy or list into shorter scenes for readable text.';
    });
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
