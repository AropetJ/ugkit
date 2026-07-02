import { Level, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/subcounties.js";

const store = new LevelStore(raw, Level.SubCounty);

/**
 * Sub-counties / town councils / municipal divisions within a county.
 * Returns `[]` when the county has no children in the loaded dataset —
 * check `subCountyCount > 0` to distinguish "level not sourced yet".
 */
export function subCounties(countyId: number): Unit[] {
  return store.childrenOf(countyId);
}

/** Sub-county by index id (dataset-version-scoped). `undefined` on miss. */
export function subCountyById(id: number): Unit | undefined {
  return store.byId(id);
}

/** Sub-county by name — normalized. `undefined` when unknown or ambiguous. */
export function subCountyByName(name: string): Unit | undefined {
  return store.byName(name);
}

/** Sub-county by official EC/UBOS code (the persistable identifier). */
export function subCountyByCode(code: string): Unit | undefined {
  return store.byCode(code);
}

/** Prefix search over sub-county names (typeahead). Default `limit` 20. */
export function searchSubCounties(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

/** Number of sub-counties in the loaded dataset (0 = level not sourced yet). */
export const subCountyCount = store.size;
/** Dataset version this blob was generated from. */
export const datasetVersion = store.version;
