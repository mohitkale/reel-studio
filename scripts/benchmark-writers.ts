/**
 * `npm run benchmark:writers`: write the twelve golden briefs with a storyboard
 * writer and report how many pass the linter, how long each took and how many
 * model calls it needed.
 *
 *   npm run benchmark:writers -- --provider ollama --model qwen2.5:7b
 *   npm run benchmark:writers -- --fixture          (no model: replays the golden examples)
 *
 * A model run needs the provider running on this computer (Ollama or LM Studio)
 * or an API key for a cloud provider; it makes up to 24 calls (one retry each).
 * `--fixture` checks the harness itself and is what the unit tests run.
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { getAIProvider, isAIProviderId } from "../src/providers/ai/registry";
import { isLocalAIProviderId } from "../src/providers/ai/local-definitions";
import { isSmallModel, memoryTier } from "../src/providers/ai/local-models";
import { writeStoryboard } from "../src/providers/ai/storyboard-writer";
import type { AIProvider } from "../src/providers/ai/types";
import { BENCHMARK_BRIEFS } from "../src/storyboard/benchmark-briefs";
import {
  benchmarkTable,
  summarise,
  type BenchmarkRow,
} from "../src/storyboard/benchmark-report";

const { values } = parseArgs({
  options: {
    provider: { type: "string" },
    model: { type: "string" },
    fixture: { type: "boolean", default: false },
    limit: { type: "string" },
    "no-retry": { type: "boolean", default: false },
  },
});

function fixtureProvider(): AIProvider {
  let index = -1;
  return {
    id: "ollama",
    label: "Golden examples (fixture)",
    isConfigured: () => true,
    completeStructured: async () => {
      index += 1;
      const name = BENCHMARK_BRIEFS[index % BENCHMARK_BRIEFS.length]!.example;
      return readFileSync(
        path.join(process.cwd(), "examples", "storyboards", `${name}.json`),
        "utf8",
      );
    },
  } as unknown as AIProvider;
}

async function main() {
  const providerId = values.provider ?? "ollama";
  if (!values.fixture && !isAIProviderId(providerId))
    throw new Error(`Unknown provider "${providerId}"`);
  const provider = values.fixture
    ? fixtureProvider()
    : getAIProvider(providerId as Parameters<typeof getAIProvider>[0]);
  if (!provider.isConfigured())
    throw new Error(`${provider.label} is not configured. Check Settings.`);
  const small =
    isLocalAIProviderId(providerId) && isSmallModel(values.model ?? "");
  const briefs = BENCHMARK_BRIEFS.slice(
    0,
    values.limit ? Number(values.limit) : undefined,
  );
  const rows: BenchmarkRow[] = [];
  for (const { example, brief } of briefs) {
    const started = performance.now();
    let row: BenchmarkRow;
    try {
      const result = await writeStoryboard({
        provider,
        modelId: values.model,
        brief: { ...brief, compact: small },
        twoPass: small && brief.kind !== "podcast",
        retry: !values["no-retry"],
        // The fixture replays whole examples, so length is not what is being judged.
        lint: values.fixture
          ? { minSeconds: 1, maxSeconds: 10_000 }
          : undefined,
      });
      row = {
        example,
        pass: result.errors.length === 0 && result.storyboard !== null,
        attempts: result.attempts,
        errors: result.errors.length,
        warnings: result.warnings.length,
        seconds: (performance.now() - started) / 1000,
        note: result.errors[0]?.message,
      };
    } catch (error) {
      row = {
        example,
        pass: false,
        attempts: 0,
        errors: 1,
        warnings: 0,
        seconds: (performance.now() - started) / 1000,
        note: error instanceof Error ? error.message : String(error),
      };
    }
    rows.push(row);
    console.error(
      `${row.pass ? "✓" : "✗"} ${example} ${row.seconds.toFixed(1)}s`,
    );
  }
  const memoryGb = Math.round(os.totalmem() / 1024 ** 3);
  console.log(
    `\n${values.fixture ? "Fixture replay" : `${provider.label} ${values.model ?? "(selected model)"}`} · ${memoryGb} GB memory (tier ${memoryTier(os.totalmem())})\n`,
  );
  console.log(benchmarkTable(rows));
  const summary = summarise(rows);
  console.log(
    `\n${summary.passed} of ${summary.total} briefs passed the linter · ${summary.medianSeconds.toFixed(1)} s median · ${summary.calls} model calls`,
  );
  process.exit(summary.passed === summary.total ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
