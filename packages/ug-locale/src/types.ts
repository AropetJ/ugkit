/**
 * @ugkit/locale — core types
 *
 * The dataset is an immutable tree known at build time, so we store it the
 * way a compiler would: flat, structure-of-arrays, with parent indices and
 * children laid out contiguously.
 *
 * Every administrative unit is a "node". Nodes of one level are sorted so
 * that all children of a given parent are adjacent. That means:
 *
 *   childrenOf(parent) === one slice — O(1), zero allocation, no filter().
 */

/** Administrative levels, root → leaf. */
export enum Level {
  District = 0,
  County = 1,
  SubCounty = 2,
  Parish = 3,
  Village = 4,
}

/**
 * The packed wire format for one level, as emitted by scripts/build-data.mjs.
 * Parallel arrays: entry i across all arrays describes one unit.
 */
export interface LevelData {
  /** Dataset version this blob was generated from, e.g. "2026.1". */
  version: string;
  /** Unit names, in (parent, name) sorted order. */
  names: string[];
  /**
   * Index of each unit's parent in the *previous* level's arrays.
   * Districts (root level) have parent -1.
   */
  parents: number[];
  /**
   * For each unit in the *previous* level: [firstChildIndex, childCount]
   * into this level's arrays. Stored on the child blob so each file is
   * self-sufficient for "children of X" queries.
   */
  spans: [first: number, count: number][];
}

/** Public, ergonomic shape returned by query functions. */
export interface Unit {
  /** Stable index within its level for this dataset version. */
  id: number;
  name: string;
  /** id of the parent unit in the level above (undefined for districts). */
  parentId?: number;
  level: Level;
}
