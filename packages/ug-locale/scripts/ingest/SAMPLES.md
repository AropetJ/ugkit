# Source investigation record (2026-07)

> **Outcome:** UBOS is the source of `data/uganda.csv` — see "UBOS Track 2 —
> RESOLVED" below and `data/PROVENANCE.md`. The New Vision and EC sections are
> kept as the historical record of why those sources were rejected. The New
> Vision crawler (`crawl-ec.mjs`), `DISCOVERY.md` and `newvision-districts.json`
> were removed in the 0.1.0 close-out; they remain in git history.

## Endpoint discovery — New Vision election portal (captured 2026-07-02)

Session findings from driving the portal with browser DevTools. This is the
"Target A" discovery step from DISCOVERY.md.

## What the portal is

- Framework: **Nuxt 3** SPA (`_nuxt/*` chunks). No `__NEXT_DATA__`.
- Title: "Uganda Decides 2026 — Uganda Polling Stations".
- Header totals shown: **132 DISTRICTS**, **43,630 STATIONS**.
- The district list is delivered in the initial Nuxt payload (~23 KB); the
  132 districts (name, electoral region, station count, area count) are
  captured in `newvision-districts.json`.

## The data API (DISCOVERED)

```
GET https://cms-vgad.visiongroup.co.ug/api/enumeration-areas/district/{DISTRICT}/
```

- `{DISTRICT}` = the district name, uppercased, spaces kept, trailing slash
  required — e.g. `.../district/ARUA%20CITY/`, `.../district/MADI-OKOLLO/`.
- CORS preflight (OPTIONS) succeeds from the portal origin.
- Also observed: `https://api.newvisionapp.com/v1/Category?...` — that's the
  site nav menu, NOT election data. Ignore it.

## BLOCKER: API was returning HTTP 503 this whole session

Every GET to the enumeration-areas endpoint returned **503 Service
Unavailable** — the app's own three requests AND direct fetches. The
"Select an enumeration area" view rendered empty as a result.

**Therefore the response shape is UNCONFIRMED.** The single most important
open question could not be answered:

> Does the enumeration-areas response drill down to PARISH and VILLAGE, or does
> it stop at polling stations?

Re-run this discovery when the backend is up. First call to make:
`fetch('https://cms-vgad.visiongroup.co.ug/api/enumeration-areas/district/ABIM/')`
then paste the JSON shape here and wire `extractUnits()` in `crawl-ec.mjs`.

## STRUCTURAL CAVEAT — this source may not be village-complete

The portal's hierarchy is **District → "Enumeration Area" → … → Polling
Station**, and the numbers suggest it is electoral/station-oriented, not the
full admin hierarchy ugkit targets:

| Level (portal) | Portal count | EC target (13 Nov 2025) | Gap |
|---|---|---|---|
| Districts | 132 | 146 districts/cities | portal ~14 short |
| "Areas" (sum) | 304 | 312 counties | ≈ county level, not village |
| Polling stations | 43,630 | 50,739 | portal ~7k short |
| Villages | **unknown (503)** | 71,214 | ??? |

Read: "enumeration area" here behaves like **county/constituency** (304 ≈ 312),
NOT a census enumeration area / village. So even if the API drills to stations,
we may get District → County → (Parish?) → Polling Station — and polling
stations are NOT villages. If village depth is absent, this source alone cannot
fill `village` in `uganda.csv`.

## EC demarcated-areas PDFs — investigated 2026-07-02 (Track 1 pivot)

Downloaded from https://www.ec.or.ug/info/lists-demarcated-electoral-areas-2025
into `sources/` (both dated 14 Jan 2025). These are the EC's **electoral-area
demarcations, organised by ELECTIVE POSITION** — NOT a complete admin gazetteer.

### `split-by-village.pdf` (7.03 MB, 2402 pp)
- One elective position: **Sub-county/Town/Municipal Division Women Councillors**.
- Structure (one parish per page), every level CODED:
  `District 006 HOIMA > Constituency 028 BUGAHYA COUNTY > Subcounty 02 BUSERUKA
   > Parish 006 NYAKABINGO > Village 002 BISENYI`.
  ("Constituency" = the county tier; there is an extra "Electoral Area" grouping
  between parish and village which we ignore — we take the right VILLAGES column.)
- Parsed by `parse-ec-pdf.mjs` (uses `pdftotext -layout`). Counts:
  districts 136, counties 320, subcounties 1631, parishes 2098, **villages 16,557**.
- Parser verified correct (raw right-column tokens 17,377 ≈ parsed 17,314).
- => This file holds only **~23% of the 71,214 villages** — a SUBSET by design.

### `electoral-areas.pdf` (7.93 MB, 1531 pp)
- Columns: District | Constituency | Sub-county | Parish | Electoral Area.
- **No village column at all.** Seven position categories: District/City Directly
  Elected + Women Councillors; Sub-county/TC/Division Directly Elected + Women
  Councillors; Municipality/City Division Directly Elected + Women Councillors.
- Coded district→parish frame, but granularity varies by category.

### DEFINITIVE CONCLUSION
No single public EC download contains the complete 71,214-village register. The
EC publishes electoral demarcations per elective position; the full census
village frame lives at **UBOS**. Realistic paths to a COMPLETE village dataset:
1. **UBOS** census enumeration frame (Track 2 email) — complete + officially
   coded. Now the clear primary path for village-level completeness.
