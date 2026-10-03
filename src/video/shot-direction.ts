import { z } from "zod";
import { productionSceneRoleSchema } from "@/production/roles";
import { motionDirectionSchema } from "@/production/motion";

/** The same bounded, data-only direction is used by local and AI planning. */
export const shotDirectionSchema = z
  .object({
    version: z.literal(1),
    role: productionSceneRoleSchema,
    composition: z.enum(["authored", "layered-title"]),
    motion: motionDirectionSchema.optional(),
  })
  .strict();
export type ShotDirection = z.infer<typeof shotDirectionSchema>;

/** A planner invocation is explicit; critique never triggers another paid call. */
export const directorBudgetSchema = z
  .object({
    maxPaidCalls: z.union([z.literal(0), z.literal(1)]).default(0),
  })
  .strict();
