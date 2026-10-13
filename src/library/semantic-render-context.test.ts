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
    props,
    totalFrames: 1152,
  });
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
    expect(html.match(/data-semantic-block=/g)).toHaveLength(
      props.scenes.length,
    );
    expect(html).toContain('class="sg-visual sg-overlap"');
    expect(html).toContain('data-subject="GEO" data-symbol="sources"');
  }
  const isolated = {
    ...props,
    scenes: [scenes[0]],
    timeline: [{ sceneId: scenes[0].id, startFrame: 0, durationFrames: 144 }],
  };
  expect(buildHyperframesCompositionHtml(isolated)).not.toContain(
    "data-semantic-block=",
  );
  expect(
    buildHyperframesCompositionHtml({
      ...isolated,
      storySource: semanticStorySource(scenes),
    }),
  ).toContain('data-semantic-block="comparison"');
  expect(
    buildHyperframesCompositionHtml({
      ...isolated,
      storySource: "An unrelated story after a copy edit.",
    }),
  ).not.toContain("data-semantic-block=");
});
