// A tour of @ugkit/locale — the everyday tasks, in the order an app meets them.
// Run after `npm run build`:  node examples/tour.mjs

import {
  districts,
  districtByName,
  districtById,
  districtsInRegion,
  searchDistricts,
  counties,
  countyById,
  datasetVersion,
} from "@ugkit/locale";
import { subCounties, subCountyById } from "@ugkit/locale/subcounties";
import { parishes, parishById, parishByCode, parishByName } from "@ugkit/locale/parishes";

const show = (title, value) => console.log(`\n▸ ${title}\n`, value);

// 1. A district dropdown — the light, common path (~5 KB of data).
show(`${districts().length} districts & cities (dataset ${datasetVersion}); first three`,
  districts().slice(0, 3).map((d) => `${d.name} [${d.kind}, ${d.region}]`));

// 2. Typeahead: normalized prefix search.
show('searchDistricts("mba")', searchDistricts("mba").map((d) => d.name));

// 3. Name lookup forgives case, spacing and punctuation.
show('districtByName("  fort-portal city ")', districtByName("  fort-portal city "));

// 4. Drill down: every step is an O(1) slice of the level below.
const wakiso = districtByName("Wakiso");
const busiro = counties(wakiso.id).find((c) => c.name === "Busiro County");
const bussi = subCounties(busiro.id).find((s) => s.name === "Bussi");
show("Wakiso → Busiro County → Bussi → parishes",
  parishes(bussi.id).map((p) => `${p.name} (${p.code})`));

// 5. Villages are the heavy level (~550 KB gzipped): load them only when the
//    form needs them. In a browser bundle this becomes a separate chunk.
const { villages, villageByCode } = await import("@ugkit/locale/villages");
const balabala = parishes(bussi.id)[0];
show(`Villages of ${balabala.name} (EC codes, July 2022)`,
  villages(balabala.id).map((v) => `${v.name} ${v.code}`));

// 6. Persist CODES, never ids. Store the code; resolve it when you read back.
const saved = { village: villages(balabala.id)[0].code, parish: balabala.code };
const v = villageByCode(saved.village);
const p = parishByCode(saved.parish);
show("Saved codes → resolved back", { saved, village: v.name, parish: p.name });

// 7. Walk up from any unit with parentId to build a full address line.
function addressOf(village) {
  const parish = parishById(village.parentId);
  const sub = subCountyById(parish.parentId);
  const county = countyById(sub.parentId);
  const district = districtById(county.parentId);
  return [village.name, parish.name, sub.name, county.name, district.name].join(", ");
}
show("Full address line", addressOf(v));

// 8. Ambiguous names return undefined rather than guess — scope by parent.
show('parishByName("Central Ward") — shared by many parishes', parishByName("Central Ward"));

// 9. Region and kind for reporting and filtering.
show("Districts per region", Object.fromEntries(
  ["Central", "Eastern", "Northern", "Western"].map((r) => [r, districtsInRegion(r).length])));
const isingiro = districtByName("Isingiro");
const settlements = counties(isingiro.id)
  .flatMap((c) => subCounties(c.id))
  .filter((s) => s.kind === "settlement");
show("Refugee settlements in Isingiro (excluded from EC/census counts)",
  settlements.map((s) => s.name));
