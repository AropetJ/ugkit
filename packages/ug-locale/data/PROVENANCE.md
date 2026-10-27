# Dataset provenance

## 2026.1 — districts + counties + sub-counties + parishes (UBOS) + villages (EC)

- **Content:** 146 districts/cities, 312 counties, 2,209 sub-counties/town
  councils/divisions, and 10,860 parishes/wards. Every level carries a
  hierarchical UBOS code (`DCode`, `DCode.CCode`, `DCode.CCode.SCode`,
  `DCode.CCode.SCode.PCode`) so codes are globally unique per level. Villages
  are not disseminated by UBOS; they come from the EC (July 2022) — see
  "Villages — Electoral Commission, July 2022" below.
- **Source:** Uganda Bureau of Statistics, *"Administrative Units — Parish
  Level (UG)"* spreadsheet, provided by direct request to `ubos@ubos.org`
  (draft: `../scripts/ingest/ubos-request-draft.md`).
  - Original filename: `Administrative Units-Parish Level_UG-7 July 2026.xlsx`
  - Repo copy: `../scripts/ingest/sources/ubos-parishes-2026-07.xlsx`
    (sha256 `2756a4461f2327c2b0786c1a271cd92db5ebc074edc11e7662903a1d63b7aa3a`)
    and its CSV extraction `ubos-parishes-2026-07.csv`
    (sha256 `c12eedc6f58d65b8694d0e61919cf169da459de82aada26524bdc85108b5a432`).
    Both are committed so `build-ubos-frame.mjs` re-runs from a fresh clone.
- **Retrieved:** 2026-07-08 (email from UBOS confirming dissemination up to
  parish level only).
- **Extraction:** the xlsx is converted once to `sources/ubos-parishes-2026-07.csv`
  (single-sheet, 10 columns, 10,860 rows — see the header comment in
  `scripts/ingest/build-ubos-frame.mjs` for the exact `openpyxl` one-liner).
  From there `build-ubos-frame.mjs` (zero deps) normalises names via
  `normalize.mjs → canonicalName`, concatenates UBOS's per-parent codes into
  globally-unique per-level codes, and emits `data/uganda.csv`.
- **Errata (documented in `build-ubos-frame.mjs → ERRATA`):**
  - County code `218.2` (Bududa): 1 row of 77 spelled the county
    "RLUTSESHE COUNTY"; the majority (and historical) spelling is
    "LUTSESHE COUNTY". Corrected during ingest.
  - Sub-counties `406.2.06`, `411.4.03` (Kasese, Ntungamo): names truncated
    mid-suffix ("…TOWN COUNCI") → "…TOWN COUNCIL".
  - Sub-county `109.2.07` (Nakasongola): "MAYIRIKITI TOWNCOUNCIL" →
    "MAYIRIKITI TOWN COUNCIL".
  - The last three were mis-kinded as plain sub-counties until fixed; found
    while crosswalking EC villages (see `GAPS.md` §1).
- **Attributes:**
  - *Region* — UBOS's own `Region` column (Central 27, Eastern 40, Northern
    41, Western 38 districts), carried through unchanged; the ingest fails
    if a district appears in two regions.
  - *Kind* — derived from the canonical name's suffix by
    `scripts/ingest/kinds.mjs` (e.g. "… Town Council" → `town-council`,
    "… Ward" → `ward`, "Kampala"/"… City" → `city`), with a
    `KIND_OVERRIDES` table in `build-ubos-frame.mjs` (empty in 2026.1).
  - *Settlement* — 19 sub-county codes curated in `build-ubos-frame.mjs →
    SETTLEMENTS`, identified by name and checked district-by-district
    against the EC July 2022 summary (see `GAPS.md` §2). "Rhino Camp"
    (`336.1.05`) and "Rhino Camp Town Council" (`336.1.07`) are ordinary
    units, not the settlement (`336.1.06`).
- **Naming policy (`normalize.mjs → canonicalName`):** UBOS names are upper
  case; they are title-cased, with each segment after `-`, `/`, `(` and `.`
  capitalized ("BUSSI/KISABA" → "Bussi/Kisaba", "P.W.D" stays "P.W.D").
  Particles `of`/`and` stay lower case; Roman numerals and single-letter
  suffixes stay upper case. Codes are never altered.
- **Validation (`npm run validate:data`):**
  ```
  districts       146  expected 146 ±5    ✓
  counties        312  expected 312 ±15   ✓
  subcounties    2209  expected 2191 ±100 ✓
  parishes      10860  expected 10717 ±300 ✓
  villages      70878  expected 71214 ±1500 ✓

  EC frame (excluding 19 refugee settlements):
  subcounties    2190  expected 2191 ±10  ✓
  parishes      10712  expected 10717 ±50  ✓

  All validations passed.
  ```
