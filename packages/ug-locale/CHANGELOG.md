# Changelog

Code follows semver. The dataset has its own version
(`package.json → ugkit.datasetVersion`), stamped into every generated blob.

## [Unreleased] — 0.1.0 (not yet published)

### Code
- Flat structure-of-arrays tree engine: `(parent, name)`-sorted levels,
  contiguous children, `[firstChild, count]` span slices (O(1) `childrenOf`).
- Lazy name indices, normalized `byName`, prefix `search`.
- Subpath exports per level; villages excluded from the barrel by design.
- Data pipeline `scripts/build-data.mjs` (CSV → `JSON.parse("...")` blobs)
  with `--csv`/`--out` overrides. Now accepts **variable-depth** rows, so a
  shallow dataset (e.g. district+county) ships without a schema change and
  deeper levels back-fill later; absent levels emit empty blobs.
- Data quality gate `scripts/ingest/validate.mjs` (structural checks +
  official reference counts, ±15 on counties), wired into `prepublishOnly`. Variable-depth aware:
  not-yet-sourced levels are reported and skipped, not failed.
- Ingest tooling under `scripts/ingest/`: `build-ubos-frame.mjs` (the live
  UBOS ingest, with a documented `ERRATA` table), `normalize.mjs`
  (`canonicalName` naming policy, now unit-tested), `SAMPLES.md` (source
  investigation record). Retired EC-PDF tooling (`build-ec-frame.mjs`,
  `parse-ec-pdf.mjs`) kept for reference; the never-functional New Vision
  crawler was removed.
- Tests rewritten to assert **engine invariants** (sorted levels, contiguous
  children, parent back-references, safe empty results) instead of sample
  content — they pass at any dataset depth and auto-exercise deeper levels
  as data lands.
- README: data-coverage section, per-level API reference, provenance links.
- **Design-review hardening** (post 4-lens review against industry practice):
  - `Unit.code` — official EC/UBOS codes ship on every coded unit;
    `xByCode()` lookups per level. Persist `code`, never `id` (index ids are
    dataset-version-scoped). New 10-column coded CSV format.
  - Collision-aware `byName`: ambiguous names return `undefined` instead of
    an arbitrary unit. Apostrophes/diacritics are deleted, not split, during
    normalization ("Ngora" matches "Ng'ora").
  - Uniform per-level API: `byId`/`byName`/`byCode`/`search`/`count`/
    `datasetVersion` at every level.
  - Deterministic builds (code-unit sort, not ICU collation); generated blobs
    typed as `LevelData`; `Level` is an erasable const object.
  - Packaging: `main`/`types` fallbacks + `default` conditions +
    `./package.json` export (Metro/legacy-resolver compatibility), `engines`,
    `publishConfig` (public + provenance), CHANGELOG shipped in the tarball.
  - tsconfig: `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
    `declarationMap`, DOM lib removed.
  - Built with TypeScript 7 (native compiler); emitted `.js`/`.d.ts` are
    byte-identical to the TypeScript 5.5 output.
- **Unit attributes** (design: `docs/design-unit-attributes.md`):
  - `Unit.kind` on every unit — `district`/`city`, `county`/`municipality`/
    `division`, `sub-county`/`town-council`/`division`/`settlement`,
    `parish`/`ward`, `village`/`cell`. New `UnitKind` type.
  - `Unit.region` on districts (`Central`/`Eastern`/`Northern`/`Western`),
    new `Region` type, and `districtsInRegion(region)`.
  - CSV format v2 (16 columns): `region` + a `code,name,kind` triple per
    level. Kinds and region are written by the ingest
    (`scripts/ingest/kinds.mjs`), compiled verbatim by `build-data.mjs`, and
    dictionary-encoded in the blobs (`LevelData.kinds` / `.regions`) —
    +1.4 KB gzip on parishes, no measurable runtime cost.
  - `validate.mjs` enforces per-level kind allow-lists and one region per
    district, and adds an **EC-frame check**: excluding settlements,
    sub-counties must be 2,191 ±10 and parishes 10,717 ±50.
- Villages tooling: `parse-ec-admin-units.mjs` parses
  the EC *Verified Administrative Units, July 2022* PDF (71,230 villages,
  every printed subtotal and total self-checked); `crosswalk-ec-villages.mjs`
  matches EC parishes to UBOS parishes by name (exact → rough → fuzzy, kind-
  and uniqueness-guarded), placing 99.5% of villages; the same matching
  (`ec-villages.mjs`) is what `build-ubos-frame.mjs` uses to write them.
- Full-scale benchmark `scripts/bench-scale.mjs`. Results at real size
  (71k synthetic villages): build 1.3 s; blobs ≈ 1.9 MB total
  (villages 1.7 MB, districts+counties ≈ 10 KB); villages blob
  JSON.parse ≈ 12 ms; `childrenOf` ≈ 116 ns/lookup; one-time village
  name index ≈ 10 ms.

### Dataset
- `2026.1`: **146 districts/cities, 312 counties, 2,209 sub-counties/town
  councils/divisions, 10,860 parishes/wards**, from the Uganda Bureau of
  Statistics *Administrative Units — Parish Level (UG)* frame (7 July 2026,
  received by request 2026-07-08). Every unit carries a UBOS code, chained per
  level (`113` → `113.1` → `113.1.01` → `113.1.01.01`) to be globally unique.
  See `data/PROVENANCE.md`.
- **70,878 villages/cells** from the Electoral Commission's *Uganda's
  Verified Administrative Units, July 2022* (UBOS disseminates only to parish
  level). **Reference date July 2022.** Attached to UBOS parishes by name
  (99.5% of the EC's 71,230; the rest are in parishes reorganised since 2022
  and are left out). Village codes are the EC's own
  (`district-constituency-subcounty-parish-village`). The EC states no
  licence; included with attribution pending its permission, and removable
  on request. Attribution: *village names and codes: Electoral Commission of
  Uganda*.
- Ingest corrections: UBOS typos fixed via `ERRATA` — county `218.2`
  "RLUTSESHE" → "Lutseshe", and three town councils whose suffix was
  truncated or run together ("Kabatunda-Kirabaho Town Counci",
  "Kakukuru-Rwenanura Town Counci", "Mayirikiti Towncouncil"), which had
  been mis-kinded as plain sub-counties (found by the EC village crosswalk); name casing now capitalizes segments after `/`,
  `(` and `.` (33 names, e.g. "Bussi/Kisaba", "Nakaziba (Ggavu)", "P.W.D").
- Region carried from the UBOS `Region` column; kinds derived per the rules
  above; 19 refugee settlements curated by code (`SETTLEMENTS`). Excluding
  them reconciles with the EC frame: 2,190 sub-counties (EC 2,191) and
  10,712 parishes (EC 10,717).
- Supersedes the unreleased EC-sourced draft of `2026.1` (districts + 329
  counties from the EC Demarcated Electoral Areas 2025 PDF), whose county
  count was an artefact of constituency deduplication.
- `data/uganda.sample.csv` (15-row, full-depth) remains the pipeline fixture
  and benchmark input.
