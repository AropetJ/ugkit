#!/usr/bin/env node
/**
 * validate.mjs — data quality gate for data/uganda.csv.
 *
 * Run via `npm run validate:data`. Wired into prepublishOnly so it is
 * impossible to publish a package whose dataset fails these checks.
 *
 * CSV format v2 (16 columns): `region`, then a `code,name,kind` triple per
 * level; codes optional; rows may stop at any level (variable depth, by NAME
 * presence). See docs/design-unit-attributes.md.
 *
 *   ATTRIBUTES (always fatal): every present unit has a kind from its level's
 *   allow-list (kinds.mjs), constant across rows; the full dataset has a
 *   valid region on every row, constant per district.
 *
 * Three classes of checks:
 *
 *   STRUCTURAL (always fatal): well-formed rows, no interior gaps, no
 *   duplicate rows, no duplicate codes within a level.
 *
 *   CHARSET (always fatal): names must match the canonicalName output
 *   alphabet — letters/digits/space/hyphen/apostrophe/period/slash.
 *   Anything else (especially commas) would corrupt the naive CSV split.
 *   Codes must be short alphanumerics.
 *
 *   REFERENCE COUNTS (fatal on full dataset, skipped on sample data and on
 *   levels not yet sourced): per-level totals must land within tolerance of
 *   the Electoral Commission's published statistics. Update EXPECTED when
 *   the EC or UBOS publish new figures, alongside a datasetVersion bump.
 *
 * EC reference (as of 13 Nov 2025): 146 districts/cities, 312 counties,
 * 2,191 sub-counties/towns/municipal divisions, 10,717 parishes,
 * 71,214 villages. Source: https://www.ec.or.ug/voter-statistics
 * The UBOS parish frame (dataset 2026.1) lands exactly on 312 counties —
 * city/municipal divisions sit at sub-county level, not county level — so
 * the county tolerance is tight like the others: it only absorbs gazetting
 * churn (e.g. the pending Tororo split adds a handful of counties).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS_BY_LEVEL, REGIONS } from "./kinds.mjs";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fullCsv = join(pkgRoot, "data", "uganda.csv");
const sampleCsv = join(pkgRoot, "data", "uganda.sample.csv");

const isFull = existsSync(fullCsv);
const csvPath = isFull ? fullCsv : sampleCsv;

const LEVELS = ["districts", "counties", "subcounties", "parishes", "villages"];
const HEADER =
  "region,district_code,district,district_kind,county_code,county,county_kind," +
  "subcounty_code,subcounty,subcounty_kind,parish_code,parish,parish_kind," +
  "village_code,village,village_kind";

// canonicalName's output alphabet. Comma is structurally forbidden (CSV).
const NAME_RE = /^[\p{L}\p{N} .'’\-\/()]+$/u;
// UBOS codes are dotted (113.1.01.01, ≤12 chars); EC village codes are
// dashed (100-118-01-13-05, ≤17).
const CODE_RE = /^[A-Za-z0-9.\-]{0,20}$/;

// [expected, tolerance]. Tolerance absorbs gazetting churn (e.g. the pending
// Tororo split) between EC statistical releases.
const EXPECTED = [
  [146, 5],      // districts + cities
  [312, 15],     // counties / constituency-equivalents
  [2191, 100],   // sub-counties / town councils / divisions
  [10717, 300],  // parishes / wards
  [71214, 1500], // villages / cells
];

const lines = readFileSync(csvPath, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
const header = lines.shift()?.trim();
const errors = [];

if (header !== HEADER) {
  errors.push(`Bad header: ${header}`);
}

const SEP = "\u0000";
const perLevel = LEVELS.map(() => new Set());
const codesPerLevel = LEVELS.map(() => new Map()); // code -> first pathKey
const seenRows = new Set();
const kindOfKey = LEVELS.map(() => new Map()); // pathKey -> kind
const regionOfDistrict = new Map();            // district pathKey -> region

lines.forEach((line, n) => {
  const cells = line.split(",").map((s) => s.trim());
  if (cells.length < 4 || cells.length > 16) {
    errors.push(`Row ${n + 2}: expected 4-16 cells, got ${cells.length}`);
    return;
  }
  const region = cells[0];
  const units = [];
  for (let L = 0; L < 5; L++) {
    const at = 1 + 3 * L;
    units.push({ code: cells[at] ?? "", name: cells[at + 1] ?? "", kind: cells[at + 2] ?? "" });
  }

  // VARIABLE DEPTH: a row populates levels 0..depth-1 then stops (by name).
  let depth = 0;
  while (depth < 5 && units[depth].name) depth++;
  if (depth === 0) {
    errors.push(`Row ${n + 2}: empty district cell`);
    return;
  }
  for (let i = depth; i < 5; i++) {
    if (units[i].name || units[i].code || units[i].kind)
      errors.push(`Row ${n + 2}: interior gap — ${LEVELS[i]} set but a shallower level is empty`);
  }
  for (let i = 0; i < depth; i++) {
    const { name, code } = units[i];
    if (!NAME_RE.test(name))
      errors.push(`Row ${n + 2}: illegal character in ${LEVELS[i]} name "${name}"`);
    if (/\s{2,}/.test(name)) errors.push(`Row ${n + 2}: doubled whitespace in "${name}"`);
    if (!CODE_RE.test(code))
      errors.push(`Row ${n + 2}: bad ${LEVELS[i]} code "${code}"`);
    if (!KINDS_BY_LEVEL[i].includes(units[i].kind))
      errors.push(`Row ${n + 2}: bad ${LEVELS[i]} kind "${units[i].kind}"`);
  }
  if (isFull && !REGIONS.includes(region))
    errors.push(`Row ${n + 2}: bad region "${region}"`);

  if (seenRows.has(line)) errors.push(`Row ${n + 2}: exact duplicate row`);
  seenRows.add(line);

  let key = "";
  for (let L = 0; L < depth; L++) {
    key += SEP + units[L].name;
    const isNew = !perLevel[L].has(key);
    perLevel[L].add(key);
    const priorKind = kindOfKey[L].get(key);
    if (priorKind !== undefined && priorKind !== units[L].kind)
      errors.push(`Row ${n + 2}: ${LEVELS[L]} "${units[L].name}" kind ${units[L].kind} ≠ earlier ${priorKind}`);
    kindOfKey[L].set(key, units[L].kind);
    if (L === 0) {
      const priorRegion = regionOfDistrict.get(key);
      if (priorRegion !== undefined && priorRegion !== region)
        errors.push(`Row ${n + 2}: district "${units[0].name}" region ${region} ≠ earlier ${priorRegion}`);
      regionOfDistrict.set(key, region);
    }
    const code = units[L].code;
    if (code) {
      const prior = codesPerLevel[L].get(code);
      if (prior !== undefined && prior !== key) {
        errors.push(`Row ${n + 2}: ${LEVELS[L]} code ${code} reused by a different unit`);
      } else if (isNew || prior === undefined) {
        codesPerLevel[L].set(code, key);
      }
    }
  }
});

console.log(`Validating ${csvPath}${isFull ? "" : " (SAMPLE — reference counts skipped)"}\n`);

for (let L = 0; L < 5; L++) {
  const count = perLevel[L].size;
  const [want, tol] = EXPECTED[L];
  const line = `${LEVELS[L].padEnd(12)} ${String(count).padStart(6)}`;
  if (!isFull) {
    console.log(`${line}  (target ~${want})`);
    continue;
  }
  if (count === 0) {
    // Partial dataset: this level isn't sourced yet (e.g. villages pending UBOS).
    // The check re-engages automatically once rows populate it.
    console.log(`${line}  (not yet sourced — skipped)`);
    continue;
  }
  const ok = Math.abs(count - want) <= tol;
  console.log(`${line}  expected ${want} ±${tol}  ${ok ? "✓" : "✗"}`);
  if (!ok) errors.push(`${LEVELS[L]}: count ${count} outside ${want} ±${tol}`);
}

// EC/census frame check. UBOS files refugee settlements as sub-counties; the
// EC and the 2024 census do not. Excluding them, the dataset must land close
// to the EC figures — a much tighter check than the raw totals above.
if (isFull) {
  const settlements = [...kindOfKey[2]].filter(([, k]) => k === "settlement").map(([key]) => key);
  const inSettlement = (key) => settlements.some((s) => key.startsWith(s + SEP));
  const frame = [
    ["subcounties", perLevel[2].size - settlements.length, 2191, 10],
    ["parishes", [...perLevel[3]].filter((k) => !inSettlement(k)).length, 10717, 50],
  ];
  console.log(`\nEC frame (excluding ${settlements.length} refugee settlements):`);
  for (const [label, count, want, tol] of frame) {
    if (count === 0) continue;
    const ok = Math.abs(count - want) <= tol;
    console.log(`${label.padEnd(12)} ${String(count).padStart(6)}  expected ${want} ±${tol}  ${ok ? "✓" : "✗"}`);
    if (!ok) errors.push(`${label} (EC frame): count ${count} outside ${want} ±${tol}`);
  }
}

if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors.slice(0, 25)) console.error(`  - ${e}`);
  if (errors.length > 25) console.error(`  ... and ${errors.length - 25} more`);
  process.exit(1);
}

console.log("\nAll validations passed.");
