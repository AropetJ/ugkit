#!/usr/bin/env node
/**
 * parse-ec-admin-units.mjs — parse the Electoral Commission's
 * "Uganda's Verified Administrative Units, July 2022" gazetteer into a
 * village-level STAGING CSV. Not part of the shipped dataset: villages ship
 * only once the EC confirms redistribution terms (see data/GAPS.md §1).
 *
 * Source: https://www.ec.or.ug/sites/default/files/statistics/ADMINISTRATIVE%20UNITS%20IN%20UGANDA_JULY%202022.pdf
 *   3,019 pages, Microsoft Access report, generated 19 Jul 2022.
 *   sha256 fa70833b077402f69cdba96075d13a032fe76ff045d4ee929bee491848cb683d
 * Text extraction (once, poppler):
 *   pdftotext -layout admin-units-july-2022.pdf admin-units-july-2022.txt
 *
 * Usage:
 *   node parse-ec-admin-units.mjs <txt> <out.csv>
 *
 * Layout: each page carries "DISTRICT: 06 HOIMA" and "CONSTITUENCY: 028 …"
 * headers, then three columns — SUBCOUNTY/TOWN, PARISH NAME, VILLAGES — each
 * cell "NN NAME". A sub-county/parish cell appears only on its first village
 * line (and again at the top of each page). Long names wrap onto an uncoded
 * continuation line in the same column ("BULINDI TOWN" / "COUNCIL").
 * Column boundaries are taken from each page's header line, because the
 * report's column offsets drift slightly between pages.
 *
 * Self-checks (the parse fails unless ALL hold):
 *   - every "TOTAL VILLAGES IN <sub-county>  N" matches our count AND name,
 *     which also proves wrapped names were rejoined correctly;
 *   - every "END OF DISTRICT <name>  N" matches;
 *   - the grand total ("TOTAL NUMBER OF VILLAGES …  71,230") matches.
 *
 * Output (raw EC spelling, upper case; codes as printed):
 *   district_code,district,constituency_code,constituency,
 *   subcounty_code,subcounty,parish_code,parish,village_code,village
 *
 * Zero npm deps.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [txtPath, outPath] = process.argv.slice(2);
if (!txtPath || !outPath) {
  console.error("usage: node parse-ec-admin-units.mjs <txt> <out.csv>");
  process.exit(2);
}

const lines = readFileSync(txtPath, "utf8").split("\n");

// Cells are separated by runs of 2+ spaces; keep each cell's start column.
// A long name can run into the next column with a single space
// ("28 KANYEGARAMIRE WARD 01 KAGORORA"), so a cell is also split before an
// embedded "NN " code — but only where that code starts in a LATER column
// (levelOf), so a name that merely contains a number stays whole.
function cells(line, levelOf) {
  const out = [];
  for (const m of line.matchAll(/\S+(?: \S+)*/g)) {
    let start = m.index;
    let text = m[0];
    for (const inner of m[0].matchAll(/ (?=\d{2,3} \S)/g)) {
      const col = m.index + inner.index + 1;
      if (levelOf && levelOf(col) > levelOf(start)) {
        out.push({ col: start, text: line.slice(start, col).trim() });
        start = col;
      }
    }
    text = line.slice(start, m.index + m[0].length).trim();
    out.push({ col: start, text });
  }
  return out;
}

const fail = (msg, i) => {
  throw new Error(`line ${i + 1}: ${msg}`);
};

let district = null; // { code, name }
let constituency = null;
let subcounty = null;
let parish = null;
let bounds = null; // [subcounty|parish boundary, parish|village boundary]
let lastCellByLevel = [null, null, null]; // for continuation lines

