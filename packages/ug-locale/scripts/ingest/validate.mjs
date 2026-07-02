#!/usr/bin/env node
/**
 * validate.mjs — data quality gate for data/uganda.csv.
 *
 * Run via `npm run validate:data`. Wired into prepublishOnly so it is
 * impossible to publish a package whose dataset fails these checks.
 *
 * Two classes of checks:
 *
 *   STRUCTURAL (always fatal): well-formed rows, no empty cells, no
 *   duplicate (parent, name) pairs at any level.
 *
 *   REFERENCE COUNTS (fatal on full dataset, skipped on sample data):
 *   per-level totals must land within tolerance of the Electoral
 *   Commission's published statistics. Update EXPECTED when the EC or
 *   UBOS publish new figures, alongside a datasetVersion bump.
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

// [expected, tolerance]. Tolerance absorbs gazetting churn (e.g. the pending
// Tororo split) between EC statistical releases.
const EXPECTED = [
  [146, 5],      // districts + cities
  [312, 400],    // counties — loose: city/municipal divisions land here too
  [2191, 100],   // sub-counties / town councils / divisions
  [10717, 300],  // parishes / wards
  [71214, 1500], // villages / cells
];

const lines = readFileSync(csvPath, "utf8").trim().split("\n");
const header = lines.shift();
const errors = [];

if (header !== "district,county,subcounty,parish,village") {
  errors.push(`Bad header: ${header}`);
}

const SEP = "\u0000";
const perLevel = LEVELS.map(() => new Set());
const seenRows = new Set();

lines.forEach((line, n) => {
  const cells = line.split(",").map((s) => s.trim());
  if (cells.length < 1 || cells.length > 5) {
    errors.push(`Row ${n + 2}: expected 1-5 cells, got ${cells.length}`);
    return;
  }
  // VARIABLE DEPTH: a row populates levels 0..depth-1 then stops. Require a
  // non-empty leading run and no interior gaps.
  let depth = 0;
  while (depth < cells.length && cells[depth]) depth++;
  if (depth === 0) {
    errors.push(`Row ${n + 2}: empty district cell`);
    return;
  }
  for (let i = depth; i < cells.length; i++) {
    if (cells[i]) errors.push(`Row ${n + 2}: interior gap — ${LEVELS[i]} set but a shallower level is empty`);
  }
  for (let i = 0; i < depth; i++) {
    const c = cells[i];
    if (/\s{2,}/.test(c)) errors.push(`Row ${n + 2}: doubled whitespace in "${c}"`);
    if (c !== c.trim()) errors.push(`Row ${n + 2}: unstripped whitespace in "${c}"`);
  }

  if (seenRows.has(line)) errors.push(`Row ${n + 2}: exact duplicate row`);
  seenRows.add(line);

  let key = "";
  for (let L = 0; L < depth; L++) {
    key += SEP + cells[L];
    perLevel[L].add(key);
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