- **Generated blob sizes** (after `npm run build`, gzip is `gzip -c | wc -c`):
  ```
  districts.ts       4.4 KB  raw    1.5 KB  gz
  counties.ts       13   KB  raw    3.6 KB  gz
  subcounties.ts    80   KB  raw   19   KB  gz
  parishes.ts      416   KB  raw   85   KB  gz
  villages.ts     3.0   MB  raw  548    KB  gz
  ```

### Villages — Electoral Commission, July 2022

- **Content:** 70,878 villages/cells (70,699 village, 179 cell) under 10,662
  UBOS parishes, each with its EC code verbatim
  (`district-constituency-subcounty-parish-village`, e.g. `06-028-01-01-01`).
- **Source:** Electoral Commission of Uganda, *"Uganda's Verified
  Administrative Units, July 2022"* —
  https://www.ec.or.ug/sites/default/files/statistics/ADMINISTRATIVE%20UNITS%20IN%20UGANDA_JULY%202022.pdf
  (3,019 pages, generated 19 Jul 2022; sha256
  `fa70833b077402f69cdba96075d13a032fe76ff045d4ee929bee491848cb683d`).
  Retrieved 2026-10-27. **Reference date: July 2022.**
- **Licence / terms:** none stated in the publication or on the EC site.
  Included with attribution at the maintainer's decision (2026-10-27) while
  permission is sought (`scripts/ingest/ec-request-draft.md`). Will be
  removed in a dataset release if the EC requests it.
- **Extraction:** `pdftotext -layout`, then
  `scripts/ingest/parse-ec-admin-units.mjs` → `scripts/ingest/sources/ec-villages-2022.csv`
  (committed; the PDF is not). The parser fails unless all 2,198 sub-county
  subtotals, 146 district totals and the national total (71,230) match.
- **Attachment:** `build-ubos-frame.mjs` matches each EC parish to a UBOS
  parish by name (`ec-villages.mjs`: exact → rough → fuzzy, unique and
  kind-guarded; no UBOS parish may receive two EC parishes) and writes its
  villages beneath it. 70,878 of 71,230 placed (99.5%): 95.9% exact, 1.7%
  rough, 1.9% fuzzy. **Every fuzzy match was reviewed by hand** (2026-10-27:
  124 decisions covering 195 EC parishes / 1,335 villages, all accepted —
  93 parish decisions are the sole leftover pair in their sub-county, 38
  have a village named after the UBOS parish). Verdicts and evidence are in
  `scripts/ingest/ec-fuzzy-review.csv`; the ingest refuses any fuzzy match
  without a verdict. 352 villages in 55 EC parishes that no longer
  correspond to a 2026 UBOS parish are left out; `crosswalk-ec-villages.mjs`
  lists them and every fuzzy match.
- **Known defects:** the EC printed code `67-126-31-146-01` for two villages
  (Manafwa / Bunamone Ward: Buwalusati, Butta); the second ships without a
  code. 198 UBOS parishes have no villages — 148 under refugee settlements,
  ~50 created or reorganised since 2022, whose villages the EC may list under
  a parent parish.

### Village-level policy (superseded 2026-10-27)

UBOS confirmed in writing (2026-07-08) that the Bureau disseminates
administrative units only **up to parish, not village level**. No coded
national village register is published by UBOS. The EC's "Split by village"
PDF is a subset (one elective position, ~23% of the national count) and is
therefore unsuitable as an authoritative source. Consequently ugkit ships
`@ugkit/locale` with `villages` present as an empty, safely-queryable level;
`prefix()`/`byName()` on villages return empty results by contract. If a
future UBOS release publishes villages, they will slot in without any code
change (the runtime tolerates variable depth).

### Prior source retired

The EC "Demarcated Electoral Areas 2025" PDF supplied the 2026.1 predecessor
release (districts + counties only). It is retained in
`scripts/ingest/sources/electoral-areas.pdf` and its coded sidecar in
`scripts/ingest/ec-districts-counties.csv` (353 electoral constituencies,
useful for future constituency-level work — e.g. a companion
`@ugkit/constituencies` package). It is no longer the source of
`data/uganda.csv`.

### Known gaps

See [`GAPS.md`](GAPS.md) for the full audit (2026-10-27): what this release
lacks from district level down, with sources and a recommended order.

### Known upstream churn

- Tororo district's pending split into three districts + one city is not yet
  reflected in this UBOS release. It will land when UBOS republishes.

## 2026.1 (SAMPLE — pipeline fixture, not shipped)

- `data/uganda.sample.csv`: 15 hand-written rows (Kampala, Wakiso, Gulu,
  Mbarara, Jinja), full 5-level depth. Used as the pipeline fallback and for
  the scale benchmark. Not used when `data/uganda.csv` is present.
- Reference counts (EC voter statistics, 13 Nov 2025): 146 districts/cities,
  312 counties, 2,191 sub-counties, 10,717 parishes, 71,214 villages
  (https://www.ec.or.ug/voter-statistics).
