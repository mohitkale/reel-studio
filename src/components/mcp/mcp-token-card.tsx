"use client";

import * as React from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  useGenerateMcpToken,
  useMcpToken,
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
  const [copied, setCopied] = React.useState(false);

  if (isLoading || !data) {
    return <Skeleton className="h-24 w-full" />;
  }

  function handleGenerate() {
    generate.mutate(undefined, {
      onSuccess: () =>
        toast.success("MCP token generated", {
          description: "Paste it into your AI tool's MCP config.",
        }),
      onError: (e) =>
        toast.error("Could not generate token", {
          description: (e as Error).message,
        }),
    });
  }

  function handleRevoke() {
    revoke.mutate(undefined, {
      onSuccess: () => toast.info("MCP token revoked"),
    });
  }

  async function handleCopy() {
    if (!data?.token) return;
    await navigator.clipboard.writeText(data.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            Lets AI tools (Claude, Cursor) build storyboards via the MCP server.
            Rendering still needs your approval here. Deletion and key
            management are never exposed.
          </p>
        </div>
      </div>

      {data.configured && data.token ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <Input readOnly value={data.token} className="font-mono text-xs" />
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored in a git-ignored .env.local. Keep it secret — anyone with it
            can create and edit projects via MCP.
          </p>
        </div>
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
    </div>
  );
}
