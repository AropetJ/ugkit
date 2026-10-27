# Electoral Commission request — DRAFT for review

Status: **draft, not sent.** Review, fill in the contact address and sender
details, then send from the maintainer's own email address.

- **To:** [EC contact — confirm the right address on https://www.ec.or.ug before sending; not verified]
- **Subject:** Permission to redistribute village list from "Uganda's Verified Administrative Units, July 2022" in an open-source library

---

Dear Electoral Commission team,

My name is Joel Aropet, a software engineer based in Kampala. I maintain
**ugkit**, a free, open-source (MIT-licensed) software library that gives
Ugandan developers an accurate, coded list of the country's administrative
units for use in their applications — for example, address and
service-location forms. It already ships districts, counties, sub-counties
and parishes from the Uganda Bureau of Statistics' parish-level frame. UBOS
has confirmed that it disseminates administrative units only up to parish
level, so the village level is currently empty.

The Commission's publication **"Uganda's Verified Administrative Units, July
2022"** (published at ec.or.ug, 3,019 pages) is the only complete, coded
national list of villages we have found. I would like to ask:

1. **Permission to redistribute** the village names and their EC codes from
   that publication, as part of this open-source library, with clear
   attribution to the Electoral Commission in the dataset's provenance record
   and documentation. If specific attribution wording or conditions apply, we
   will follow them exactly.
2. Whether a **more recent edition** exists — for example the village list
   used for the July 2026 LC I and LC II elections (we understand 71,214
   villages) — and whether it can be shared, ideally in a machine-readable
   form (CSV or Excel) rather than PDF.
3. If redistribution is not possible, any guidance on the correct channel or
   terms under which it could be.

For transparency: we have parsed the July 2022 publication for internal
validation only — not published — and it reconciles exactly with the
Commission's own totals (71,230 villages, 10,717 parishes, 353
constituencies, 146 districts). Nothing from it will be released until we
hear from you.

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
  gazetteer"). Staging outputs stay in the gitignored `sources/` directory.
- Offering the Commission the cleaned, machine-readable file is a genuine
  give-back. Two defects in their PDF are worth mentioning if they reply:
  Manafwa / Bunamone Ward has two villages coded 01 (BUWALUSATI, BUTTA), and
  several "… WARD COUNCIL" parish names.
- If they grant permission but only for the 2022 edition, it can still ship,
  with the 2022 reference date stated plainly in PROVENANCE and the README.
