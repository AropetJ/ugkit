# Dataset provenance

## 2026.1 — districts + counties (partial depth; production)

- **Content:** 146 districts/cities and 329 counties. Sub-counties, parishes and
  villages are NOT yet sourced (the barrel exports only districts + counties by
  design, so this is a coherent, usable release).
- **Source:** Uganda Electoral Commission, *"Display List of Demarcated Electoral
  Areas for Local Government Council Elections 2025"*
  (`Local Goverment Electoral Areas for display.pdf`, 1531 pp, modified
  14 Jan 2025), from
  https://www.ec.or.ug/info/lists-demarcated-electoral-areas-2025
- **Retrieved:** 2026-07-02.
- **Extraction:** `pdftotext -layout` → `scripts/ingest/build-ec-frame.mjs`
  (names via `normalize.mjs` `canonicalName`). Every level carries an official
  EC code; the full coded constituency list is kept in
  `scripts/ingest/ec-districts-counties.csv` (353 constituencies) for future
  `Unit.id` alignment.
- **Constituency → county reconciliation:** the EC "Constituency" tier lists 353
  electoral constituencies. Several constituencies share one county name (e.g.
  Bukooli County → 031/032; West Budama → 209/210/316); deduping by name yields
  **329 counties**, near the 312 administrative counties (the remainder are
  city/municipal divisions counted at this tier, as `validate.mjs` notes).
- **Validation (`npm run validate:data`):**
  ```
  districts       146  expected 146 ±5  ✓
  counties        329  expected 312 ±400  ✓
  subcounties       0  (not yet sourced — skipped)
  parishes          0  (not yet sourced — skipped)
  villages          0  (not yet sourced — skipped)
  All validations passed.
  ```
- **Known caveats / pending changes:**
  - Sub-counties → villages pending. No single public EC download contains the
    complete 71,214-village register (the EC's "Split by village" PDF is a ~23%
    subset — one elective position); the full coded frame is being requested
    from UBOS. See `scripts/ingest/SAMPLES.md` for the full investigation.
  - Pending Tororo split (into 3 districts + 1 city) not yet reflected upstream.

## 2026.1 (SAMPLE — pipeline fixture, not shipped)

- `data/uganda.sample.csv`: 15 hand-written rows (Kampala, Wakiso, Gulu, Mbarara,
  Jinja), full 5-level depth. Used as the pipeline fallback and for the scale
  benchmark. Not used when `data/uganda.csv` is present.
- Reference counts (EC voter statistics, 13 Nov 2025): 146 districts/cities,
  312 counties, 2,191 sub-counties, 10,717 parishes, 71,214 villages
  (https://www.ec.or.ug/voter-statistics).
