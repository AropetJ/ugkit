import { Level, type LevelData, type Unit } from "./types.js";
import { LevelStore } from "./store.js";
import raw from "./generated/villages.js";

const store = new LevelStore(raw as LevelData, Level.Village);

/** Villages / cells within a parish. This is the heavy level — import lazily:
 *    const { villages } = await import("@ugkit/locale/villages");
 */
export function villages(parishId: number): Unit[] {
  return store.childrenOf(parishId);
}

export function villageById(id: number): Unit | undefined {
  return store.byId(id);
}
