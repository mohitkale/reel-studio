"use client";

import * as React from "react";
import { Check, KeyRound, Star } from "lucide-react";
import { toast } from "sonner";

import type { ProviderStatus } from "@/providers/voice/types";
import type { AppConfig } from "@/server/app-config";
import { useModels, useSaveKey, useSetDefaults } from "@/hooks/voice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";

export function ProviderKeyCard({
  status,
  config,
}: {
  status: ProviderStatus;
  config: AppConfig;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const saveKey = useSaveKey();
  const setDefaults = useSetDefaults();
  const models = useModels(status.configured ? status.id : undefined);

  const isDefaultProvider = config.defaultProviderId === status.id;
  const selectedModel =
    config.defaultModel[status.id] ?? status.defaultModel ?? "";

  function handleSave() {
    if (!apiKey.trim()) return;
    saveKey.mutate(
      { providerId: status.id, apiKey },
      {
        onSuccess: (res) => {
          setApiKey("");
          if (res.verified) {
            toast.success(`${status.label} connected`, {
              description: `${res.voiceCount ?? 0} voices available.`,
            });
          } else {
            toast.warning(`${status.label} key saved, but not verified`, {
              description: res.verifyError ?? "Could not list voices.",
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
      {
        onSuccess: () =>
          toast.info(`${status.label} key removed`),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <KeyRound className="size-4" />
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
              {isDefaultProvider ? (
                <Badge>
                  <Star className="mr-1 size-3" />
                  Default
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        {status.configured && !isDefaultProvider ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDefaults.mutate(
                { defaultProviderId: status.id },
                {
                  onSuccess: () =>
                    toast.success(`${status.label} is now the default provider`),
                },
              )
            }
          >
            Make default
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`key-${status.id}`}>API key</Label>
        <div className="flex gap-2">
          <Input
            id={`key-${status.id}`}
            type="password"
            autoComplete="off"
            placeholder={
              status.configured ? "Enter a new key to replace" : "Paste your API key"
            }
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim() || saveKey.isPending}
          >
            {saveKey.isPending ? "Saving..." : "Save"}
          </Button>
          {status.configured ? (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={saveKey.isPending}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Stored in a git-ignored .env.local on this machine.
        </p>
      </div>

      {status.configured ? (
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor={`model-${status.id}`}>Default model</Label>
          <Combobox
            id={`model-${status.id}`}
            value={selectedModel}
            disabled={models.isLoading}
            onChange={(v) =>
              setDefaults.mutate(
                { modelFor: status.id, modelId: v },
                { onSuccess: () => toast.success("Default model updated") },
              )
            }
            options={(models.data ?? [{ id: selectedModel, label: selectedModel }]).map(
              (m) => ({ value: m.id, label: m.label }),
            )}
            placeholder="Select model…"
            searchPlaceholder="Search models…"
          />
        </div>
      ) : null}

      <Separator />
    </div>
  );
}