const rows = [];
const villageless = []; // parishes printed with no villages under them
const warnings = []; // tolerated source defects, reported after the parse
let scCount = 0; // villages since the last sub-county total
let distCount = 0;
let grandTotal = null;
const errors = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const t = line.trim();
  if (!t) continue;

  let m;
  if (t.startsWith("UGANDA'S VERIFIED") || /^Page \d+ of \d+$/.test(t) || /^\w+day, \d+ \w+ \d{4}/.test(t))
    continue;

  if ((m = t.match(/^DISTRICT:\s+(\d+)\s+(.+)$/))) {
    const next = { code: m[1], name: m[2].trim() };
    if (!district || district.code !== next.code) {
      distCount = 0;
      subcounty = parish = null; // codes restart per parent
    }
    district = next;
    continue;
  }
  if ((m = t.match(/^CONSTITUENCY:\s+(\d+)\s+(.+)$/))) {
    const next = { code: m[1], name: m[2].trim() };
    // Sub-county codes restart per constituency, so a new constituency must
    // not let its "01" be mistaken for a page-top repeat of the old "01".
    if (!constituency || constituency.code !== next.code) subcounty = parish = null;
    constituency = next;
    continue;
  }
  if (t.startsWith("SUBCOUNTY/TOWN")) {
    const p = line.indexOf("PARISH NAME");
    const v = line.indexOf("VILLAGES");
    if (p < 0 || v < 0) fail("header without PARISH NAME / VILLAGES", i);
    const s = line.indexOf("SUBCOUNTY/TOWN");
    bounds = [(s + p) / 2, (p + v) / 2];
    continue;
  }
  if ((m = t.match(/^TOTAL VILLAGES IN\s{2,}(.+?)\s{2,}([\d,]+)$/))) {
    const want = Number(m[2].replace(/,/g, ""));
    if (!subcounty) fail("sub-county total before any sub-county", i);
    // The report truncates long names on total lines ("… TOWN" for
    // "… TOWN COUNCIL"), so the total's name must be a PREFIX of ours.
    if (!subcounty.name.startsWith(m[1]))
      errors.push(`line ${i + 1}: total names "${m[1]}" but parsed sub-county is "${subcounty.name}"`);
    if (want !== scCount)
      errors.push(`line ${i + 1}: ${district.name} / ${subcounty.name}: total ${want}, parsed ${scCount}`);
    scCount = 0;
    continue;
  }
  if ((m = t.match(/^END OF DISTRICT\s+(.+?)\s{2,}([\d,]+)$/))) {
    const want = Number(m[2].replace(/,/g, ""));
    if (m[1] !== district.name) errors.push(`line ${i + 1}: END OF DISTRICT ${m[1]} inside ${district.name}`);
    if (want !== distCount) errors.push(`line ${i + 1}: district ${m[1]}: total ${want}, parsed ${distCount}`);
    continue;
  }
  if ((m = t.match(/^TOTAL NUMBER OF VILLAGES IN .+?\s{2,}([\d,]+)$/))) {
    grandTotal = Number(m[1].replace(/,/g, ""));
    continue;
  }

  if (!bounds) fail(`data before any header: ${JSON.stringify(t)}`, i);
  const level = (col) => (col < bounds[0] ? 0 : col < bounds[1] ? 1 : 2);
  const cs = cells(line, level);

  // Continuation line: no cell starts with a code — append to the cell above.
  if (cs.every((c) => !/^\d{2,3} /.test(c.text))) {
    for (const c of cs) {
      // A bare-digit fragment carries no name (source defect: Manafwa /
      // Bunamone Ward prints "01 BUTTA" then a lone "0"). Drop it, loudly.
      if (/^\d+$/.test(c.text)) {
        warnings.push(`line ${i + 1}: dropped stray "${c.text}" after "${lastCellByLevel[level(c.col)]?.name}"`);
        continue;
      }
      const target = lastCellByLevel[level(c.col)];
      if (!target) fail(`continuation with nothing to continue: ${JSON.stringify(t)}`, i);
      // Rows hold the unit object by reference, so the rows already
      // emitted for this unit pick up the completed name too.
      target.name += " " + c.text;
    }
    continue;
  }

  let village = null;
  let prev = null; // { L, unit } — the previous cell on this line
  for (const c of cs) {
    const cm = c.text.match(/^(\d{2,3}) (.+)$/);
    if (!cm) {
      // Source names sometimes contain runs of spaces ("PANYANGASI     A"),
      // which split them into two cells in the SAME column: rejoin.
      if (prev && level(c.col) === prev.L) {
        prev.unit.name += " " + c.text;
        continue;
      }
      fail(`uncoded cell mixed into a coded line: ${JSON.stringify(t)}`, i);
    }
    const unit = { code: cm[1], name: cm[2] };
    const L = level(c.col);
    // A page-top repeat re-states the current sub-county/parish (same code).
    // Keep the original object; route any continuation of the repeated
    // (possibly wrapped) name to a throwaway so it isn't appended twice.
    const current = L === 0 ? subcounty : L === 1 ? parish : null;
    if (current && current.code === unit.code) {
      lastCellByLevel[L] = { ...unit };
      prev = { L, unit: lastCellByLevel[L] };
      continue;
    }
    if (L === 0) {
      subcounty = unit;
      parish = null;
    } else if (L === 1) {
      parish = unit;
    } else {
      village = unit;
    }
    lastCellByLevel[L] = unit;
    prev = { L, unit };
  }
  if (!subcounty || !parish) fail(`line without a sub-county/parish: ${JSON.stringify(t)}`, i);
  if (!village) {
    // A parish (typically an urban ward) listed with no villages.
    villageless.push({ district, constituency, subcounty, parish });
    continue;
  }

  rows.push({ district, constituency, subcounty, parish, village });
  scCount++;
  distCount++;
}

