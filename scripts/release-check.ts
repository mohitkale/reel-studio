import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import cinematicBrandFixture from "../tests/fixtures/cinematic-brand-reel.json";
import creatorPunchFixture from "../tests/fixtures/creator-punch-reel.json";
import dataStoryFixture from "../tests/fixtures/data-story-reel.json";
import developerDemoFixture from "../tests/fixtures/developer-demo-reel.json";
import editorialExplainerFixture from "../tests/fixtures/editorial-explainer-reel.json";
import productLaunchFixture from "../tests/fixtures/product-launch-reel.json";
import releaseBriefs from "../tests/fixtures/release-briefs.json";
import type { ReelProps } from "../src/compositions/types";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition";
import { listVideoEngines } from "../src/engines/registry";
import { VIDEO_ENGINE_IDS } from "../src/engines/types";
import { dimsFor, ORIENTATIONS } from "../src/lib/orientation";
import { createDeterministicProductionPlan } from "../src/production/manual-planner";
import { getPresetTemplateId } from "../src/production/preset-template-map";
import {
  PRODUCTION_PRESET_IDS,
  PRODUCTION_PRESETS,
} from "../src/production/presets";

const EXPECTED_VERSION = "0.4.0";
const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function readJson(filename: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, filename), "utf8")) as Record<
    string,
    unknown
  >;
}

function probe(filename: string) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,width,height",
        "-show_entries",
        "format=duration,size",
        "-of",
        "json",
        path.join(root, filename),
      ],
      { encoding: "utf8" },
    ),
  ) as {
    streams?: Array<{ codec_name?: string; width?: number; height?: number }>;
    format?: { duration?: string; size?: string };
  };
}

