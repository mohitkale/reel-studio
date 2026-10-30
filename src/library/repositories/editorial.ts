import { prisma } from "@/library/db";
import { Prisma } from "@prisma/client";
import { brandOverridesSchema, parseJsonColumn } from "@/library/schemas";
import {
  editorialWorkflowSchema,
  type EditorialWorkflow,
} from "@/production/editorial";
import { AIError } from "@/providers/ai/types";
import type { EvidencePack } from "@/research/contracts";
import { dimsFor } from "@/lib/orientation";

export async function createEditorialRecord(
  workflow: EditorialWorkflow,
  evidence: EvidencePack | null,
) {
  const suffix = workflow.fingerprint.slice(0, 16);
  const { createHash } = await import("node:crypto");
  const identity = createHash("sha256").update(workflow.key).digest("hex");
  const projectId = `editorial-project-${identity}`,
    scriptId = `editorial-script-${identity}`;
  const existing = await readEditorialRecord(scriptId);
  if (existing) {
    if (existing.workflow.fingerprint !== workflow.fingerprint)
      throw new AIError(
        "This creation key belongs to different editorial inputs",
        409,
      );
    return { projectId, scriptId };
  }
  try {
    await prisma.project.create({
      data: {
        id: projectId,
        name: `Editorial draft · ${workflow.request.brief.slice(0, 60)}`,
        videoEngine: "hyperframes",
        brandKitId: workflow.request.brandKitId,
        scripts: {
          create: {
            id: scriptId,
            name: `Editorial script ${suffix.slice(0, 4)}`,
            ...dimsFor(workflow.request.orientation),
            brandOverrides: JSON.stringify({
              editorialWorkflow: workflow,
              ...(evidence ? { researchEvidence: evidence } : {}),
            }),
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const prior = await readEditorialRecord(scriptId);
      if (prior?.workflow.fingerprint === workflow.fingerprint)
        return { projectId, scriptId };
    }
    throw error;
  }
  return { projectId, scriptId };
}

export async function readEditorialRecord(scriptId: string) {
  const row = await prisma.script.findUnique({
    where: { id: scriptId },
    select: { id: true, projectId: true, brandOverrides: true },
  });
  if (!row) return null;
  const overrides = parseJsonColumn(
    row.brandOverrides,
    brandOverridesSchema,
    {},
  );
  const workflow = editorialWorkflowSchema.safeParse(
    overrides.editorialWorkflow,
  );
  return workflow.success
    ? {
        projectId: row.projectId,
        scriptId: row.id,
        workflow: workflow.data,
        storyboard: overrides.editorialStoryboard,
        evidence: overrides.researchEvidence ?? null,
      }
    : null;
}

/** Serialize claims and publications without keeping a transaction open during IO. */
export async function changeEditorialRecord(
  scriptId: string,
  change: (
    workflow: EditorialWorkflow,
    evidence: EvidencePack | null,
  ) => EditorialWorkflow,
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.script.findUnique({
      where: { id: scriptId },
      select: { brandOverrides: true },
    });
    if (!row) throw new AIError("Editorial draft not found", 404);
    const overrides = parseJsonColumn(
      row.brandOverrides,
      brandOverridesSchema,
      {},
    );
    const workflow = editorialWorkflowSchema.parse(overrides.editorialWorkflow);
    const next = editorialWorkflowSchema.parse(
      change(workflow, overrides.researchEvidence ?? null),
    );
    await tx.script.update({
      where: { id: scriptId },
      data: {
        brandOverrides: JSON.stringify({
          ...overrides,
          editorialWorkflow: next,
        }),
      },
    });
    return next;
  });
}
