# Data ingestion playbook

Goal: produce a canonical, validated `data/uganda.csv` (10 columns — a
`code,name` pair per level, rows may stop early) covering the current
hierarchy, with recorded provenance.

## Reference counts (validation targets)

Electoral Commission voter statistics, as of 13 Nov 2025
(https://www.ec.or.ug/voter-statistics):

| Level | Count |
|---|---|
| Districts + cities | 146 |
| Counties | 312 |
| Sub-counties / town councils / divisions | 2,191 |
| Parishes / wards | 10,717 |
| Villages / cells | 71,214 |

Known churn: Tororo District split (3 districts + 1 city) approved but not
yet reflected in EC figures. Expect these numbers to move; tolerances live
in `validate.mjs`.

## Sources

**Live source: UBOS** — *Administrative Units — Parish Level (UG)*, obtained by
direct request to ubos@ubos.org (template: `ubos-request-draft.md`). Ingested by
`build-ubos-frame.mjs`; see that file's header for the xlsx → csv step and the
code-chaining scheme, and `data/PROVENANCE.md` for the release record. To
refresh: request the latest frame, drop it in `sources/`, re-run the script,
review the CSV diff, bump `ugkit.datasetVersion`.

UBOS disseminates **only to parish level**. Villages are not sourced and the
level ships empty.

Rejected / reference-only sources (full reasoning in `SAMPLES.md`):

- **Electoral Commission PDFs** — coded, but electoral (constituencies, not
  counties), and the village-level PDF covers ~23% of villages. Tooling kept:
  `build-ec-frame.mjs`, `parse-ec-pdf.mjs`, and the 353-constituency sidecar
  `ec-districts-counties.csv` for a future constituency-level package.
- **New Vision election portal** — API unavailable (HTTP 503) and stops at
  polling stations, not villages. Crawler removed.
- **HDX COD-AB** — UBOS 2020 boundary shapefiles
  (https://data.humdata.org/dataset/cod-ab-uga), parish depth, pre-2021
  districts. Not for names; reserve for a future `@ugkit/locale-geo`.

## Pipeline stages

```
fetch → extract → canonicalName() → dedupe paths → uganda.csv
                                        ↓
                              validate.mjs (counts, dupes, orphans)
                                        ↓
                              build-data.mjs (packed blobs)
```

- All names pass through `normalize.mjs#canonicalName` before hitting CSV.
- Cross-source reconciliation uses `namesRoughlyEqual`.
- Re-ingestion should emit a diff vs the previous CSV (added/removed/renamed
  units) — paste it into CHANGELOG.md under the new datasetVersion.

## Provenance

Record in `data/PROVENANCE.md` for every dataset release: source URL(s),
retrieval date, extraction method, known caveats, and the validation output.
