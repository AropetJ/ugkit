# Electoral Commission request — DRAFT for review

Status: **draft, not sent.** Review, fill in the contact address and sender
details, then send from the maintainer's own email address.

- **To:** [EC contact — confirm the right address on https://www.ec.or.ug before sending; not verified]
- **Subject:** Use of the village list from "Uganda's Verified Administrative Units, July 2022" in an open-source library — permission and terms

---

Dear Electoral Commission team,

My name is Joel Aropet, a software engineer based in Kampala. I maintain
**ugkit**, a free, open-source (MIT-licensed) software library that gives
Ugandan developers an accurate, coded list of the country's administrative
units for use in their applications — for example, address and
service-location forms. It already ships districts, counties, sub-counties
and parishes from the Uganda Bureau of Statistics' parish-level frame. UBOS
has confirmed that it disseminates administrative units only up to parish
level.

For the village level, the library uses the Commission's publication
**"Uganda's Verified Administrative Units, July 2022"** (published at
ec.or.ug), the only complete, coded national list of villages we have found.
The village names and EC codes are included with attribution to the
Electoral Commission and the July 2022 date stated, in the project's
documentation and provenance record. The publication does not state terms of
use, so I am writing to ask:

1. **Whether the Commission is content with this use**, and whether any
   specific attribution wording or conditions apply — we will follow them
   exactly. If the Commission would prefer the data not be redistributed, we
   will remove it in the next dataset release.
2. Whether a **more recent edition** exists — for example the village list
   used for the July 2026 LC I and LC II elections (we understand 71,214
   villages) — and whether it can be shared, ideally in a machine-readable
   form (CSV or Excel) rather than PDF.
3. If redistribution is not possible, any guidance on the correct channel or
   terms under which it could be.

For transparency: our processing of the July 2022 publication reconciles
exactly with the Commission's own totals (71,230 villages, 10,717 parishes,
353 constituencies, 146 districts). We matched 70,878 of those villages
(99.5%) to the current UBOS parishes; the remainder fall in parishes
reorganised since 2022.

Thank you for considering this request. I am happy to share more detail about
the project, or a copy of the processed data for the Commission's own use.

Kind regards,

Joel Aropet
Kampala, Uganda
[phone / email to be filled in before sending]
Project repository: https://github.com/AropetJ/ugkit

---

## Notes for Joel (delete before sending)

- The parse and crosswalk are in `parse-ec-admin-units.mjs` and
  `crosswalk-ec-villages.mjs`; findings in `SAMPLES.md` ("EC July 2022
  gazetteer"). The villages SHIPPED in dataset 2026.1 (decision 2026-10-27)
  before this was sent — the email is worded accordingly; don't promise
  non-publication.
- Offering the Commission the cleaned, machine-readable file is a genuine
  give-back. Two defects in their PDF are worth mentioning if they reply:
  Manafwa / Bunamone Ward has two villages coded 01 (BUWALUSATI, BUTTA), and
  several "… WARD COUNCIL" parish names.
- If they ask for removal: drop the EC attachment in `build-ubos-frame.mjs`
  (and the committed `sources/ec-villages-2022.csv`), bump
  `ugkit.datasetVersion`, and note it in CHANGELOG/PROVENANCE.
