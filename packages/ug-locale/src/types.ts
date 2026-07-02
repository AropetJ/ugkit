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
 *   childrenOf(parent) === one slice — O(1) to locate, no filter().
 */

/** Administrative levels, root → leaf. */
export const Level = {
  District: 0,
  County: 1,
  SubCounty: 2,
  Parish: 3,
  Village: 4,
} as const;
export type Level = (typeof Level)[keyof typeof Level];

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
   * Official codes (Electoral Commission / UBOS), parallel to `names`.
   * Empty string when the source did not provide a code for the unit.
   */
  codes: string[];
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
  /**
   * Index of the unit within its level — valid ONLY for the dataset version
   * it came from. Ids shift when the dataset changes (districts split,
   * units are renamed). NEVER persist `id` in a database; persist `code`
   * (and fall back to `name`) instead, and resolve at read time.
   */
  id: number;
  name: string;
  /**
   * Official code (EC/UBOS) when the source provides one, e.g. "006" for
   * Hoima. Stable across dataset versions — this is the value to persist.
   */
  code?: string;
  /** id of the parent unit in the level above (undefined for districts). */
  parentId?: number;
  level: Level;
}
