# Endpoint discovery runbook (EC / New Vision)

Execute this in an interactive session with the Chrome extension connected, so
the DevTools Network tab is drivable. Goal: capture the JSON endpoint(s) that
serve the district → county → sub-county → parish → village hierarchy, then hand
the endpoint + response shape to `crawl-ec.mjs`.

## Target A — New Vision election portal (primary)

URL: https://www.newvision.co.ug/election-portal/polling-stations

It is a JS app; the data comes from XHR/fetch calls not present in static HTML.

1. Open the page. Open DevTools → **Network** tab → filter to **Fetch/XHR**.
2. Clear the log. In the finder, select a **district** (e.g. "Kampala").
   Watch for a new request. Record its full URL, method, query params, headers.
3. Drill down: select a **county / sub-county / parish** in turn. Each drill is
   likely a separate request keyed by a parent id. Record the URL pattern and
   which parameter is the parent key (numeric id? slug? uuid?).
4. Click a captured request → **Response / Preview**. Confirm it is clean JSON.
   Note the exact field names for: unit id, unit name, parent id, and any level
   indicator. Paste one sample response per level into `SAMPLES.md`.
5. Check for a bulk/list endpoint: sometimes these apps fetch a whole level at
   once (e.g. `?level=district`) rather than per-parent. Prefer bulk if it
   exists — fewer requests, gentler on their server.
6. Note rate-limiting signals: response headers (`retry-after`, `x-ratelimit-*`),
   status 429, or a Cloudflare challenge. Set `crawl-ec.mjs` delay accordingly.

Fill the four ENDPOINT constants at the top of `crawl-ec.mjs` from what you find,
plus the field-name mapping in `extractUnits()`.

## Target B — EC "Display of Verified Villages and Parishes" (official fallback)

URL: https://www.ec.or.ug/node/635 (linked from ec.or.ug voter-statistics)

Built for the June 2026 LC I / LC II elections — freshest *official* village list.

1. Inspect what the page actually serves: an interactive search UI, per-district
   PDFs, or downloadable files. In DevTools → Network, reload and scan for
   `.pdf`, `.xlsx`, `.csv`, or JSON responses.
2. If per-district **PDFs**: these carry the full chain
   district → constituency → subcounty → parish → village → polling station.
   Extraction is table parsing, not a JSON crawl — different code path; note it
   and we'll add a `parse-ec-pdf.mjs` instead. Capture one PDF URL pattern.
3. If a **JSON search API**: treat it like Target A — capture endpoint + shape.

## Target C — EC voter locator (cross-check only)

URL: https://www.ec.or.ug/register/ — search UI. Use to spot-verify a handful of
villages against whatever the crawler produces. Not a bulk source.

## After discovery

1. Paste sample responses into `SAMPLES.md` (create it) — one per level.
2. Wire `crawl-ec.mjs`: ENDPOINT_* constants + `extractUnits()` field mapping.
3. Dry-run against ONE district first (`--district Kampala`), inspect the CSV
   rows, confirm `canonicalName` output looks right.
4. Full run → `data/uganda.csv`. Then:
   `npm run validate:data` → expect counts near EC targets (146 / 312 / 2,191 /
   10,717 / 71,214, within validate.mjs tolerances).
5. Record source URLs + retrieval date in `data/PROVENANCE.md`.

## Politeness / ethics

- Rate-limit hard (default 500 ms between requests in the skeleton; raise if the
  server signals strain). Set a descriptive User-Agent identifying the project.
- This is public electoral data; the aim is a respectful, low-volume crawl, not
  a hammering. If the portal has terms prohibiting scraping, stop and fall back
  to Target B PDFs or the UBOS request instead.
