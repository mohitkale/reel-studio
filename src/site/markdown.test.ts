import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { escapeHtml, renderInline, renderMarkdown, slugify } from "./markdown";

describe("inline", () => {
  it("renders code, bold, italic and links, and escapes everything else", () => {
    expect(renderInline("a **b** and *c* with `x < y` and [d](e.md)")).toBe(
      'a <strong>b</strong> and <em>c</em> with <code>x &lt; y</code> and <a href="e.md">d</a>',
    );
    expect(renderInline("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("leaves emphasis markers inside code alone", () => {
    expect(renderInline("`a*b*c` and snake_case_name")).toBe(
      "<code>a*b*c</code> and snake_case_name",
    );
  });

  it("puts the link through the mapper, also for images", () => {
    const link = (href: string) => `/x/${href}`;
    expect(renderInline("[a](b.md) ![c](d.png)", { link })).toBe(
      '<a href="/x/b.md">a</a> <img src="/x/d.png" alt="c" loading="lazy">',
    );
  });

  it("does not let a quote break out of an attribute", () => {
    expect(renderInline('[a](b"onload="x)')).not.toContain('onload="x"');
  });
});

describe("blocks", () => {
  it("renders headings with unique ids", () => {
    const html = renderMarkdown("# One\n\n## Two\n\n## Two\n");
    expect(html).toContain('<h1 id="one">One</h1>');
    expect(html).toContain('id="two"');
    expect(html).toContain('id="two-2"');
  });

  it("renders fenced code verbatim and escaped", () => {
    expect(renderMarkdown('```json\n{ "a": "<b>" }\n```')).toBe(
      '<pre><code class="language-json">{ &quot;a&quot;: &quot;&lt;b&gt;&quot; }</code></pre>',
    );
  });

  it("renders tables with alignment", () => {
    const html = renderMarkdown("| a | b |\n| :-- | --: |\n| 1 | 2 |");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain('<th style="text-align:right">b</th>');
    expect(html).toContain("<td>1</td>");
  });

  it("renders nested and ordered lists", () => {
    const html = renderMarkdown("1. one\n2. two\n   - inner\n3. three");
    expect(html).toContain("<ol>");
    expect(html).toContain("<ul><li>inner</li></ul>");
    expect(html.match(/<li>/g)).toHaveLength(4);
  });

  it("slugifies like the headings it links to", () => {
    expect(slugify("Add it to your `client`")).toBe("add-it-to-your-client");
    expect(escapeHtml('"&')).toBe("&quot;&amp;");
  });
});

describe("the project guides", () => {
  const dir = path.resolve("docs");
  const guides = readdirSync(dir).filter((f) => f.endsWith(".md"));

  it.each(guides)("%s renders without leftover Markdown", (file) => {
    const html = renderMarkdown(readFileSync(path.join(dir, file), "utf8"));
    const text = html
      .replace(/<pre>[\s\S]*?<\/pre>/g, "")
      .replace(/<code>[\s\S]*?<\/code>/g, "");
    // No table rule rows, link syntax or heading marks left in the prose.
    expect(text).not.toMatch(/\|\s*:?-{3,}/);
    expect(text).not.toMatch(/\]\([^)]+\)/);
    expect(text).not.toMatch(/<p>#{1,6}\s/);
    expect(text).not.toMatch(/\*\*[^*]+\*\*/);
    // Every tag opened is closed.
    for (const tag of ["p", "ul", "ol", "li", "table", "blockquote", "pre"])
      expect(html.match(new RegExp(`<${tag}[ >]`, "g"))?.length ?? 0).toBe(
        html.match(new RegExp(`</${tag}>`, "g"))?.length ?? 0,
      );
  });
});
