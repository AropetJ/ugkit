# UBOS data request — DRAFT for review

Status: **draft, not sent.** Review, adjust the sender details, then send from
the maintainer's own email address.

- **To:** ubos@ubos.org
- **Cc (optional):** the UBOS Microdata Archive / GIS desk if a specific
  contact is known
- **Subject:** Request for Uganda administrative units list (names + codes, all levels) — open-source dataset

---

Dear Uganda Bureau of Statistics team,

My name is Joel Aropet, a software engineer based in Kampala. I am building a
small, free and open-source (MIT-licensed) software library that makes Uganda's
administrative hierarchy — district → county → sub-county → parish → village —
easily usable by Ugandan developers building local applications (for example,
address entry and service-location forms). The library is a public good; the
data and code are published openly at no cost.

To keep the dataset authoritative and correctly coded, I would like to request
the **administrative units frame** as maintained by UBOS, ideally:

1. The full list of administrative units at every level — **district, county,
   sub-county, parish, and village** — with their **official UBOS codes**
   alongside the names.
2. Any machine-readable form you can share (CSV, Excel, or a Microdata Archive
   export). A structured table is far more useful to us than a PDF.
3. A note on the reference date / census round the frame corresponds to (e.g.
   the 2024 National Population and Housing Census geography), so we can version
   and attribute it accurately.

We intend to **attribute UBOS as the source** in the dataset's provenance record
and align our internal identifiers to the official UBOS codes, so that anything
built on this library stays consistent with national statistics.

If the village-level frame is not something that can be shared directly, we would
still be very grateful for whatever is available at the parish level and above,
and for any guidance on the correct channel or terms for requesting the
village-level geography.

Thank you for the work you do, and for considering this request. I am happy to
provide any further detail about the project or its intended use.

Kind regards,

Joel Aropet
Kampala, Uganda
[phone / email to be filled in before sending]
Project repository: https://github.com/AropetJ/ugkit

---

## Notes for Joel (delete before sending)

- The playbook (`scripts/ingest/README.md`, source #2) says: if UBOS grants the
  coded frame, **align `Unit.id` with UBOS codes in a minor release**. That's why
  the email explicitly asks for codes, not just names.
- Consider also referencing the **UBOS Microdata Archive**
  (https://microdata.ubos.org) if you have an account there — a formal archive
  request may route faster than a cold email.
- Realistic latency: days to weeks. This runs in **parallel** with the EC/New
  Vision crawler track, which is the path to a shippable 0.1.0. UBOS codes are a
  later-minor-release enhancement, not a blocker.