function checkReleaseMetadata() {
  const pkg = readJson("package.json");
  const lock = readJson("package-lock.json");
  assert(
    pkg.version === EXPECTED_VERSION,
    "package.json release version drift",
  );
  const lockPackages = lock.packages as Record<string, { version?: string }>;
  assert(
    lockPackages?.[""]?.version === EXPECTED_VERSION,
    "package-lock.json release version drift",
  );
  assert(
    Number(process.versions.node.split(".")[0]) === 24,
    `release checks require Node 24, found ${process.version}`,
  );

  const dependencies = {
    ...(pkg.dependencies as Record<string, string>),
    ...(pkg.devDependencies as Record<string, string>),
  };
  for (const [name, version] of Object.entries(dependencies)) {
    assert(
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version),
      `${name} must use an exact version, found ${version}`,
    );
  }
  const remotionVersions = Object.entries(dependencies)
    .filter(([name]) => name === "remotion" || name.startsWith("@remotion/"))
    .map(([, version]) => version);
  assert(
    new Set(remotionVersions).size === 1,
    "Remotion package versions are not synchronized",
  );

  const migrationCount = readdirSync(path.join(root, "prisma", "migrations"), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory()).length;
  assert(
    migrationCount === 9,
    `expected 9 database migrations, found ${migrationCount}`,
  );

  for (const filename of [
    "README.md",
    "CHANGELOG.md",
    "docs/CREATOR_GUIDE.md",
    "docs/WALKTHROUGHS.md",
    "docs/production/RELEASE_MATRIX_0.4.0.json",
    "docs/production/LOCAL_FIRST_PR2_RENDER_MATRIX.json",
    "docs/production/RELEASE_VALIDATION.md",
    "mcp/README.md",
  ]) {
    assert(
      existsSync(path.join(root, filename)),
      `missing release document: ${filename}`,
    );
  }

  const matrix = readJson("docs/production/RELEASE_MATRIX_0.4.0.json");
  const matrixEnvironment = matrix.environment as
    { packageVersion?: string } | undefined;
  const outputs = matrix.outputs as
    | Array<{ presetId?: string; orientation?: string; engine?: string }>
    | undefined;
  assert(
    matrixEnvironment?.packageVersion === EXPECTED_VERSION,
    "release matrix package version drift",
  );
  assert(outputs?.length === 36, "expected 36 published release renders");
  assert(
    new Set(
      outputs.map(
        (output) => `${output.presetId}/${output.orientation}/${output.engine}`,
      ),
    ).size === 36,
    "published 0.4 matrix contains duplicate or missing combinations",
  );

  const briefMatrix = readJson(
    "docs/production/LOCAL_FIRST_PR2_RENDER_MATRIX.json",
  );
  const briefEnvironment = briefMatrix.environment as
    { packageVersion?: string } | undefined;
  const entries = briefMatrix.entries as
    | Array<{
        presetId?: string;
        orientation?: string;
        briefIndex?: number;
        briefHash?: string;
        width?: number;
        height?: number;
        engines?: { hyperframes?: number; remotion?: number };
      }>
    | undefined;
  assert(
    briefEnvironment?.packageVersion === EXPECTED_VERSION,
    "three-brief matrix package version drift",
  );
  assert(entries?.length === 18, "expected 18 three-brief matrix entries");
  for (const presetId of PRODUCTION_PRESET_IDS) {
    const presetEntries = entries.filter(
      (entry) => entry.presetId === presetId,
    );
    assert(
      presetEntries.length === 3,
      `${presetId} needs three rendered briefs`,
    );
    assert(
      new Set(presetEntries.map((entry) => entry.briefHash)).size === 3,
      `${presetId} needs three distinct rendered briefs`,
    );
    assert(
      new Set(presetEntries.map((entry) => entry.orientation)).size === 3,
      `${presetId} needs all three orientations`,
    );
    for (const [briefIndex, brief] of releaseBriefs[presetId].entries()) {
      const entry = presetEntries.find(
        (candidate) => candidate.briefIndex === briefIndex + 1,
      );
      assert(entry, `${presetId} brief ${briefIndex + 1} is missing`);
      const expectedDimensions = dimsFor(ORIENTATIONS[briefIndex]);
      assert(
        entry.briefHash === createHash("sha256").update(brief).digest("hex"),
        `${presetId} brief ${briefIndex + 1} hash drifted`,
      );
      assert(
        entry.width === expectedDimensions.width &&
          entry.height === expectedDimensions.height,
        `${presetId} brief ${briefIndex + 1} dimensions drifted`,
      );
      assert(
        Number(entry.engines?.hyperframes) > 10_000 &&
          Number(entry.engines?.remotion) > 10_000,
        `${presetId} brief ${briefIndex + 1} needs both engine outputs`,
      );
    }
  }
}

function checkPresetContracts() {
  assert(PRODUCTION_PRESETS.length === 6, "expected six production presets");
  const engines = listVideoEngines();
  assert(engines.length === 2, "expected two video engines");
  let capabilityCombinations = 0;
  let plannedBriefs = 0;

  for (const preset of PRODUCTION_PRESETS) {
    assert(
      preset.engines.length === VIDEO_ENGINE_IDS.length &&
        VIDEO_ENGINE_IDS.every((id) => preset.engines.includes(id)),
      `${preset.name} must support both engines`,
    );
    const briefs = releaseBriefs[preset.id];
    assert(
      briefs.length === 3,
      `${preset.name} must have three release briefs`,
    );

    for (const engine of engines) {
      for (const orientation of ORIENTATIONS) {
        assert(
          engine.capabilities.aspectRatios.includes(orientation),
          `${engine.label} does not support ${orientation}`,
        );
        capabilityCombinations += 1;
      }
      for (const role of preset.sceneRoles) {
        const templateId = getPresetTemplateId({
          presetId: preset.id,
          engineId: engine.id,
          role,
        });
        assert(
          templateId,
          `${preset.name}/${engine.label}/${role} is unmapped`,
        );
        const capability = engine.capabilities.templates[templateId];
        assert(capability, `${engine.label} is missing template ${templateId}`);
        assert(
          capability.sceneRoles.includes(role),
          `${templateId} does not declare the ${role} role`,
        );
      }
      for (const [index, brief] of briefs.entries()) {
        const plan = createDeterministicProductionPlan({
          name: `${preset.name} release brief ${index + 1}`,
          text: brief,
          presetId: preset.id,
          videoEngine: engine.id,
          hasVisualAsset: true,
        });
        assert(
          plan.plan.scenes.length > 0,
          `${preset.name} produced no scenes`,
        );
        assert(
          plan.plan.scenes
            .map((scene) => scene.spokenText ?? scene.text)
            .join(" ") === brief,
          `${preset.name}/${engine.label} did not preserve narration`,
        );
        plannedBriefs += 1;
      }
    }
  }
  assert(capabilityCombinations === 36, "preset canvas matrix is incomplete");
  assert(plannedBriefs === 36, "three-brief planning matrix is incomplete");
  return { capabilityCombinations, plannedBriefs };
}

