/**
 * Internal engine shared by every level module.
 *
 * Design notes (the "why", not just the "what"):
 *
 * 1. Indices are built LAZILY. Importing a level costs only JSON parse of
 *    its blob. The Maps for name/code lookup and the normalized-name cache
 *    are constructed on the first call that needs them, then cached.
 *    Cold import stays cheap; hot lookups are O(1).
 *
 * 2. childrenOf is a slice over contiguous data — the build script sorts
 *    children under their parent, so we never filter() at runtime.
 *
 * 3. Name matching normalizes case/whitespace/punctuation, because real
 *    Ugandan datasets disagree on "Fort Portal" vs "FORT-PORTAL " etc.
 *    Apostrophes and diacritics are DELETED (not split on): a user typing
 *    "Ngora" must match "Ng'ora", and "Merida" must match "Mérida".
 *
 * 4. Duplicate names are a fact of the data (many districts have a
 *    "Central" division; village names repeat constantly). byName answers
 *    only when the name is unambiguous at its level — ambiguous names
 *    return undefined rather than an arbitrary winner.
 */

import { Level, type LevelData, type Unit } from "./types.js";

/**
 * Normalize a name for lookup: lowercase; strip diacritics and apostrophes;
 * collapse any other punctuation/whitespace runs into single spaces.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\p{M}'’ʼ]+/gu, "") // delete: combining marks, apostrophes
    .replace(/[^\p{L}\p{N}]+/gu, " ") // separate: everything else
    .trim();
}

/** Sentinel in the name index marking a name shared by 2+ units. */
const AMBIGUOUS = -2;

export class LevelStore {
  private nameIndex: Map<string, number> | undefined;
  private codeIndex: Map<string, number> | undefined;
  private normalized: string[] | undefined;

  constructor(
    private readonly data: LevelData,
    private readonly level: Level,
  ) {}

  get size(): number {
    return this.data.names.length;
  }

  get version(): string {
    return this.data.version;
  }

  /** All units at this level. Allocates once per call — prefer byId/childrenOf in hot paths. */
  all(): Unit[] {
    const { names, parents } = this.data;
    const out: Unit[] = new Array(names.length);
    for (let i = 0; i < names.length; i++) {
      out[i] = this.unit(i, names[i]!, parents[i]!);
    }
    return out;
  }

  byId(id: number): Unit | undefined {
    const name = this.data.names[id];
    if (name === undefined) return undefined;
    return this.unit(id, name, this.data.parents[id]!);
  }

  /** Normalized names, computed once and shared by byName and search. */
  private normalizedNames(): string[] {
    if (!this.normalized) {
      this.normalized = this.data.names.map(normalizeName);
    }
    return this.normalized;
  }

  /**
   * O(1) after first call (lazy Map build). Returns undefined when the name
   * is unknown OR when it is AMBIGUOUS at this level (shared by 2+ units) —
   * use childrenOf/search to disambiguate via the parent.
   */
  byName(name: string): Unit | undefined {
    if (!this.nameIndex) {
      this.nameIndex = new Map();
      const norm = this.normalizedNames();
      for (let i = 0; i < norm.length; i++) {
        this.nameIndex.set(norm[i]!, this.nameIndex.has(norm[i]!) ? AMBIGUOUS : i);
      }
    }
    const id = this.nameIndex.get(normalizeName(name));
    return id === undefined || id === AMBIGUOUS ? undefined : this.byId(id);
  }

  /**
   * Lookup by official EC/UBOS code — the stable identifier to persist.
   * O(1) after first call. Returns undefined for unknown/uncoded units.
   */
  byCode(code: string): Unit | undefined {
    if (!this.codeIndex) {
      this.codeIndex = new Map();
      const { codes } = this.data;
      for (let i = 0; i < codes.length; i++) {
        if (codes[i]) this.codeIndex.set(codes[i]!, i);
      }
    }
    const id = this.codeIndex.get(code.trim());
    return id === undefined ? undefined : this.byId(id);
  }

  /**
   * Children of a unit in the level ABOVE this one.
   * Contiguous layout ⇒ this is a slice, not a scan.
   */
  childrenOf(parentId: number): Unit[] {
    const span = this.data.spans[parentId];
    if (!span) return [];
    const [first, count] = span;
    const out: Unit[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const idx = first + i;
      out[i] = this.unit(idx, this.data.names[idx]!, this.data.parents[idx]!);
    }
    return out;
  }

  /**
   * Simple prefix search over names (for typeahead). O(n) scan over the
   * cached normalized names — no per-call re-normalization.
   */
  search(prefix: string, limit = 20): Unit[] {
    const q = normalizeName(prefix);
    if (!q) return [];
    const norm = this.normalizedNames();
    const out: Unit[] = [];
    for (let i = 0; i < norm.length && out.length < limit; i++) {
      if (norm[i]!.startsWith(q)) {
        out.push(this.unit(i, this.data.names[i]!, this.data.parents[i]!));
      }
    }
    return out;
  }

  private unit(id: number, name: string, parent: number): Unit {
    const u: Unit = { id, name, level: this.level };
    const code = this.data.codes[id];
    if (code) u.code = code;
    if (parent >= 0) u.parentId = parent;
    return u;
  }
}
