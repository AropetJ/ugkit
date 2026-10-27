/**
 * normalize.mjs — canonical name cleanup for ingested source data.
 *
 * Source lists (EC PDFs, UBOS profiles) disagree on casing, whitespace and
 * punctuation. Every ingested name passes through here BEFORE landing in
 * data/uganda.csv, so the committed CSV is already canonical and the runtime
 * only needs lookup-time normalization (src/store.ts).
 *
 * Policy decisions (change deliberately, with a datasetVersion bump):
 *   - Title Case with known lowercase particles preserved.
 *   - Structural suffixes (County, Division, Town Council, Municipality,
 *     Ward, Zone, Cell...) are KEPT — they are semantically real.
 *   - Roman-numeral and letter suffixes (I, II, III, A, B) stay uppercase.
 *   - Segments after "-", "/", "(" and "." are capitalized like words
 *     ("Bussi/Kisaba", "Nakaziba (Ggavu)", "P.W.D"); apostrophes are not
 *     segment boundaries ("T'oo").
 *   - Commas are FORBIDDEN in names (they would break the CSV): replaced
 *     with " - ".
 */

const KEEP_UPPER = new Set(["I", "II", "III", "IV", "V", "A", "B", "C", "LC"]);
const KEEP_LOWER = new Set(["of", "and"]);

export function canonicalName(raw) {
  const cleaned = raw
    .normalize("NFKC")
    .replace(/,/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .split(" ")
    .map((word, i) => {
      const upper = word.toUpperCase();
      if (KEEP_UPPER.has(upper)) return upper;
      const lower = word.toLowerCase();
      if (i > 0 && KEEP_LOWER.has(lower)) return lower;
      // Capitalize every segment start, not just the word start:
      // "fort-portal" → "Fort-Portal", "bussi/kisaba" → "Bussi/Kisaba",
      // "bweya(sseta)" → "Bweya(Sseta)", "p.w.d" → "P.W.D".
      // Apostrophes are deliberately NOT boundaries ("T'oo", not "T'Oo").
      return lower.replace(/(^|[-\/(.])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(" ");
}

/** Loose equality for cross-source reconciliation (EC name vs UBOS name). */
export function namesRoughlyEqual(a, b) {
  const strip = (s) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\b(county|division|town council|municipality|sub county|subcounty|ward)\b/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  return strip(a) === strip(b);
}
