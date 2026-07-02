import { Level, type LevelData, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/districts.js";

const store = new LevelStore(raw as LevelData, Level.District);

/** All districts (and cities) of Uganda. */
export function districts(): Unit[] {
  return store.all();
}

export function districtById(id: number): Unit | undefined {
  return store.byId(id);
}

export function districtByName(name: string): Unit | undefined {
  return store.byName(name);
}

export function searchDistricts(prefix: string, limit?: number): Unit[] {
  return store.search(prefix, limit);
}

export const districtCount = store.size;
export const datasetVersion = store.version;
