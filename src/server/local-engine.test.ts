// @vitest-environment node
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizeRequest } from "@/server/auth";
import {
  engineHome,
  peekLocalSecret,
  readEngineInfo,
  readOrCreateLocalSecret,
  writeEngineInfo,
} from "@/server/local-engine";

let home: string;
beforeEach(() => {
  home = mkdtempSync(path.join(tmpdir(), "reel-home-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("local engine files", () => {
  it("creates one private secret and reuses it", () => {
    expect(peekLocalSecret(home)).toBeUndefined();
    const first = readOrCreateLocalSecret(home);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(readOrCreateLocalSecret(home)).toBe(first);
    expect(peekLocalSecret(home)).toBe(first);
    if (process.platform !== "win32")
      expect(statSync(path.join(home, "local-secret")).mode & 0o077).toBe(0);
  });

  it("replaces a secret that is too short to be safe", () => {
    writeFileSync(path.join(home, "local-secret"), "short\n");
    expect(peekLocalSecret(home)).toBeUndefined();
    expect(readOrCreateLocalSecret(home).length).toBeGreaterThanOrEqual(32);
  });

  it("records and reads the engine, ignoring garbage", () => {
    expect(readEngineInfo(home)).toBeNull();
    writeEngineInfo(
      {
        port: 4321,
        pid: 99,
        startedBy: "mcp",
        startedAt: "2026-11-17T00:00:00Z",
      },
      home,
    );
    expect(readEngineInfo(home)).toMatchObject({
      port: 4321,
      startedBy: "mcp",
    });
    writeFileSync(path.join(home, "engine.json"), "{not json");
    expect(readEngineInfo(home)).toBeNull();
  });

  it("honours REEL_STUDIO_HOME", () => {
    expect(engineHome({ REEL_STUDIO_HOME: home } as never)).toBe(home);
  });
});

describe("the per-install secret as a request credential", () => {
  const prevHome = process.env.REEL_STUDIO_HOME;
  const prevToken = process.env.MCP_API_TOKEN;
  beforeEach(() => {
    process.env.REEL_STUDIO_HOME = home;
    delete process.env.MCP_API_TOKEN;
  });
  afterEach(() => {
    if (prevHome === undefined) delete process.env.REEL_STUDIO_HOME;
    else process.env.REEL_STUDIO_HOME = prevHome;
    if (prevToken !== undefined) process.env.MCP_API_TOKEN = prevToken;
  });

  const call = (secret: string, host = "127.0.0.1:3000") =>
    new Request(`http://${host}/api/x`, {
      headers: { host, authorization: `Bearer ${secret}` },
    });

  it("is accepted from the loopback as a local client that may render", () => {
    const secret = readOrCreateLocalSecret(home);
    expect(authorizeRequest(call(secret))).toEqual({
      origin: "mcp",
      token: { kind: "local" },
    });
  });

  it("is rejected when wrong", () => {
    readOrCreateLocalSecret(home);
    expect(() => authorizeRequest(call("x".repeat(43)))).toThrow(
      /Invalid MCP token/,
    );
  });

  it("is never honoured when no secret exists yet", () => {
    expect(() => authorizeRequest(call("a".repeat(43)))).toThrow(
      /Invalid MCP token/,
    );
  });
});
