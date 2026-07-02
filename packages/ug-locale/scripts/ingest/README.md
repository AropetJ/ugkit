# Data ingestion playbook

Goal: produce a canonical, validated `data/uganda.csv` with header
`district,county,subcounty,parish,village`, covering the full current
hierarchy, with recorded provenance.

## Reference counts (validation targets)

Electoral Commission voter statistics, as of 13 Nov 2025
(https://www.ec.or.ug/voter-statistics):

| Level | Count |
|---|---|
| Districts + cities | 146 |
| Counties | 312 (+ city/municipal divisions at this tier) |
| Sub-counties / town councils / divisions | 2,191 |
| Parishes / wards | 10,717 |
| Villages / cells | 71,214 |

Known churn: Tororo District split (3 districts + 1 city) approved but not
yet reflected in EC figures. Expect these numbers to move; tolerances live
in `validate.mjs`.

## Sources, in order of preference

1. **Electoral Commission (freshest, village-complete).**
   The EC demarcated every village for the 2025/2026 general elections and
   the June 2026 LC I/LC II elections. Data surfaces:
   - Per-district polling station lists (PDF) on ec.or.ug — full chain
     district → constituency → subcounty → parish → village → station.
   - Voter locator at https://www.ec.or.ug/register/ (search UI).
   - New Vision mirror: https://www.newvision.co.ug/election-portal/polling-stations
     — a JS app; the JSON API it calls is not referenced in the static HTML.
     **Discovery step:** open the page with browser DevTools → Network tab,
     type a district name, and capture the XHR endpoint + response shape.
     If it returns clean JSON per level, ingestion becomes a simple crawler
     with polite rate limiting.
   - CAVEAT: the EC hierarchy is electoral (constituencies); map
     constituency→county carefully or reconcile against UBOS/MoLG naming.

2. **UBOS (authoritative frame; request for village level).**
   - 2024 NPHC sub-region profiles (ubos.org) publish the hierarchy to
     parish level — extract for reconciliation.
   - The village-level census geography frame exists (census mapping
     2021–2024) but is not a public download. Email **ubos@ubos.org**
     referencing the Microdata Archive, explaining the open-source MIT
     library use case, and request the administrative units list
     (names + codes, all levels). If granted, UBOS codes become our
     stable IDs — align `Unit.id` with them in a minor release.

3. **HDX COD-AB (geo only, stale).** UBOS 2020 boundary shapefiles at
   https://data.humdata.org/dataset/cod-ab-uga — parish depth, pre-2021
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
