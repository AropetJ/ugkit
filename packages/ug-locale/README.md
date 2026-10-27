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

Dataset `2026.1` ships the official **Uganda Bureau of Statistics** frame
(Administrative Units — Parish Level, 7 July 2026), every unit coded:

| Level | Units | Blob (raw / gzip) |
|---|---|---|
| Districts + cities | 146 | 4.4 KB / 1.5 KB |
| Counties | 312 | 13 KB / 3.6 KB |
| Sub-counties / town councils / divisions / settlements | 2,209 | 80 KB / 19 KB |
| Parishes / wards | 10,860 | 416 KB / 85 KB |
| Villages / cells | **0** | empty placeholder |

**Villages are empty by design, not by omission.** UBOS confirmed in writing
that it disseminates administrative units only up to parish level, and no
other authoritative, coded national village register exists. The `villages`
level stays in the API and is safe to query — it returns `[]`/`undefined` and
`villageCount === 0` — so if UBOS ever publishes villages they arrive as a
dataset bump with no code change. Details in
[`data/PROVENANCE.md`](data/PROVENANCE.md); known gaps (2025 town councils,
sub-regions, population, villages) are tracked in
[`data/GAPS.md`](data/GAPS.md).

## Usage

```ts
import { districts, districtByName } from "@ugkit/locale";
import { counties } from "@ugkit/locale/counties";
import { subCounties } from "@ugkit/locale/subcounties";
import { parishes } from "@ugkit/locale/parishes";

const wakiso = districtByName("Wakiso")!;
const busiro = counties(wakiso.id).find(c => c.name === "Busiro County")!;
const bussi = subCounties(busiro.id)[0];   // { name: "Bussi", code: "113.1.01", … }
const parish = parishes(bussi.id)[0];      // { name: "Balabala", code: "113.1.01.01", … }

// Leaf level — load only when the form reaches it (empty in dataset 2026.1):
const { villages } = await import("@ugkit/locale/villages");
villages(parish.id); // → []
```

Typeahead:

```ts
import { searchDistricts } from "@ugkit/locale";
searchDistricts("mb"); // → Mbale, Mbale City, Mbarara, Mbarara City
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

Each level is its own subpath export with the same uniform surface; import
only what you use. For level *X* (district, county, subCounty, parish,
village):

| Function | Behavior |
|---|---|
| `xs(parentId)` / `districts()` | Children of a parent (O(1) slice); districts take no argument |
| `xById(id)` | By index id — `undefined` on miss |
| `xByName(name)` | Normalized name lookup — `undefined` when unknown **or ambiguous** |
| `xByCode(code)` | By official UBOS code — the **persistable** identifier |
| `searchXs(prefix, limit?)` | Prefix typeahead over cached normalized names (default limit 20) |
| `xCount` | Units in the loaded dataset — `0` means the level isn't sourced yet |
| `datasetVersion` | Dataset version stamped into the blob |

Districts also have `districtsInRegion(region)` — the districts (and cities)
of `"Central"`, `"Eastern"`, `"Northern"` or `"Western"`.

The barrel (`@ugkit/locale`) re-exports the district + county surface and all
types. `subcounties`, `parishes`, and `villages` are subpath-only so bundlers
never drag leaf data into a district dropdown.

All functions return `Unit` objects:
`{ id, name, code?, parentId?, level, kind, region? }`.

- `kind` is the unit's administrative type, always present:

  | Level | Kinds (count in 2026.1) |
  |---|---|
  | district | `district` 135 · `city` 11 |
  | county | `county` 256 · `municipality` 31 · `division` 25 |
  | sub-county | `sub-county` 1,506 · `town-council` 577 · `division` 107 · `settlement` 19 |
  | parish | `parish` 7,762 · `ward` 3,098 |
  | village | `village` · `cell` |

- `region` is set on districts only (`"Central"` 27 · `"Eastern"` 40 ·
  `"Northern"` 41 · `"Western"` 38). For a lower unit, walk up:
  `districtById(county.parentId!)!.region`.

**Refugee settlements.** UBOS files 19 refugee settlements (Nakivale, Bidi
Bidi, Kyangwali, …) as sub-counties; they are administered by the Office of
the Prime Minister, not a local government, and have `kind: "settlement"`.
The Electoral Commission and the 2024 census don't count them, so to match
those figures, drop them — and the 148 parishes under them:

```ts
const frame = subCounties(countyId).filter((s) => s.kind !== "settlement");
```

Without settlements the dataset has 2,190 sub-counties and 10,712 parishes
(EC: 2,191 and 10,717 — Kampala has 5 divisions here to the EC's 6).

**Persist `code`, never `id`.** `id` is the unit's index within its level and
is only valid for the dataset version it came from — ids shift when districts
split or units are renamed. `code` is the official UBOS identifier and is
stable across dataset versions. UBOS codes restart under each parent, so each
level's code is the ancestor chain joined with `.` — district `113`, county
`113.1`, sub-county `113.1.01`, parish `113.1.01.01` — which makes it globally
unique within its level. Every sourced unit carries one.

Name lookups are normalized (case, whitespace, punctuation, apostrophes,
diacritics): `districtByName("  WAKISO ")` finds `Wakiso`, and a user typing
`"Ngora"` matches `Ng'ora`. Ambiguous names — e.g. a county name that exists
in two districts — return `undefined` rather than an arbitrary winner;
disambiguate via the parent (`counties(districtId)`) or use codes. This
matters most for parishes: about 20% share a name with another parish, so
look them up under their sub-county (`parishes(subCountyId)`) or by code. Unknown
ids/parents return `undefined`/`[]` — never a throw.

