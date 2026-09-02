"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

test("normalising text for search", async (t) => {
  await t.test("lowercases, so case never matters", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.normalizeForSearch("Quarter-Tone FLAT"), "quarter-tone flat");
  });

  await t.test("folds diacritics, so a Romanian or Turkish name is reachable from ASCII", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.normalizeForSearch("Răileanu"), "raileanu");
    assert.equal(h.app.normalizeForSearch("Büyük mücenneb"), "buyuk mucenneb");
    assert.equal(h.app.normalizeForSearch("Ţurkish"), "turkish");
  });

  await t.test("folds the dashes, because nobody types a typographic minus", () => {
    const h = loadApp();
    t.after(() => h.close());
    // The Răileanu and mixed-Sagittal labels are written with U+2212 MINUS
    // SIGN, which is not the key on anyone's keyboard.
    assert.equal(h.app.normalizeForSearch("−1/4 tone flat"), "-1/4 tone flat");
    assert.equal(h.app.normalizeForSearch("–2 — 3"), "-2 - 3");
  });
});

test("splitting a query into words", async (t) => {
  await t.test("drops the whitespace, however much of it there is", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.deepEqual(Array.from(h.app.searchWords("  quarter   FLAT ")), ["quarter", "flat"]);
  });

  await t.test("returns nothing for an empty query, which is what shows the whole list", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.deepEqual(Array.from(h.app.searchWords("   ")), []);
  });
});

test("matching a query against a label", async (t) => {
  await t.test("requires every word, in any order", () => {
    const h = loadApp();
    t.after(() => h.close());
    const label = "Three-quarter-tones flat (Grisey)";
    assert.equal(h.app.matchesQuery(label, ["quarter", "flat"]), true);
    assert.equal(h.app.matchesQuery(label, ["flat", "quarter"]), true, "word order must not matter");
    assert.equal(h.app.matchesQuery(label, ["quarter", "sharp"]), false, "every word must match");
  });

  await t.test("matches on substrings, so a partial word still narrows", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("Koma (sharp)", ["shar"]), true);
  });

  await t.test("folds the haystack too, not just the query", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("Küçük mücenneb (flat)", ["kucuk"]), true);
    assert.equal(h.app.matchesQuery("Küçük mücenneb (flat)", ["küçük"]), true);
  });

  await t.test("reaches a typographic minus from the hyphen key", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(
      h.app.matchesQuery("−1/4 tone flat", Array.from(h.app.searchWords("-1/4"))),
      true,
      "the Răileanu labels are unreachable if the query's hyphen does not fold"
    );
  });

  await t.test("matches everything on an empty word list", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("anything at all", []), true);
    assert.equal(h.app.matchesQuery("", []), true);
  });
});
