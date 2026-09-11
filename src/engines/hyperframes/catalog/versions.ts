import importedCatalogJson from "@/engines/hyperframes/catalog/versions/c93c7654033282e1a66a662a39fb10b8ed273b7d/catalog.json";
import { HF_CATALOG_BLOCKS } from "@/engines/hyperframes/catalog/manifest";
import {
  importedCatalogSchema,
  type ImportedCatalog,
} from "@/engines/hyperframes/catalog/importer";

export const LEGACY_HF_CATALOG_REVISION = "builtin-v0.3.0" as const;
export const CURRENT_HF_CATALOG_REVISION =
  "c93c7654033282e1a66a662a39fb10b8ed273b7d" as const;

export const CURRENT_HF_CATALOG = importedCatalogSchema.parse(
  importedCatalogJson,
) as ImportedCatalog;

export interface CatalogVersionSummary {
  revision: string;
  source: string;
  status: "legacy" | "current";
  itemNames: readonly string[];
}

export const HF_CATALOG_VERSIONS: readonly CatalogVersionSummary[] = [
  {
    revision: LEGACY_HF_CATALOG_REVISION,
    source: "Reel Studio v0.3 bundled catalog",
    status: "legacy",
    itemNames: HF_CATALOG_BLOCKS.map((item) => item.id),
  },
  {
    revision: CURRENT_HF_CATALOG_REVISION,
    source: CURRENT_HF_CATALOG.source,
    status: "current",
    itemNames: CURRENT_HF_CATALOG.items.map((item) => item.name),
  },
];

export function getCatalogVersion(
  revision: string,
): CatalogVersionSummary | undefined {
  return HF_CATALOG_VERSIONS.find((version) => version.revision === revision);
}
