# Dataset gaps — what `@ugkit/locale` 2026.1 is missing, district downwards

Audit date: 2026-10-27. Scope: everything below the national level that an
application might expect from this package and that dataset `2026.1` does not
ship correctly or at all. Each item says how we know, the best source to close
it, and confidence. "Verified" = checked against `data/uganda.csv` or the
committed UBOS source; "reported" = from external sources (URLs given), not
independently confirmed. None of these block publishing 0.1.0 — they are the
work list for 0.2+ dataset releases.

## Summary

| # | Gap | Level | Have the data? | Effort |
|---|---|---|---|---|
| 1 | ~~Villages~~ **Shipped** — 70,878 from EC July 2022; permission pending | village | Yes | — |
| 2 | ~~Refugee-settlement units not flagged~~ **Done** — `kind: "settlement"` | sub-county, parish | Yes | — |
| 3 | Nine town councils created 1 Jul 2025 missing / mistyped | sub-county | Partly | Small |
| 4 | ~~Region dropped at ingest~~ **Done** — `Unit.region`, `districtsInRegion` | district | Yes | — |
| 5 | ~~Unit type~~ **Done** — `Unit.kind` | all | Yes | — |
| 6 | City divisions duplicated at county + sub-county | county, sub-county | **Yes** | Small (model decision) |
| 7 | 17 sub-regions | district | No — UBOS census profiles | Small |
| 8 | 2024 census population | district → parish | No — UBOS xlsx (to sub-county), PDFs (parish) | Medium |
| 9 | County ↔ constituency crosswalk | county | Partly — EC sidecar committed | Medium |
| 10 | Boundaries / centroids | all | No | Large (separate `-geo` package) |
| 11 | Pending creations (Tororo split, Bughendera, 5 cities) | district | N/A — not legally in force | Watch only |
| 12 | `byName` ambiguity at parish level | parish | N/A — API/UX | Small (docs) |

## 1. Villages — the only missing level

