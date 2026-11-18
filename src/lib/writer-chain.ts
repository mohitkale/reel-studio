import type { AIProviderStatus } from "@/providers/ai/types";

/**
 * The order the studio looks for something to write the storyboard: a model on
 * this computer, then an online key the person added, then pasting a reply from
 * any chat assistant. The chain is shown as it is so nobody is surprised where
 * their text goes.
 */
export type ChainStepId = "local" | "key" | "paste";

export interface ChainStep {
  id: ChainStepId;
  title: string;
  detail: string;
  /** `active` is the step in use now; `ready` would be used next. */
  state: "active" | "ready" | "off";
}

const configured = (providers: AIProviderStatus[] | undefined) =>
  (providers ?? []).filter((provider) => provider.configured);

/** The writer to use: a local model first, then a cloud key. */
export function pickWriter(
  providers: AIProviderStatus[] | undefined,
): AIProviderStatus | undefined {
  const ready = configured(providers);
  return (
    ready.find((provider) => provider.kind === "local") ?? ready[0]
  );
}

/** A cloud writer to offer when the local one does not answer. */
export function cloudFallback(
  providers: AIProviderStatus[] | undefined,
): AIProviderStatus | undefined {
  return configured(providers).find((provider) => provider.kind === "cloud");
}

export function writerChain(
  providers: AIProviderStatus[] | undefined,
): ChainStep[] {
  const ready = configured(providers);
  const local = ready.find((provider) => provider.kind === "local");
  const cloud = ready.find((provider) => provider.kind === "cloud");
  const active: ChainStepId = local ? "local" : cloud ? "key" : "paste";
  const state = (id: ChainStepId, available: boolean): ChainStep["state"] =>
    id === active ? "active" : available ? "ready" : "off";
  return [
    {
      id: "local",
      title: "A model on this computer",
      detail: local
        ? `${local.label}, ${local.defaultModel}. Nothing leaves this computer.`
        : "Not set up. Free and private.",
      state: state("local", Boolean(local)),
    },
    {
      id: "key",
      title: "An online writer",
      detail: cloud
        ? `${cloud.label}. Your topic is sent to ${cloud.label} to write the script.`
        : "No key added.",
      state: state("key", Boolean(cloud)),
    },
    {
      id: "paste",
      title: "Your own chat assistant",
      detail: "Copy the prompt, paste the reply. Always available.",
      state: state("paste", true),
    },
  ];
}

/** One sentence that says where the text goes. */
export function writerPrivacyNote(
  writer: AIProviderStatus | undefined,
): string {
  if (!writer) return "";
  return writer.kind === "local"
    ? `Written on this computer by ${writer.label} (${writer.defaultModel}). Nothing leaves your machine.`
    : `Your topic is sent to ${writer.label} to write the script. Everything else stays on this computer.`;
}
