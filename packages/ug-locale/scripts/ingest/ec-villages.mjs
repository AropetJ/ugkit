/**
 * ec-villages.mjs — shared logic for attaching EC villages to UBOS parishes.
 *
 * Used by build-ubos-frame.mjs (which writes the villages into
 * data/uganda.csv) and by crosswalk-ec-villages.mjs (which writes review
 * reports). One implementation, so the review always describes exactly what
 * the dataset ships. Matching rules are documented in
 * crosswalk-ec-villages.mjs.
 *
 * Zero npm deps.
 */

import { canonicalName, namesRoughlyEqual } from "./normalize.mjs";
import { kindFromName } from "./kinds.mjs";

// Minimal RFC 4180 reader (the EC staging file quotes a few cells).
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// EC names carry characters our canonical alphabet doesn't admit, plus
// suffix typos and the report's 30-character truncation ("…TOWN COUNCI").
export const ecName = (raw) =>
  canonicalName(
    raw
      .replace(/&/g, " and ")
      .replace(/["\[\]_]/g, " ")
      .replace(/\bWARD COUNCIL$/, "WARD")
      .replace(/\bTOWN ?COU?N?C?I?L?$/, "TOWN COUNCIL")
      .replace(/\s+/g, " ")
      .trim(),
  );

const rough = (s) =>
  s.toLowerCase().normalize("NFKD")
    .replace(/\b(county|division|town council|municipality|sub county|subcounty|ward)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
const skeleton = (s) => rough(s).replace(/([bcdfgjklmnpqrstvwxyz])h/g, "$1").replace(/(.)\1+/g, "$1");
function editDistanceAtMost1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Match `name` against candidates [{code, name}] at `level`, tier by tier
 * (exact → rough → fuzzy, see crosswalk-ec-villages.mjs). Returns
 * { code, method } or { method: "ambiguous"|"none", options? }.
 */
function match(name, candidates, level) {
  const one = (hits, method) =>
    hits.length === 1 ? { code: hits[0].code, method } :
    hits.length > 1 ? { method: "ambiguous", options: hits.map((c) => c.name) } : null;

  const exact = candidates.filter((c) => c.name === name);
  if (exact.length) return one(exact, "exact");

  // Non-exact tiers respect kind: prefer candidates of the EC name's kind,
  // and at sub-county level never cross from a town council/division to a
  // different kind — "Ruteete Town Council" (EC 2022) is NOT "Ruteete"
  // sub-county (UBOS 2026 has no such town council).
  const kind = kindFromName(level, name);
  const byKind = (hits) => {
    const same = hits.filter((c) => kindFromName(level, c.name) === kind);
    if (same.length) return same;
    if (level === 2 && kind !== "sub-county") return [];
    return hits;
  };

  // Alternates: renamed units often carry both names ("Serere/Olio",
  // "Greek River (Kiriki)"), so compare every slash part and the name with
  // its parenthetical removed, on both sides.
  const alternates = (s) => {
    const base = s.replace(/\s*\([^)]*\)\s*/g, " ").trim();
    return [...new Set([s, base, ...base.split("/").map((x) => x.trim()).filter(Boolean)])];
  };
  const mine = alternates(name);
  const roughHits = byKind(
    candidates.filter((c) => alternates(c.name).some((a) => mine.some((b) => namesRoughlyEqual(a, b)))),
  );
  if (roughHits.length) return one(roughHits, "rough");

  const sk = skeleton(name);
  let fuzzy = byKind(candidates.filter((c) => skeleton(c.name) === sk));
  if (!fuzzy.length && sk.length >= 6)
    fuzzy = byKind(candidates.filter((c) => editDistanceAtMost1(skeleton(c.name), sk)));
  if (fuzzy.length) return one(fuzzy, "fuzzy");
  return { method: "none" };
}
const asCandidates = (map, nameOf = (v) => v.name) => [...map].map(([code, v]) => ({ code, name: nameOf(v) }));


/**
 * UBOS tree for matching, from rows carrying district_code, district,
 * subcounty_code, subcounty, parish_code, parish (canonical names).
 */
export function ubosTree(rows) {
  const uDistricts = new Map(); // code → { name, subs: Map(code → { name, parishes: Map(code → name) }) }
  for (const r of rows) {
    if (!uDistricts.has(r.district_code)) uDistricts.set(r.district_code, { name: r.district, subs: new Map() });
    const d = uDistricts.get(r.district_code);
    if (!d.subs.has(r.subcounty_code)) d.subs.set(r.subcounty_code, { name: r.subcounty, parishes: new Map() });
    d.subs.get(r.subcounty_code).parishes.set(r.parish_code, r.parish);
  }
  return uDistricts;
}

/**
 * Load ec-fuzzy-review.csv → Map("<level>|<ubos_code>|<ec name>" → verdict).
 * Every fuzzy match must be listed there (see crosswalkEcParishes).
 */
export function loadFuzzyReview(text) {
  const body = text.split("\n").filter((l) => l && !l.startsWith("#")).join("\n");
  const review = new Map();
  for (const r of parseCsv(body + "\n")) {
    const name = r.level === "sub-county" ? r.ec_subcounty : r.ec_parish;
    if (r.verdict !== "accept" && r.verdict !== "reject")
      throw new Error(`ec-fuzzy-review: bad verdict "${r.verdict}" for ${name}`);
    review.set(`${r.level}|${r.ubos_code}|${name}`, r.verdict);
  }
  return review;
}

/**
 * Apply the human review to a fuzzy match: accepted stays "fuzzy",
 * rejected becomes "rejected", absent becomes "unreviewed" — the last two
 * do NOT match, so their villages are not placed.
 */
function reviewed(m, level, ecNameOfUnit, review) {
  if (m.method !== "fuzzy") return m;
  const verdict = review?.get(`${level}|${m.code}|${ecNameOfUnit}`);
  if (verdict === "accept") return m;
  return { method: verdict === "reject" ? "rejected" : "unreviewed", options: [m.code] };
}

/**
 * Match every distinct EC parish (from parsed EC village rows) to a UBOS
 * parish. `review` (from loadFuzzyReview) gates fuzzy matches; without it
 * every fuzzy match is "unreviewed". Returns one result per EC parish:
 *   { key, dName, cons, sName, pName, villages, status, ubosParish, ubosNames, … }
 * `ubosParish` is the UBOS parish code, or "" when unmatched.
 */
export function crosswalkEcParishes(ec, uDistricts, review) {
  // Distinct EC parishes, with their village counts.
  const ecParishes = new Map(); // key → { d, dName, cons, sName, pName, villages }
  for (const r of ec) {
    const key = [r.district_code, r.constituency_code, r.subcounty_code, r.parish_code].join("-");
    if (!ecParishes.has(key))
      ecParishes.set(key, {
        key, dName: ecName(r.district), cons: r.constituency,
        sName: ecName(r.subcounty), pName: ecName(r.parish), villages: 0,
      });
    ecParishes.get(key).villages++;
  }

  // District: the EC prints cities without "City" in a few cases (2022 names);
  // try "<name> City" as a second exact candidate before rough matching.
  const districtCands = asCandidates(uDistricts);
  const districtMatch = new Map();
  for (const p of ecParishes.values()) {
    if (districtMatch.has(p.dName)) continue;
    let m = match(p.dName, districtCands, 0);
    if (m.method === "none") m = match(`${p.dName} City`, districtCands, 0);
    districtMatch.set(p.dName, m);
  }

  const results = [];
  for (const p of ecParishes.values()) {
    const res = { ...p, district: districtMatch.get(p.dName) };
    if (res.district.code) {
      const d = uDistricts.get(res.district.code);
      res.sub = reviewed(match(p.sName, asCandidates(d.subs), 2), "sub-county", p.sName, review);
      if (res.sub.code) {
        const parishes = asCandidates(d.subs.get(res.sub.code).parishes, (v) => v);
        res.parish = reviewed(match(p.pName, parishes, 3), "parish", p.pName, review);
      }
    }
    res.status =
      !res.district.code ? `district:${res.district.method}` :
      !res.sub.code ? `subcounty:${res.sub.method}` :
      !res.parish.code ? `parish:${res.parish.method}` :
      [res.district, res.sub, res.parish].some((m) => m.method === "fuzzy") ? "matched:fuzzy" :
      [res.district, res.sub, res.parish].every((m) => m.method === "exact") ? "matched:exact" :
      "matched:rough";
    res.ubosParish = res.parish?.code ? res.parish.code : "";
    res.ubosNames = res.ubosParish
      ? (() => { const d = uDistricts.get(res.district.code), sc = d.subs.get(res.sub.code);
          return `${sc.name} / ${sc.parishes.get(res.parish.code)}`; })()
      : "";
    results.push(res);
  }

  return results;
}
