"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

test("the Byzantine note vocabulary", async (t) => {
  await t.test("holds 21 letters: three registers of seven, ascending in pitch", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = Array.from(h.app.BYZ_NOTES);
    assert.equal(notes.length, 21, "seven degrees in each of three registers");
    assert.deepEqual(
      notes.slice(0, 7).map((n) => n.id),
      ["lowZo", "lowNi", "lowPa", "lowVou", "lowGa", "lowDi", "lowKe"],
      "the low register runs Zo Ni Pa Vou Ga Di Ke"
    );
    assert.deepEqual(
      notes.map((n) => n.octave).filter((o, i, all) => all.indexOf(o) === i),
      ["low", "mid", "high"],
      "the registers appear in ascending order and do not interleave"
    );
  });

  await t.test("numbers each letter by its position within its register", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = Array.from(h.app.BYZ_NOTES);
    assert.deepEqual(
      notes.map((n) => n.letterIndex),
      [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6]
    );
  });

  await t.test("carries a Greek and a Latin name for every letter", () => {
    const h = loadApp();
    t.after(() => h.close());

    const midPa = h.app.byzNoteById("midPa");
    assert.equal(midPa.greek, "Πα");
    assert.equal(midPa.latin, "Pa");
    assert.equal(h.app.byzNoteById("nonesuch"), null, "an unknown id resolves to null");
  });
});
