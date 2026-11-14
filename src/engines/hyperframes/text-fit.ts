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
    // Lists fill their region: grow the rows until the group nearly fills it.
    document.querySelectorAll('.fx-panelled .fx-dlg-list').forEach(function (box) {
      var items = Array.from(box.querySelectorAll('.fx-check-item'));
      var title = box.querySelector('.fx-list-title');
      var stage = box.closest('.fx-stage');
      if (!items.length || !stage) return;
      var itemBase = parseFloat(getComputedStyle(items[0]).fontSize);
      var titleBase = title ? parseFloat(getComputedStyle(title).fontSize) : 0;
      var cs = getComputedStyle(box);
      var availH = box.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      var availW = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      var list = box.querySelector('.fx-check-list');
      function apply(v) {
        items.forEach(function (item) { item.style.fontSize = (itemBase * v).toFixed(2) + 'px'; });
        if (title) title.style.fontSize = (titleBase * v).toFixed(2) + 'px';
        if (list) list.style.gap = (stage.clientHeight * 0.012 * v).toFixed(2) + 'px';
      }
      function used() {
        var h = 0;
        Array.from(box.children).forEach(function (c) { h += c.offsetHeight; });
        return { h: h, w: Math.max.apply(null, Array.from(box.children).map(function (c) { return c.scrollWidth; })) };
      }
      var cap = Math.max(1, (stage.clientHeight * 0.06) / itemBase);
      var v = 1;
      apply(v);
      while (v < cap) {
        var next = Math.min(cap, v * 1.05);
        apply(next);
        var u = used();
        if (u.h > availH * 0.94 || u.w > availW + 1) { apply(v); break; }
        v = next;
      }
    });
    // Registered scene types size everything from one scale variable: grow it
    // until the content fills its panel, or shrink it until it fits.
    document.querySelectorAll('.fx-panelled .fx-dialogue[data-sc-grow]').forEach(function (box) {
      var cs = getComputedStyle(box);
      var availH = box.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
      var availW = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      function used() {
        var h = 0, w = 0;
        Array.from(box.children).forEach(function (c) { h += c.offsetHeight; w = Math.max(w, c.scrollWidth); });
        return { h: h, w: w };
      }
      function over() { var u = used(); return u.h > availH * 0.94 || u.w > availW + 1; }
      var v = 1;
      box.style.setProperty('--sc-scale', '1');
      if (over()) {
        while (v > 0.5 && over()) { v *= 0.95; box.style.setProperty('--sc-scale', v.toFixed(3)); }
      } else {
        var cap = 2.2;
        while (v < cap) {
          var next = Math.min(cap, v * 1.05);
          box.style.setProperty('--sc-scale', next.toFixed(3));
          if (over()) { box.style.setProperty('--sc-scale', v.toFixed(3)); break; }
          v = next;
        }
      }
    });
    document.querySelectorAll('.fx-stack').forEach(function (stack) {
      var stage = stack.closest('.fx-stage');
      var lines = Array.from(stack.querySelectorAll('.fx-line-inner'));
      if (!stage || !lines.length || !stack.clientWidth) return;
      var width = stack.clientWidth * 0.96;
      // A scene's content lives in one region of the layout: fit to it.
      var box = stack.closest('.fx-panelled .fx-dialogue');
      var height = stage.clientHeight * 0.62;
      if (box) {
        var others = 0;
        Array.from(box.children).forEach(function (child) { if (!child.contains(stack) && child !== stack) others += child.offsetHeight; });
        height = Math.max(40, box.clientHeight * 0.84 - others);
        var share = parseFloat((stack.closest('[data-fit-share]') || document.body).getAttribute('data-fit-share'));
        if (share && stage.clientHeight >= stage.clientWidth * 0.9) height = box.clientHeight * share;
        var holder = stack.closest('.fx-lt-plate') || box;
        var inset = holder === box ? (parseFloat(getComputedStyle(box).paddingLeft) || 0) * 2 : (parseFloat(getComputedStyle(holder).paddingLeft) || 0) + (parseFloat(getComputedStyle(holder).paddingRight) || 0);
        width = (holder.clientWidth - inset) * 0.96;
        if (stack.parentElement && stack.parentElement !== holder && stack.parentElement !== box) width = Math.min(width, stack.parentElement.clientWidth * 0.96);
      }
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
      // Fit to the stage: shrink to fit, and grow (up to 14% of the frame height) so short copy fills the
      // frame, but never past the stage edges (offset metrics ignore animation transforms).
      var baseStack = parseFloat(stackStyle.fontSize);
      function apply(value) {
        stack.style.fontSize = (baseStack * value).toFixed(3) + 'px';
        lines.forEach(function (line, index) {
          line.style.fontSize = (sizes[index].inner * value).toFixed(3) + 'px';
          line.parentElement.style.fontSize = (sizes[index].outer * value).toFixed(3) + 'px';
        });
      }
      function leavesStage() {
        var top = 0, left = 0, node = stack;
        while (node && node !== stage) { top += node.offsetTop; left += node.offsetLeft; node = node.offsetParent; }
        if (node !== stage) return false;
        var vars = getComputedStyle(stage.closest('#root') || document.body);
        var px = function (name, fallback) { var v = parseFloat(vars.getPropertyValue(name)); return isFinite(v) ? v : fallback; };
        var safeL = px('--safe-left', stage.clientWidth * 0.04), safeR = px('--safe-right', stage.clientWidth * 0.04);
        var safeT = px('--safe-top', stage.clientHeight * 0.04), safeB = px('--safe-bottom', stage.clientHeight * 0.1);
        return top < safeT - 1 || top + stack.offsetHeight > stage.clientHeight - safeB + 1 ||
          left < safeL - 1 || left + stack.offsetWidth > stage.clientWidth - safeR + 1;
      }
      // Largest line may reach 14% of the frame height, however small the authored size.
      var growCap = Math.max(1, (stage.clientHeight * 0.14) / Math.max.apply(null, sizes.map(function (size) { return size.inner; })));
      var scale = Math.min(growCap, width / Math.max(1, widest), height / Math.max(1, totalHeight));
      apply(scale);
      for (var step = 0; scale > 1 && step < 16 && leavesStage(); step++) {
        scale = Math.max(1, scale * 0.92);
        apply(scale);
      }
      stack.dataset.textFitScale = scale.toFixed(3);
      if (Math.min.apply(null, sizes.map(function (size) { return size.inner * scale; })) < 22)
        stack.dataset.textFitWarning = 'Split this copy into shorter scenes for readable text.';
    });
  }
  if (document.fonts) document.fonts.ready.then(fitText); else fitText();
})();
</script>`;
}
