/**
 * A small Markdown to HTML renderer for the project's own guides (roadmap L3).
 * It covers what `docs/*.md` use: headings, paragraphs, nested lists, tables,
 * fenced code, block quotes, rules, and inline code, bold, italic, links and
 * images. Everything else is escaped, so a guide can never inject markup.
 */

export interface RenderOptions {
  /** Maps a link target found in the Markdown to the URL the page should use. */
  link?: (href: string) => string;
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (c) => ESCAPES[c]!);

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Inline Markdown. Code spans are lifted out first so nothing inside them is touched. */
export function renderInline(
  text: string,
  options: RenderOptions = {},
): string {
  const link = options.link ?? ((href) => href);
  const stash: string[] = [];
  const keep = (html: string) => `\u0000${stash.push(html) - 1}\u0000`;
  let out = text.replace(
    /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g,
    (_m, _t, code) => keep(`<code>${escapeHtml(code.trim())}</code>`),
  );
  out = escapeHtml(out);
  // Images, then links (the text of a link may hold emphasis or code).
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, alt, src) =>
      keep(`<img src="${escapeHtml(link(src))}" alt="${alt}" loading="lazy">`),
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_m, label, href) =>
      keep(
        `<a href="${escapeHtml(link(href.replace(/&amp;/g, "&")))}">${label}</a>`,
      ),
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?![\w*])/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^\w_])_([^_\s][^_]*)_(?![\w_])/g, "$1<em>$2</em>");
  // Restore, innermost first (a link label can itself hold a stashed code span).
  let previous: string;
  do {
    previous = out;
    out = out.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[Number(i)]!);
  } while (out !== previous);
  return out;
}

const isFence = (line: string) => /^\s*(```+|~~~+)/.exec(line);
const isTableRule = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.replace(/\\\|/g, "|").trim());
const listMarker = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function renderMarkdown(
  source: string,
  options: RenderOptions = {},
): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const inline = (text: string) => renderInline(text, options);
  const used = new Set<string>();
  const unique = (base: string) => {
    let id = base || "section";
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = isFence(line);
    if (fence) {
      const marker = fence[1]!;
      const lang =
        line.trim().slice(marker.length).trim().split(/\s+/)[0] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(marker)) {
        body.push(lines[i]!);
        i++;
      }
      i++;
      html.push(
        `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const id = unique(slugify(heading[2]!));
      html.push(`<h${level} id="${id}">${inline(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      html.push("<hr>");
      i++;
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      isTableRule(lines[i + 1]!)
    ) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]!).map((c) =>
        /^:-+:$/.test(c) ? "center" : /-:$/.test(c) ? "right" : "",
      );
      const cell = (tag: string, text: string, n: number) =>
        `<${tag}${align[n] ? ` style="text-align:${align[n]}"` : ""}>${inline(text)}</${tag}>`;
      const rows: string[] = [];
      i += 2;
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim()) {
        rows.push(
          `<tr>${splitRow(lines[i]!)
            .map((c, n) => cell("td", c, n))
            .join("")}</tr>`,
        );
        i++;
      }
      html.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c, n) => cell("th", c, n)).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`,
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) {
        quote.push(lines[i]!.replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push(
        `<blockquote>${renderMarkdown(quote.join("\n"), options)}</blockquote>`,
      );
      continue;
    }

    const marker = listMarker.exec(line);
    if (marker) {
      const base = marker[1]!.length;
      const ordered = /\d/.test(marker[2]!);
      const items: string[][] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const m = listMarker.exec(current);
        if (m && m[1]!.length <= base + 1 && m[1]!.length >= base) {
          items.push([m[3]!]);
          i++;
        } else if (!current.trim()) {
          // A blank line continues the list only when another item or an indented line follows.
          const next = lines[i + 1];
          if (
            next !== undefined &&
            (listMarker.test(next) || /^\s{2,}\S/.test(next))
          ) {
            i++;
          } else break;
        } else if (/^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1]!.push(current.trim());
          i++;
        } else if (
          items.length &&
          !isFence(current) &&
          !/^#{1,6}\s/.test(current)
        ) {
          // A wrapped line of the item above.
          items[items.length - 1]!.push(current.trim());
          i++;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(
        `<${tag}>${items
          .map((parts) => {
            // Nested list lines were indented; render them as a block under the item.
            const nestedAt = parts.findIndex(
              (p, n) => n > 0 && listMarker.test(p),
            );
            if (nestedAt > 0) {
              const text = parts.slice(0, nestedAt).join(" ");
              const nested = parts.slice(nestedAt).join("\n");
              return `<li>${inline(text)}${renderMarkdown(nested, options)}</li>`;
            }
            return `<li>${inline(parts.join(" "))}</li>`;
          })
          .join("")}</${tag}>`,
      );
      continue;
    }

    // A paragraph runs to the next blank line or block start.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !isFence(lines[i]!) &&
      !/^#{1,6}\s/.test(lines[i]!) &&
      !/^\s*>/.test(lines[i]!) &&
      !(para.length && listMarker.test(lines[i]!)) &&
      !(
        lines[i]!.includes("|") &&
        i + 1 < lines.length &&
        isTableRule(lines[i + 1]!)
      )
    ) {
      para.push(lines[i]!.trim());
      i++;
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return html.join("\n");
}
