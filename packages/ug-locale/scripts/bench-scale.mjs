#!/usr/bin/env node
/**
 * bench-scale.mjs — does the design hold at Uganda's REAL size?
 *
 * Generates a synthetic hierarchy matching the EC's published shape
 * (146 districts → ~312+divisions → 2,191 subcounties → 10,717 parishes
 * → 71,214 villages), runs the real build pipeline on it, then measures:
 *
 *   1. build time (CSV → packed blobs)
 *   2. emitted blob size per level (what consumers download)
 *   3. cold import time of the heaviest module (villages)
 *   4. lookup latency: childrenOf slices and byName after lazy index build
 *
 * Synthetic names are realistic-length so string volume is honest.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "ugkit-bench-"));

// ---------------------------------------------------------------- generate
const TARGET = { d: 146, c: 320, s: 2191, p: 10717, v: 71214 };
const syll = ["ka", "bu", "na", "mu", "ki", "lu", "wa", "go", "nya", "ru", "ma", "se", "to", "ji", "mba"];
const rand = (() => { let x = 42; return () => (x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const name = (cap = 4) => {
  let s = "";
  const n = 2 + Math.floor(rand() * (cap - 1));
  for (let i = 0; i < n; i++) s += syll[Math.floor(rand() * syll.length)];
  return s[0].toUpperCase() + s.slice(1);
};

console.log("Generating synthetic full-scale hierarchy…");
const rows = [];
const spread = (total, parents) => {
  // distribute `total` children across `parents`, ≥1 each
  const counts = new Array(parents).fill(1);
  for (let left = total - parents; left > 0; left--) counts[Math.floor(rand() * parents)]++;
  return counts;
};

const dNames = Array.from({ length: TARGET.d }, () => name());
const cPer = spread(TARGET.c, TARGET.d);
const sPer = spread(TARGET.s, TARGET.c);
const pPer = spread(TARGET.p, TARGET.s);
const vPer = spread(TARGET.v, TARGET.p);

let ci = 0, si = 0, pi = 0;
for (let d = 0; d < TARGET.d; d++) {
  for (let cc = 0; cc < cPer[d]; cc++, ci++) {
    const cName = `${name()} County`;
    for (let ss = 0; ss < sPer[ci]; ss++, si++) {
      const sName = name();
      for (let pp = 0; pp < pPer[si]; pp++, pi++) {
        const pName = name();
        for (let vv = 0; vv < vPer[pi]; vv++) {
          rows.push(`,${dNames[d]},,${cName},,${sName},,${pName},,${name()} ${vv % 3 === 0 ? "Zone" : "Village"}`);
        }
      }
    }
  }
}

const csv = join(tmp, "uganda.csv");
writeFileSync(
  csv,
  "district_code,district,county_code,county,subcounty_code,subcounty," +
    "parish_code,parish,village_code,village\n" +
    rows.join("\n"),
);
console.log(`  ${rows.length} rows → ${(statSync(csv).size / 1e6).toFixed(1)} MB CSV\n`);

// ------------------------------------------------------------------- build
const outDir = join(tmp, "generated");
const t0 = performance.now();
execFileSync(process.execPath, [join(here, "build-data.mjs"), "--csv", csv, "--out", outDir], { stdio: "inherit" });
console.log(`\nbuild-data: ${((performance.now() - t0) / 1000).toFixed(2)}s`);

console.log("\nEmitted blob sizes:");
let total = 0;
for (const f of readdirSync(outDir).sort()) {
  const kb = statSync(join(outDir, f)).size / 1024;
  total += kb;
  console.log(`  ${f.padEnd(18)} ${kb.toFixed(0).padStart(6)} KB`);
}
console.log(`  ${"TOTAL".padEnd(18)} ${total.toFixed(0).padStart(6)} KB`);

// ------------------------------------------------- cold import + lookups
const t1 = performance.now();
const villagesBlob = (await import(join(outDir, "villages.ts").replace(/\.ts$/, ".ts"))).default;
const importMs = performance.now() - t1;
console.log(`\nCold import of villages module: ${importMs.toFixed(1)} ms`);
console.log(`  (${villagesBlob.names.length} villages, ${villagesBlob.spans.length} parish spans)`);

// simulate LevelStore.childrenOf hot path
const spans = villagesBlob.spans;
const names = villagesBlob.names;
const t2 = performance.now();
let touched = 0;
for (let i = 0; i < 100000; i++) {
  const p = (i * 7919) % spans.length;
  const [first, count] = spans[p];
  for (let k = 0; k < count; k++) touched += names[first + k].length;
}
const perLookup = ((performance.now() - t2) / 100000) * 1e6;
console.log(`childrenOf (100k random parish lookups): ${perLookup.toFixed(0)} ns/lookup (touched=${touched})`);

// lazy name index build (worst case: villages)
const t3 = performance.now();
const idx = new Map();
for (let i = 0; i < names.length; i++) idx.set(names[i].toLowerCase(), i);
console.log(`Lazy name-index build over all villages: ${(performance.now() - t3).toFixed(0)} ms (one-time)`);

console.log(`\nScratch dir: ${tmp}`);
