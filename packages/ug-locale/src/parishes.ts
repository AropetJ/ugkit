import { Level, type LevelData, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/parishes.js";

const store = new LevelStore(raw as LevelData, Level.Parish);

/** Parishes / wards within a sub-county. */
export function parishes(subCountyId: number): Unit[] {
  return store.childrenOf(subCountyId);
}

export function parishById(id: number): Unit | undefined {
  return store.byId(id);
}

export function parishByName(name: string): Unit | undefined {
  return store.byName(name);
}
