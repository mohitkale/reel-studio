import { expect, it } from "vitest";
import { editorialCopy } from "./type-scenes";

it("uses saved emphasis to establish hierarchy without rewriting, repeating or injecting copy", () => {
  const text = "Feeling overwhelmed by AI? It's understandable.";
  const html = editorialCopy({ text, emphasis: ["OVERWHELMED BY AI"] });
  const copy = document.createElement("div");
  copy.innerHTML = html;
  expect(copy.textContent?.replace(/\s+/g, " ")).toBe(text);
  expect(copy.querySelector(".tm-copy-focus")?.textContent).toBe(
    "overwhelmed by AI?",
  );
  const unsafe = document.createElement("div");
  unsafe.innerHTML = editorialCopy({
    text: "Keep <script> safe & readable",
    emphasis: ["<script>"],
  });
  expect(unsafe.querySelector("script")).toBeNull();
  expect(unsafe.textContent).toBe("Keep <script> safe & readable");
});

it("serializes bounded manual text reveal settings without changing scene timing", async () => {
  const { buildTypeMotionScene } = await import("./type-scenes");
  const { defaultBrandTokens } = await import("@/video/tokens");
  const { motionDirection, motionDirectionSchema } =
    await import("@/production/motion");
  const motion = motionDirectionSchema.parse({
    ...motionDirection("type-impact"),
    textReveal: { durationSeconds: 1.1, ease: "smooth" },
  });
  const html = buildTypeMotionScene({
    scene: {
      id: "timing",
      templateId: "hf-statement",
      text: "Review the reveal",
      emphasis: [],
      motion,
    },
    tokens: defaultBrandTokens,
    absoluteStart: 2,
    duration: 4,
    exitWindow: 0.3,
    transitionClass: "",
  })!;
  const container = document.createElement("div");
  container.innerHTML = html;
  expect(
    container
      .querySelector("[data-motion-scene]")
      ?.getAttribute("data-text-reveal-duration"),
  ).toBe("1.1");
  expect(
    container
      .querySelector("[data-motion-scene]")
      ?.getAttribute("data-text-reveal-ease"),
  ).toBe("smooth");
  expect(container.querySelector(".scene")?.getAttribute("data-duration")).toBe(
    "4.000",
  );
  expect(
    motionDirectionSchema.safeParse({
      ...motion,
      textReveal: { durationSeconds: 9, ease: "custom-js" },
    }).success,
  ).toBe(false);
});