if (grandTotal === null) errors.push("no grand total line found");
else if (grandTotal !== rows.length) errors.push(`grand total ${grandTotal}, parsed ${rows.length}`);

if (errors.length) {
  console.error(`${errors.length} self-check error(s):`);
  for (const e of errors.slice(0, 30)) console.error("  " + e);
  process.exit(1);
}

// RFC 4180 quoting: a few EC names contain quotes or commas (JJEZA "A").
// This is a staging file; canonicalName() cleans names at crosswalk time.
const cell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv =
  "district_code,district,constituency_code,constituency,subcounty_code,subcounty," +
  "parish_code,parish,village_code,village\n" +
  rows
    .map((r) =>
      [r.district.code, r.district.name, r.constituency.code, r.constituency.name,
       r.subcounty.code, r.subcounty.name, r.parish.code, r.parish.name,
       r.village.code, r.village.name].map(cell).join(","),
    )
    .join("\n") +
  "\n";
writeFileSync(outPath, csv);

const distinct = (f) => new Set(rows.map(f)).size;
console.log(
  `villages ${rows.length} · parishes ${distinct((r) => r.district.code + "/" + r.constituency.code + "/" + r.subcounty.code + "/" + r.parish.code)}` +
    ` · sub-county blocks ${distinct((r) => r.district.code + "/" + r.constituency.code + "/" + r.subcounty.code)}` +
    ` · constituencies ${distinct((r) => r.district.code + "/" + r.constituency.code)}` +
    ` · districts ${distinct((r) => r.district.code)}`,
);
console.log(`village-less parishes: ${villageless.length}`);
// Duplicate codes are the EC's own data, reported rather than "fixed".
const fullCode = (r) => [r.district.code, r.constituency.code, r.subcounty.code, r.parish.code, r.village.code].join("-");
const seenCodes = new Map();
for (const r of rows) {
  const k = fullCode(r);
  if (seenCodes.has(k)) warnings.push(`duplicate village code ${k}: "${seenCodes.get(k)}" and "${r.village.name}"`);
  else seenCodes.set(k, r.village.name);
}
for (const w of warnings) console.log(`warning: ${w}`);
console.log(`all self-checks passed (grand total ${grandTotal}) → ${outPath}`);
