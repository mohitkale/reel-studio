import { z } from "zod";
import { videoSnapshotSchema } from "./video-snapshot";

/** Portable metadata; referenced media bytes are not embedded. */
export const filmPlanDocumentSchema = z
  .object({
    kind: z.literal("reel-studio-film-plan"),
    version: z.literal(1),
    snapshot: videoSnapshotSchema,
  })
  .strict()
  .refine((document) => Boolean(document.snapshot.filmPlan), {
    path: ["snapshot", "filmPlan"],
    message: "A film plan document requires its resolved plan",
  });
export const saveFilmPlanRequestSchema = z
  .object({ document: filmPlanDocumentSchema })
  .strict();
export type FilmPlanDocument = z.infer<typeof filmPlanDocumentSchema>;
