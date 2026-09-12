import { describe, expect, it } from "vitest";

import {
  hasMcpScope,
  providerPolicyDecision,
  type McpTokenPolicy,
} from "@/production/mcp-access";

const policy: McpTokenPolicy & { paidRequestsUsed: number } = {
  scopes: ["studio:read", "production:submit"],
  allowedProviders: ["kokoro-server", "elevenlabs"],
  paidProviders: [],
  maxDurationSeconds: 180,
  maxBatchSize: 5,
  paidRequestLimit: 0,
  paidRequestsUsed: 0,
};

describe("scoped MCP access", () => {
  it("exposes explicit permissions", () => {
    expect(hasMcpScope(policy, "production:submit")).toBe(true);
    expect(hasMcpScope(policy, "production:automatic")).toBe(false);
  });

  it("allows local providers and rejects providers outside the allowlist", () => {
    expect(providerPolicyDecision(policy, ["kokoro-server"])).toEqual({
      allowed: true,
      paidRequest: false,
    });
    expect(providerPolicyDecision(policy, ["cartesia"])).toMatchObject({
      allowed: false,
      paidRequest: false,
    });
  });

  it("requires both a named paid-provider allowance and remaining request budget", () => {
    expect(providerPolicyDecision(policy, ["elevenlabs"])).toMatchObject({
      allowed: false,
      paidRequest: true,
    });
    expect(
      providerPolicyDecision(
        {
          ...policy,
          paidProviders: ["elevenlabs"],
          paidRequestLimit: 2,
          paidRequestsUsed: 1,
        },
        ["elevenlabs"],
      ),
    ).toEqual({ allowed: true, paidRequest: true });
    expect(
      providerPolicyDecision(
        {
          ...policy,
          paidProviders: ["elevenlabs"],
          paidRequestLimit: 1,
          paidRequestsUsed: 1,
        },
        ["elevenlabs"],
      ),
    ).toMatchObject({ allowed: false, paidRequest: true });
  });
});
