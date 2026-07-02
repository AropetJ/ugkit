import test from "node:test";
import assert from "node:assert/strict";

import {
  districts,
  districtByName,
  districtByCode,
  searchDistricts,
  districtCount,
  datasetVersion,
} from "../dist/districts.js";
import { counties, countyByName, countyByCode } from "../dist/counties.js";
import { subCounties, subCountyCount } from "../dist/subcounties.js";
import { parishes } from "../dist/parishes.js";
import { villages, villageById, villageCount } from "../dist/villages.js";
import { normalizeName } from "../dist/store.js";

// These tests assert ENGINE INVARIANTS, not specific dataset content, so they
// hold whether the shipped dataset is district+county deep (current) or the
// full five levels (once sub-counties → villages are back-filled from UBOS).

const assertSortedByName = (units) => {
  const names = units.map((u) => u.name);
  const sorted = [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(names, sorted, "level not sorted by name (code-unit order)");
};

test("districts load and are sorted", () => {
  const all = districts();
  assert.ok(all.length >= 5);
  assert.equal(all.length, districtCount);
  assertSortedByName(all);
  assert.match(datasetVersion, /^\d{4}\.\d+$/);
});

test("name lookup is normalized", () => {
  assert.equal(districtByName("  WAKISO ")?.name, "Wakiso");
  assert.equal(districtByName("kampala")?.name, "Kampala");
  assert.equal(districtByName("Nowhere"), undefined);
});

test("normalizeName deletes apostrophes and diacritics instead of splitting", () => {
  assert.equal(normalizeName("Ng'ora"), "ngora"); // user types "Ngora"
  assert.equal(normalizeName("Mérida"), "merida");
  assert.equal(normalizeName("FORT-PORTAL  City"), "fort portal city");
});

test("official codes round-trip: byCode(unit.code) is the unit itself", () => {
  let coded = 0;
  for (const d of districts()) {
    if (!d.code) continue;
    coded++;
    assert.deepEqual(districtByCode(d.code), d);
  }
  assert.ok(coded > 0, "expected at least some coded districts");
  assert.equal(districtByCode("no-such-code"), undefined);
});

test("ambiguous names return undefined instead of an arbitrary unit", () => {
  // Count duplicated normalized county names across the whole level by
  // walking children of every district (content-independent invariant).
  const seen = new Map();
  for (const d of districts()) {
    for (const c of counties(d.id)) {
      seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    }
  }
  for (const [name, n] of seen) {
    const hit = countyByName(name);
    if (n > 1) {
      assert.equal(hit, undefined, `ambiguous "${name}" must not resolve`);
      // ...but the coded lookup still can:
    } else if (hit) {
      assert.equal(hit.name, name);
    }
  }
});

test("drill-down links every child to its parent, sorted, as deep as the data goes", () => {
  const childFns = [counties, subCounties, parishes, villages];
  let parents = districts();
  assert.ok(parents.length > 0);

  let reachedDepth = 0;
  for (const childrenOf of childFns) {
    const nextParents = [];
    let anyChildren = false;
    for (const p of parents.slice(0, 8)) { // sample parents to keep it fast
      const kids = childrenOf(p.id);
      if (kids.length) anyChildren = true;
      assertSortedByName(kids);
      for (const k of kids) assert.equal(k.parentId, p.id);
      nextParents.push(...kids);
    }
    if (!anyChildren) break; // reached the dataset's current depth
    reachedDepth++;
    parents = nextParents;
  }
  assert.ok(reachedDepth >= 1, "expected at least district → county depth");
});

test("children carry correct parentId back-references", () => {
  const wakiso = districtByName("Wakiso");
  assert.ok(wakiso);
  const cs = counties(wakiso.id);
  assert.ok(cs.length > 0);
  for (const county of cs) assert.equal(county.parentId, wakiso.id);
});

test("prefix search works and respects limit", () => {
  const hits = searchDistricts("mb");
  assert.ok(hits.some((d) => d.name === "Mbarara"));
  assert.equal(searchDistricts("", 5).length, 0);
  assert.ok(searchDistricts("k", 3).length <= 3);
});

test("unsourced levels are queryable and safe", () => {
  if (subCountyCount === 0) {
    assert.deepEqual(subCounties(0), []);
  }
  if (villageCount === 0) {
    assert.deepEqual(villages(0), []);
    assert.equal(villageById(0), undefined);
  }
});

test("unknown parent yields empty slice, not a crash", () => {
  assert.deepEqual(counties(999999), []);
  assert.deepEqual(villages(999999), []);
  assert.equal(countyByCode("xyz"), undefined);
});
