/**
 * kinds.mjs — the unit-kind vocabulary and the name-suffix rules that derive
 * a kind from a canonical name. See docs/design-unit-attributes.md.
 *
 * Shared by the ingest (which WRITES kinds into data/uganda.csv) and by
 * validate.mjs (which checks them). build-data.mjs never derives kinds — it
 * compiles whatever the CSV says.
 *
 * Keep KINDS_BY_LEVEL and REGIONS in sync with `UnitKind` / `Region` in
 * src/types.ts.
 */

/** Allowed kinds per level (0 = district … 4 = village). */
export const KINDS_BY_LEVEL = [
  ["district", "city"],
  ["county", "municipality", "division"],
  ["sub-county", "town-council", "division", "settlement"],
  ["parish", "ward"],
  ["village", "cell"],
];

export const REGIONS = ["Central", "Eastern", "Northern", "Western"];

/**
 * Derive a unit's kind from its canonical name. Source-agnostic: callers
 * apply source-specific knowledge (settlement lists, overrides) first.
 */
export function kindFromName(level, name) {
  switch (level) {
    case 0:
      return name === "Kampala" || name.endsWith(" City") ? "city" : "district";
    case 1:
      if (name.endsWith(" Municipality")) return "municipality";
      if (name.endsWith(" Division")) return "division";
      return "county";
    case 2:
      if (name.endsWith(" Town Council")) return "town-council";
      if (name.endsWith(" Division")) return "division";
      return "sub-county";
    case 3:
      return name.endsWith(" Ward") ? "ward" : "parish";
    case 4:
      return name.endsWith(" Cell") ? "cell" : "village";
    default:
      throw new Error(`kindFromName: bad level ${level}`);
  }
}
