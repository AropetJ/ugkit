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
  EC reference counts), wired into `prepublishOnly`. Variable-depth aware:
  not-yet-sourced levels are reported and skipped, not failed.
- EC-sourcing tooling under `scripts/ingest/`: `build-ec-frame.mjs`
  (districts+counties from the EC PDF), `parse-ec-pdf.mjs` (village-level
  parser), `DISCOVERY.md`/`SAMPLES.md` (source investigation).
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
- Full-scale benchmark `scripts/bench-scale.mjs`. Results at real size
  (71k synthetic villages): build 1.3 s; blobs ≈ 1.9 MB total
  (villages 1.7 MB, districts+counties ≈ 10 KB); villages blob
  JSON.parse ≈ 12 ms; `childrenOf` ≈ 116 ns/lookup; one-time village
  name index ≈ 10 ms.

### Dataset
- `2026.1`: **146 districts + 329 counties**, sourced from the Uganda Electoral
  Commission's Demarcated Electoral Areas 2025 PDF (retrieved 2026-07-02).
  Officially coded; constituency→county reconciliation applied (353→329). See
  `data/PROVENANCE.md`.
- Sub-counties → parishes → villages: not yet sourced. No single public EC
  download holds the complete 71,214-village register (the "Split by village"
  PDF is a ~23% subset); requested from UBOS. Investigation in
  `scripts/ingest/SAMPLES.md`. These levels back-fill in a later dataset bump.
- `data/uganda.sample.csv` (15-row, full-depth) remains the pipeline fixture
  and benchmark input.