## Data pipeline

```
data/uganda.csv  →  scripts/build-data.mjs  →  src/generated/*.ts  →  tsc  →  dist/
```

- CSV format (16 columns): `region`, then a `code,name,kind` triple per
  level — `region,district_code,district,district_kind,county_code,…`. Codes
  are official UBOS identifiers, empty when the source has none. Region and
  kind are written by the ingest (`scripts/ingest/kinds.mjs` rules plus a
  curated settlement list); `build-data.mjs` compiles them as given and
  dictionary-encodes them into the blobs (one small int per unit). Design:
  [`docs/design-unit-attributes.md`](docs/design-unit-attributes.md).
- Rows may be **variable depth**: a row can stop at any level (the current
  dataset stops at parish). Absent levels emit empty blobs; their
  functions return `[]` and their `xCount` is `0`. No interior gaps allowed.
- Builds are **deterministic**: names sort by UTF-16 code units (not locale
  collation), so the generated files are byte-identical on every machine.
- `data/uganda.sample.csv` (full 5-level, 15 rows) ships with the repo so the
  pipeline runs end-to-end without the real dataset; it is used automatically
  when `data/uganda.csv` is absent.
- Dataset version lives in `package.json → ugkit.datasetVersion` and is stamped
  into every generated blob, independent of the npm package version.
- Every dataset release records sources, retrieval dates, extraction method and
  validation output in [`data/PROVENANCE.md`](data/PROVENANCE.md).
- `npm run validate:data` is the quality gate (structural checks + official
  reference counts) and runs in `prepublishOnly` — an invalid dataset cannot be published.

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

- [x] Source districts → counties → sub-counties → parishes from an official,
      coded source (UBOS parish-level frame — dataset `2026.1`).
- [x] Official UBOS codes on every unit (`xByCode`).
- [ ] Villages — blocked upstream: UBOS does not disseminate below parish.
      Slots in with a dataset bump if that changes.
- [ ] Tororo split (3 districts + 1 city) once UBOS republishes.
- [ ] Fuzzy search (typo-tolerant) behind a subpath export.
- [ ] Rust reference implementation (`ugkit-locale` crate) sharing this pipeline.

## Contributing

See the repo-level [CONTRIBUTING.md](../../CONTRIBUTING.md). Wrong or missing
unit names are the most valuable issues we can receive — include the unit's
full chain and an official source if possible. Release history is in
[CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © 2026 Joel Aropet
