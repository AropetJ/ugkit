# ugkit roadmap

ugkit's thesis: small, static, boring national reference data + validation
logic that every Ugandan product needs — done once, done properly, versioned,
and shared. The `@ugkit/locale` build proved the architecture; this document
is the catalog of everything that architecture generalizes to, and the order
we intend to build it in.

## The six repeatable shapes

Every package idea below is one of these shapes. If a proposed package isn't,
it probably doesn't belong in ugkit.

1. **Reference registries** — static-ish national lists, shipped as versioned
   datasets with a build pipeline (what `@ugkit/locale` is).
2. **Format validators** — "is this string a valid X?" (NIN, plates, TINs).
3. **Rate tables + calculators** — official numbers that change on gazette,
   not per-request (taxes, tariffs). Dataset version bumps when a Finance Act
   or tariff notice changes something.
4. **Protocol/format parsers** — decode structured tokens and messages.
5. **Localization primitives** — language and formatting for Ugandan users.
6. **Test-data generators** — fake-but-valid versions of all the above.

## Agreed build order

Weighted by static-ness × demand × uniqueness, plus gravity from Kirafiki Pay
(mobile-money payments) and ClinicMaster (health systems):

1. `@ugkit/locale` — finish the dataset (sub-counties → villages via UBOS).
2. `@ugkit/phone` — Kirafiki critical path.
3. `@ugkit/tax` — highest general demand; pure rate tables.
4. `@ugkit/currency` + `@ugkit/lang` amounts-in-words — small, unique,
   demo-able together (bilingual invoice amounts).
5. `@ugkit/faker` — ecosystem multiplier, great marketing.
6. `@ugkit/uneb` — untapped vertical, tiny scope.
7. `sts-token` — global reach + deep-systems content gold.
8. `@ugkit/efris` — biggest business value, biggest scope; start only when
   able to commit to it.

**The rule: each package must be *finished* — sourced, validated,
provenance'd — before the next starts.** The failure mode of an ecosystem
like this isn't building it; it's maintaining twelve packages' worth of
gazette changes alone. The mitigations are architectural (versioned data,
validation gates, CONTRIBUTING.md that invites data-error reports), but
sequencing is the real discipline. Shugyō, not sprawl.

## Full catalog by domain

### Payments & identity (the original core)

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/phone` | validator | MSISDN parse/validate/normalize, network detection (MTN, Airtel, Lyca) from prefix. Critical for Kirafiki Pay. |
| `@ugkit/currency` | localization | UGX formatting + amount-in-words for receipts and invoices. |
| `@ugkit/nin` / `@ugkit/tin` | validator | Structural validation for Uganda NIN and URA TIN. |
| `@ugkit/momo-fees` | rate table | MTN MoMo / Airtel Money tariff tables as versioned data. |
| `@ugkit/plates` | validator | Vehicle registration plate parsing/validation. |
| `@ugkit/holidays` | registry | Public holidays + banking-day arithmetic. |
| `@ugkit/ussd` | protocol | USSD menu-flow utilities for feature-phone interfaces. |

### Payroll, tax & compliance — probably the highest-demand cluster

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/tax` | rate table | PAYE band calculator, NSSF contribution math (employee 5% / employer 10%), Local Service Tax bands, withholding tax rates, VAT helpers. Every payroll/HR/accounting system in Uganda re-implements these from a URA PDF, slightly wrong. `rates: 2026.1`-style versioning bumps on Finance Act changes. Likely the single most-downloaded ugkit package long-term. |
| `@ugkit/efris` | protocol | TypeScript types, payload builders, and QR-content parsing for URA's EFRIS e-invoicing system. Bigger than "tiny", but every business system touching Uganda needs it, official docs are rough, and integration knowledge lives in scattered WhatsApp groups. Even types-and-validators-only (no HTTP client) would get adopted. ClinicMaster likely has hard-won EFRIS knowledge worth extracting. |
| `@ugkit/nssf` / `@ugkit/ursb` | validator | NSSF membership number and URSB company registration number format validation. |

