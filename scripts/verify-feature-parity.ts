/**
 * Feature parity guard (roadmap F10).
 *
 * `docs/FEATURES.md` lists every page, REST route, MCP tool and MCP resource
 * the app offers. This script compares that inventory with the code:
 *
 *   - listed but missing in code  -> a capability was removed or renamed: FAIL
 *   - present in code, not listed -> inventory is out of date: FAIL
 *   - every route module must load and export a function per HTTP method,
 *     every MCP tool must register with a handler and input schema
 *
 * Removing or hiding a capability needs a maintainer decision recorded in an
 * issue; the PR then edits `docs/FEATURES.md` and says so in its title.
 *
 * Usage:
 *   npm run test:parity          check
 *   npm run test:parity -- --print   print the code inventory as Markdown rows
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const FEATURES = path.join(ROOT, "docs", "FEATURES.md");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const DISPOSITIONS = new Set([
  "keep as is",
  "keep and simplify the entry point",
  "keep behind Pro mode",
]);

function walk(dir: string, file: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, file));
    else if (entry.name === file) out.push(full);
  }
  return out.sort();
}

function urlPath(appDir: string, file: string): string {
  const dir = path.relative(appDir, path.dirname(file)).split(path.sep);
  const segments = dir.filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + segments.join("/");
}

/** Pages: `/editor/[scriptId]` etc. */
export function codePages(): string[] {
  const appDir = path.join(ROOT, "src", "app");
  return walk(appDir, "page.tsx").map((f) => urlPath(appDir, f));
}

/** HTTP handlers as `METHOD /path` (REST API and media), with the file for loading checks. */
export function codeRoutes(): { id: string; file: string; method: string }[] {
  const appDir = path.join(ROOT, "src", "app");
  const routes: { id: string; file: string; method: string }[] = [];
  for (const file of walk(appDir, "route.ts")) {
    const text = readFileSync(file, "utf8");
    for (const method of METHODS) {
      const exported = new RegExp(
        `export\\s+(?:async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`,
      );
      if (exported.test(text)) {
        routes.push({ id: `${method} ${urlPath(appDir, file)}`, file, method });
      }
    }
  }
  return routes;
}

interface Registered {
  tools: Map<string, { hasHandler: boolean }>;
  resources: Set<string>;
}

/** Register the real MCP tools against a recorder, no network or token needed. */
export async function codeMcp(): Promise<Registered> {
  const tools = new Map<string, { hasHandler: boolean }>();
  const resources = new Set<string>();
  const recorder = {
    registerTool(name: string, config: unknown, handler: unknown) {
      if (tools.has(name)) throw new Error(`Duplicate MCP tool ${name}`);
      const ok =
        typeof handler === "function" &&
        typeof config === "object" &&
        config !== null;
      tools.set(name, { hasHandler: ok });
    },
    registerResource(_name: string, uri: unknown) {
      resources.add(String(uri));
    },
  };
  const { registerTools } = await import(
    pathToFileURL(path.join(ROOT, "mcp", "src", "tools.ts")).href
  );
  const { registerResources } = await import(
    pathToFileURL(path.join(ROOT, "mcp", "src", "resources.ts")).href
  );
  registerTools(recorder);
  registerResources(recorder);
  return { tools, resources };
}

