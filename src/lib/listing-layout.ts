/**
 * Shared responsive listing grids — target 6 columns on wide screens,
 * stepping down cleanly on smaller viewports.
 */
export const LISTING_GRID_6 =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/** Slightly roomier gap for card-heavy pages (projects, renders, templates). */
export const LISTING_GRID_6_CARDS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

export type ListingViewMode = "list" | "grid";