### Utilities & infrastructure

| Package | Shape | Notes |
|---|---|---|
| `sts-token` | protocol | Parser/validator for STS prepaid electricity tokens (the 20-digit Yaka codes): decode token class, TID, units. STS is an *international* standard used across dozens of countries — globally useful, born from a Ugandan pain point. Great deep-systems content: binary formats, DES-era crypto, bit packing. Possibly published unscoped given the global audience. |
| `@ugkit/utilities` | validator | Meter/account number format validation for UEDCL/Umeme-era meters and NWSC accounts. Core to every bill-payment flow (Kirafiki again). |
| `@ugkit/address` | localization | Structured Ugandan address formatting *on top of* `@ugkit/locale`: plot/block conventions, P.O. Box formats, the (widely misused) official postcode system. First dependent package — proves the ecosystem composes. |

### Education

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/uneb` | validator + rate table | UNEB index number format validation; grading/aggregation calculators for PLE, UCE (incl. new competency-based grading), UACE points. Every school management system hand-rolls aggregate calculation. Small, static, high demand. |
| `@ugkit/schools` | registry | EMIS school registry (name, level, district — foreign-keyed to `@ugkit/locale` districts). Same build pipeline as locale. |

### Health — the unfair advantage (ClinicMaster)

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/health-facilities` | registry | Master Facility List with facility levels (HC II–IV, hospitals), keyed to `@ugkit/locale` districts. Nobody better positioned to maintain this. |
| `@ugkit/medicines` | registry | Essential Medicines List / NDA-registered products for pharmacy modules, prescriptions, stock systems. Reference data ONLY, clearly versioned, no clinical claims. |
| `@ugkit/insurers` | registry | Health insurers and schemes operating in Uganda, for claims modules. |

### Language & localization — the most differentiated cluster

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/lang` | localization | Number-to-words and amount-in-words in Luganda, Runyankole-Rukiga, Acholi, Ateso, Lusoga… Start with Luganda amounts for receipts. With `@ugkit/currency`, prints a legally-styled invoice amount in English *and* Luganda. Nothing like this exists on npm; feeds USSD/IVR for non-English speakers directly. |
| `@ugkit/greetings` | localization | Time-of-day greetings and common service phrases per language, for chatbots and USSD menus. Sounds trivial; it's the difference between a bot that feels foreign and one that feels local. |

### Civic & government reference

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/gov` | registry | Ministries, departments, and agencies (the MDA list) + local governments, with acronyms. Procurement tools, CRM dropdowns, journalism. |
| `@ugkit/parliament` | registry | MPs by constituency (foreign-keyed to `@ugkit/locale`), refreshed each term. The 2026 election just happened — perfect timing for a `2026` dataset version. |

### Agriculture & commerce

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/crops` | registry | Crop calendars per region (first/second rains planting windows), staple crop reference data. Agtech is a big funding category and everyone rebuilds this table. |
| `@ugkit/markets` | registry | Major markets and market days, keyed to districts. |

### Developer infrastructure — the ecosystem glue

| Package | Shape | Notes |
|---|---|---|
| `@ugkit/faker` | generator | Fake-but-format-valid Ugandan test data: names from real regional name pools, valid-format phone numbers with correct network prefixes, well-formed NINs and plates, real district/village combinations from `@ugkit/locale`. Makes every other package more valuable and is what developers discover first — everyone seeds databases. Composes the whole ecosystem into one demo: `faker.person()` returns someone in a real village with a valid MTN number. |

## Rules every package follows

Same as the [design principles](README.md#design-principles): zero runtime
dependencies; data as versioned artifacts with a build pipeline (never
hand-edited literals); subpath exports + lazy loading; dataset version
separate from code version; provenance recorded per dataset release;
validation gates wired into `prepublishOnly`.
