# Design: unit attributes — region, kind, refugee settlements

Status: **implemented** in 0.1.0 / dataset 2026.1 (approved and built 2026-10-27).
Closes GAPS.md §2, §4, §5 with no new source.

## Goals

1. Every district carries its **region** (Central / Eastern / Northern / Western).
2. Every unit carries its administrative **kind** (city, municipality, town
   council, ward, …).
3. **Refugee-settlement** sub-counties are identifiable, so users can filter
   to the EC/census frame. With the 19 settlements excluded, the dataset
   reconciles with the EC: 2,190 sub-counties vs 2,191 (Kampala has 5
   divisions to EC's 6) and 10,712 parishes vs 10,717.

Non-goals: sub-regions and population (need new sources; §7/§8), geometry,
any change to ids, codes, ordering or the span invariants.

## Where each piece of knowledge lives

The existing split stays: **ingest scripts hold source-specific knowledge;
`build-data.mjs` is a source-agnostic compiler.** So:

| Fact | Decided in | Recorded in |
|---|---|---|
| region | UBOS `Region` column (currently dropped) | `uganda.csv` |
| kind | suffix rules + override table in `build-ubos-frame.mjs` | `uganda.csv` |
| settlement | curated code list `SETTLEMENTS` in `build-ubos-frame.mjs` | `uganda.csv` (as a kind) |

`build-data.mjs` never parses names to guess a kind; it compiles whatever the
CSV says. That keeps the CSV self-describing and auditable (a reviewer sees
`town-council` on the row), and lets a future non-UBOS source supply kinds
its own way.

## CSV format v2 (16 columns)

```
region,district_code,district,district_kind,county_code,county,county_kind,
subcounty_code,subcounty,subcounty_kind,parish_code,parish,parish_kind,
village_code,village,village_kind
```

- Each level goes from a `code,name` pair to a `code,name,kind` triple;
  `region` leads the row as a district attribute. Variable depth still works:
  a row stops when a level's name is empty, and all three cells after that
  must be empty.
- The `kind` cell is **required** wherever the name is present (the validator
  fails on empty or unknown kinds). Region is required on every row of the
  full dataset and must be constant per district.
- Rejected alternative — a sidecar `attributes.csv` keyed by code: two files
  to keep in sync, and `uganda.sample.csv` has no codes to key on.

## Vocabulary

```ts
type Region = "Central" | "Eastern" | "Northern" | "Western";

type UnitKind =
  | "district" | "city"                               // level 0
  | "county" | "municipality" | "division"            // level 1
  | "sub-county" | "town-council" | "division" | "settlement" // level 2
  | "parish" | "ward"                                 // level 3
  | "village" | "cell";                               // level 4
```

Validator enforces the per-level allow-list. Kebab-case values read naturally
in a CSV and in UI labels (`kind.replace("-", " ")`).

### Derivation rules (ingest, UBOS)

| Level | Rule | Result today |
|---|---|---|
| district | name ends " City", or is "Kampala" → `city`; else `district` | 11 city, 135 district |
| county | " Municipality" → `municipality`; " Division" → `division`; else `county` | 31 / 25 / 256 |
| sub-county | code in `SETTLEMENTS` → `settlement`; " Town Council" → `town-council`; " Division" → `division`; else `sub-county` | 19 / 577 / 107 / 1,506 |
| parish | " Ward" → `ward`; else `parish` | 3,098 / 7,762 |

The 8 unsuffixed counties (Bughendera, Buliisa, Chua East, …) are counties
and fall through to `county` correctly. A `KIND_OVERRIDES` table (same shape
and audit trail as `ERRATA`) handles future exceptions — e.g. the nine
July-2025 town councils (GAPS §3) once they're confirmed.

### Why settlement is a kind, not a separate flag

Refugee settlements are administered by the Office of the Prime Minister, not
by a local government — a genuinely different *kind* of unit that UBOS
happens to file at sub-county level. Making it a kind means one concept, and
the common filter is one comparison (`u.kind !== "settlement"`). None of the
19 settlements is also a town council or division, so nothing is lost.
Parishes inside a settlement keep `parish`/`ward`; to filter them, check the
parent (`subCountyById(p.parentId).kind`). The two "Rhino Camp" units in
Madi-Okollo that are *not* the settlement (`336.1.05`, `336.1.07`) stay
ordinary.

## Runtime

### `Unit`

```ts
interface Unit {
  id: number;
  name: string;
  code?: string;
  parentId?: number;
  level: Level;
  kind: UnitKind;      // NEW — always present
  region?: Region;     // NEW — districts only
}
```

Region lives on districts only, not copied down. Inheriting it would make
every level module import the district blob, and the lookup is one call:
`districtById(county.parentId!)!.region`.

### Wire format (`LevelData`)

Dictionary-encoded, so repeated strings cost one small int per unit:

```ts
interface LevelData {
  version: string;
  names: string[];
  codes: string[];
  parents: number[];
  spans: [number, number][];
  kinds: { values: UnitKind[]; index: number[] };   // NEW
  regions?: { values: Region[]; index: number[] };  // NEW, districts only
}
```

Cost: about 2 bytes per unit raw ("0,"); +22 KB raw / ~1 KB gzip on parishes,
negligible elsewhere. Same `{values, index}` shape will carry sub-regions
(GAPS §7) later without another format change.

### New query functions

- `districtsInRegion(region): Unit[]` — on the districts module (and barrel).
  Filter over 146 units; no index needed.
- No `byKind` index for now: filtering a child slice by kind is already cheap,
  and every lower-level query is parent-scoped.

## Validation

- Per-level kind allow-list; region required and constant per district.
- **Tighter reference check**: the non-settlement sub-county and parish counts
  are compared with the EC figures at ±10 (sub-counties) and ±50 (parishes)
  instead of the current ±100/±300. Raw totals keep the old loose bands.
- Settlement count reported (19) so additions/removals show up in review.

## Compatibility and versioning

- Nothing is published yet, so this goes into **0.1.0 / dataset 2026.1**
  rather than 0.2.0. No migration path is needed.
- The changes are additive at the API level (new fields, new function); the
  CSV v1 format is retired outright, not supported alongside v2.
- Files touched: `build-ubos-frame.mjs`, `build-data.mjs`, `validate.mjs`,
  `bench-scale.mjs`, `uganda.sample.csv`, `src/types.ts`, `src/store.ts`,
  `src/districts.ts`, `src/index.ts`, tests, README, CHANGELOG, PROVENANCE,
  GAPS.md (mark §2/§4/§5 done).

## Tests

- Every unit has a kind allowed for its level; every district has a region.
- `districtsInRegion` covers all 146 districts exactly once across the four.
- With the full dataset: 19 settlements; the non-settlement counts equal
  2,190 / 10,712.
- Ingest: kind derivation rules unit-tested on representative names.
