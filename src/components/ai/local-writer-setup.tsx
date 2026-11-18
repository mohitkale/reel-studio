"use client";

import { Download, ExternalLink, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useAIProviders,
  useLocalWriter,
  useLocalWriterAction,
} from "@/hooks/ai";
import { formatBytes } from "@/providers/ai/local-models";
import { writerChain } from "@/lib/writer-chain";

/**
 * Get a storyboard writer running on this computer in a few clicks. It detects
 * Ollama and LM Studio, offers the model that fits this computer's memory, shows
 * download progress and selects the model when it is done. It also shows the
 * order the studio tries: this computer, then an online key, then paste mode.
 */
export function LocalWriterSetup({
  showChain = true,
}: {
  showChain?: boolean;
}) {
  const writer = useLocalWriter();
  const action = useLocalWriterAction();
  const providers = useAIProviders();
  const state = writer.data;
  const chain = writerChain(providers.data);

  return (
    <section
      aria-labelledby="local-writer-heading"
      className="bg-card space-y-3 rounded-lg border p-4 text-sm"
    >
      <div>
        <h3 id="local-writer-heading" className="font-medium">
          Write on this computer
        </h3>
        <p className="text-muted-foreground">
          A free model writes the script here. Your topic never leaves this
          computer, and no account is needed.
        </p>
      </div>

      {!state && (
        <p role="status" className="text-muted-foreground">
          Looking for Ollama or LM Studio…
        </p>
      )}

      {state?.next === "ready" && state.active && (
        <p role="status" className="flex items-center gap-2">
          <Check className="size-4 text-green-600" aria-hidden />
          Writing with {state.active.modelId} on this computer.
        </p>
      )}

      {state?.pull.state === "pulling" && (
        <div role="status" className="space-y-2">
          <p>
            Downloading {state.pull.model}
            {state.pull.total
              ? ` · ${formatBytes(state.pull.completed ?? 0)} of ${formatBytes(state.pull.total)}`
              : ` · ${state.pull.status}`}
          </p>
          <div
            role="progressbar"
            aria-label="Model download"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((state.pull.fraction ?? 0) * 100)}
            className="bg-muted h-2 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full transition-all"
              style={{
                width: `${Math.round((state.pull.fraction ?? 0) * 100)}%`,
              }}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => action.mutate({ action: "cancel" })}
          >
            Cancel
          </Button>
        </div>
      )}

      {state?.pull.state === "error" && (
        <p role="alert" className="text-destructive">
          {state.pull.message}
        </p>
      )}

      {state &&
        state.pull.state !== "pulling" &&
        state.next === "download-model" && (
          <div className="space-y-2">
            <p>
              Ollama is running. The best fit for this computer (
              {Math.round(state.memoryBytes / 1024 ** 3)} GB memory) is{" "}
              {state.recommended.label}, a download of about{" "}
              {formatBytes(state.recommended.bytes)}.
            </p>
            <Button
              onClick={() =>
                action.mutate({
                  action: "pull",
                  model: state.recommended.ollama,
                })
              }
              disabled={action.isPending}
            >
              {action.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" aria-hidden />
              )}
              Download and use {state.recommended.label}
            </Button>
          </div>
        )}

      {state &&
        state.pull.state !== "pulling" &&
        state.next === "choose-installed" && (
          <div className="space-y-2">
            <p>These models are already installed. Pick one to write with.</p>
            <ul className="flex flex-wrap gap-2">
              {state.servers
                .filter((server) => server.running)
                .flatMap((server) =>
                  server.models.map((model) => (
                    <li key={`${server.id}:${model}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          action.mutate({
                            action: "use",
                            providerId: server.id,
                            model,
                          })
                        }
                      >
                        Use {model}
                      </Button>
                    </li>
                  )),
                )}
            </ul>
            {!state.recommendedInstalled && state.servers[0]?.running && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  action.mutate({
                    action: "pull",
                    model: state.recommended.ollama,
                  })
                }
              >
                Or download {state.recommended.label} (
                {formatBytes(state.recommended.bytes)})
              </Button>
            )}
          </div>
        )}

      {state?.next === "install-server" && (
        <div className="space-y-2">
          <p>
            Install Ollama, a free program that runs models on your computer.
            This page notices it as soon as it is running; there is nothing to
            paste.
          </p>
          <a
            href={state.installUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 underline"
          >
            Get Ollama <ExternalLink className="size-3" aria-hidden />
          </a>
          <p role="status" className="text-muted-foreground">
            Looking for Ollama…
          </p>
        </div>
      )}

      {showChain && (
        <ol aria-label="Where the script gets written" className="space-y-1">
          {chain.map((step, index) => (
            <li key={step.id} className="flex gap-2">
              <span className="text-muted-foreground w-4">{index + 1}.</span>
              <span>
                <span className={step.state === "active" ? "font-medium" : ""}>
                  {step.title}
                  {step.state === "active" ? " (in use)" : ""}
                </span>{" "}
                <span className="text-muted-foreground">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
