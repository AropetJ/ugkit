import test from "node:test";
import assert from "node:assert/strict";

import { canonicalName } from "../scripts/ingest/normalize.mjs";

// canonicalName is the ingest-time naming policy: every name in
// data/uganda.csv has passed through it, so its output IS the shipped data.

test("title-cases words, keeps particles and numerals", () => {
  assert.equal(canonicalName("KIKURRA A AND B"), "Kikurra A and B");
  assert.equal(canonicalName("BASE CAMP II and IV"), "Base Camp II and IV");
  assert.equal(canonicalName("  fort-portal   CITY "), "Fort-Portal City");
});

test("capitalizes each segment after / ( and . — not just space and hyphen", () => {
  assert.equal(canonicalName("BUSSI/KISABA"), "Bussi/Kisaba");
  assert.equal(canonicalName("KASENYI/CALTEX WARD"), "Kasenyi/Caltex Ward");
  assert.equal(canonicalName("NAKAZIBA (GGAVU)"), "Nakaziba (Ggavu)");
  assert.equal(canonicalName("BWEYA(SSETA)"), "Bweya(Sseta)");
  assert.equal(canonicalName("KASANA P.W.D WARD"), "Kasana P.W.D Ward");
});

test("apostrophes do not start a new segment", () => {
  assert.equal(canonicalName("T'OO COUNTY"), "T'oo County");
});

test("commas are replaced so they cannot break the CSV", () => {
  assert.equal(canonicalName("A, B"), "A - B");
});
