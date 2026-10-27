# ugkit changelog

Changelogs are kept **per package** — each package versions its code (semver)
and its dataset (`ugkit.datasetVersion`) independently:

- [`@ugkit/locale`](packages/ug-locale/CHANGELOG.md)

Future packages will add their changelogs here as they land.

## Repository-level changes

### 2026-10-27
- `@ugkit/locale` 0.1.0 close-out: docs aligned with the UBOS dataset, county
  tolerance tightened (±400 → ±15), TypeScript 5.5 → 7.0, New Vision crawler
  removed. See the package changelog.
- CI matrix is Node 20/22/24 (since 2026-07-16; actions on v7).

### 2026-07-02
- Monorepo scaffolding: npm workspaces, CI (Node 18/20/22), manual-dispatch
  npm publish workflow with `--provenance` (inert until `NPM_TOKEN` is set).
- Repo hygiene: `.gitignore` covers secrets (`.env*`, keys, `.npmrc`),
  AI-assistant working files, and large sourced artifacts (raw source PDFs are
  excluded; their provenance is recorded in-repo instead).
- Root docs: README (principles, layout, roadmap), CONTRIBUTING (ground rules,
  workflow, dataset-error reporting, sourcing playbook pointers), MIT LICENSE.
