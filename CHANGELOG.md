# ugkit changelog

Changelogs are kept **per package** — each package versions its code (semver)
and its dataset (`ugkit.datasetVersion`) independently:

- [`@ugkit/locale`](packages/ug-locale/CHANGELOG.md)

Future packages will add their changelogs here as they land.

## Repository-level changes

### 2026-07-02
- Monorepo scaffolding: npm workspaces, CI (Node 18/20/22), manual-dispatch
  npm publish workflow with `--provenance` (inert until `NPM_TOKEN` is set).
- Repo hygiene: `.gitignore` covers secrets (`.env*`, keys, `.npmrc`),
  AI-assistant working files, and large sourced artifacts (raw source PDFs are
  excluded; their provenance is recorded in-repo instead).
- Root docs: README (principles, layout, roadmap), CONTRIBUTING (ground rules,
  workflow, dataset-error reporting, sourcing playbook pointers), MIT LICENSE.
