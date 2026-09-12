"use client";

import * as React from "react";
import {
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  useGenerateMcpToken,
  useMcpToken,
  useNamedMcpTokens,
  useCreateNamedMcpToken,
  useRevokeNamedMcpToken,
  useRevokeMcpToken,
} from "@/hooks/mcp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function McpTokenCard() {
  const { data, isLoading } = useMcpToken();
  const generate = useGenerateMcpToken();
  const revoke = useRevokeMcpToken();
  const named = useNamedMcpTokens();
  const createNamed = useCreateNamedMcpToken();
  const revokeNamed = useRevokeNamedMcpToken();
  const [copied, setCopied] = React.useState(false);
  /** Shown only after generate/rotate — never re-fetched from the server. */
  const [revealedToken, setRevealedToken] = React.useState<string | null>(null);
  const [revealedNamedToken, setRevealedNamedToken] = React.useState<
    string | null
  >(null);
  const [name, setName] = React.useState("Production agent");
  const [automatic, setAutomatic] = React.useState(false);
  const [cloudVoice, setCloudVoice] = React.useState(false);
  const [cloudAi, setCloudAi] = React.useState(false);
  const [maxDuration, setMaxDuration] = React.useState(180);
  const [paidLimit, setPaidLimit] = React.useState(0);

  if (isLoading || !data) {
    return <Skeleton className="h-24 w-full" />;
  }

  function handleGenerate() {
    generate.mutate(undefined, {
      onSuccess: (res) => {
        setRevealedToken(res.token);
        toast.success("MCP token generated", {
          description: "Copy it now — it won’t be shown again after you leave.",
        });
      },
      onError: (e) =>
        toast.error("Could not generate token", {
          description: (e as Error).message,
        }),
    });
  }

  function handleRevoke() {
    revoke.mutate(undefined, {
      onSuccess: () => {
        setRevealedToken(null);
        toast.info("MCP token revoked");
      },
    });
  }

  async function handleCopy() {
    if (!revealedToken) return;
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
          <KeyRound className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">MCP access token</span>
            {data.configured ? (
              <Badge variant="success">
                <Check className="mr-1 size-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Not set</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Lets AI tools (Claude, Cursor) build storyboards via the MCP server.
            Rendering still needs your approval here. Deletion and key
            management are never exposed.
          </p>
        </div>
      </div>

      {revealedToken ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={revealedToken}
              className="font-mono text-xs"
            />
            <Button variant="outline" onClick={() => void handleCopy()}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Copy this into your AI tool’s MCP config now. Stored in git-ignored
            `.env.local` — the API will not return it again on refresh.
          </p>
        </div>
      ) : data.configured ? (
        <p className="bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs">
          A token is active. For security it isn’t shown again — rotate to mint
          a new one if you need to copy it.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={generate.isPending}>
          {data.configured ? (
            <>
              <RefreshCw className="mr-1 size-4" />
              Rotate token
            </>
          ) : (
            "Generate token"
          )}
        </Button>
        {data.configured ? (
          <Button
            variant="outline"
            onClick={handleRevoke}
            disabled={revoke.isPending}
          >
            Revoke
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium">Scoped production tokens</p>
            <p className="text-muted-foreground text-sm">
              Give each automation a name, provider allowlist, duration cap and
              finite paid-request budget. Automatic rendering is opt-in.
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium">
            Token name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            Maximum production duration
            <select
              className="bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={maxDuration}
              onChange={(event) => setMaxDuration(Number(event.target.value))}
            >
              <option value={60}>1 minute</option>
              <option value={180}>3 minutes</option>
              <option value={600}>10 minutes</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={automatic}
              onChange={(event) => setAutomatic(event.target.checked)}
            />
            Allow unattended video and audiogram rendering
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cloudVoice}
              onChange={(event) => {
                setCloudVoice(event.target.checked);
                if (!event.target.checked && !cloudAi) setPaidLimit(0);
              }}
            />
            Allow Cartesia and ElevenLabs
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={cloudAi}
              onChange={(event) => {
                setCloudAi(event.target.checked);
                if (!event.target.checked && !cloudVoice) setPaidLimit(0);
              }}
            />
            Allow Gemini and OpenAI directors
          </label>
          {cloudVoice || cloudAi ? (
            <label className="space-y-1 text-xs font-medium sm:col-span-2">
              Paid provider request limit
              <Input
                type="number"
                min={1}
                max={10000}
                value={paidLimit || 1}
                onChange={(event) => setPaidLimit(Number(event.target.value))}
              />
            </label>
          ) : null}
          <Button
            className="sm:col-span-2"
            disabled={createNamed.isPending || !name.trim()}
            onClick={() =>
              createNamed.mutate(
                {
                  name,
                  policy: {
                    scopes: [
                      "studio:read",
                      "studio:write",
                      "production:submit",
                      ...(automatic ? (["production:automatic"] as const) : []),
                      "production:cancel",
                      "artifacts:read",
                    ],
                    allowedProviders: [
                      "kokoro-server",
                      "voiceforge",
                      ...(cloudVoice
                        ? (["cartesia", "elevenlabs"] as const)
                        : []),
                      ...(cloudAi ? (["gemini", "openai"] as const) : []),
                    ],
                    paidProviders: [
                      ...(cloudVoice
                        ? (["cartesia", "elevenlabs"] as const)
                        : []),
                      ...(cloudAi ? (["gemini", "openai"] as const) : []),
                    ],
                    maxDurationSeconds: maxDuration,
                    maxBatchSize: 10,
                    paidRequestLimit:
                      cloudVoice || cloudAi ? Math.max(1, paidLimit) : 0,
                  },
                },
                {
                  onSuccess: (result) => {
                    setRevealedNamedToken(result.token);
                    toast.success("Scoped MCP token created", {
                      description: "Copy it now; only its hash is retained.",
                    });
                  },
                  onError: (error) =>
                    toast.error("Could not create scoped token", {
                      description: (error as Error).message,
                    }),
                },
              )
            }
          >
            Create scoped token
          </Button>
        </div>

        {revealedNamedToken ? (
          <div className="border-primary/30 bg-primary/5 flex gap-2 rounded-lg border p-3">
            <Input
              readOnly
              value={revealedNamedToken}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard.writeText(revealedNamedToken)
              }
            >
              <Copy className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          {named.data?.tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{token.name}</p>
                <p className="text-muted-foreground text-xs">
                  {token.maxDurationSeconds}s · {token.maxBatchSize} batch items
                  · {token.paidRequestsUsed}/{token.paidRequestLimit} paid
                  requests
                  {token.scopes.includes("production:automatic")
                    ? " · unattended renders"
                    : " · render approval required"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Revoke ${token.name}`}
                disabled={revokeNamed.isPending}
                onClick={() => revokeNamed.mutate(token.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
