/**
 * Internal engine shared by every level module.
 *
 * Design notes (the "why", not just the "what"):
 *
 * 1. Indices are built LAZILY. Importing a level costs only JSON parse of
 *    its blob. The Map for name lookup is constructed on the first call
 *    that needs it, then cached. Cold import stays cheap; hot lookups are O(1).
 *
 * 2. childrenOf is a slice over contiguous data — the build script sorts
 *    children under their parent, so we never filter() at runtime.
 *
 * 3. Name matching normalizes case/whitespace/punctuation, because real
 *    Ugandan datasets disagree on "Fort Portal" vs "FORT-PORTAL " etc.
 */

import { Level, type LevelData, type Unit } from "./types.js";

/** Normalize a name for lookup: lowercase, collapse whitespace, strip punctuation. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export class LevelStore {
  private nameIndex: Map<string, number> | undefined;

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

  /** O(1) after first call (lazy Map build). */
  byName(name: string): Unit | undefined {
    if (!this.nameIndex) {
      this.nameIndex = new Map();
      for (let i = 0; i < this.data.names.length; i++) {
        this.nameIndex.set(normalizeName(this.data.names[i]!), i);
      }
    }
    const id = this.nameIndex.get(normalizeName(name));
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

  /** Simple prefix search over names (for typeahead). O(n) but n is per-level. */
  search(prefix: string, limit = 20): Unit[] {
    const q = normalizeName(prefix);
    if (!q) return [];
    const out: Unit[] = [];
    for (let i = 0; i < this.data.names.length && out.length < limit; i++) {
      if (normalizeName(this.data.names[i]!).startsWith(q)) {
        out.push(this.unit(i, this.data.names[i]!, this.data.parents[i]!));
      }
    }
    return out;
  }

  private unit(id: number, name: string, parent: number): Unit {
    return {
      id,
      name,
      parentId: parent >= 0 ? parent : undefined,
      level: this.level,
    };
  }
}
