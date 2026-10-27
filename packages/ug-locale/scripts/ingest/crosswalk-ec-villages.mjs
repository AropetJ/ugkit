#!/usr/bin/env node
/**
 * crosswalk-ec-villages.mjs — attach EC villages (staging CSV from
 * parse-ec-admin-units.mjs) to the UBOS parishes in data/uganda.csv.
 *
 * The two sources share no codes: EC keys villages by
 * district-constituency-subcounty-parish (EC codes), UBOS by
 * district.county.subcounty.parish (UBOS codes). So we match by NAME, top
 * down, each step scoped to the parent matched in the step before:
 *
 *   district   → UBOS district           (whole country)
 *   sub-county → UBOS sub-county         (within the matched district —
 *                EC constituencies ≠ UBOS counties, so county is skipped)
 *   parish     → UBOS parish             (within the matched sub-county)
 *
 * At each step, tiers in order — a tier answers only with exactly ONE
 * candidate; otherwise the next tier tries:
 *   1. exact    — identical canonical name;
 *   2. rough    — namesRoughlyEqual (drops Town Council/Ward/Division and
 *                 punctuation), narrowed to candidates whose kind
 *                 (kindFromName) agrees with the EC name's — "Kitoba" vs
 *                 "Kitoba Town Council" both rough-match "kitoba". At
 *                 sub-county level a town council/division never matches a
 *                 different kind (a 2022 TC absent in 2026 stays unmatched);
 *   3. fuzzy    — same "skeleton" (rough form with doubled letters collapsed
 *                 and h-after-consonant dropped: Kitoonya/Kitonya,
 *                 Mucwini/Muchwini), or skeletons one edit apart for names of
 *                 6+ letters (Ndaragi/Ngaragi). Fuzzy matches are spelling
 *                 judgements: listed in the report for human review.
 * Anything else is reported as none/ambiguous, never guessed.
 *
 * Usage:
 *   node crosswalk-ec-villages.mjs <ec-villages.csv> <out-dir>
 * Writes:
 *   <out-dir>/ec-parish-crosswalk.csv   one row per EC parish: match result
 *   <out-dir>/crosswalk-report.txt      summary + every unmatched unit
 *
 * Zero npm deps.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalName, namesRoughlyEqual } from "./normalize.mjs";
import { kindFromName } from "./kinds.mjs";

const [ecPath, outDir] = process.argv.slice(2);
if (!ecPath || !outDir) {
  console.error("usage: node crosswalk-ec-villages.mjs <ec-villages.csv> <out-dir>");
  process.exit(2);
}
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Minimal RFC 4180 reader (the EC staging file quotes a few cells).
function parseCsv(text) {
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
const ecName = (raw) =>
  canonicalName(
    raw
      .replace(/&/g, " and ")
      .replace(/["\[\]_]/g, " ")
      .replace(/\bWARD COUNCIL$/, "WARD")
      .replace(/\bTOWN ?COU?N?C?I?L?$/, "TOWN COUNCIL")
      .replace(/\s+/g, " ")
      .trim(),
  );

// ------------------------------------------------------------ UBOS side
const ubos = parseCsv(readFileSync(join(pkgRoot, "data", "uganda.csv"), "utf8"));
const uDistricts = new Map(); // code → { name, subs: Map(code → { name, parishes: Map(code → name) }) }
for (const r of ubos) {
  if (!uDistricts.has(r.district_code)) uDistricts.set(r.district_code, { name: r.district, subs: new Map() });
  const d = uDistricts.get(r.district_code);
  if (!d.subs.has(r.subcounty_code)) d.subs.set(r.subcounty_code, { name: r.subcounty, kind: r.subcounty_kind, parishes: new Map() });
  d.subs.get(r.subcounty_code).parishes.set(r.parish_code, r.parish);
}

/**
 * Match `name` against candidates [{code, name}]: exact canonical first,
 * then a unique rough match. Returns { code, method } or { method, options }.
 */
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

// ------------------------------------------------------------ EC side
const ec = parseCsv(readFileSync(ecPath, "utf8"));

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
    res.sub = match(p.sName, asCandidates(d.subs), 2);
    if (res.sub.code) {
      res.parish = match(p.pName, asCandidates(d.subs.get(res.sub.code).parishes, (v) => v), 3);
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

// Two EC parishes landing on one UBOS parish would merge village lists —
// legitimate after a parish merger, suspicious otherwise. Report.
const byUbos = new Map();
for (const r of results) if (r.ubosParish) byUbos.set(r.ubosParish, [...(byUbos.get(r.ubosParish) ?? []), r]);
const collisions = [...byUbos].filter(([, rs]) => rs.length > 1);

// ------------------------------------------------------------ report
const sum = (rs) => rs.reduce((n, r) => n + r.villages, 0);
const byStatus = new Map();
for (const r of results) byStatus.set(r.status, [...(byStatus.get(r.status) ?? []), r]);
const totalVillages = sum(results);
const lines = [];
lines.push(`EC parishes: ${results.length}   EC villages: ${totalVillages}   UBOS parishes: ${[...uDistricts.values()].reduce((n, d) => n + [...d.subs.values()].reduce((m, s) => m + s.parishes.size, 0), 0)}`);
lines.push("");
for (const [status, rs] of [...byStatus].sort()) {
  lines.push(`${status.padEnd(22)} ${String(rs.length).padStart(6)} parishes  ${String(sum(rs)).padStart(6)} villages  (${((100 * sum(rs)) / totalVillages).toFixed(1)}%)`);
}
const ubosHit = new Set(results.map((r) => r.ubosParish).filter(Boolean));
lines.push("");
lines.push(`UBOS parishes receiving villages: ${ubosHit.size}`);
lines.push(`UBOS parishes hit by 2+ EC parishes: ${collisions.length}`);
const unmatchedDistricts = [...districtMatch].filter(([, m]) => !m.code);
lines.push("");
lines.push(`Unmatched EC districts (${unmatchedDistricts.length}): ${unmatchedDistricts.map(([n, m]) => `${n} [${m.method}]`).join(", ")}`);
for (const [status, rs] of [...byStatus].sort()) {
  if (status === "matched:exact" || status === "matched:rough") continue;
  lines.push("");
  lines.push(`== ${status} (${rs.length})`);
  for (const r of rs.slice(0, 400)) {
    const opts = (r.parish ?? r.sub ?? r.district).options;
    const to = r.ubosNames ? `  →  UBOS ${r.ubosNames}` : "";
    lines.push(`  ${r.key}  ${r.dName} / ${r.sName} / ${r.pName}  (${r.villages} villages)${to}${opts ? "  options: " + opts.join(" | ") : ""}`);
  }
}
writeFileSync(join(outDir, "crosswalk-report.txt"), lines.join("\n") + "\n");

const esc = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
writeFileSync(
  join(outDir, "ec-parish-crosswalk.csv"),
  "ec_parish_key,ec_district,ec_constituency,ec_subcounty,ec_parish,villages,status,ubos_parish_code\n" +
    results.map((r) => [r.key, r.dName, r.cons, r.sName, r.pName, r.villages, r.status, r.ubosParish].map((v) => esc(String(v))).join(",")).join("\n") + "\n",
);
console.log(lines.slice(0, 16).join("\n"));
