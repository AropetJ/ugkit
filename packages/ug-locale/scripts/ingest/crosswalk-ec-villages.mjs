#!/usr/bin/env node
/**
 * crosswalk-ec-villages.mjs — review report for attaching EC villages
 * (parse-ec-admin-units.mjs output) to the UBOS parishes in data/uganda.csv.
 * The matching itself lives in ec-villages.mjs and is the SAME code
 * build-ubos-frame.mjs uses to write villages into the dataset.
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
 *                 judgements, so each needs a human verdict in
 *                 ec-fuzzy-review.csv: accepted ones match, rejected ones
 *                 don't, and any without a verdict ("unreviewed") stop
 *                 build-ubos-frame.mjs until reviewed.
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
import { crosswalkEcParishes, loadFuzzyReview, parseCsv, ubosTree } from "./ec-villages.mjs";

const [ecPath, outDir] = process.argv.slice(2);
if (!ecPath || !outDir) {
  console.error("usage: node crosswalk-ec-villages.mjs <ec-villages.csv> <out-dir>");
  process.exit(2);
}
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ubos = parseCsv(readFileSync(join(pkgRoot, "data", "uganda.csv"), "utf8"));
const uDistricts = ubosTree(ubos);
const review = loadFuzzyReview(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ec-fuzzy-review.csv"), "utf8"));
const results = crosswalkEcParishes(parseCsv(readFileSync(ecPath, "utf8")), uDistricts, review);
const districtMatch = new Map(results.map((r) => [r.dName, r.district]));

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
