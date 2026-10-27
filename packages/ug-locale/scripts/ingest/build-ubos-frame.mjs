#!/usr/bin/env node
/**
 * build-ubos-frame.mjs — turn the UBOS parish-level Administrative Units
 * spreadsheet into ugkit's district → county → sub-county → parish frame.
 *
 * Source: sources/ubos-parishes-2026-07.xlsx (UBOS, 7 July 2026)
 *   Received by direct request to ubos@ubos.org (see ubos-request-draft.md).
 *   The Bureau disseminates administrative units only up to PARISH level; there
 *   is no official village register — hence villages remain unsourced in ugkit
 *   and rows in data/uganda.csv stop at parish (variable-depth by design).
 *
 * Intermediate: sources/ubos-parishes-2026-07.csv, produced once by:
 *   python3 -c "from openpyxl import load_workbook; import csv; \
 *     wb=load_workbook('sources/ubos-parishes-2026-07.xlsx',read_only=True,data_only=True); \
 *     ws=wb['Uganda_Parishes_Ug']; \
 *     open_csv=csv.writer(open('sources/ubos-parishes-2026-07.csv','w',newline='')); \
 *     [open_csv.writerow(['' if c is None else str(c).strip() for c in r]) \
 *      for r in ws.iter_rows(values_only=True)]"
 * This mirrors the pdf→txt intermediate that build-ec-frame.mjs consumes:
 * committing the plain CSV keeps this script zero-dependency and CI-portable
 * (the UBOS files are the one exception to the sources/ gitignore).
 *
 * Emits:
 *   ../../data/uganda.csv  — canonical 10-col variable-depth CSV (see build-data.mjs)
 *
 * Code strategy: UBOS codes are hierarchical — SCode/PCode restart per parent,
 * so they are NOT globally unique. We concatenate the ancestor chain (with '.'
 * separators) so each level's code is globally unique, which is what
 * validate.mjs demands. This stays within CODE_RE's 12-char limit:
 *
 *   district_code   DCode                                  e.g. 314           (3)
 *   county_code     DCode.CCode                            e.g. 314.1         (5)
 *   subcounty_code  DCode.CCode.SCode                      e.g. 314.1.01      (8)
 *   parish_code     DCode.CCode.SCode.PCode                e.g. 314.1.01.05  (11)
 *
 * Character quirks in UBOS names handled before canonicalName():
 *   "&"  →  " and "     (e.g. "BASE CAMP II & IV" → "Base Camp II and IV")
 *   "_"  →  " "          (e.g. "NYABUBALE_MAHANGO WARD")
 * Both would otherwise violate NAME_RE. Everything else canonicalName covers.
 *
 * Zero npm deps.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalName } from "./normalize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..", "..");
const SRC = join(here, "sources", "ubos-parishes-2026-07.csv");

// UBOS names use uppercase + a couple of punctuation characters that our
// canonical alphabet does not admit. Rewrite them before canonicalName().
function preclean(raw) {
  return raw.replace(/&/g, " and ").replace(/_/g, " ");
}
const norm = (raw) => canonicalName(preclean(raw));

// ERRATA — corrections applied to the UBOS source, one entry per fix.
// Each entry documents the code/level, the wrong name, the correct name, and
// how we know it is wrong. Kept explicit so every deviation from the source
// is auditable (matches the "provenance is a feature" principle).
const ERRATA = {
  // Bududa County-2 "LUTSESHE" appears in 76 rows; a single row spells it
  // "RLUTSESHE" (stray leading R). Correcting to the majority spelling.
  "C:218.2": { wrong: "RLUTSESHE COUNTY", right: "LUTSESHE COUNTY" },
};
function fixName(level, code, raw) {
  const rule = ERRATA[`${level}:${code}`];
  return rule && raw === rule.wrong ? rule.right : raw;
}

const text = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n").trim().split("\n");
const header = text.shift();
const EXPECTED_HEADER = "Region,RCode,County,CCode,District,DCode,Sub_County,SCode,Parish,PCode";
if (header !== EXPECTED_HEADER)
  throw new Error(`Unexpected UBOS header:\n  got:      ${header}\n  expected: ${EXPECTED_HEADER}`);

// Intermediate CSV was written by Python's csv writer; UBOS names contain no
// commas or quotes (verified during ingest), so a naive split is safe and
// avoids a CSV parser dependency.
const rows = text.map((line, i) => {
  const cells = line.split(",");
  if (cells.length !== 10)
    throw new Error(`Row ${i + 2}: expected 10 cells, got ${cells.length}`);
  const [, /* region */ , /* rCode */ cty, cCode, dist, dCode, sub, sCode, par, pCode] = cells;
  const ccCode = `${dCode}.${cCode}`;
  const scCode = `${dCode}.${cCode}.${sCode}`;
  const pcCode = `${dCode}.${cCode}.${sCode}.${pCode}`;
  return {
    dCode, d: norm(fixName("D", dCode, dist)),
    cCode, c: norm(fixName("C", ccCode, cty)),
    sCode, s: norm(fixName("S", scCode, sub)),
    pCode, p: norm(fixName("P", pcCode, par)),
  };
});

