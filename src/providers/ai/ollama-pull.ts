import { z } from "zod";

import { secureLocalAIFetch } from "./local-http";
import { AIError } from "./types";

const pullLineSchema = z.object({
  status: z.string().default(""),
  total: z.number().optional(),
  completed: z.number().optional(),
  error: z.string().optional(),
});

export interface PullProgress {
  status: string;
  /** 0 to 1 while a layer downloads, otherwise undefined. */
  fraction?: number;
  completed?: number;
  total?: number;
}

/**
 * Ask a local Ollama server to download a model, reporting progress. Ollama
 * streams one JSON object per line. The model comes from Ollama's own library;
 * this app never stores or ships weights. Only a local endpoint is allowed.
 */
export async function pullOllamaModel(args: {
  baseUrl: string;
  model: string;
  allowLan?: boolean;
  onProgress: (progress: PullProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await secureLocalAIFetch({
    providerId: "ollama",
    baseUrl: args.baseUrl,
    allowLan: args.allowLan ?? false,
    path: "/api/pull",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: args.model, stream: true }),
    signal: args.signal,
    // The connection stays open for the whole download.
    timeoutMs: 6 * 60 * 60_000,
  });
  if (!response.ok || !response.body) {
    throw new AIError(
      `Ollama could not start downloading ${args.model} (HTTP ${response.status}).`,
      502,
      "ollama",
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let succeeded = false;
  const handle = (line: string) => {
    if (!line.trim()) return;
    let parsed: z.infer<typeof pullLineSchema>;
    try {
      parsed = pullLineSchema.parse(JSON.parse(line));
    } catch {
      return;
    }
    if (parsed.error) throw new AIError(parsed.error, 502, "ollama");
    if (parsed.status === "success") succeeded = true;
    args.onProgress({
      status: parsed.status,
      completed: parsed.completed,
      total: parsed.total,
      fraction:
        parsed.total && parsed.completed !== undefined
          ? Math.min(1, parsed.completed / parsed.total)
          : undefined,
    });
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  handle(buffer);
  if (!succeeded)
    throw new AIError(
      `The download of ${args.model} ended before it finished. Try again.`,
      502,
      "ollama",
    );
}