2. Union of multiple EC position-PDFs — messy, and even unioned, electoral areas
   need not enumerate every village. Not recommended as the sole source.

### SALVAGEABLE VALUE (available now, no UBOS needed)
- Official EC **codes** at every level (district/constituency/subcounty/parish,
  plus a 23% village sample) — lets us populate `Unit.id` with real codes.
- A coded district→county→subcounty→parish frame (finish the `electoral-areas.pdf`
  parser to confirm parish coverage vs the 10,717 target).

## UBOS Track 2 — RESOLVED (2026-07-08)

UBOS replied to the parish-frame request. What arrived:

- **File:** `sources/ubos-parishes-2026-07.xlsx`
  (originally `Administrative Units-Parish Level_UG-7 July 2026.xlsx`), single
  sheet `Uganda_Parishes_Ug`, 10,861 rows (header + 10,860 parish rows),
  10 columns: `Region, RCode, County, CCode, District, DCode, Sub_County,
  SCode, Parish, PCode`.
- **Coverage counts:** 4 regions, 146 districts, 313 (district, county) pairs,
  2,209 sub-counties, 10,860 parishes. Zero blank cells.
- **Code system:** hierarchical and PER-PARENT (SCode/PCode restart from
  `01` in each parent), so `(RCode, DCode, CCode, SCode, PCode)` is the
  unique key. `build-ubos-frame.mjs` concatenates ancestor codes with `.` to
  produce globally-unique per-level codes that fit ugkit's 12-char code
  limit.
- **Villages: not disseminated.** Bob confirmed in writing: *"the Bureau
  disseminates information up to parish not village level."* This is
  authoritative — the EC's per-position village PDFs are electoral subsets
  and no other complete, coded village register is published anywhere.
  Village-level in ugkit will therefore ship empty (safely queryable, empty
  results by contract) until UBOS changes its dissemination policy.
- **Data quality:** ONE typo across 10,860 rows — county code `218.2`
  (Bududa) spelled "RLUTSESHE COUNTY" in 1 row vs "LUTSESHE COUNTY" in 76.
  Fixed via a documented entry in `build-ubos-frame.mjs → ERRATA`.
- **Delta vs EC:** UBOS reports **312 admin counties** (once
  Kampala-division "counties" collapse to the divisions we already treat as
  counties). This matches the EC's admin count exactly; the EC's 329 in the
  prior release was an artefact of electoral-constituency dedup. UBOS is now
  the authoritative source for `data/uganda.csv`; the EC coded sidecar stays
  in `ec-districts-counties.csv` for future constituency-level work.
- **Structural quirk to remember:** in UBOS, Kampala's 5 divisions appear
  simultaneously as county AND sub-county (the division is both). This is
  correct — Kampala Capital City Authority conflates the two administrative
  levels — and it flows through the pipeline naturally.

## EC "Verified Administrative Units, July 2022" — parsed 2026-10-27

The village-level lead from the gap audit. Findings:

- **Source:** https://www.ec.or.ug/sites/default/files/statistics/ADMINISTRATIVE%20UNITS%20IN%20UGANDA_JULY%202022.pdf
  — 3,019 pages, Microsoft Access report generated 19 Jul 2022, 10.8 MB,
  sha256 `fa70833b…683d`. Kept locally in `sources/ec-admin-units-2022/`
  (gitignored; redistribution terms unknown).
- **Structure:** page headers DISTRICT / CONSTITUENCY; three columns
  sub-county / parish / village, each cell `NN NAME`. EC codes at every
  level; village codes have gaps (retired villages). Totals printed per
  sub-county block (2,198), per district (146), and nationally (71,230).
- **Parse quirks handled** (`parse-ec-admin-units.mjs`): column offsets drift
  per page (bounds taken from each header); long names wrap onto uncoded
  lines; a long parish name can abut its village with a single space;
  internal space runs ("PANYANGASI     A"); names truncated at 30 chars on
  total lines; sub-county codes restart per constituency (so a new
  constituency's "01" is not a page-top repeat); quotes in names.
- **Result:** 71,230 villages, 10,717 parishes, 353 constituencies, 146
  districts — every printed total matches. Defects in the source: two
  villages coded `67-126-31-146-01` (Manafwa / Bunamone Ward: BUWALUSATI,
  BUTTA) with a stray "0" line; "… WARD COUNCIL" parish names; "TOWN COUCIL".
- **Crosswalk to UBOS 2026** (`crosswalk-ec-villages.mjs`): 99.5% of
  villages placed, 0 collisions. Side effect: exposed three UBOS town
  councils with broken suffixes, now fixed in `build-ubos-frame.mjs → ERRATA`.
- **Licence:** not stated in the PDF or on the site. Request drafted in
  `ec-request-draft.md`.

## Recommendation (superseded — see EC PDF conclusion above)

1. Re-hit the endpoint when up; confirm whether parish/village appear.
2. If YES to village depth → wire `crawl-ec.mjs`, dry-run ABIM, full crawl.
3. If NO (stops at polling stations) → this source gives districts + counties +
   stations only. For true village-level data, pivot to:
   - **EC per-district polling-station PDFs** (Target B, `node/635`), which do
     carry district → … → parish → village → station, OR
   - the **UBOS** frame (the parallel email track), which is village-complete
     and coded.
4. Regardless, `newvision-districts.json` is usable now as a districts anchor
   and a cross-check for the 146-vs-132 reconciliation.
