#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

import { engineHome } from "../../src/server/local-engine";
import { BASE_URL, connectEngine } from "./client.js";
import { ensureEngine } from "./engine.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { SERVER_INSTRUCTIONS } from "./storyboard-resources.js";

/** The server version comes from package.json. */
function packageVersion(): string {
  try {
    return (
      (
        JSON.parse(
          readFileSync(
            path.resolve(import.meta.dirname, "..", "..", "package.json"),
            "utf8",
          ),
        ) as { version?: string }
      ).version ?? "0.0.0"
    );
  } catch {
    return "0.0.0";
  }
}

/**
 * Reel Studio MCP server (stdio).
 *
 * Lets external AI tools (Claude Code, Cursor) build and edit storyboards and
 * audio-only podcasts in the running Reel Studio app: create projects/podcasts,
 * edit scenes or dialogue, AI-generate plans, create voice/podcast takes, and
 * request durable single or batch video, audio, podcast, and audiogram
 * productions. It NEVER
 * deletes content or changes configuration/secrets. Legacy tokens keep the
 * human render gate; named scoped tokens may opt into bounded unattended renders.
 *
 * Auth: presents REEL_STUDIO_MCP_TOKEN as a bearer token to the REST API.
 */
async function main(): Promise<void> {
  const log = (line: string) => {
    // stdout is the MCP channel; every log line goes to stderr and the log file.
    console.error(`[reel-studio-mcp] ${line}`);
    try {
      appendFileSync(
        path.join(engineHome(), "mcp.log"),
        `${new Date().toISOString()} ${line}\n`,
      );
    } catch {
      // logging must never stop the server
    }
  };

  // A token means a remote or shared studio: use it as before. Without one the
  // engine on this computer is found or started, and the per-install secret
  // authenticates this local client.
  if (!process.env.REEL_STUDIO_MCP_TOKEN) {
    try {
      connectEngine(await ensureEngine(log));
    } catch (error) {
      log(
        `cannot reach a studio engine: ${error instanceof Error ? error.message : error}`,
      );
      process.exit(1);
    }
  }

  const server = new McpServer(
    { name: "reel-studio", version: packageVersion() },
    { instructions: SERVER_INSTRUCTIONS },
  );

  registerTools(server);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(`connected (API base: ${BASE_URL})`);
}

main().catch((err) => {
  console.error("[reel-studio-mcp] fatal:", err);
  process.exit(1);
});
