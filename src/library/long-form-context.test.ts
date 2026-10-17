import { expect, it } from "vitest";
import { longFormChapterContext } from "./long-form-context";
import { LONG_FORM_BUDGETS } from "@/production/long-form";
import { filmSnapshot } from "../../tests/fixtures/film-plan";

it("bounds global context without cutting identity records or treating goals as new facts", () => {
  const script = filmSnapshot().script;
  const value = longFormChapterContext(
    {
      ...script,
      chapterPlan: {
        version: "1.0.0",
        chapters: [
          {
            id: "one",
            title: "Original",
            firstSceneId: script.scenes[0].id,
            direction: { goal: "Keep literal subjects", phase: "develop" },
          },
        ],
      },
      motionPlan: {
        version: "1.0.0",
        seed: "saved",
        ambition: "clean",
        subjectRegistry: Array.from({ length: 80 }, (_, index) => ({
          id: `subject-${index}`,
          label: `Exact label ${index}`,
          aliases: [`Alias ${index}`],
          colorSlot: "accent" as const,
          symbol: "document" as const,
        })),
      },
    },
    { goal: "Revisit", phase: "recap", callbackChapterId: "one" },
  );
  expect(value.length).toBeLessThanOrEqual(
    LONG_FORM_BUDGETS.globalContextCharacters,
  );
  expect(value).toContain('"aliases":["Alias 0"]');
  expect(value).toContain("Further context omitted");
  expect(value).toContain("Saved callback excerpt");
});