// Dedupe up the chain by (district, county, subcounty, parish) name path so
// the same district/county/subcounty emits one row per level in the final CSV.
// build-data.mjs already dedupes by pathKey, but keeping the intermediate CSV
// naturally-shaped (one row per parish, ancestors repeat) matches the design.

// Build the per-level unique code map by hierarchical concatenation. We check
// that each concatenated code maps to exactly one canonical name path, which
// catches any UBOS row where a parent's name disagrees between sibling rows
// (a data-quality issue we want to surface before writing uganda.csv).
const codeToPath = [new Map(), new Map(), new Map(), new Map()];
const setCode = (level, code, pathKey, whatRow) => {
  const prior = codeToPath[level].get(code);
  if (prior !== undefined && prior !== pathKey) {
    throw new Error(
      `Level ${level}: code ${code} maps to two paths — "${prior}" vs "${pathKey}" (row: ${whatRow})`
    );
  }
  codeToPath[level].set(code, pathKey);
};

const SEP = "\u0000";
const out = [];
for (const r of rows) {
  const dCode = r.dCode;
  const ccCode = `${r.dCode}.${r.cCode}`;
  const scCode = `${r.dCode}.${r.cCode}.${r.sCode}`;
  const pcCode = `${r.dCode}.${r.cCode}.${r.sCode}.${r.pCode}`;

  const dPath = r.d;
  const cPath = dPath + SEP + r.c;
  const sPath = cPath + SEP + r.s;
  const pPath = sPath + SEP + r.p;

  const rowStr = `${r.d} / ${r.c} / ${r.s} / ${r.p}`;
  setCode(0, dCode, dPath, rowStr);
  setCode(1, ccCode, cPath, rowStr);
  setCode(2, scCode, sPath, rowStr);
  setCode(3, pcCode, pPath, rowStr);

  out.push(
    `${dCode},${r.d},${ccCode},${r.c},${scCode},${r.s},${pcCode},${r.p}`
  );
}

// Sanity guards — catch a mis-parse before it poisons the dataset.
const distinct = (level) => codeToPath[level].size;
console.log(
  `districts: ${distinct(0)}  counties: ${distinct(1)}  ` +
    `subcounties: ${distinct(2)}  parishes: ${distinct(3)}  ` +
    `(parish rows: ${out.length})`
);
if (distinct(0) < 140 || distinct(0) > 160)
  throw new Error(`District count ${distinct(0)} outside sane range.`);
if (distinct(1) < 300 || distinct(1) > 400)
  throw new Error(`County count ${distinct(1)} outside sane range.`);
if (distinct(2) < 2000 || distinct(2) > 2400)
  throw new Error(`Sub-county count ${distinct(2)} outside sane range.`);
if (distinct(3) < 10000 || distinct(3) > 11500)
  throw new Error(`Parish count ${distinct(3)} outside sane range.`);

const csv =
  "district_code,district,county_code,county,subcounty_code,subcounty," +
  "parish_code,parish,village_code,village\n" +
  out.join("\n") + "\n";
writeFileSync(join(pkgRoot, "data", "uganda.csv"), csv);
console.log(`wrote data/uganda.csv (${out.length} parish rows)`);
