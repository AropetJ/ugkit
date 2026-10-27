import test from "node:test";
import assert from "node:assert/strict";

import { districts, districtsInRegion, districtByName } from "../dist/districts.js";
import { counties } from "../dist/counties.js";
import { subCounties, subCountyByCode, subCountyById } from "../dist/subcounties.js";
import { parishes } from "../dist/parishes.js";
import { villages, villageByCode, villageCount } from "../dist/villages.js";
import { KINDS_BY_LEVEL, REGIONS, kindFromName } from "../scripts/ingest/kinds.mjs";

// Region, kind and settlement attributes (docs/design-unit-attributes.md).
// Invariant tests hold for any dataset; count tests run only on the full
// UBOS dataset (detected by its 146 districts) and skip on sample data.

const FULL = districts().length === 146;

/** Every unit at every level, walked through the parent→children slices. */
function allLevels() {
  const levels = [districts()];
  for (const childrenOf of [counties, subCounties, parishes, villages]) {
    levels.push(levels.at(-1).flatMap((p) => childrenOf(p.id)));
  }
  return levels;
}

test("every unit has a kind allowed for its level", () => {
  allLevels().forEach((units, L) => {
    for (const u of units) {
      assert.ok(KINDS_BY_LEVEL[L].includes(u.kind), `${u.name}: kind ${u.kind} not allowed at level ${L}`);
    }
  });
});

test("region is set on every district and on nothing below", () => {
  const [ds, ...lower] = allLevels();
  for (const d of ds) assert.ok(REGIONS.includes(d.region), `${d.name}: region ${d.region}`);
  for (const units of lower) for (const u of units) assert.equal(u.region, undefined);
});

test("districtsInRegion partitions the districts", () => {
  const seen = REGIONS.flatMap((r) => districtsInRegion(r));
  assert.equal(seen.length, districts().length);
  assert.equal(new Set(seen.map((d) => d.id)).size, districts().length);
  for (const r of REGIONS) for (const d of districtsInRegion(r)) assert.equal(d.region, r);
  assert.deepEqual(districtsInRegion("Nowhere"), []);
});

test("known units carry the expected attributes", () => {
  assert.equal(districtByName("Kampala")?.kind, "city");
  assert.equal(districtByName("Kampala")?.region, "Central");
  assert.equal(districtByName("Wakiso")?.kind, "district");
  if (!FULL) return;
  assert.equal(districtByName("Gulu City")?.kind, "city");
  assert.equal(districtByName("Gulu")?.region, "Northern");
  assert.equal(districtByName("Mbarara")?.region, "Western");
  assert.equal(districtByName("Jinja")?.region, "Eastern");
  assert.equal(subCountyByCode("418.2.05")?.kind, "settlement"); // Nakivale Basecamp
  assert.equal(subCountyByCode("336.1.05")?.kind, "sub-county"); // Rhino Camp — not the settlement
  assert.equal(subCountyByCode("336.1.07")?.kind, "town-council"); // Rhino Camp TC
});

test("full dataset: kind tallies and the EC-frame reconciliation", { skip: !FULL && "sample data" }, () => {
  const [ds, cs, ss, ps] = allLevels();
  const tally = (units) =>
    Object.fromEntries([...new Set(units.map((u) => u.kind))].sort().map((k) => [k, units.filter((u) => u.kind === k).length]));
  assert.deepEqual(tally(ds), { city: 11, district: 135 });
  assert.deepEqual(tally(cs), { county: 256, division: 25, municipality: 31 });
  assert.deepEqual(tally(ss), { division: 107, settlement: 19, "sub-county": 1503, "town-council": 580 });
  assert.deepEqual(tally(ps), { parish: 7762, ward: 3098 });
  for (const r of REGIONS) assert.ok(districtsInRegion(r).length > 0);

  // Excluding refugee settlements reconciles with the EC/census frame
  // (EC: 2,191 sub-counties, 10,717 parishes — see data/GAPS.md §2).
  const frameSubCounties = ss.filter((s) => s.kind !== "settlement");
  const frameParishes = ps.filter((p) => subCountyById(p.parentId).kind !== "settlement");
  assert.equal(frameSubCounties.length, 2190);
  assert.equal(frameParishes.length, 10712);
});

test("kindFromName suffix rules", () => {
  assert.equal(kindFromName(0, "Kampala"), "city");
  assert.equal(kindFromName(0, "Fort Portal City"), "city");
  assert.equal(kindFromName(0, "Wakiso"), "district");
  assert.equal(kindFromName(1, "Kira Municipality"), "municipality");
  assert.equal(kindFromName(1, "Rubaga Division"), "division");
  assert.equal(kindFromName(1, "Omoro"), "county");
  assert.equal(kindFromName(2, "Kajjansi Town Council"), "town-council");
  assert.equal(kindFromName(2, "Laroo Division"), "division");
  assert.equal(kindFromName(2, "Bussi"), "sub-county");
  assert.equal(kindFromName(3, "Kasana P.W.D Ward"), "ward");
  assert.equal(kindFromName(3, "Balabala"), "parish");
  assert.equal(kindFromName(4, "Kagugube Zone"), "village");
  assert.equal(kindFromName(4, "Nsambya Cell"), "cell");
  // Town councils are named "... Town Council", so no bare "Town" rule:
  assert.equal(kindFromName(2, "Townsend"), "sub-county");
});

test("full dataset: EC villages attached under UBOS parishes", { skip: !FULL && "sample data" }, () => {
  const [, , ss, ps, vs] = allLevels();
  assert.equal(vs.length, 70878);
  assert.equal(villageCount, 70878);
  // EC codes, verbatim: district-constituency-subcounty-parish-village.
  const coded = vs.filter((v) => v.code);
  assert.equal(vs.length - coded.length, 1, "only the EC's duplicate-coded village lacks a code");
  for (const v of coded.slice(0, 2000)) {
    assert.match(v.code, /^\d{2,3}-\d{3}-\d{2}-\d{2,3}-\d{2}$/);
    assert.deepEqual(villageByCode(v.code), v);
  }
  // Refugee settlements are not in the EC gazetteer: no villages under them.
  const settlementIds = new Set(ss.filter((s) => s.kind === "settlement").map((s) => s.id));
  for (const p of ps.filter((p) => settlementIds.has(p.parentId))) assert.deepEqual(villages(p.id), []);
  // All villages under one parish come from one EC parish (same code prefix).
  for (const p of ps.slice(0, 3000)) {
    const prefixes = new Set(villages(p.id).filter((v) => v.code).map((v) => v.code.slice(0, v.code.lastIndexOf("-"))));
    assert.ok(prefixes.size <= 1, `parish ${p.code} mixes EC parishes: ${[...prefixes]}`);
  }
  assert.equal(villageByCode("06-028-01-01-01")?.name, "Kasambya I");
});
