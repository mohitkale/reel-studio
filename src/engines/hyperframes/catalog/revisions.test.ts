import { describe, expect, it } from "vitest";
import {
  catalogRevisionIncludes,
  CURRENT_HF_CATALOG_REVISION,
  PREVIOUS_HF_CATALOG_REVISION,
  LEGACY_HF_CATALOG_REVISION,
} from "./revisions";
import { getCatalogBlockByTemplateId } from "./manifest";

describe("explicit catalog revision order", () => {
  it("retains capabilities introduced by older known revisions", () => {
    expect(
      catalogRevisionIncludes(
        CURRENT_HF_CATALOG_REVISION,
        PREVIOUS_HF_CATALOG_REVISION,
      ),
    ).toBe(true);
    expect(
      catalogRevisionIncludes(
        PREVIOUS_HF_CATALOG_REVISION,
        LEGACY_HF_CATALOG_REVISION,
      ),
    ).toBe(true);
    expect(
      catalogRevisionIncludes(
        CURRENT_HF_CATALOG_REVISION,
        CURRENT_HF_CATALOG_REVISION,
      ),
    ).toBe(true);
    expect(
      catalogRevisionIncludes(
        PREVIOUS_HF_CATALOG_REVISION,
        CURRENT_HF_CATALOG_REVISION,
      ),
    ).toBe(false);
  });
  it("does not infer chronology from unknown hashes or names", () => {
    expect(
      catalogRevisionIncludes("ffffffff", CURRENT_HF_CATALOG_REVISION),
    ).toBe(false);
    expect(
      catalogRevisionIncludes(CURRENT_HF_CATALOG_REVISION, "00000000"),
    ).toBe(false);
  });
  it("gates carousel adapters while retaining legacy unrestricted templates", () => {
    expect(
      getCatalogBlockByTemplateId(
        "hf-carousel-circle-v1",
        CURRENT_HF_CATALOG_REVISION,
      ),
    ).toBeDefined();
    expect(
      getCatalogBlockByTemplateId(
        "hf-carousel-circle-v1",
        PREVIOUS_HF_CATALOG_REVISION,
      ),
    ).toBeUndefined();
    expect(
      getCatalogBlockByTemplateId("hf-carousel-circle-v1", "unknown"),
    ).toBeUndefined();
    expect(
      getCatalogBlockByTemplateId(
        "hf-kinetic-slam",
        LEGACY_HF_CATALOG_REVISION,
      ),
    ).toBeDefined();
  });
});
