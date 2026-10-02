export const LEGACY_HF_CATALOG_REVISION = "builtin-v0.3.0" as const;
export const PREVIOUS_HF_CATALOG_REVISION =
  "c93c7654033282e1a66a662a39fb10b8ed273b7d" as const;
export const CURRENT_HF_CATALOG_REVISION =
  "cfe5dcfad310ced2a5844998628daa2b8a0f53d7" as const;

/** Commit hashes have no chronological ordering. Append new known revisions. */
export const HF_CATALOG_REVISION_ORDER: readonly string[] = [
  LEGACY_HF_CATALOG_REVISION,
  PREVIOUS_HF_CATALOG_REVISION,
  CURRENT_HF_CATALOG_REVISION,
];

export function catalogRevisionIncludes(
  revision: string,
  introduced: string,
): boolean {
  const current = HF_CATALOG_REVISION_ORDER.indexOf(revision);
  const minimum = HF_CATALOG_REVISION_ORDER.indexOf(introduced);
  return current >= 0 && minimum >= 0 && current >= minimum;
}
