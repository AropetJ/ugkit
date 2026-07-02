# @ugkit/locale

Uganda administrative divisions — districts, counties, sub-counties, parishes,
villages — as a fast, typed, versioned dataset.

A ground-up rebuild of the `ug-locale` idea with three fixes:

1. **Data is not code.** The dataset is a versioned CSV compiled by
   `scripts/build-data.mjs` into packed `JSON.parse("...")` modules —
   parsed by V8's JSON fast path, never evaluated as object literals.
2. **Flat-array tree.** Units are stored structure-of-arrays, children sorted
   contiguously under each parent with `[firstChild, count]` spans. "Counties
   of district X" is a slice, not a `filter()` over the whole country.
3. **Pay for what you use.** Subpath exports per level. A district dropdown
   never loads village data; villages are one dynamic `import()` away.

## Data coverage

Dataset `2026.1` ships **146 districts + 329 counties**, sourced from the Uganda
Electoral Commission's Demarcated Electoral Areas 2025 and officially coded. The
sub-county, parish and village levels are **not yet populated** — those functions
return `[]` until the data is sourced (village-complete frame pending from UBOS;
see [`data/PROVENANCE.md`](data/PROVENANCE.md)). The full five-level API below is
stable regardless; deeper levels simply fill in via a future dataset bump.

## Usage

```ts
import { districts, districtByName } from "@ugkit/locale";
import { counties } from "@ugkit/locale/counties";
import { subCounties } from "@ugkit/locale/subcounties";
import { parishes } from "@ugkit/locale/parishes";

const wakiso = districtByName("Wakiso")!;
const busiro = counties(wakiso.id).find(c => c.name === "Busiro County")!;
const nansana = subCounties(busiro.id)[0];

// Heavy leaf level — load only when the form reaches it:
const { villages } = await import("@ugkit/locale/villages");
villages(parishes(nansana.id)[0].id);
```

Typeahead:

```ts
import { searchDistricts } from "@ugkit/locale";
searchDistricts("mb"); // → Mbarara, Mbale, ...
```

## Cascading selects (React sketch)

```tsx
const [d, setD] = useState<number>();
const [c, setC] = useState<number>();

<Select options={districts()} onChange={setD} />
<Select options={d != null ? counties(d) : []} onChange={setC} />
// each change is an O(1) slice — no filtering 70k rows per keystroke
```

## API

Each level is its own subpath export; import only what you use.

| Import | Functions |
|---|---|
| `@ugkit/locale` (barrel) | `districts()`, `districtById(id)`, `districtByName(name)`, `searchDistricts(prefix, limit?)`, `counties(districtId)`, `countyById(id)`, `countyByName(name)`, `districtCount`, `datasetVersion` |
| `@ugkit/locale/districts` | `districts()`, `districtById`, `districtByName`, `searchDistricts`, `districtCount`, `datasetVersion` |
| `@ugkit/locale/counties` | `counties(districtId)`, `countyById`, `countyByName` |
| `@ugkit/locale/subcounties` | `subCounties(countyId)`, `subCountyById`, `subCountyByName` |
| `@ugkit/locale/parishes` | `parishes(subCountyId)`, `parishById`, `parishByName` |
| `@ugkit/locale/villages` | `villages(parishId)`, `villageById` |

All functions return `Unit` objects: `{ id, name, parentId?, level }`. `id` is
the unit's index within its level for the current dataset version — stable
within a dataset version, not across versions. (Alignment with official UBOS
codes is planned; the EC codes for the current data are preserved in
`scripts/ingest/ec-districts-counties.csv`.)

Name lookups are normalized (case, whitespace, punctuation): `districtByName("  WAKISO ")`
finds `Wakiso`. Unknown ids/parents return `undefined`/`[]` — never a throw.

## Data pipeline

```
data/uganda.csv  →  scripts/build-data.mjs  →  src/generated/*.ts  →  tsc  →  dist/
```

- Rows may be **variable depth**: a row can stop at any level (the current
  dataset is `district,county` deep). Absent levels emit empty blobs; their
  functions return `[]`. No interior gaps allowed.
- `data/uganda.sample.csv` (full 5-level, 15 rows) ships with the repo so the
  pipeline runs end-to-end without the real dataset; it is used automatically
  when `data/uganda.csv` is absent.
- Dataset version lives in `package.json → ugkit.datasetVersion` and is stamped
  into every generated blob, independent of the npm package version.
- Every dataset release records sources, retrieval dates, extraction method and
  validation output in [`data/PROVENANCE.md`](data/PROVENANCE.md).
- `npm run validate:data` is the quality gate (structural checks + EC reference
  counts) and runs in `prepublishOnly` — an invalid dataset cannot be published.

## Build & test

```bash
npm run build   # build:data + tsc
npm test
```


## Performance at real scale

`npm run bench` generates a synthetic hierarchy at Uganda's actual size
(146 districts → 71k villages) and runs the real pipeline. Measured on the
build container:

| Metric | Result |
|---|---|
| Pipeline build (71,214 rows) | ~1.3 s |
| Districts + counties blobs (common path) | ~10 KB |
| Villages blob (heavy path, lazy-loaded) | ~1.7 MB raw (~est. 400–500 KB gzipped) |
| `JSON.parse` of the full villages blob | ~12 ms |
| `childrenOf` lookup | ~116 ns |
| One-time village name index build | ~10 ms |

For comparison, the original `ug-locale` eagerly parses the entire country as
JavaScript object literals on `require()`, regardless of what you use.

## Invariants (relied on by the runtime)

1. Within each level, units are sorted by `(parentIndex, name)`.
2. All children of a parent are therefore contiguous.
3. `spans[parentId] = [firstChildIndex, childCount]` into the child level.

`build-data.mjs` is the only writer of the generated files; never hand-edit them.

## Roadmap

- [x] Source districts + counties from an official, coded source (EC
      Demarcated Electoral Areas 2025 — dataset `2026.1`).
- [ ] Source sub-counties → parishes → villages (village-complete frame
      requested from UBOS; see `scripts/ingest/SAMPLES.md` for why no public
      EC download suffices).
- [ ] Align `Unit.id` with official UBOS codes (EC codes already preserved in
      `scripts/ingest/ec-districts-counties.csv`).
- [ ] Fuzzy search (typo-tolerant) behind a subpath export.
- [ ] Rust reference implementation (`ugkit-locale` crate) sharing this pipeline.

## Contributing

See the repo-level [CONTRIBUTING.md](../../CONTRIBUTING.md). Wrong or missing
unit names are the most valuable issues we can receive — include the unit's
full chain and an official source if possible. Release history is in
[CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Joel Aropet
