import { NextResponse } from "next/server";
import { z } from "zod";

import {
  replaceCharacters,
  updateCharacterVoices,
} from "@/library/repositories/podcasts";
import { podcastGenderSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const characterSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(80),
  gender: podcastGenderSchema,
  definition: z.string().trim().max(1000).optional(),
  providerId: z.string().optional(),
  voiceId: z.string().optional(),
  modelId: z.string().nullable().optional(),
});

const putSchema = z.object({
  characters: z.array(characterSchema).min(2).max(4),
});

const patchSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        providerId: z.string().optional(),
        voiceId: z.string().optional(),
        modelId: z.string().nullable().optional(),
        name: z.string().trim().min(1).max(80).optional(),
        gender: podcastGenderSchema.optional(),
        definition: z.string().trim().max(1000).optional(),
      }),
    )
    .min(1),
});

/** Replace the full cast (clears turns). */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = putSchema.parse(await req.json());
    const podcast = await replaceCharacters(id, body.characters);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Patch voice bindings / name / gender without wiping the script. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const podcast = await updateCharacterVoices(id, body.updates);
    return NextResponse.json({ podcast });
  } catch (e) {
    return errorResponse(e);
  }
}
