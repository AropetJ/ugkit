import { Level, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/parishes.js";

const store = new LevelStore(raw, Level.Parish);

/**
 * Parishes / wards within a sub-county.
 * Returns `[]` when the sub-county has no children in the loaded dataset —
 * check `parishCount > 0` to distinguish "level not sourced yet".
 */
export function parishes(subCountyId: number): Unit[] {
  return store.childrenOf(subCountyId);
}

/** Parish by index id (dataset-version-scoped). `undefined` on miss. */
export function parishById(id: number): Unit | undefined {
  return store.byId(id);
}

/** Parish by name — normalized. `undefined` when unknown or ambiguous. */
export function parishByName(name: string): Unit | undefined {
  return store.byName(name);
}

/** Parish by official EC/UBOS code (the persistable identifier). */
export function parishByCode(code: string): Unit | undefined {
  return store.byCode(code);
}

/** Prefix search over parish names (typeahead). Default `limit` 20. */
export function searchParishes(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

/** Number of parishes in the loaded dataset (0 = level not sourced yet). */
export const parishCount = store.size;
/** Dataset version this blob was generated from. */
export const datasetVersion = store.version;
