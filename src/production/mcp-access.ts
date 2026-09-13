import { z } from "zod";

import { AI_PROVIDER_IDS } from "@/providers/ai/types";
import { PROVIDER_IDS } from "@/providers/voice/types";

export const MCP_SCOPES = [
  "studio:read",
  "studio:write",
  "production:submit",
  "production:automatic",
  "production:cancel",
  "artifacts:read",
] as const;

export const mcpScopeSchema = z.enum(MCP_SCOPES);
export type McpScope = z.infer<typeof mcpScopeSchema>;

export const MCP_PROVIDER_IDS = [...PROVIDER_IDS, ...AI_PROVIDER_IDS] as const;
export const mcpProviderIdSchema = z.enum(MCP_PROVIDER_IDS);
export type McpProviderId = z.infer<typeof mcpProviderIdSchema>;

export const mcpTokenPolicySchema = z.object({
  scopes: z.array(mcpScopeSchema).min(1),
  allowedProviders: z.array(mcpProviderIdSchema),
  paidProviders: z.array(mcpProviderIdSchema),
  maxDurationSeconds: z.number().int().min(1).max(600),
  maxBatchSize: z.number().int().min(1).max(10),
  paidRequestLimit: z.number().int().min(0).max(10_000),
});
export type McpTokenPolicy = z.infer<typeof mcpTokenPolicySchema>;

export const createMcpTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  policy: mcpTokenPolicySchema,
});

export interface McpNamedTokenRecord extends McpTokenPolicy {
  id: string;
  name: string;
  tokenHash: string;
  paidRequestsUsed: number;
  createdAt: string;
  lastUsedAt: string | null;
}

export const mcpNamedTokenRecordSchema = mcpTokenPolicySchema.extend({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  paidRequestsUsed: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export const PAID_MCP_PROVIDERS = new Set<McpProviderId>([
  "cartesia",
  "elevenlabs",
  "gemini",
  "openai",
]);

export function hasMcpScope(policy: McpTokenPolicy, scope: McpScope): boolean {
  return policy.scopes.includes(scope);
}

export function providerPolicyDecision(
  policy: McpTokenPolicy & { paidRequestsUsed: number },
  providerIds: readonly string[],
): { allowed: boolean; paidRequest: boolean; reason?: string } {
  const unique = [...new Set(providerIds.filter(Boolean))];
  const disallowed = unique.find(
    (provider) => !policy.allowedProviders.includes(provider as McpProviderId),
  );
  if (disallowed) {
    return {
      allowed: false,
      paidRequest: false,
      reason: `Provider ${disallowed} is not allowed by this MCP token`,
    };
  }
  const paid = unique.filter((provider) =>
    PAID_MCP_PROVIDERS.has(provider as McpProviderId),
  );
  if (!paid.length) return { allowed: true, paidRequest: false };
  const unapproved = paid.find(
    (provider) => !policy.paidProviders.includes(provider as McpProviderId),
  );
  if (unapproved) {
    return {
      allowed: false,
      paidRequest: true,
      reason: `Paid provider ${unapproved} needs an explicit token allowance`,
    };
  }
  if (policy.paidRequestsUsed >= policy.paidRequestLimit) {
    return {
      allowed: false,
      paidRequest: true,
      reason: "This MCP token has reached its paid-request limit",
    };
  }
  return { allowed: true, paidRequest: true };
}
