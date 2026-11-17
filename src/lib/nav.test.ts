import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isNavActive, proNavItems, simpleNavItems } from "@/lib/nav";

/** Pages not in the menu, and the screen that links to each (checked by hand in the PR). */
const REACHED_FROM: Record<string, string> = {
  "/examples": "Create (Or start from an example)",
  "/scenes": "Create (Browse scene types and looks)",
  "/diagnostics": "Settings (Run system check)",
};

function documentedPages(): string[] {
  const text = readFileSync(
    path.join(process.cwd(), "docs", "FEATURES.md"),
    "utf8",
  );
  const section = text.split("## Pages")[1]?.split("## REST routes")[0] ?? "";
  return [...section.matchAll(/^\| `(\/[^`]*)`/gm)]
    .map((m) => m[1])
    .filter((page) => !page.includes("["));
}

describe("navigation", () => {
  it("shows five destinations in Simple and all of them in Pro", () => {
    expect(simpleNavItems.map((i) => i.title)).toEqual([
      "Create",
      "Library",
      "Podcasts",
      "Brand",
      "Settings",
    ]);
    const pro = new Set(proNavItems.map((i) => i.href));
    for (const item of simpleNavItems) expect(pro.has(item.href)).toBe(true);
  });

  it("leaves no documented page unreachable in Pro", () => {
    const pro = new Set(proNavItems.map((i) => i.href));
    const missing = documentedPages().filter(
      (page) => !pro.has(page) && !(page in REACHED_FROM),
    );
    expect(missing).toEqual([]);
  });

  it("keeps Assets under Brand in Simple without lighting two items in Pro", () => {
    const active = (items: typeof proNavItems) =>
      items.filter((i) => isNavActive("/assets", i, items)).map((i) => i.title);
    expect(active(simpleNavItems)).toEqual(["Brand"]);
    expect(active(proNavItems)).toEqual(["Assets"]);
  });

  it("has no duplicate destinations", () => {
    const hrefs = proNavItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
