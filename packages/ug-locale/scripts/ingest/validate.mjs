#!/usr/bin/env node
/**
 * validate.mjs — data quality gate for data/uganda.csv.
 *
 * Run via `npm run validate:data`. Wired into prepublishOnly so it is
 * impossible to publish a package whose dataset fails these checks.
 *
 * CSV format (10 columns): `code,name` pair per level; codes optional;
 * rows may stop at any level (variable depth, by NAME presence).
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
 * NOTE: county-level total in our CSV will exceed 312 because cities and
 * municipalities contribute divisions at that level — hence the loose
 * tolerance on level 1. Tighten once the sourced hierarchy is settled.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fullCsv = join(pkgRoot, "data", "uganda.csv");
const sampleCsv = join(pkgRoot, "data", "uganda.sample.csv");

const isFull = existsSync(fullCsv);
const csvPath = isFull ? fullCsv : sampleCsv;

const LEVELS = ["districts", "counties", "subcounties", "parishes", "villages"];
const HEADER =
  "district_code,district,county_code,county,subcounty_code,subcounty," +
  "parish_code,parish,village_code,village";

// canonicalName's output alphabet. Comma is structurally forbidden (CSV).
const NAME_RE = /^[\p{L}\p{N} .'’\-\/()]+$/u;
const CODE_RE = /^[A-Za-z0-9.\-]{0,12}$/;

// [expected, tolerance]. Tolerance absorbs gazetting churn (e.g. the pending
// Tororo split) between EC statistical releases.
const EXPECTED = [
  [146, 5],      // districts + cities
  [312, 400],    // counties — loose: city/municipal divisions land here too
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

lines.forEach((line, n) => {
  const cells = line.split(",").map((s) => s.trim());
  if (cells.length < 2 || cells.length > 10) {
    errors.push(`Row ${n + 2}: expected 2-10 cells, got ${cells.length}`);
    return;
  }
  const units = [];
  for (let L = 0; L < 5; L++) {
    units.push({ code: cells[2 * L] ?? "", name: cells[2 * L + 1] ?? "" });
  }

  // VARIABLE DEPTH: a row populates levels 0..depth-1 then stops (by name).
  let depth = 0;
  while (depth < 5 && units[depth].name) depth++;
  if (depth === 0) {
    errors.push(`Row ${n + 2}: empty district cell`);
    return;
  }
  for (let i = depth; i < 5; i++) {
    if (units[i].name || units[i].code)
      errors.push(`Row ${n + 2}: interior gap — ${LEVELS[i]} set but a shallower level is empty`);
  }
  for (let i = 0; i < depth; i++) {
    const { name, code } = units[i];
    if (!NAME_RE.test(name))
      errors.push(`Row ${n + 2}: illegal character in ${LEVELS[i]} name "${name}"`);
    if (/\s{2,}/.test(name)) errors.push(`Row ${n + 2}: doubled whitespace in "${name}"`);
    if (!CODE_RE.test(code))
      errors.push(`Row ${n + 2}: bad ${LEVELS[i]} code "${code}"`);
  }

  if (seenRows.has(line)) errors.push(`Row ${n + 2}: exact duplicate row`);
  seenRows.add(line);

  let key = "";
  for (let L = 0; L < depth; L++) {
    key += SEP + units[L].name;
    const isNew = !perLevel[L].has(key);
    perLevel[L].add(key);
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

if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors.slice(0, 25)) console.error(`  - ${e}`);
  if (errors.length > 25) console.error(`  ... and ${errors.length - 25} more`);
  process.exit(1);
}

console.log("\nAll validations passed.");
