# Security policy

ugkit packages are reference-data libraries intended to sit inside KYC,
payments, and health-records forms. We take data integrity and supply-chain
trust seriously: zero runtime dependencies, provenance-attested npm publishes,
and a validation gate that blocks publishing an invalid dataset.

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting:
[github.com/AropetJ/ugkit/security/advisories/new](https://github.com/AropetJ/ugkit/security/advisories/new)

Include what you found, a reproduction if possible, and the impact you see.
You should hear back within a week. If the report is valid, we will fix it,
credit you (unless you prefer otherwise), and note the fix in the CHANGELOG.

Dataset *errors* (wrong or missing unit names) are not security issues — please
open a regular issue for those; see CONTRIBUTING.md.

## Supported versions

Until 1.0, only the latest published minor of each package receives fixes.
