import test from "node:test";
import assert from "node:assert/strict";

import { districts, districtByName, searchDistricts, districtCount } from "../dist/districts.js";
import { counties } from "../dist/counties.js";
import { subCounties } from "../dist/subcounties.js";
import { parishes } from "../dist/parishes.js";
import { villages } from "../dist/villages.js";

// These tests assert ENGINE INVARIANTS, not specific dataset content, so they
// hold whether the shipped dataset is district+county deep (current) or the
// full five levels (once sub-counties → villages are back-filled from UBOS).

const assertSortedByName = (units) => {
  const names = units.map((u) => u.name);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b)),
    "level not sorted by name",
  );
};

test("districts load and are sorted", () => {
  const all = districts();
  assert.ok(all.length >= 5);
  assert.equal(all.length, districtCount);
  assertSortedByName(all);
});

test("name lookup is normalized", () => {
  assert.equal(districtByName("  WAKISO ")?.name, "Wakiso");
  assert.equal(districtByName("kampala")?.name, "Kampala");
  assert.equal(districtByName("Nowhere"), undefined);
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

test("prefix search works", () => {
  const hits = searchDistricts("mb");
  assert.ok(hits.some((d) => d.name === "Mbarara"));
});

test("unknown parent yields empty slice, not a crash", () => {
  assert.deepEqual(counties(999999), []);
  assert.deepEqual(villages(999999), []);
});
