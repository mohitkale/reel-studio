import { describe, expect, it } from "vitest";

import { localAddressScope, validateLocalAIEndpoint } from "./local-endpoint";

describe("local AI endpoint policy", () => {
  it("allows loopback HTTP without an opt-in", async () => {
    await expect(
      validateLocalAIEndpoint("http://localhost:11434", false, async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "::1", family: 6 },
      ]),
    ).resolves.toMatchObject({
      baseUrl: "http://localhost:11434",
      scope: "loopback",
    });
  });

  it("requires explicit opt-in for LAN and Docker host endpoints", async () => {
    const lookup = async () => [{ address: "192.168.65.2", family: 4 }];
    await expect(
      validateLocalAIEndpoint(
        "http://host.docker.internal:1234",
        false,
        lookup,
      ),
    ).rejects.toThrow("Enable LAN access explicitly");
    await expect(
      validateLocalAIEndpoint("http://host.docker.internal:1234", true, lookup),
    ).resolves.toMatchObject({ scope: "lan" });
  });

  it("rejects public, mixed, credential-bearing, and non-HTTP endpoints", async () => {
    await expect(
      validateLocalAIEndpoint("https://models.example", true, async () => [
        { address: "203.0.113.5", family: 4 },
      ]),
    ).rejects.toThrow("loopback or private LAN");
    await expect(
      validateLocalAIEndpoint("http://mixed.local", true, async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "203.0.113.5", family: 4 },
      ]),
    ).rejects.toThrow("loopback or private LAN");
    await expect(
      validateLocalAIEndpoint("http://token@127.0.0.1:11434", false),
    ).rejects.toThrow("token field");
    await expect(
      validateLocalAIEndpoint("file:///tmp/model", false),
    ).rejects.toThrow("http:// or https://");
  });

  it("classifies IPv4, IPv6, and mapped addresses", () => {
    expect(localAddressScope("127.9.0.1")).toBe("loopback");
    expect(localAddressScope("::ffff:127.0.0.1")).toBe("loopback");
    expect(localAddressScope("10.0.0.2")).toBe("lan");
    expect(localAddressScope("fd12::1")).toBe("lan");
    expect(localAddressScope("8.8.8.8")).toBe("blocked");
  });
});
