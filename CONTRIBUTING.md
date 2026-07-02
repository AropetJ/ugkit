# Contributing to ugkit

Thank you for helping build Uganda's missing standard library. This document
covers the ground rules, the development workflow, and the two most valuable
kinds of contribution: **dataset corrections** and **new reference-data
packages**.

## Ground rules

1. **Data is not code.** Never hand-edit files in `src/generated/` — they are
   emitted by `scripts/build-data.mjs`, which is the ONLY writer of that
   directory. Dataset changes go through `data/uganda.csv` + the ingest
   pipeline + `npm run validate:data`.
2. **Zero runtime dependencies.** PRs adding runtime deps will be declined.
   Dev-time tooling should also stay minimal (currently: TypeScript only).
3. **Every dataset change updates provenance.** A change to `data/uganda.csv`
   must update `data/PROVENANCE.md` (source URLs, retrieval date, extraction
   method, validation output) and the CHANGELOG under a new `datasetVersion`.
4. **Engine invariants are contracts.** The runtime depends on them:
   - Within each level, units are sorted by `(parentIndex, name)`.
   - Therefore all children of a parent are contiguous.
   - `spans[parentId] = [firstChildIndex, childCount]` indexes the child level.
   Any pipeline change must preserve all three (the tests check them).
5. **Variable-depth rows are supported.** A CSV row may stop at any level
   (e.g. `district,county` only); absent levels emit empty blobs and their
   functions return `[]`. Rows must have no interior gaps.

## Development workflow

Requires Node 18+ (CI runs 18/20/22).

```bash
npm install                 # repo root — npm workspaces
cd packages/ug-locale
npm run build               # build:data (CSV → generated modules) + tsc
npm test                    # node --test — engine-invariant tests
npm run validate:data       # dataset quality gate
npm run bench               # full-scale synthetic benchmark (optional)
```

**Before pushing:** `npm run build && npm test && npm run validate:data` must
all pass. The same three gates run as `prepublishOnly`, so a failing dataset
cannot be published.

The tests assert engine invariants rather than specific dataset content, so
they pass at any dataset depth. If you add a test that depends on a specific
unit existing, guard it or derive it from the loaded data.

## Reporting data errors

Wrong or missing district/county/sub-county/parish/village names are the most
valuable issues we can receive. Open an issue with:

- the unit's **full chain** (district → … → the unit),
- what is wrong (misspelling, missing unit, wrong parent, stale name), and
- if possible, an **official source**: EC list, UBOS profile, or gazette notice.

Note that the county tier currently reflects the EC frame after
constituency→county reconciliation (multiple same-named electoral
constituencies collapse into one county); see `data/PROVENANCE.md` before
reporting an "extra" or "missing" county.

## Dataset sourcing

The sourcing playbook lives in `packages/ug-locale/scripts/ingest/README.md`,
and the full investigation record (what each source contains, what it lacks) in
`scripts/ingest/SAMPLES.md`. Key scripts:

- `build-ec-frame.mjs` — districts + counties from the EC demarcation PDF.
- `parse-ec-pdf.mjs` — parser for the EC village-level PDF (a partial source).
- `normalize.mjs` — canonical naming policy. All ingested names pass through
  `canonicalName` BEFORE landing in the CSV.
- `validate.mjs` — the quality gate (structural checks + EC reference counts).

Raw source artifacts (PDFs, extracted text) go in `scripts/ingest/sources/`,
which is **gitignored** — commit the extraction script and record the source
URL + date in `PROVENANCE.md` instead of committing multi-MB binaries.

## Adding a new ugkit package

New packages (see the roadmap in the root README) must follow the same
principles: zero runtime deps, data as a versioned artifact where applicable,
subpath exports for anything heavy, a validation gate wired into
`prepublishOnly`, and a PROVENANCE record for any sourced data. Open an issue
first so we can agree on scope and API shape.

## Security & secrets

- Never commit credentials, tokens, `.env` files, or personal data. The
  `.gitignore` blocks the common cases; treat it as a backstop, not permission.
- npm publishing uses a repository-level `NPM_TOKEN` secret via the manual
  publish workflow — tokens never live in the tree.
- Found a security issue? Open an issue marked "security" (or contact the
  maintainer privately if it is sensitive).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
