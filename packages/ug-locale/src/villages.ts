import { Level, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/villages.js";

const store = new LevelStore(raw, Level.Village);

/**
 * Villages / cells within a parish. This is the heavy level — import lazily:
 *   const { villages } = await import("@ugkit/locale/villages");
 * Returns `[]` when the parish has no children in the loaded dataset —
 * check `villageCount > 0` to distinguish "level not sourced yet".
 */
export function villages(parishId: number): Unit[] {
  return store.childrenOf(parishId);
}

/** Village by index id (dataset-version-scoped). `undefined` on miss. */
export function villageById(id: number): Unit | undefined {
  return store.byId(id);
}

/**
 * Village by name — normalized. `undefined` when unknown or ambiguous.
 * Village names repeat heavily across parishes; prefer navigating via
 * `villages(parishId)` and treat this as a convenience for unique names.
 */
export function villageByName(name: string): Unit | undefined {
  return store.byName(name);
}

/** Village by official EC/UBOS code (the persistable identifier). */
export function villageByCode(code: string): Unit | undefined {
  return store.byCode(code);
}

/** Prefix search over village names (typeahead). Default `limit` 20. */
export function searchVillages(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

/** Number of villages in the loaded dataset (0 = level not sourced yet). */
export const villageCount = store.size;
/** Dataset version this blob was generated from. */
export const datasetVersion = store.version;
