/**
 * Which open-weight model to suggest for writing storyboards on this computer.
 * The picks are conservative instruction-following models that support JSON
 * schema constrained output in Ollama. Sizes are the download sizes shown to the
 * person before anything is fetched. `npm run benchmark:writers` measures how
 * well a model actually does; docs/LOCAL_AI.md holds the measured table.
 */
export type MemoryTier = 8 | 16 | 32;

export interface RecommendedWriter {
  tier: MemoryTier;
  /** The Ollama model tag. */
  ollama: string;
  label: string;
  /** Approximate download size in bytes. */
  bytes: number;
  /** The model is small enough that a one-call storyboard often fails the linter. */
  weak: boolean;
}

export const RECOMMENDED_WRITERS: readonly RecommendedWriter[] = [
  {
    tier: 8,
    ollama: "qwen2.5:3b",
    label: "Qwen 2.5 3B",
    bytes: 1_900_000_000,
    weak: true,
  },
  {
    tier: 16,
    ollama: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
    bytes: 4_700_000_000,
    weak: false,
  },
  {
    tier: 32,
    ollama: "qwen2.5:14b",
    label: "Qwen 2.5 14B",
    bytes: 9_000_000_000,
    weak: false,
  },
];

const GB = 1024 ** 3;

/** The tier for the memory of this computer. A model needs about half the memory free. */
export function memoryTier(totalBytes: number): MemoryTier {
  if (totalBytes >= 24 * GB) return 32;
  if (totalBytes >= 12 * GB) return 16;
  return 8;
}

export function recommendedWriter(totalBytes: number): RecommendedWriter {
  const tier = memoryTier(totalBytes);
  return RECOMMENDED_WRITERS.find((writer) => writer.tier === tier)!;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
}

/**
 * Models of about four billion parameters or fewer get the two-step writer
 * (outline first, then the scenes) and the shorter prompt. Reads the size from
 * names like `qwen2.5:3b`, `llama3.2:1b` or `gemma-2b-it`.
 */
export function isSmallModel(modelId: string | undefined): boolean {
  if (!modelId) return false;
  const match = /(?:^|[:\-_/ ])(\d+(?:\.\d+)?)b(?![a-z])/i.exec(modelId);
  if (!match) return false;
  return Number(match[1]) <= 4;
}

/** True when a configured model name is the recommended one (tags such as `:latest` are ignored). */
export function sameModel(a: string, b: string): boolean {
  const base = (id: string) => id.replace(/:latest$/, "");
  return base(a) === base(b);
}
