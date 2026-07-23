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
  /** Shown only after generate/rotate — never re-fetched from the server. */
  const [revealedToken, setRevealedToken] = React.useState<string | null>(null);

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
          <p className="text-xs text-muted-foreground">
            Copy this into your AI tool’s MCP config now. Stored in git-ignored
            `.env.local` — the API will not return it again on refresh.
          </p>
        </div>
      ) : data.configured ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          A token is active. For security it isn’t shown again — rotate to
          mint a new one if you need to copy it.
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
    </div>
  );
}
