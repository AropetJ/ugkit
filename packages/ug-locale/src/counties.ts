import { Level, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/counties.js";

const store = new LevelStore(raw, Level.County);

/** Counties / municipalities within a district. O(1) slice lookup. */
export function counties(districtId: number): Unit[] {
  return store.childrenOf(districtId);
}

/** County by index id (dataset-version-scoped). `undefined` on miss. */
export function countyById(id: number): Unit | undefined {
  return store.byId(id);
}

/**
 * County by name — normalized. `undefined` when unknown or when the name is
 * shared by counties in different districts (disambiguate via `counties()`).
 */
export function countyByName(name: string): Unit | undefined {
  return store.byName(name);
}

/** County by official EC/UBOS code (the persistable identifier). */
export function countyByCode(code: string): Unit | undefined {
  return store.byCode(code);
}

/** Prefix search over county names (typeahead). Default `limit` 20. */
export function searchCounties(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

/** Number of counties in the loaded dataset. */
export const countyCount = store.size;
/** Dataset version this blob was generated from. */
export const datasetVersion = store.version;