> **Status 2026-10-27 — SHIPPED in 2026.1** (maintainer's decision), with
> attribution and the July 2022 date stated; EC permission still being
> sought (`scripts/ingest/ec-request-draft.md`). Open: EC permission, a newer
> edition (2026 LC I list), the 352 unplaced villages.
>
> Earlier status — parsed and crosswalked:
> The EC July 2022 gazetteer is verified: EC codes down to village
> (`district-constituency-subcounty-parish-village`, e.g. `06-028-01-01-01`).
> `scripts/ingest/parse-ec-admin-units.mjs` extracts **71,230 villages /
> 10,717 parishes / 353 constituencies / 146 districts**, matching every one
> of the PDF's 2,198 sub-county subtotals, 146 district totals and the grand
> total. `crosswalk-ec-villages.mjs` places **70,878 villages (99.5%)** under
> UBOS parishes — 95.9% exact, 1.7% rough, 1.9% fuzzy (listed for review) —
> with no UBOS parish receiving two EC parishes. Unplaced: 55 EC parishes /
> 352 villages (structural changes since 2022, e.g. "Makerere University",
> 2022 town councils absent in 2026). Caveat for shipping: 77 non-settlement
> UBOS parishes get no villages — most likely parishes split since 2022 whose
> villages the EC still lists under the parent. Source defects: Manafwa /
> Bunamone Ward has two villages coded `01`. Next: send
> `scripts/ingest/ec-request-draft.md`; ship only with permission.

- **Shipped:** 0. UBOS confirmed in writing it disseminates only to parish
  (`PROVENANCE.md`). Reference totals: EC 71,214 (voter statistics Nov 2025;
  also used for the 28 Jul 2026 LC I elections), EC 71,230 (July 2022 admin-
  units summary), UBOS profile page 71,227 (undated).
- **Best lead (reported, partially verified):** EC *Administrative Units in
  Uganda, July 2022* —
  https://www.ec.or.ug/sites/default/files/statistics/ADMINISTRATIVE%20UNITS%20IN%20UGANDA_JULY%202022.pdf
  (verified: HTTP 200, 10.8 MB, last-modified 19 Jul 2022). Reportedly a
  ~3,000-page gazetteer with EC hierarchical codes down to village
  (`district-constituency-subcounty-parish-village`). **Not yet opened** —
  village codes and completeness UNVERIFIED. Index: https://www.ec.or.ug/admin-units
- **Caveats:** keyed by *constituency*, not county, and by EC codes, not UBOS
  codes — needs a crosswalk onto our UBOS parishes (name-match within parish;
  `namesRoughlyEqual` exists for this). Four years old (pre-dates the 2025 town
  councils). Redistribution terms not stated — ask the EC before shipping.
- **Derived datasets (reported):** `github.com/kakandemanwell/uganda` claims
  71,230 village rows parsed from that PDF (CC BY 4.0 on the derivative;
  upstream terms unclear); `github.com/buyonjederrick/Uganda.AdministrativeUnits`
  claims the EC codes. Use only to cross-check our own parse, not as a source.
- **Rejected:** UBOS census EA frame (microdata restricted), HDX "Uganda
  villages" (2009, 128-district system), OSM (sparse below district), New
  Vision portal and EC "split by village" PDF (see `scripts/ingest/SAMPLES.md`).

## 2. Refugee-settlement units (verified) — DONE

> Closed in 0.1.0: 19 settlement sub-counties have `kind: "settlement"`
> (`build-ubos-frame.mjs → SETTLEMENTS`); excluding them gives 2,190 /
> 10,712 vs EC 2,191 / 10,717, now enforced by `validate.mjs`.

UBOS carries refugee settlements as their own sub-counties; the EC/census
2,191 / 10,717 frame does not. This is why we ship **2,209** sub-counties and
**10,860** parishes. A name scan of `uganda.csv` finds 21 settlement-type
sub-counties holding 156 parishes, e.g. Nakivale Basecamp Rwc III (Isingiro),
Kyangwali Rsc (Kikuube), Bidi Bidi Refugee Camp ×3 (Yumbe), Palabek Refugee
Settlement Camp (Lamwo), Rwamwanja Refugee Camp (Kamwenge). A per-district
comparison against the EC 2022 summary (reported) gives +18 sub-counties in
12 settlement-hosting districts, offset by Kampala −1. Two name matches —
"Rhino Camp" and "Rhino Camp Town Council" (Madi-Okollo) — are probably
ordinary units named after the settlement, which fits the +18 figure.

**Fix:** a `settlement` flag (or unit type, §5) via a curated code list in
the ingest, so users can filter to the EC/census frame. No new source needed.

## 3. Town councils created 1 July 2025 (verified against our data)

Minister's letter to the EC chair, 1 Jul 2025 ("deemed operational");
reported by Daily Monitor, 13 Jul 2025:
https://www.monitor.co.ug/uganda/news/national/full-list-govt-approves-nine-new-town-councils-ahead-of-2026-elections-5117060
No statutory-instrument number found.

| Town council | District | In `uganda.csv` |
|---|---|---|
| Awach | Gulu | plain sub-county "Awach" |
| Kitoba | Hoima | plain sub-county "Kitoba" |
| Ogur | Lira | plain sub-county "Ogur" |
| Katine | Soroti | plain sub-county "Katine" |
| Vurra | Arua | plain sub-county "Vurra" |
| Kyanamukaka | Masaka | plain sub-county "Kyanamukaka" |
| Kagoma | Jinja | **absent** |
| Busoro | Kabale | **absent** (our "Busoro" is in Kabarole) |
| Mbale | Mbale | **absent** (our "Mbale Town Council" is in Kyenjojo) |

UBOS's July 2026 frame has not caught up. Whether the conversions also split
out wards is UNVERIFIED. **Fix:** confirm with MoLG/UBOS, then either an
`ERRATA`/additions table in `build-ubos-frame.mjs` (with provenance) or wait
for the next UBOS frame. Document as a known gap meanwhile.

## 4. Region — already in our source, dropped at ingest (verified) — DONE

> Closed in 0.1.0: `Unit.region` on districts, `districtsInRegion()`.

The committed UBOS file has `Region,RCode` on every row: Central (1) 27
districts, Eastern (2) 40, Northern (3) 41, Western (4) 38. No district spans
two regions. **Fix:** carry it through the ingest as a district attribute — a
CSV-format change (new column) and a `Unit` field, so it wants a minor
version and a deliberate design pass, not a quick patch.

## 5. Unit type (verified, derivable) — DONE

> Closed in 0.1.0: `Unit.kind` on every unit; rules in
> `scripts/ingest/kinds.mjs`, exceptions via `KIND_OVERRIDES`.

Not stored; recoverable from name suffixes in the UBOS frame:

- Districts: 11 city districts (Kampala + Arua, Fort Portal, Gulu, Hoima,
  Jinja, Lira, Masaka, Mbale, Mbarara, Soroti Cities), 135 districts.
- Counties: 248 County, 31 Municipality, 25 Division, 8 unsuffixed
  (Bughendera, Buliisa, Chua East, Chua West, Kashari North, Kashari South,
  Omoro, West Moyo).
- Sub-counties: 1,525 sub-county, 577 Town Council, 107 Division.
- Parishes: 7,762 parish, 3,098 Ward.

**Fix:** a `kind` field computed at ingest. Note that the UBOS profile page
reports 302 counties and 2,197 sub-counties (undated) — unexplained;
possibly municipalities are counted differently (UNVERIFIED).

## 6. City divisions duplicated across two levels (verified)

In all 11 city districts, each division appears as a county *and* as its
only sub-county (26 units, e.g. Gulu City → Bardege-Layibi Division →
Bardege-Layibi Division). That's faithful to UBOS, but a cascading select
shows the same name twice. Decide: keep (document — done in CONTRIBUTING),
or mark the sub-county echo so UIs can skip a level.

## 7. Sub-regions (reported)

The 2024 census uses 17 sub-regions (First Schedule, 1995 Constitution); each
UBOS sub-region profile lists its districts (Table 1.2):
https://statistics.ubos.org/nphc/report. Small, static — pairs with §4.

## 8. 2024 census population (reported)

District/county/sub-county: UBOS `NPHC-2024-Subcounty-Profiles-Excel-Tables.xlsx`
(9.4 MB, modified 15 Jun 2026):
https://statistics.ubos.org/nphc/resources/NPHC-2024-Subcounty-Profiles-Excel-Tables.xlsx
Parish: PDF tables in the 17 sub-region profiles only. National total
45,905,417. HDX COD-PS is still 2023 projections on 135 districts — don't
use. Population changes on census cycles, so if added it belongs in its own
subpath (`@ugkit/locale/population`) so lookups never pay for it.

## 9. County ↔ constituency (partly in repo)

312 counties vs 353 constituencies; no new constituencies for 2026 (IPU,
EC). `scripts/ingest/ec-districts-counties.csv` already holds the 353 EC
constituencies with EC district codes. EC and UBOS districts match 1:1 by
name except "Fort Portal" (EC) ↔ "Fort Portal City" (UBOS), so the district
join is trivial; the county ↔ constituency join needs name matching. Natural
home: the planned constituency/parliament package (ROADMAP).

## 10. Boundaries and centroids (reported)

HDX COD-AB (https://data.humdata.org/dataset/cod-ab-uga) is 135 districts,
files ~2023, flagged stale, and doesn't match our county/sub-county/parish
frame. The UBOS 2024 census polygons are the right source (request from
UBOS). Out of scope for this package by design — a future `@ugkit/locale-geo`
keyed by our codes.

## 11. Watch list — not legally in force (reported)

Don't add until gazetted and operational:

- **Tororo split** — Mukuju, Mulanda, Kisoko districts + Tororo City.
  Presidential approval Apr 2025, Cabinet/caucus Sep 2025; as of Oct 2026 the
  2021 moratorium on new units "has not been lifted" (PM to Parliament,
  1 Oct 2026). No gazette, no effective date.
  https://www.riotimesonline.com/museveni-new-tororo-counties-city-2026/
- **Bughendera District** (from Bundibugyo) — caucus-approved Sep 2025,
  stalled.
- **Five pending cities** — Entebbe, Kabale, Moroto, Nakasongola, Wakiso;
  approved 2020, not operationalised (10 of 15 cities running).

## 12. Name ambiguity (verified, API note)

`xByName` returns `undefined` for names shared within a level, by design.
Shared names: 2 at county level (4 units), 47 at sub-county (120 units),
**841 at parish (2,187 units — ~20% of parishes)**. Parish lookups by name
alone will often miss; the README should steer users to
`parishes(subCountyId)` or `parishByCode`.

## Recommended order

1. ~~**Small, no new source:** §4 region, §5 kind, §2 settlement flag~~ —
   done in 0.1.0 (docs/design-unit-attributes.md).
2. **§3 town councils** — confirm with MoLG/UBOS; add as documented additions.
3. **§1 villages** — shipped from the EC July 2022 gazetteer; send the EC
   request (`scripts/ingest/ec-request-draft.md`) for permission and a 2026
   edition.
4. §7 sub-regions with §4; §8 population as its own subpath.
5. §9 and §10 belong in other packages (constituencies, `-geo`).
