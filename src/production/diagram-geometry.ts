/** Stable SVG coordinates shared by both renderers. The first item is the core. */
export function orbitNodes(count: number): Array<{ x: number; y: number }> {
  const angles =
    count === 2 ? [-90, 90] : count === 3 ? [-90, 30, 150] : [-90, 0, 90, 180];
  return angles.map((angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: 500 + Math.cos(radians) * 320,
      y: 500 + Math.sin(radians) * 320,
    };
  });
}

export function diagramLabelLines(label: string): string[] {
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && `${line} ${word}`.length > 12) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2 && lines.every((part) => part.length <= 14))
    return lines;
  const compact = label.trim();
  return [compact.slice(0, 12).trim(), compact.slice(12).trim()];
}
