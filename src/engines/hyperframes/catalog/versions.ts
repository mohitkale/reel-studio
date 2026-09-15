import previousCatalogJson from "@/engines/hyperframes/catalog/versions/c93c7654033282e1a66a662a39fb10b8ed273b7d/catalog.json";
import currentCapabilitiesJson from "@/engines/hyperframes/catalog/versions/cfe5dcfad310ced2a5844998628daa2b8a0f53d7/capabilities.json";
import currentCatalogJson from "@/engines/hyperframes/catalog/versions/cfe5dcfad310ced2a5844998628daa2b8a0f53d7/catalog.json";
import currentUnsupportedJson from "@/engines/hyperframes/catalog/versions/cfe5dcfad310ced2a5844998628daa2b8a0f53d7/unsupported.json";
import { HF_CATALOG_BLOCKS } from "@/engines/hyperframes/catalog/manifest";
import {
  catalogCapabilityManifestSchema,
  importedCatalogSchema,
  unsupportedCatalogReportSchema,
  type ImportedCatalog,
} from "@/engines/hyperframes/catalog/importer";

export const LEGACY_HF_CATALOG_REVISION = "builtin-v0.3.0" as const;
export const PREVIOUS_HF_CATALOG_REVISION =
  "c93c7654033282e1a66a662a39fb10b8ed273b7d" as const;
export const CURRENT_HF_CATALOG_REVISION =
  "cfe5dcfad310ced2a5844998628daa2b8a0f53d7" as const;

export const CURRENT_HF_CATALOG = importedCatalogSchema.parse(
  currentCatalogJson,
) as ImportedCatalog;
export const CURRENT_HF_CATALOG_CAPABILITIES =
  catalogCapabilityManifestSchema.parse(currentCapabilitiesJson);
export const CURRENT_HF_UNSUPPORTED_CATALOG =
  unsupportedCatalogReportSchema.parse(currentUnsupportedJson);
const PREVIOUS_HF_CATALOG = importedCatalogSchema.parse(
  previousCatalogJson,
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
    revision: PREVIOUS_HF_CATALOG_REVISION,
    source: PREVIOUS_HF_CATALOG.source,
    status: "legacy",
    itemNames: PREVIOUS_HF_CATALOG.items.map((item) => item.name),
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
