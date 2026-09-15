import { createHash } from "node:crypto";

import { z } from "zod";

import { ORIENTATIONS } from "@/lib/orientation";
import { productionPresetIdSchema } from "@/production/presets";

export const registryKindSchema = z.enum(["block", "component", "example"]);
export const embeddableRegistryKindSchema = z.enum(["block", "component"]);
export const registryTypeSchema = z.enum([
  "hyperframes:block",
  "hyperframes:component",
  "hyperframes:example",
]);
export const safeRelativePathSchema = z
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

export const hyperframesPackageTargetsSchema = z.object({
  producer: z.object({
    name: z.literal("@hyperframes/producer"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
  cli: z.object({
    name: z.literal("hyperframes"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  }),
});

export const catalogSelectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    source: z.url(),
    releaseTag: z.string().regex(/^v\d+\.\d+\.\d+$/),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    packages: hyperframesPackageTargetsSchema,
    license: z.string().min(1),
    items: z
      .array(
        z.object({
          name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
          type: embeddableRegistryKindSchema,
          templateId: z.string().min(1).optional(),
          integration: z.enum(["vendored", "native-adapter"]).default("vendored"),
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
    const tagVersion = selection.releaseTag.slice(1);
    if (
      selection.packages.producer.version !== tagVersion ||
      selection.packages.cli.version !== tagVersion
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["packages"],
        message:
          "HyperFrames package targets must match the stable release tag",
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
      type: registryTypeSchema,
    }),
  ),
});

export const registryFileSchema = z.object({
  path: safeRelativePathSchema,
  target: safeRelativePathSchema,
  type: z.enum([
    "hyperframes:composition",
    "hyperframes:asset",
    "hyperframes:snippet",
    "hyperframes:style",
    "hyperframes:timeline",
  ]),
  url: z
    .url()
    .refine(
      (value) => value.startsWith("https://"),
      "Catalog asset URLs must use HTTPS",
    )
    .optional(),
});

const registryVariableSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
    type: z.enum([
      "string",
      "number",
      "boolean",
      "color",
      "enum",
      "image",
      "video",
      "audio",
    ]),
    role: z.enum(["content", "style", "timing", "layout"]).default("content"),
    label: z.string().min(1).default("Catalog variable"),
    description: z
      .string()
      .min(1)
      .default("Upstream catalog variable retained for compatibility."),
    default: z.unknown().optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().positive().optional(),
    portrays: z.array(z.string().min(1)).optional(),
    options: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
        }),
      )
      .optional(),
  })
  .superRefine((variable, ctx) => {
    if (
      variable.min !== undefined &&
      variable.max !== undefined &&
      variable.min > variable.max
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Variable min cannot exceed max",
      });
    }
    const value = variable.default;
    if (value === undefined) return;
    if (variable.type === "number" && typeof value !== "number") {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: "Number variable defaults must be numeric",
      });
    }
    if (variable.type === "boolean" && typeof value !== "boolean") {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: "Boolean variable defaults must be boolean",
      });
    }
    if (
      ["string", "color", "enum", "image", "video", "audio"].includes(
        variable.type,
      ) &&
      typeof value !== "string"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: "Text and media variable defaults must be strings",
      });
    }
    if (
      variable.type === "color" &&
      typeof value === "string" &&
      !/^#[0-9a-f]{6}$/i.test(value)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: "Color defaults must be six-digit hex values",
      });
    }
    if (variable.type === "enum") {
      if (!variable.options?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "Enum variables require options",
        });
      } else if (
        typeof value === "string" &&
        !variable.options.some((option) => option.value === value)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["default"],
          message: "Enum default must match an option",
        });
      }
    }
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
    variables: z.array(registryVariableSchema).default([]),
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
    const variableIds = new Set<string>();
    for (const [index, variable] of item.variables.entries()) {
      if (variableIds.has(variable.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["variables", index, "id"],
          message: `Duplicate catalog variable: ${variable.id}`,
        });
      }
      variableIds.add(variable.id);
    }
    const filePaths = new Set<string>();
    for (const [index, file] of item.files.entries()) {
      if (filePaths.has(file.path)) {
        ctx.addIssue({
          code: "custom",
          path: ["files", index, "path"],
          message: `Duplicate catalog file: ${file.path}`,
        });
      }
      filePaths.add(file.path);
      if (file.type === "hyperframes:asset" && !file.url) {
        // Older registry entries keep assets beside the manifest, so a URL is
        // optional. The synchronizer still vendors and hashes the local file.
        continue;
      }
      if (file.type !== "hyperframes:asset" && file.url) {
        ctx.addIssue({
          code: "custom",
          path: ["files", index, "url"],
          message: "Only catalog assets may use an external source URL",
        });
      }
    }
  });
