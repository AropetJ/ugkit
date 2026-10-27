# Dataset provenance

## 2026.1 — districts + counties + sub-counties + parishes (production)

- **Content:** 146 districts/cities, 312 counties, 2,209 sub-counties/town
  councils/divisions, and 10,860 parishes/wards. Every level carries a
  hierarchical UBOS code (`DCode`, `DCode.CCode`, `DCode.CCode.SCode`,
  `DCode.CCode.SCode.PCode`) so codes are globally unique per level. Villages
  are NOT sourced — see "Village-level policy" below.
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
  villages          0  (not yet sourced — skipped)

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
  villages.ts       65   KB  raw  <1     KB  gz  (empty placeholder)
  ```

### Village-level policy

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
