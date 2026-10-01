// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { expect, it } from "vitest";
import type { ReelProps } from "@/compositions/types";
import { serverDefaultTokens } from "@/lib/brand-defaults";
import { hashRenderDirectory } from "@/library/render-section-cache";
import { writeHyperframesVisualSections } from "./hyperframes-visual-sections";

it("freezes only active native visuals/media and captions, preserving global endpoint and audio isolation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "reel-visual-scopes-"));
  const project = path.join(root, "project");
  await fs.mkdir(path.join(project, "_assets"), { recursive: true });
  await fs.mkdir(path.join(project, "_runtime"));
  await fs.writeFile(path.join(project, "_runtime/gsap.min.js"), "runtime");
  for (const name of ["a.png", "b.png"])
    await fs.writeFile(path.join(project, "_assets", name), name);
  const props: ReelProps = {
    fps: 30,
    width: 1080,
    height: 1920,
    tokens: serverDefaultTokens,
    scenes: ["a", "b"].map((id, order) => ({
      id,
      order,
      templateId: "hf-statement",
      text: `Scene ${id}`,
      emphasis: [],
      background: { type: "image", url: `_assets/${id}.png` },
    })),
    timeline: [
      { sceneId: "a", startFrame: 0, durationFrames: 900 },
      { sceneId: "b", startFrame: 900, durationFrames: 60 },
    ],
    audioUrl: "_assets/vo.wav",
    musicUrl: "_assets/music.wav",
    sfxCues: [],
    captions: {
      enabled: true,
      timingSource: "imported",
      cues: [
        { id: "c", startFrame: 901, endFrame: 950, text: "Later caption" },
      ],
    },
  };
  try {
    expect(await writeHyperframesVisualSections(project, props)).toBe(true);
    const scope = (i: number) =>
      path.join(`${project}-sections/visuals`, String(i));
    const before = await hashRenderDirectory(scope(0));
    const html = await fs.readFile(path.join(scope(0), "index.html"), "utf8");
    expect(html).toContain('data-duration="32.000"');
    expect(html).not.toContain("Scene b");
    expect(html).not.toContain("Later caption");
    expect(html).not.toContain("vo.wav");
    expect(html).not.toContain("font-family:&#39;");
    expect(html).toContain('font-family:"DM Sans", "Segoe UI"');
    expect(await fs.readdir(path.join(scope(0), "_assets"))).toEqual(["a.png"]);
    const second = await hashRenderDirectory(scope(1));
    props.scenes[1].text = "Revised final visual";
    props.captions!.cues[0].text = "Revised final caption";
    await fs.writeFile(path.join(project, "_assets/b.png"), "replaced image");
    // Each production run gets fresh project directories; emulate that here.
    await fs.rm(`${project}-sections`, { recursive: true });
    await writeHyperframesVisualSections(project, props);
    expect(await hashRenderDirectory(scope(0))).toBe(before);
    expect(await hashRenderDirectory(scope(1))).not.toBe(second);
    props.tokens = { ...props.tokens, accent: "#aabbcc" };
    await fs.rm(`${project}-sections`, { recursive: true });
    await writeHyperframesVisualSections(project, props);
    expect(await hashRenderDirectory(scope(0))).not.toBe(before);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
it("keeps imported catalog blocks on whole-composition reuse", async () => {
  const props = { scenes: [{ templateId: "hf-kinetic-slam" }] } as ReelProps;
  expect(await writeHyperframesVisualSections("unused", props)).toBe(false);
});
