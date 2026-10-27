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

/** Uganda's four statistical regions (UBOS). Carried on districts. */
export type Region = "Central" | "Eastern" | "Northern" | "Western";

/**
 * Administrative kind of a unit. Which kinds occur depends on the level:
 *
 * - district level: `district`, `city` (Kampala + the operational cities)
 * - county level: `county`, `municipality`, `division` (city divisions)
 * - sub-county level: `sub-county`, `town-council`, `division`,
 *   `settlement` (refugee settlements — administered by the Office of the
 *   Prime Minister; exclude them to match EC/census counts)
 * - parish level: `parish`, `ward`
 * - village level: `village`, `cell`
 */
export type UnitKind =
  | "district"
  | "city"
  | "county"
  | "municipality"
  | "division"
  | "sub-county"
  | "town-council"
  | "settlement"
  | "parish"
  | "ward"
  | "village"
  | "cell";

/**
 * A dictionary-encoded string column: `values[index[i]]` is unit i's value.
 * One small int per unit on the wire instead of a repeated string.
 */
export interface DictColumn<T extends string> {
  values: T[];
  index: number[];
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
  /** Kind of each unit, parallel to `names`. */
  kinds: DictColumn<UnitKind>;
  /** Region of each unit — district level only, absent when unsourced. */
  regions?: DictColumn<Region>;
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
   * Official UBOS code when the source provides one, e.g. "113" for Wakiso,
   * "113.1.01" for one of its sub-counties. Stable across dataset versions —
   * this is the value to persist.
   */
  code?: string;
  /** id of the parent unit in the level above (undefined for districts). */
  parentId?: number;
  level: Level;
  /** Administrative kind — see {@link UnitKind} for the values per level. */
  kind: UnitKind;
  /** Statistical region — set on districts only. */
  region?: Region;
}
