#!/usr/bin/env node
/**
 * build-data.mjs — the heart of the "data is not code" principle.
 *
 * Reads data/uganda.csv (falling back to data/uganda.sample.csv), builds the
 * flat structure-of-arrays tree, and emits one generated module per level:
 *
 *   src/generated/{districts,counties,subcounties,parishes,villages}.ts
 *
 * Each module is `export default JSON.parse("...") as LevelData` — the string
 * is parsed by V8's JSON fast path (faster than evaluating an object literal),
 * the pattern works in every bundler with no import-attribute support needed,
 * and the `as LevelData` keeps the data boundary typed.
 *
 * CSV format v2 (16 columns): `region`, then a `code,name,kind` triple per
 * level —
 *   region,district_code,district,district_kind,county_code,county,
 *   county_kind,…,village_code,village,village_kind
 * Codes are official UBOS identifiers; empty when the source has none. Kinds
 * and region are written by the ingest (scripts/ingest/kinds.mjs); this
 * script compiles them as given and never derives them from names.
 * Rows may be VARIABLE DEPTH: a row populates levels 0..depth-1 (by NAME
 * presence) and stops. Absent levels emit empty blobs. No interior name gaps.
 *
 * Kinds and regions are dictionary-encoded: `{ values, index }`, where
 * `values` lists the distinct strings in first-seen order and `index[i]` is
 * unit i's position in it — one small int per unit instead of a string.
 *
 * Invariants this script guarantees (the runtime relies on them):
 *   1. Within each level, units are sorted by (parentIndex, name) — name
 *      compared by UTF-16 code units, NOT locale collation, so the build is
 *      byte-identical on every machine (localeCompare varies with ICU).
 *   2. Therefore all children of a parent are CONTIGUOUS.
 *   3. spans[parentId] = [firstChildIndex, childCount] into the child level.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fullCsv = join(pkgRoot, "data", "uganda.csv");
const sampleCsv = join(pkgRoot, "data", "uganda.sample.csv");

// Optional overrides (used by the scale benchmark):
//   node build-data.mjs --csv <path> --out <dir>
const argv = process.argv.slice(2);
const argOf = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const csvPath = argOf("--csv") ?? (existsSync(fullCsv) ? fullCsv : sampleCsv);
const outDir = argOf("--out") ?? join(pkgRoot, "src", "generated");

const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
const VERSION = pkg.ugkit?.datasetVersion ?? "0.0.0";

const LEVELS = ["districts", "counties", "subcounties", "parishes", "villages"];
const HEADER =
  "region,district_code,district,district_kind,county_code,county,county_kind," +
  "subcounty_code,subcounty,subcounty_kind,parish_code,parish,parish_kind," +
  "village_code,village,village_kind";

// ---------------------------------------------------------------- parse CSV
// Minimal CSV parsing: our pipeline controls the file, and validate.mjs
// enforces that names contain no commas/quotes. Tolerate CRLF line endings.
const lines = readFileSync(csvPath, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
const header = lines.shift()?.trim();
if (header !== HEADER) {
  throw new Error(`Unexpected CSV header: ${header}`);
}

// Each row → array of {code, name, kind} for levels 0..depth-1 (depth by
// NAME presence; codes optional), with the row's region on the district.
// Interior name gaps and missing kinds are errors.
const rows = lines.map((l) => {
  const cells = l.split(",").map((s) => s.trim());
  const region = cells[0] ?? "";
  const units = [];
  for (let L = 0; L < 5; L++) {
    const at = 1 + 3 * L;
    units.push({ code: cells[at] ?? "", name: cells[at + 1] ?? "", kind: cells[at + 2] ?? "" });
  }
  let depth = 0;
  while (depth < 5 && units[depth].name) depth++;
  if (depth === 0) throw new Error(`Bad row (empty district): ${JSON.stringify(l)}`);
  for (let i = 0; i < depth; i++) {
    if (!units[i].kind) throw new Error(`Bad row (missing ${LEVELS[i]} kind): ${JSON.stringify(l)}`);
  }
  for (let i = depth; i < 5; i++) {
    if (units[i].name || units[i].code || units[i].kind)
      throw new Error(`Bad row (interior gap): ${JSON.stringify(l)}`);
  }
  units[0].region = region;
  return units.slice(0, depth);
});

// ------------------------------------------------- build the tree, level 0→4
// nodesPerLevel[L] = Map<pathKey, { name, code, parentKey }>
// pathKey uniquely identifies a unit by its full name ancestry, because names
// repeat across parents (many districts have a "Central" division).
const SEP = "\u0000";
const nodesPerLevel = LEVELS.map(() => new Map());

for (const row of rows) {
  let parentKey = "";
  for (let L = 0; L < row.length; L++) {
    const { name, code, kind, region = "" } = row[L];
    const key = parentKey + SEP + name;
    const existing = nodesPerLevel[L].get(key);
    if (!existing) {
      nodesPerLevel[L].set(key, { name, code, kind, region, parentKey });
    } else {
      if (code && !existing.code) existing.code = code; // later row may supply a missing code
      if (existing.kind !== kind)
        throw new Error(`${LEVELS[L]} "${name}" has two kinds: ${existing.kind} vs ${kind}`);
      if (existing.region !== region)
        throw new Error(`District "${name}" has two regions: "${existing.region}" vs "${region}"`);
    }
    parentKey = key;
  }
}

// -------------------------------------- assign indices: sort, then span-index
// prevIndexByKey maps a parent's pathKey → its final index in its level.
// Deterministic name order: UTF-16 code-unit compare (see invariant 1).
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Dictionary-encode a string column: distinct values in first-seen order. */
function dictEncode(column) {
  const values = [];
  const pos = new Map();
  const index = column.map((v) => {
    let i = pos.get(v);
    if (i === undefined) pos.set(v, (i = values.push(v) - 1));
    return i;
  });
  return { values, index };
}
let prevIndexByKey = new Map();
let prevCount = 0;