const fixtureMap: Record<(typeof PRODUCTION_PRESET_IDS)[number], ReelProps> = {
  "product-launch": productLaunchFixture as ReelProps,
  "editorial-explainer": editorialExplainerFixture as ReelProps,
  "creator-punch": creatorPunchFixture as ReelProps,
  "data-story": dataStoryFixture as ReelProps,
  "developer-demo": developerDemoFixture as ReelProps,
  "cinematic-brand": cinematicBrandFixture as ReelProps,
};

function checkOfflineCompositionMatrix() {
  let compositions = 0;
  for (const presetId of PRODUCTION_PRESET_IDS) {
    for (const orientation of ORIENTATIONS) {
      const html = buildHyperframesCompositionHtml(
        { ...fixtureMap[presetId], ...dimsFor(orientation) },
        {
          producerMode: true,
          runtimeUrl: "/_runtime/gsap.min.js",
        },
      );
      assert(
        html.includes("data-reel-local-fonts"),
        `${presetId} has no local fonts`,
      );
      assert(
        !/fonts\.(?:googleapis|gstatic)\.com/i.test(html),
        `${presetId} fetches fonts`,
      );
      assert(
        !html.includes("cdn.jsdelivr.net"),
        `${presetId} fetches its runtime`,
      );
      compositions += 1;
    }
  }
  assert(
    compositions === 18,
    "offline HyperFrames composition matrix is incomplete",
  );
  return compositions;
}

function checkGalleryArtifacts() {
  const expected = [
    ["portrait-demo.mp4", 1080, 1920],
    ["landscape-demo.mp4", 1920, 1080],
    ["square-demo.mp4", 1080, 1080],
  ] as const;
  for (const [name, width, height] of expected) {
    const result = probe(`docs/assets/examples/${name}`);
    const video = result.streams?.find(
      (stream) => stream.codec_name === "h264",
    );
    const audio = result.streams?.find((stream) => stream.codec_name === "aac");
    assert(
      video?.width === width && video.height === height,
      `${name} dimensions drifted`,
    );
    assert(audio, `${name} has no AAC audio`);
    assert(Number(result.format?.duration) > 1, `${name} has no duration`);
  }
  const podcast = probe("docs/assets/examples/podcast-demo.mp3");
  assert(
    podcast.streams?.some((stream) => stream.codec_name === "mp3"),
    "podcast gallery sample is not MP3",
  );
  assert(
    Number(podcast.format?.duration) > 1,
    "podcast gallery sample has no duration",
  );
  return expected.length + 1;
}

function main() {
  checkReleaseMetadata();
  const preset = checkPresetContracts();
  const compositions = checkOfflineCompositionMatrix();
  const artifacts = checkGalleryArtifacts();
  console.log(`✓ Reel Studio ${EXPECTED_VERSION} release metadata`);
  console.log(
    `✓ ${preset.plannedBriefs} deterministic preset/brief/engine plans`,
  );
  console.log(
    `✓ ${preset.capabilityCombinations} preset/engine/canvas capabilities`,
  );
  console.log(`✓ ${compositions} offline HyperFrames composition variants`);
  console.log(`✓ ${artifacts} decodable bundled gallery artifacts`);
}

main();
