import { Level, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/districts.js";

const store = new LevelStore(raw, Level.District);

/** All districts (and cities) of Uganda, sorted by name. */
export function districts(): Unit[] {
  return store.all();
}

/** District by index id (dataset-version-scoped). `undefined` on miss. */
export function districtById(id: number): Unit | undefined {
  return store.byId(id);
}

/**
 * District by name — case/whitespace/punctuation-insensitive.
 * `undefined` when unknown or ambiguous.
 */
export function districtByName(name: string): Unit | undefined {
  return store.byName(name);
}

/** District by official EC/UBOS code (the persistable identifier). */
export function districtByCode(code: string): Unit | undefined {
  return store.byCode(code);
}

/** Prefix search over district names (typeahead). Default `limit` 20. */
export function searchDistricts(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

/** Number of districts in the loaded dataset. */
export const districtCount = store.size;
/** Dataset version this blob was generated from, e.g. "2026.1". */
export const datasetVersion = store.version;
