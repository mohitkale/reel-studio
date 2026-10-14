// @vitest-environment node
import { expect, it } from "vitest";
import { semanticGraphicsFixture } from "../../tests/fixtures/semantic-graphics";
import { materializeHyperframesScene } from "./hyperframes-render";
import { enrichSemanticSequence } from "@/production/semantic-direction";
import { semanticStorySource } from "@/production/semantic-direction";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { preparedVideoCompositionSchema } from "@/production/video-snapshot";

it("keeps whole-story narration through export media localization so the MP4 uses the preview's illustrations", async () => {
  const props = semanticGraphicsFixture();
  props.scenes = enrichSemanticSequence(props.scenes);
  const preview = buildHyperframesCompositionHtml(props);
  const prepared = preparedVideoCompositionSchema.parse({
    props: {
      ...props,
      sfxCues: [
        { url: "/sfx/pop.wav", startFrame: 24, volume: 0.06, fadeSeconds: 0 },
      ],
    },
    totalFrames: 1152,
  });
  expect(prepared.props.sfxCues?.[0].fadeSeconds).toBe(0);
  const scenes = await Promise.all(
    prepared.props.scenes.map((scene, index) =>
      materializeHyperframesScene(
        scene,
        "/unused-no-media-fixture",
        index,
        "http://localhost:3103",
      ),
    ),
  );
  expect(
    scenes.map((scene) => [scene.text, scene.spokenText, scene.direction]),
  ).toEqual(
    props.scenes.map((scene) => [
      scene.text,
      scene.spokenText,
      scene.direction,
    ]),
  );
  const exported = buildHyperframesCompositionHtml(
    { ...props, scenes },
    { producerMode: true },
  );
  for (const html of [preview, exported]) {
    expect(
      html.match(/<div[^>]+data-(?:semantic-block|showpiece)=/g),
    ).toHaveLength(props.scenes.length);
    expect(html).toContain('class="sg-visual sg-overlap"');
    expect(html).toContain('data-subject="GEO" data-symbol="sources"');
  }
  const isolated = {
    ...props,
    scenes: [scenes[0]],
    timeline: [{ sceneId: scenes[0].id, startFrame: 0, durationFrames: 144 }],
  };
  expect(buildHyperframesCompositionHtml(isolated)).not.toMatch(
    /<div[^>]+data-(?:semantic-block|showpiece)=/,
  );
  expect(
    buildHyperframesCompositionHtml({
      ...isolated,
      storySource: semanticStorySource(scenes),
    }),
  ).toContain('data-showpiece="orbital-comparison"');
  expect(
    buildHyperframesCompositionHtml({
      ...isolated,
      storySource: "An unrelated story after a copy edit.",
    }),
  ).not.toMatch(/<div[^>]+data-(?:semantic-block|showpiece)=/);
});
