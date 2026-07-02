import { Level, type LevelData, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/counties.js";

const store = new LevelStore(raw as LevelData, Level.County);

/** Counties / municipalities within a district. O(1) slice lookup. */
export function counties(districtId: number): Unit[] {
  return store.childrenOf(districtId);
}

export function countyById(id: number): Unit | undefined {
  return store.byId(id);
}

export function countyByName(name: string): Unit | undefined {
  return store.byName(name);
}
