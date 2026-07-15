# ugkit

[![CI](https://github.com/AropetJ/ugkit/actions/workflows/ci.yml/badge.svg)](https://github.com/AropetJ/ugkit/actions/workflows/ci.yml)

Tiny, fast, well-typed libraries for building Ugandan software.

Small, static, boring national reference data + validation logic that every
local product needs — done once, done properly, versioned, and shared.

## Packages

| Package | Status | Description |
|---|---|---|
| [`@ugkit/locale`](packages/ug-locale) | ✅ engine complete · ✅ districts + counties shipped (dataset 2026.1) · ⏳ sub-counties → villages pending | Uganda administrative divisions: districts → counties → sub-counties → parishes → villages. Flat-array tree, O(1) child lookups, lazy loading. |
| `@ugkit/phone` | planned (next) | Parse/validate/normalize Ugandan MSISDNs, detect network (MTN, Airtel, Lyca) from prefix. |
| `@ugkit/tax` | planned | PAYE bands, NSSF contributions, Local Service Tax, withholding tax — official rate tables as versioned data, calculators on top. |
| `@ugkit/currency` | planned | UGX formatting + amount-in-words for receipts and invoices. |
| `@ugkit/lang` | planned | Number-to-words and amount-in-words in Ugandan languages (Luganda first), for receipts, USSD, and IVR. |
| `@ugkit/faker` | planned | Fake-but-format-valid Ugandan test data: names, phone numbers, NINs, plates, real district/village combinations. |
| `@ugkit/uneb` | planned | UNEB index number validation + PLE/UCE/UACE grading and aggregation calculators. |
| `sts-token` | planned | Parser/validator for STS prepaid electricity tokens (20-digit Yaka codes) — an international standard, born from a Ugandan pain point. |
| `@ugkit/efris` | planned | Types, payload builders, and QR parsing for URA's EFRIS e-invoicing system. |

Plus `@ugkit/nin`, `@ugkit/holidays`, `@ugkit/plates`, `@ugkit/momo-fees`,
`@ugkit/health-facilities`, `@ugkit/ussd`, and more — the full catalog, the
six package shapes it's organized around, and the build-order rationale live
in [ROADMAP.md](ROADMAP.md).

None of the packages are published to npm yet; publishing begins with
`@ugkit/locale` 0.1.0 once the remaining dataset levels land.

## Design principles

Every ugkit package follows the same rules:

1. **Data is not code.** Reference data ships as versioned CSV/JSON artifacts,
   compiled by a build pipeline into packed `JSON.parse("...")` modules —
   never hand-edited JS object literals.
2. **Flat arrays, not nested objects.** Static trees are stored
   structure-of-arrays with parent indices and contiguous children —
   child lookups are slices, not filters.
3. **Pay for what you use.** Subpath exports + lazy indices. Importing
   districts must never load villages.
4. **Dataset versioning is separate from code versioning.** The dataset version
   (`package.json → ugkit.datasetVersion`) can bump without an API change, and
   vice versa.
5. **Provenance is a feature.** Every dataset release records its sources,
   retrieval dates, extraction method, and validation output
   (see `packages/ug-locale/data/PROVENANCE.md`).
6. **Zero runtime dependencies.** Always.

## Repository layout

```
ugkit/
├── packages/
│   └── ug-locale/          @ugkit/locale — see its README for full docs
│       ├── data/           versioned dataset (uganda.csv) + PROVENANCE.md
│       ├── src/            runtime engine + generated data modules
│       ├── scripts/        build pipeline, validation gate, benchmark
│       │   └── ingest/     data sourcing: extractors, playbook, findings
│       └── test/           engine-invariant tests (node --test)
├── .github/workflows/      CI (Node 18/20/22) + manual npm publish
├── CONTRIBUTING.md
└── LICENSE                 MIT
```

## Development

Requires Node 20+ (the workspace is tested on 20/22/24).

```bash
npm install                 # from the repo root (npm workspaces)
npm run build  -w @ugkit/locale   # data pipeline + tsc
npm test       -w @ugkit/locale   # engine-invariant tests
npm run validate:data -w @ugkit/locale   # dataset quality gate
npm run bench  -w @ugkit/locale   # full-scale synthetic benchmark
```

Or run the same scripts from inside `packages/ug-locale/`.

## Data sourcing & provenance

The `@ugkit/locale` dataset is sourced from official publications (currently
the Uganda Electoral Commission's Demarcated Electoral Areas 2025; the
village-level frame has been requested from the Uganda Bureau of Statistics).
Sources, retrieval dates, extraction methods and validation output are recorded
in [`packages/ug-locale/data/PROVENANCE.md`](packages/ug-locale/data/PROVENANCE.md);
the full sourcing investigation lives in
[`packages/ug-locale/scripts/ingest/SAMPLES.md`](packages/ug-locale/scripts/ingest/SAMPLES.md).

Wrong or missing unit names are the most valuable bug reports this project can
receive — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for ground rules (data-is-not-code,
zero deps, provenance requirements), the development workflow, and how to
report dataset errors.

## License

[MIT](LICENSE) © 2026 Joel Aropet
