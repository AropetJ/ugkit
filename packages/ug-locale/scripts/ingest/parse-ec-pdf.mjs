#!/usr/bin/env node
/**
 * parse-ec-pdf.mjs — extract Uganda's admin hierarchy from the EC
 * "Split by village — Local Government Electoral Areas, 2025" PDF.
 *
 * Source: https://www.ec.or.ug/info/lists-demarcated-electoral-areas-2025
 *   sources/split-by-village.pdf  (7.03 MB, 2402 pp, modified 14 Jan 2025)
 *
 * The PDF is one parish per page, structured as:
 *   District: 006 HOIMA
 *   Constituency: 028 BUGAHYA COUNTY            <- county tier
 *   Subcounty/Town/Municipal Division: 02 BUSERUKA
 *   Parish: 006 NYAKABINGO
 *      ELECTORAL AREA           VILLAGES         <- two columns
 *      006 NYAKABINGO A         002 BISENYI
 *                               004 BUSERUKA T/C
 * We take the right-hand VILLAGES column (col >= VILLAGE_COL); the left
 * "electoral area" column is a women-councillor grouping we ignore.
 *
 * Every level carries an official EC numeric code — we keep them.
 *
 * Requires `pdftotext` (poppler) on PATH, OR a pre-extracted -layout text file.
 * Zero npm deps (Node built-ins + the poppler CLI).
 *
 * Usage:
 *   node parse-ec-pdf.mjs                 # parse sources/split-by-village.pdf
 *   node parse-ec-pdf.mjs --counts        # print level counts only, no CSV write
 *   node parse-ec-pdf.mjs --out /tmp/x.csv
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PDF = join(here, "sources", "split-by-village.pdf");
const TXT = join(here, "sources", "split-by-village.txt");
const VILLAGE_COL = 40; // split point: text at/after this column is the VILLAGES column

const argv = process.argv.slice(2);
const has = (f) => argv.includes(`--${f}`);
const flag = (f, d) => { const i = argv.indexOf(`--${f}`); return i >= 0 ? argv[i + 1] : d; };

function loadText() {
  if (existsSync(TXT)) return readFileSync(TXT, "utf8");
  // extract on demand
  return execFileSync("pdftotext", ["-layout", PDF, "-"], { maxBuffer: 1 << 30, encoding: "utf8" });
}

// Header line matchers (left-anchored labels, code + name).
const RE = {
  district: /^\s*District:\s*(\d+)\s+(.+?)\s*$/,
  county: /^\s*Constituency:\s*(\d+)\s+(.+?)\s*$/,
  subcounty: /Subcounty\/Town\/Municipal Division:\s*(\d+)\s+(.+?)\s*$/,
  parish: /^\s*Parish:\s*(\d+)\s+(.+?)\s*$/,
};
const VILLAGE = /^\s*(\d+)\s+(\S.*?)\s*$/;

function parse(text) {
  const rows = []; // {dCode,d,cCode,c,sCode,s,pCode,p,vCode,v}
  let d, dc, c, cc, s, sc, p, pc;
  for (const line of text.split("\n")) {
    let m;
    if ((m = RE.district.exec(line))) { dc = m[1]; d = m[2]; c = cc = s = sc = p = pc = undefined; continue; }
    if ((m = RE.county.exec(line))) { cc = m[1]; c = m[2]; s = sc = p = pc = undefined; continue; }
    if ((m = RE.subcounty.exec(line))) { sc = m[1]; s = m[2]; p = pc = undefined; continue; }
    if ((m = RE.parish.exec(line))) { pc = m[1]; p = m[2]; continue; }
    // village line: only look at the right-hand column
    if (!p) continue;
    const right = line.slice(VILLAGE_COL);
    if (!(m = VILLAGE.exec(right))) continue;
    // guard against catching page-footer "Page N of 2402" that lands right
    if (/^Page\b/i.test(m[2])) continue;
    rows.push({ dc, d, cc, c, sc, s, pc, p, vc: m[1], v: m[2] });
  }
  return rows;
}

function counts(rows) {
  const set = (keyFn) => new Set(rows.map(keyFn)).size;
  return {
    rows: rows.length,
    districts: set((r) => r.d),
    counties: set((r) => r.d + "|" + r.c),
    subcounties: set((r) => r.d + "|" + r.c + "|" + r.s),
    parishes: set((r) => r.d + "|" + r.c + "|" + r.s + "|" + r.p),
    villages: set((r) => r.d + "|" + r.c + "|" + r.s + "|" + r.p + "|" + r.v),
    villageRows: rows.length,
  };
}

const text = loadText();
const rows = parse(text);
const c = counts(rows);
console.error("EC PDF parse — level counts:");
console.error(JSON.stringify(c, null, 2));
console.error("EC targets (13 Nov 2025): 146 / 312 / 2191 / 10717 / 71214");
console.error("Sample rows:");
for (const r of rows.slice(0, 6))
  console.error(`  ${r.dc} ${r.d} > ${r.cc} ${r.c} > ${r.sc} ${r.s} > ${r.pc} ${r.p} > ${r.vc} ${r.v}`);

if (!has("counts")) {
  const out = flag("out", join(here, "sources", "ec-raw.csv"));
  const header = "district_code,district,county_code,county,subcounty_code,subcounty,parish_code,parish,village_code,village";
  const esc = (x) => (String(x).includes(",") ? `"${x}"` : x);
  const body = rows
    .map((r) => [r.dc, r.d, r.cc, r.c, r.sc, r.s, r.pc, r.p, r.vc, r.v].map(esc).join(","))
    .join("\n");
  writeFileSync(out, header + "\n" + body + "\n");
  console.error(`\nWrote ${rows.length} rows → ${out}`);
}
