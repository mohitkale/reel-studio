import { resolveSpokenText } from "@/lib/spoken-text";
const LOCAL_PROVIDERS = new Set([
  "kokoro",
  "kokoro-server",
  "webspeech",
  "voiceforge",
  "ollama",
  "lm-studio",
  "llama-cpp",
  "deterministic",
]);
export function GenerationSummary({
  providerId,
  text,
  scope,
}: {
  providerId?: string;
  text: string;
  scope: string;
}) {
  const local = providerId && LOCAL_PROVIDERS.has(providerId);
  const characters = Array.from(text).length;
  return (
    <aside
      className="bg-muted/30 space-y-1 rounded-lg border p-3 text-xs"
      aria-label="Generation summary"
    >
      <p className="font-medium">{scope}</p>
      <p>
        {characters.toLocaleString()} characters ·{" "}
        {providerId ?? "Choose a provider"}
      </p>
      <p className="text-muted-foreground">
        {!providerId
          ? "Select a provider to see where processing happens."
          : providerId === "kokoro"
            ? "Speech runs in this browser. The first use downloads a model; narration is not sent to a speech API."
            : providerId === "webspeech"
              ? "Uses the browser or operating system voice service. Processing location depends on the selected voice."
              : providerId === "deterministic"
                ? "Plans supplied content locally without an AI provider request."
                : local
                  ? "Uses your configured local runtime. Check its endpoint in Settings; custom endpoints may run on another machine."
                  : "The selected provider receives this content for generation. Usage is billed according to your provider account; a reliable price estimate is unavailable."}
      </p>
    </aside>
  );
}
export function narrationSummary(
  scenes: readonly { text: string; spokenText?: string | null }[],
) {
  return scenes.map((s) => resolveSpokenText(s)).join("\n");
}
