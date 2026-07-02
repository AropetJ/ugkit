#!/usr/bin/env node
/**
 * crawl-ec.mjs — Polite, zero-dependency crawler for the New Vision election
 * portal's polling-station API. Emits data/uganda.csv.
 *
 * DISCOVERED 2026-07-02 (see SAMPLES.md):
 *   GET https://cms-vgad.visiongroup.co.ug/api/enumeration-areas/district/{DISTRICT}/
 *   returns the subtree for ONE district. The district list itself is a static
 *   132-row payload, captured in newvision-districts.json — we iterate over that
 *   rather than crawling a districts endpoint.
 *
 * STILL BLOCKED: the endpoint was HTTP 503 during discovery, so the response
 * shape is unknown. flattenDistrict() below is the ONE remaining TODO — fill it
 * once the API is up and a sample response is pasted into SAMPLES.md. The script
 * throws loudly rather than emit a bad CSV.
 *
 * IMPORTANT CAVEAT: this source appears to stop at polling-station level and may
 * NOT contain villages (see SAMPLES.md structural analysis). If flattenDistrict
 * cannot produce a `village` column, do NOT use this as the uganda.csv source —
 * fall back to EC per-district PDFs or the UBOS frame.
 *
 * Zero deps by design (project rule): Node 18+ global fetch only.
 *
 * Usage (once flattenDistrict is wired):
 *   node crawl-ec.mjs --district ABIM      # dry-run one district
 *   node crawl-ec.mjs                       # full crawl → data/uganda.csv
 *   node crawl-ec.mjs --out /tmp/uganda.csv
 *   node crawl-ec.mjs --delay 800
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalName } from "./normalize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..", "..");

const API = (district) =>
  `https://cms-vgad.visiongroup.co.ug/api/enumeration-areas/district/${encodeURIComponent(
    district
  )}/`;

const USER_AGENT =
  "ugkit-locale-ingest/0.1 (+https://github.com/aropetjoel/ugkit; open-source, MIT)";

// ---------------------------------------------------------------------------
// TODO(API up): map ONE district's JSON response to full-hierarchy rows
// [district, county, subcounty, parish, village]. Field names below are
// GUESSES pending a real 200 response — replace them against SAMPLES.md.
// If the response has no village level, throw: this source can't feed uganda.csv.
// ---------------------------------------------------------------------------
function flattenDistrict(districtName, json) {
  void json;
  throw new Error(
    `flattenDistrict() not wired for ${districtName}: the enumeration-areas API was ` +
      `503 during discovery, so its response shape is unknown. Capture a real ` +
      `response (see SAMPLES.md), confirm it reaches VILLAGE level, then implement ` +
      `this mapping. If it stops at polling stations, use EC PDFs / UBOS instead.`
  );
  // Example once known (delete the throw above):
  // const rows = [];
  // for (const area of json.areas ?? []) {
  //   for (const parish of area.parishes ?? []) {
  //     for (const village of parish.villages ?? []) {
  //       rows.push([
  //         canonicalName(districtName),
  //         canonicalName(area.county ?? area.name),
  //         canonicalName(area.subcounty ?? ""),
  //         canonicalName(parish.name),
  //         canonicalName(village.name),
  //       ]);
  //     }
  //   }
  // }
  // return rows;
}

// --- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const DELAY_MS = Number(flag("delay", 500));
const ONLY_DISTRICT = flag("district", null);
const OUT = flag("out", join(pkgRoot, "data", "uganda.csv"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- polite fetch with backoff ---------------------------------------------
async function getDistrict(name, attempt = 1) {
  const res = await fetch(API(name), { headers: { "user-agent": USER_AGENT } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt > 5)
      throw new Error(`Giving up on ${name} after ${attempt} tries (HTTP ${res.status}). API may still be down.`);
    const retryAfter = Number(res.headers.get("retry-after")) || attempt * 2;
    console.warn(`  HTTP ${res.status} on ${name} — backing off ${retryAfter}s (try ${attempt})`);
    await sleep(retryAfter * 1000);
    return getDistrict(name, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${name}`);
  await sleep(DELAY_MS);
  return res.json();
}

// --- crawl -----------------------------------------------------------------
function csvCell(s) {
  return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s; // canonicalName strips commas; guard anyway
}

function loadDistricts() {
  const path = join(here, "newvision-districts.json");
  const { districts } = JSON.parse(readFileSync(path, "utf8"));
  return districts.map((d) => d.district);
}

async function main() {
  let names = loadDistricts();
  if (ONLY_DISTRICT)
    names = names.filter((n) => n.toLowerCase() === ONLY_DISTRICT.toLowerCase());
  if (!names.length) throw new Error(`No district matched --district ${ONLY_DISTRICT}`);

  const rows = [];
  for (const name of names) {
    console.error(`district: ${name}`);
    const json = await getDistrict(name);
    rows.push(...flattenDistrict(name, json));
  }

  rows.sort((a, b) => a.join("/").localeCompare(b.join("/")));
  const header = "district,county,subcounty,parish,village";
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, header + "\n" + body + "\n");
  console.error(`\nWrote ${rows.length} village rows → ${OUT}`);
  console.error("Next: npm run validate:data  (then build + record PROVENANCE.md)");
}

main().catch((e) => {
  console.error("\ncrawl-ec failed:", e.message);
  process.exit(1);
});
