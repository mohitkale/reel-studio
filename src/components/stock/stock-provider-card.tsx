"use client";

import * as React from "react";
import { Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { useSaveStockKey, type StockProviderStatus } from "@/hooks/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function StockProviderCard({ status }: { status: StockProviderStatus }) {
  const [apiKey, setApiKey] = React.useState("");
  const saveKey = useSaveStockKey();

  function handleSave() {
    if (!apiKey.trim()) return;
    saveKey.mutate(
      { providerId: status.id, apiKey },
      {
        onSuccess: (res) => {
          setApiKey("");
          if (res.verified) {
            toast.success(`${status.label} connected`, {
              description: "Stock backgrounds are now available for AI scenes.",
            });
          } else {
            toast.warning(`${status.label} key saved, but not verified`, {
              description: res.verifyError ?? "Could not run a test search.",
            });
          }
        },
        onError: (e) =>
          toast.error("Could not save key", {
            description: (e as Error).message,
          }),
      },
    );
  }

  function handleClear() {
    saveKey.mutate(
      { providerId: status.id, apiKey: "" },
      { onSuccess: () => toast.info(`${status.label} key removed`) },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <ImageIcon className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{status.label}</span>
            {status.configured ? (
              <Badge variant="success">
                <Check className="mr-1 size-3" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary">Not configured</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Free Demo tier (~50 requests/hour). Access Key from your Unsplash app.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`stock-key-${status.id}`}>Access key</Label>
        <div className="flex gap-2">
          <Input
            id={`stock-key-${status.id}`}
            type="password"
            autoComplete="off"
            placeholder={
              status.configured ? "Enter a new key to replace" : "Paste your Access Key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button onClick={handleSave} disabled={!apiKey.trim() || saveKey.isPending}>
            {saveKey.isPending ? "Saving..." : "Save"}
          </Button>
          {status.configured ? (
            <Button variant="outline" onClick={handleClear} disabled={saveKey.isPending}>
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Stored in a git-ignored .env.local on this machine.
        </p>
      </div>
    </div>
  );
}
