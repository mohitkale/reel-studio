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