export type UpstreamRegistryItem = z.infer<typeof upstreamRegistryItemSchema>;

export const importedCatalogFileSchema = registryFileSchema.extend({
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  embedded: z.boolean().default(true),
});

export const importedCatalogItemSchema = z.object({
  name: z.string().min(1),
  type: embeddableRegistryKindSchema,
  templateId: z.string().min(1).optional(),
  integration: z.enum(["vendored", "native-adapter"]).default("vendored"),
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
  variables: z.array(registryVariableSchema).default([]),
  presets: z.array(productionPresetIdSchema),
  supportedLayouts: z.array(z.enum(ORIENTATIONS)),
  registryItemChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  files: z.array(importedCatalogFileSchema).min(1),
});

export const importedCatalogSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    source: z.url(),
    releaseTag: z
      .string()
      .regex(/^v\d+\.\d+\.\d+$/)
      .optional(),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
    packages: hyperframesPackageTargetsSchema.optional(),
    registryChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    items: z.array(importedCatalogItemSchema).min(1),
  })
  .superRefine((catalog, ctx) => {
    if (
      catalog.schemaVersion === 2 &&
      (!catalog.releaseTag || !catalog.packages)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Catalog schema version 2 requires releaseTag and package targets",
      });
    }
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

export const catalogCapabilityManifestSchema = z.object({
  schemaVersion: z.literal(1),
  releaseTag: z.string().regex(/^v\d+\.\d+\.\d+$/),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  packages: hyperframesPackageTargetsSchema,
  registryCounts: z.object({
    blocks: z.number().int().nonnegative(),
    components: z.number().int().nonnegative(),
    examples: z.number().int().nonnegative(),
  }),
  items: z.array(
    z.object({
      capabilityId: z.string().regex(/^hf\.[a-z0-9.-]+$/),
      registryName: z.string().min(1),
      type: z.enum(["block", "component"]),
      templateId: z.string().min(1).optional(),
      integration: z.enum(["vendored", "native-adapter"]).default("vendored"),
      tags: z.array(z.string()),
      presets: z.array(productionPresetIdSchema),
      layouts: z.array(z.enum(ORIENTATIONS)),
      variableIds: z.array(z.string()),
      requiredLocalMedia: z.array(z.enum(["image", "video", "audio"])),
      offlineReady: z.literal(true),
      runtimeRewrites: z.array(z.enum(["google-fonts", "gsap"])),
    }),
  ),
});
export type CatalogCapabilityManifest = z.infer<
  typeof catalogCapabilityManifestSchema
>;

export const unsupportedCatalogReportSchema = z.object({
  schemaVersion: z.literal(1),
  releaseTag: z.string().regex(/^v\d+\.\d+\.\d+$/),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/),
  items: z.array(
    z.object({
      name: z.string().min(1),
      type: registryTypeSchema,
      reason: z.string().min(1),
    }),
  ),
});
export type UnsupportedCatalogReport = z.infer<
  typeof unsupportedCatalogReportSchema
>;

export function sha256(content: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function registryDirectory(
  type: "block" | "component" | "example",
): "blocks" | "components" | "examples" {
  if (type === "block") return "blocks";
  if (type === "component") return "components";
  return "examples";
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
