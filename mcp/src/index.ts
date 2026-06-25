#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { BASE_URL } from "./client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

/**
 * Reel Studio MCP server (stdio).
 *
 * Lets external AI tools (Claude Code, Cursor) build and edit storyboards in the
 * running Reel Studio app: create projects, add/edit/reorder scenes, AI-generate
 * scene plans in chunks, create voice takes, and request renders. It NEVER
 * deletes anything, never changes configuration/secrets, and rendering always
 * waits for explicit human approval in the web app.
 *
 * Auth: presents REEL_STUDIO_MCP_TOKEN as a bearer token to the REST API.
 */
async function main(): Promise<void> {
  if (!process.env.REEL_STUDIO_MCP_TOKEN) {
    console.error(
      "[reel-studio-mcp] REEL_STUDIO_MCP_TOKEN is not set. Generate a token in " +
        "Reel Studio → Settings → AI tools / MCP and pass it via the MCP server env.",
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "reel-studio",
    version: "0.1.0",
  });

  registerTools(server);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdout is the MCP channel — log to stderr only.
  console.error(`[reel-studio-mcp] connected (API base: ${BASE_URL})`);
}

main().catch((err) => {
  console.error("[reel-studio-mcp] fatal:", err);
  process.exit(1);
});
