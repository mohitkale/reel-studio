"use client";

import * as React from "react";
import { Activity, Check, CircleAlert } from "lucide-react";
import { toast } from "sonner";

import type { LocalAIProviderView } from "@/providers/ai/local-types";
import { useDiagnoseLocalAI, useSaveLocalAIConfig } from "@/hooks/ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

export function LocalAIProviderCard({
  status,
}: {
  status: LocalAIProviderView;
}) {
  const [baseUrl, setBaseUrl] = React.useState(status.baseUrl);
  const [modelId, setModelId] = React.useState(status.modelId);
  const [temperature, setTemperature] = React.useState(
    String(status.temperature),
  );
  const [contextWindow, setContextWindow] = React.useState(
    status.contextWindow ? String(status.contextWindow) : "",
  );
  const [maxOutputTokens, setMaxOutputTokens] = React.useState(
    status.maxOutputTokens ? String(status.maxOutputTokens) : "",
  );
  const [allowLan, setAllowLan] = React.useState(status.allowLan);
  const [token, setToken] = React.useState("");
  const save = useSaveLocalAIConfig();
  const diagnose = useDiagnoseLocalAI();
  const healthy = status.diagnostic.state === "healthy";

  function handleSave() {
    save.mutate(
      {
        providerId: status.id,
        config: {
          baseUrl,
          modelId,
          temperature: Number(temperature),
          contextWindow: optionalNumber(contextWindow),
          maxOutputTokens: optionalNumber(maxOutputTokens),
          allowLan,
          ...(status.id === "lm-studio" && token ? { token } : {}),
        },
      },
      {
        onSuccess: () => {
          setToken("");
          toast.success(`${status.label} configuration saved`);
        },
        onError: (error) =>
          toast.error(`Could not save ${status.label}`, {
            description: error.message,
          }),
      },
    );
  }

  function handleClearToken() {
    save.mutate({
      providerId: status.id,
      config: {
        baseUrl,
        modelId,
        temperature: Number(temperature),
        contextWindow: optionalNumber(contextWindow),
        maxOutputTokens: optionalNumber(maxOutputTokens),
        allowLan,
        token: "",
      },
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
          <Activity className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{status.label}</span>
            <Badge variant={healthy ? "success" : "secondary"}>
              {healthy ? (
                <Check className="mr-1 size-3" />
              ) : (
                <CircleAlert className="mr-1 size-3" />
              )}
              {status.diagnostic.state.replaceAll("-", " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {status.diagnostic.message}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={`local-ai-url-${status.id}`}>Server URL</Label>
          <Input
            id={`local-ai-url-${status.id}`}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor={`local-ai-model-${status.id}`}>Selected model</Label>
          <Input
            id={`local-ai-model-${status.id}`}
            list={`local-ai-models-${status.id}`}
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            placeholder="Discover models after connecting"
          />
          <datalist id={`local-ai-models-${status.id}`}>
            {status.diagnostic.modelIds?.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
          {status.diagnostic.modelIds ? (
            <p className="text-muted-foreground text-xs">
              {status.diagnostic.modelIds.length} model
              {status.diagnostic.modelIds.length === 1 ? "" : "s"} discovered.
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`local-ai-temperature-${status.id}`}>
            Temperature (0–2)
          </Label>
          <Input
            id={`local-ai-temperature-${status.id}`}
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(event) => setTemperature(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`local-ai-context-${status.id}`}>
            Context window
          </Label>
          <Input
            id={`local-ai-context-${status.id}`}
            type="number"
            min="512"
            max="262144"
            value={contextWindow}
            onChange={(event) => setContextWindow(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`local-ai-output-${status.id}`}>
            Max output tokens
          </Label>
          <Input
            id={`local-ai-output-${status.id}`}
            type="number"
            min="64"
            max="32768"
            value={maxOutputTokens}
            onChange={(event) => setMaxOutputTokens(event.target.value)}
          />
        </div>
        {status.id === "lm-studio" ? (
          <div className="grid gap-2">
            <Label htmlFor="local-ai-lm-token">Optional local token</Label>
            <Input
              id="local-ai-lm-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={
                status.hasToken ? "Token saved; enter to replace" : "Optional"
              }
            />
            {status.hasToken ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleClearToken}
                disabled={save.isPending}
              >
                Remove token
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={allowLan}
          onChange={(event) => setAllowLan(event.target.checked)}
        />
        <span>
          Allow this provider on my private LAN. Enable only for a server you
          control. Loopback endpoints need no opt-in.
        </span>
      </label>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-xs">
          Saved in a permission-restricted local config file, separate from
          cloud API keys.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => diagnose.mutate(status.id)}
            disabled={diagnose.isPending}
          >
            {diagnose.isPending ? "Checking…" : "Check connection"}
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save configuration"}
          </Button>
        </div>
      </div>
    </div>
  );
}
