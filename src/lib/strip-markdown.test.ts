import { expect, it } from "vitest";
import { stripMarkdown } from "./strip-markdown";
it("preserves multiple technical identifiers while removing actual Markdown emphasis", () => {
  expect(
    stripMarkdown(
      "Responses accepts input_image content with image_url and manual_review.",
    ),
  ).toBe(
    "Responses accepts input_image content with image_url and manual_review.",
  );
  expect(
    stripMarkdown("_Review_ **sources** with `input_image` and `image_url`."),
  ).toBe("Review sources with input_image and image_url.");
  expect(
    stripMarkdown("__Keep identifiers__: snake_case and object__field."),
  ).toBe("Keep identifiers: snake_case and object__field.");
});
