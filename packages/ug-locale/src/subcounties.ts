import { Level, type LevelData, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/subcounties.js";

const store = new LevelStore(raw as LevelData, Level.SubCounty);

/** Sub-counties / town councils / divisions within a county. */
export function subCounties(countyId: number): Unit[] {
  return store.childrenOf(countyId);
}

export function subCountyById(id: number): Unit | undefined {
  return store.byId(id);
}

export function subCountyByName(name: string): Unit | undefined {
  return store.byName(name);
}
