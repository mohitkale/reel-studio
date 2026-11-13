// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { scanSecretText } from "../../scripts/secret-patterns.mjs";
describe("secret scanner signatures and redaction", () => {
  it.each([
    "sk-" + "proj-",
    "sk-" + "svcacct-",
    "github_" + "pat_",
    "sk_" + "car_",
    "AIza",
    "AKIA",
  ])("covers modern credential prefix %s", (prefix) => {
    const length = prefix === "AIza" ? 35 : prefix === "AKIA" ? 16 : 40;
    const value = prefix + "A".repeat(length);
    const findings = scanSecretText("comment\r\n" + value);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].line).toBe(2);
    expect(JSON.stringify(findings)).not.toContain(value);
  });
  it.each([
    "ELEVENLABS_API_KEY",
    "PEXELS_API_KEY",
    "PIXABAY_API_KEY",
    "UNSPLASH_ACCESS_KEY",
    "VOICEFORGE_API_TOKEN",
    "MCP_API_TOKEN",
    "JAMENDO_CLIENT_ID",
  ])("checks opaque assigned %s credentials", (key) => {
    const value = "Opaque" + "X".repeat(30);
    for (const assignment of [`${key}=${value}`, `"${key}": "${value}"`])
      expect(scanSecretText(assignment)).toHaveLength(1);
    expect(scanSecretText(`${key}=your_key_here`)).toEqual([]);
  });
  it("recognizes encrypted private keys without logging material", () => {
    const key = "-----BEGIN " + "ENCRYPTED PRIVATE KEY-----";
    expect(scanSecretText(key)[0].rule).toBe("Private key material");
  });
});

it("scans index bytes rather than a sanitized working tree and never prints credentials", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "reel-index-scan-"));
  const scanner = path.resolve("scripts/scan-secrets.mjs");
  const value = "sk-" + "proj-" + "A".repeat(40);
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    writeFileSync(path.join(directory, "credential example.txt"), value);
    execFileSync("git", ["add", "credential example.txt"], { cwd: directory });
    writeFileSync(path.join(directory, "credential example.txt"), "sanitized");
    let stderr = "";
    try {
      execFileSync(process.execPath, [scanner, "--staged"], {
        cwd: directory,
        stdio: "pipe",
      });
    } catch (error) {
      stderr = (error as { stderr: Buffer }).stderr.toString();
    }
    expect(stderr).toContain("credential example.txt:1");
    expect(stderr).toContain("[redacted]");
    expect(stderr).not.toContain(value);
    execFileSync("git", ["add", "credential example.txt"], { cwd: directory });
    expect(
      execFileSync(process.execPath, [scanner, "--staged"], {
        cwd: directory,
        encoding: "utf8",
      }),
    ).toContain("passed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
