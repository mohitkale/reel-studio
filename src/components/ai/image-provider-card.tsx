"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ImageProviderConfig } from "@/providers/image/types";

interface ImageProviderState {
  config: ImageProviderConfig | null;
  defaults: Record<string, string>;
}

/**
 * Optional image generation. Off by default. A storyboard scene can ask for a
 * picture with `media.generate`; with a local ComfyUI or OpenAI-compatible
 * image server set up here, it is made on this computer. Without one, the scene
 * uses a stock picture or the themed background.
 */
export function ImageProviderCard() {
  const state = useQuery({
    queryKey: ["image-provider"],
    queryFn: () => apiGet<ImageProviderState>("/api/image-provider"),
  });
  if (!state.data) return null;
  // Keyed by what is saved, so the form starts from it without an effect.
  return (
    <ImageProviderForm
      key={JSON.stringify(state.data.config)}
      saved={state.data.config}
      defaults={state.data.defaults}
    />
  );
}

function ImageProviderForm({
  saved,
  defaults,
}: {
  saved: ImageProviderConfig | null;
  defaults: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const [providerId, setProviderId] = React.useState<
    ImageProviderConfig["providerId"]
  >(saved?.providerId ?? "comfyui");
  const [baseUrl, setBaseUrl] = React.useState(saved?.baseUrl ?? "");
  const [model, setModel] = React.useState(saved?.model ?? "");
  const [allowLan, setAllowLan] = React.useState(saved?.allowLan ?? false);
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
  }>();

  const form = {
    providerId,
    baseUrl: baseUrl || defaults[providerId] || "",
    model,
    allowLan,
  };
  const test = useMutation({
    mutationFn: () =>
      apiPost<{ ok: boolean; message: string }>(
        "/api/image-provider/test",
        form,
      ),
    onSuccess: setResult,
    onError: (error) => setResult({ ok: false, message: error.message }),
  });
  const save = useMutation({
    mutationFn: () => apiPost("/api/image-provider", form),
    onSuccess: () => {
      toast.success("Image generation is on");
      void queryClient.invalidateQueries({ queryKey: ["image-provider"] });
    },
    onError: (error) =>
      toast.error("Could not save", { description: error.message }),
  });
  const off = useMutation({
    mutationFn: () =>
      fetch("/api/image-provider", { method: "DELETE" }).then(() => undefined),
    onSuccess: () => {
      setResult(undefined);
      setBaseUrl("");
      setModel("");
      void queryClient.invalidateQueries({ queryKey: ["image-provider"] });
      toast.success("Image generation is off");
    },
  });
  const on = Boolean(saved);

  return (
    <section
      aria-labelledby="image-provider-heading"
      className="bg-card space-y-3 rounded-lg border p-4 text-sm"
    >
      <div>
        <h3
          id="image-provider-heading"
          className="flex items-center gap-2 font-medium"
        >
          <ImageIcon className="size-4" aria-hidden /> Image generation
          (optional)
          <span className="text-muted-foreground text-xs font-normal">
            {on ? "On" : "Off"}
          </span>
        </h3>
        <p className="text-muted-foreground">
          This is the only place a second model is used, and it is optional.
          Point it at an image model that runs on this computer. Scenes that ask
          for a picture are made there; with it off, they use a stock picture or
          the themed background. Nothing is downloaded for you.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label htmlFor="image-provider-kind">Server</Label>
          <NativeSelect
            id="image-provider-kind"
            value={providerId}
            onChange={(event) =>
              setProviderId(
                event.target.value as ImageProviderConfig["providerId"],
              )
            }
          >
            <option value="comfyui">ComfyUI</option>
            <option value="openai-compatible">
              OpenAI-compatible images endpoint
            </option>
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="image-provider-url">Address</Label>
          <Input
            id="image-provider-url"
            value={baseUrl}
            placeholder={defaults[providerId] ?? ""}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="image-provider-model">
            {providerId === "comfyui"
              ? "Checkpoint (optional)"
              : "Model (optional)"}
          </Label>
          <Input
            id="image-provider-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={allowLan}
            onChange={(event) => setAllowLan(event.target.checked)}
          />
          The server is on my private network
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          Test
        </Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {on ? "Save changes" : "Turn on"}
        </Button>
        {on && (
          <Button
            variant="ghost"
            onClick={() => off.mutate()}
            disabled={off.isPending}
          >
            Turn off
          </Button>
        )}
      </div>
      {result && (
        <p role="status" className={result.ok ? "" : "text-destructive"}>
          {result.message}
        </p>
      )}
    </section>
  );
}
