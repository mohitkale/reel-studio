import { createHash } from "node:crypto";

import { z } from "zod";

import { ORIENTATIONS } from "@/lib/orientation";
import { productionPresetIdSchema } from "@/production/presets";

const registryKindSchema = z.enum(["block", "component"]);
const registryTypeSchema = z.enum([
  "hyperframes:block",
  "hyperframes:component",
]);
const safeRelativePathSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.startsWith("\\") &&
      !/^[A-Za-z]:[/\\]/.test(value) &&
      !value.split(/[/\\]/).includes(".."),
    "Catalog file paths must stay inside their item directory",
  );

export const catalogSelectionSchema = z
  .object({
    source: z.url(),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    license: z.string().min(1),
    items: z
      .array(
        z.object({
          name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          type: registryKindSchema,
          templateId: z.string().min(1).optional(),
          presets: z.array(productionPresetIdSchema).min(1),
          layouts: z.array(z.enum(ORIENTATIONS)).min(1),
        }),
      )
      .min(1),
  })
  .superRefine((selection, ctx) => {
    if (!selection.source.includes(selection.revision)) {
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message: "Catalog source URL must be pinned to the selected revision",
      });
    }
    const names = new Set<string>();
    const templateIds = new Set<string>();
    for (const [index, item] of selection.items.entries()) {
      if (names.has(item.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "name"],
          message: `Duplicate catalog item: ${item.name}`,
        });
      }
      names.add(item.name);
      if (item.templateId && templateIds.has(item.templateId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "templateId"],
          message: `Duplicate catalog template id: ${item.templateId}`,
        });
      }
      if (item.templateId) templateIds.add(item.templateId);
    }
  });
export type CatalogSelection = z.infer<typeof catalogSelectionSchema>;

export const upstreamRegistryIndexSchema = z.object({
  name: z.string().min(1),
  homepage: z.url().optional(),
  items: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
    }),
  ),
});

const registryFileSchema = z.object({
  path: safeRelativePathSchema,
  target: safeRelativePathSchema,
  type: z.enum([
    "hyperframes:composition",
    "hyperframes:asset",
    "hyperframes:snippet",
    "hyperframes:style",
    "hyperframes:timeline",
  ]),
});

export const upstreamRegistryItemSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type: registryTypeSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)).default([]),
    author: z.string().min(1).optional(),
    authorUrl: z.url().optional(),
    license: z.string().min(1).optional(),
    minCliVersion: z.string().min(1).optional(),
    dimensions: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .optional(),
    duration: z.number().positive().optional(),
    registryDependencies: z.array(z.string().min(1)).default([]),
    files: z.array(registryFileSchema).min(1),
    preview: z
      .object({ video: z.string().optional(), poster: z.string().optional() })
      .optional(),
  })
  .superRefine((item, ctx) => {
    if (
      item.type === "hyperframes:block" &&
      (!item.dimensions || !item.duration)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Catalog blocks require dimensions and duration",
      });
    }
    if (
      item.type === "hyperframes:component" &&
      (item.dimensions || item.duration)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Catalog components cannot define standalone dimensions or duration",
      });
    }
  });
export type UpstreamRegistryItem = z.infer<typeof upstreamRegistryItemSchema>;

export const importedCatalogFileSchema = registryFileSchema.extend({
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
});

export const importedCatalogItemSchema = z.object({
  name: z.string().min(1),
  type: registryKindSchema,
  templateId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()),
  author: z.string().optional(),
  authorUrl: z.string().optional(),
  license: z.string().min(1),
  attribution: z.string().min(1),
  minCliVersion: z.string().optional(),
  dimensions: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  duration: z.number().positive().optional(),
  registryDependencies: z.array(z.string()),
  presets: z.array(productionPresetIdSchema),
  supportedLayouts: z.array(z.enum(ORIENTATIONS)),
  registryItemChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  files: z.array(importedCatalogFileSchema).min(1),
});

export const importedCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.url(),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    registryChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    items: z.array(importedCatalogItemSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    const names = new Set<string>();
    for (const [index, item] of catalog.items.entries()) {
      if (names.has(item.name)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "name"],
          message: `Duplicate imported catalog item: ${item.name}`,
        });
      }
      names.add(item.name);
    }
  });
export type ImportedCatalog = z.infer<typeof importedCatalogSchema>;

export function sha256(content: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function registryDirectory(
  type: "block" | "component",
): "blocks" | "components" {
  return type === "block" ? "blocks" : "components";
}

export function assertSelectionMatchesItem(
  selected: CatalogSelection["items"][number],
  item: UpstreamRegistryItem,
): void {
  const expectedType = `hyperframes:${selected.type}`;
  if (selected.name !== item.name || item.type !== expectedType) {
    throw new Error(
      `Catalog selection ${selected.name} expected ${expectedType}, received ${item.name} (${item.type})`,
    );
  }
  if (selected.type === "block" && !selected.templateId) {
    throw new Error(
      `Catalog block ${selected.name} requires a versioned templateId`,
    );
  }
  if (selected.type === "component" && selected.templateId) {
    throw new Error(
      `Catalog component ${selected.name} cannot be a standalone template`,
    );
  }
}