interface Inventory {
  capabilities: Map<string, { disposition: string; tests: string[] }>;
  pages: Map<string, string>;
  routes: Map<string, string>;
  tools: Map<string, string>;
  resources: Map<string, string>;
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

/** Parse the machine-readable tables in docs/FEATURES.md. */
export function parseFeatures(markdown: string): Inventory {
  const inv: Inventory = {
    capabilities: new Map(),
    pages: new Map(),
    routes: new Map(),
    tools: new Map(),
    resources: new Map(),
  };
  let section = "";
  for (const line of markdown.split("\n")) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      section = heading[1]!.trim();
      continue;
    }
    if (!line.startsWith("|") || /^\|\s*-/.test(line)) continue;
    const c = cells(line);
    const first = c[0]?.replace(/^`|`$/g, "") ?? "";
    if (section === "Capabilities" && /^[A-Z]{2,4}\d{2}$/.test(first)) {
      const tests = [...(c[6] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
      inv.capabilities.set(first, { disposition: c[7] ?? "", tests });
    } else if (section === "Pages" && first.startsWith("/")) {
      inv.pages.set(first, c[1] ?? "");
    } else if (section === "REST routes" && /^[A-Z]+ \//.test(first)) {
      inv.routes.set(first, c[1] ?? "");
    } else if (section === "MCP tools" && /^[a-z][a-z0-9_]+$/.test(first)) {
      inv.tools.set(first, c[1] ?? "");
    } else if (section === "MCP resources" && first.startsWith("reel://")) {
      inv.resources.set(first, c[1] ?? "");
    }
  }
  return inv;
}

function diff(
  label: string,
  listed: Iterable<string>,
  actual: Iterable<string>,
  problems: string[],
): void {
  const a = new Set(actual);
  const l = new Set(listed);
  for (const id of l) {
    if (!a.has(id)) {
      problems.push(
        `${label} \`${id}\` is listed in docs/FEATURES.md but no longer exists in code (removed or renamed without a recorded decision)`,
      );
    }
  }
  for (const id of a) {
    if (!l.has(id)) {
      problems.push(
        `${label} \`${id}\` exists in code but is missing from docs/FEATURES.md (add a row)`,
      );
    }
  }
}

async function main(): Promise<void> {
  const pages = codePages();
  const routes = codeRoutes();
  const mcp = await codeMcp();

  if (process.argv.includes("--print")) {
    console.log("## Pages");
    for (const p of pages) console.log(`| \`${p}\` | |`);
    console.log("\n## REST routes");
    for (const r of routes) console.log(`| \`${r.id}\` | |`);
    console.log("\n## MCP tools");
    for (const t of mcp.tools.keys()) console.log(`| \`${t}\` | |`);
    console.log("\n## MCP resources");
    for (const r of mcp.resources) console.log(`| \`${r}\` | |`);
    return;
  }

  const problems: string[] = [];
  if (!existsSync(FEATURES)) {
    throw new Error("docs/FEATURES.md is missing");
  }
  const inv = parseFeatures(readFileSync(FEATURES, "utf8"));

  diff("Page", inv.pages.keys(), pages, problems);
  diff(
    "REST route",
    inv.routes.keys(),
    routes.map((r) => r.id),
    problems,
  );
  diff("MCP tool", inv.tools.keys(), mcp.tools.keys(), problems);
  diff("MCP resource", inv.resources.keys(), mcp.resources, problems);

  for (const [group, map] of [
    ["Page", inv.pages],
    ["REST route", inv.routes],
    ["MCP tool", inv.tools],
    ["MCP resource", inv.resources],
  ] as const) {
    for (const [id, capability] of map) {
      if (!inv.capabilities.has(capability)) {
        problems.push(
          `${group} \`${id}\` points at unknown capability \`${capability}\``,
        );
      }
    }
  }
  for (const [id, row] of inv.capabilities) {
    if (!DISPOSITIONS.has(row.disposition)) {
      problems.push(
        `Capability ${id} has disposition "${row.disposition}"; allowed: ${[...DISPOSITIONS].join("; ")}`,
      );
    }
    for (const test of row.tests) {
      if (!existsSync(path.join(ROOT, test))) {
        problems.push(`Capability ${id} cites missing test file ${test}`);
      }
    }
  }

  // "Responds": every route module loads and exports a handler function, and
  // every MCP tool registered a handler.
  for (const route of routes) {
    try {
      const mod = (await import(pathToFileURL(route.file).href)) as Record<
        string,
        unknown
      >;
      if (typeof mod[route.method] !== "function") {
        problems.push(`${route.id} does not export a handler function`);
      }
    } catch (error) {
      problems.push(
        `${route.id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  for (const [name, tool] of mcp.tools) {
    if (!tool.hasHandler) problems.push(`MCP tool ${name} has no handler`);
  }

  if (problems.length > 0) {
    console.error(`Feature parity FAILED (${problems.length} problems):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `Feature parity OK: ${inv.capabilities.size} capabilities, ${pages.length} pages, ${routes.length} REST handlers, ${mcp.tools.size} MCP tools, ${mcp.resources.size} MCP resources.`,
  );
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