mkdirSync(outDir, { recursive: true });

for (let L = 0; L < 5; L++) {
  const entries = [...nodesPerLevel[L].entries()].map(([key, node]) => ({
    key,
    name: node.name,
    code: node.code,
    kind: node.kind,
    region: node.region,
    parent: L === 0 ? -1 : prevIndexByKey.get(node.parentKey),
  }));

  // Invariant 1: sort by (parent, name) → Invariant 2: children contiguous.
  entries.sort((a, b) => a.parent - b.parent || byCodeUnit(a.name, b.name));

  const names = entries.map((e) => e.name);
  const codes = entries.map((e) => e.code);
  const parents = entries.map((e) => e.parent);

  // Invariant 3: spans for THIS level, keyed by parent index in level above.
  const spans = Array.from({ length: prevCount }, () => [0, 0]);
  for (let i = 0; i < entries.length; i++) {
    const p = entries[i].parent;
    if (p < 0) continue;
    if (spans[p][1] === 0) spans[p][0] = i;
    spans[p][1]++;
  }

  // A fully-uncoded level ships codes: [] — codes[id] is undefined either
  // way at runtime, and this keeps ~200 KB of '"",' out of the villages blob.
  const blob = {
    version: VERSION,
    names,
    codes: codes.some((c) => c) ? codes : [],
    parents,
    spans,
    kinds: dictEncode(entries.map((e) => e.kind)),
  };
  // Region is a district attribute; omitted when the CSV supplies none.
  if (L === 0 && entries.some((e) => e.region)) {
    if (entries.some((e) => !e.region)) throw new Error("Region missing on some districts.");
    blob.regions = dictEncode(entries.map((e) => e.region));
  }
  const json = JSON.stringify(blob);
  const out =
    `// GENERATED by scripts/build-data.mjs from ${csvPath.endsWith("sample.csv") ? "SAMPLE data" : "uganda.csv"} — do not edit.\n` +
    `// dataset ${VERSION} · ${names.length} units\n` +
    `import type { LevelData } from "../types.js";\n` +
    `export default JSON.parse(${JSON.stringify(json)}) as LevelData;\n`;

  writeFileSync(join(outDir, `${LEVELS[L]}.ts`), out);
  console.log(`${LEVELS[L].padEnd(12)} ${String(names.length).padStart(6)} units`);

  prevIndexByKey = new Map(entries.map((e, i) => [e.key, i]));
  prevCount = entries.length;
}

console.log(`\nDataset ${VERSION} built from ${csvPath}`);
if (csvPath === sampleCsv) {
  console.log("⚠ Using SAMPLE data. Place the full dataset at data/uganda.csv.");
}
