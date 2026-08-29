"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");
const { equalArray } = require("../helpers/assertions.js");

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

  await t.test("is frozen: the vocabulary table cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = h.app.BYZ_NOTES;
    assert.ok(Object.isFrozen(notes), "BYZ_NOTES array itself must be frozen");
    assert.ok(Object.isFrozen(notes[0]), "each note object must be frozen");

    const originalId = notes[0].id;
    assert.throws(() => {
      "use strict";
      notes[0].id = "mutated";
    }, "mutating a frozen note property must throw in strict mode");
    assert.equal(notes[0].id, originalId, "the note object did not change");

    assert.throws(() => {
      "use strict";
      notes.push({ id: "intruder" });
    }, "pushing onto a frozen array must throw in strict mode");
    assert.equal(notes.length, 21, "the array length did not change");
  });
});

test("the Byzantine genus vocabulary", async (t) => {
  await t.test("holds the twelve genus signs in SBMuFL block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.BYZ_GENERA).map((g) => g.id),
      [
        "zo", "delta", "alpha", "legetos", "nana", "deltaDotted",
        "alphaDotted", "hardChromaticPa", "hardChromaticDi",
        "softChromaticDi", "softChromaticKe", "zygos",
      ]
    );
    assert.deepEqual(
      Array.from(h.app.BYZ_GENERA).map((g) => g.index),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      "index must equal the block offset, which the resolver relies on"
    );
  });

  await t.test("reserves a sentinel for 'no genus', which is not one of the twelve", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.GENUS_NONE, "none");
    assert.equal(
      Array.from(h.app.BYZ_GENERA).filter((g) => g.id === h.app.GENUS_NONE).length,
      0
    );
  });

  await t.test("is frozen: the vocabulary table cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const genera = h.app.BYZ_GENERA;
    assert.ok(Object.isFrozen(genera), "BYZ_GENERA array itself must be frozen");
    assert.ok(Object.isFrozen(genera[0]), "each genus object must be frozen");
  });
});

test("the fthora vocabulary", async (t) => {
  await t.test("holds the sixteen standalone fthores and chroes in block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.BYZ_FTHORES).map((f) => f.id),
      [
        "diatonicNiLow", "diatonicPa", "diatonicVou", "diatonicGa",
        "diatonicDi", "diatonicKe", "diatonicZo", "diatonicNiHigh",
        "hardChromaticPa", "hardChromaticDi", "softChromaticDi",
        "softChromaticKe", "enharmonic", "chroaZygos", "chroaKliton",
        "chroaSpathi",
      ]
    );
    assert.equal(h.app.byzFthoraById("diatonicPa").index, 1);
    assert.equal(h.app.byzFthoraById("nonesuch"), null);
  });

  await t.test("is frozen: the vocabulary table cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const fthores = h.app.BYZ_FTHORES;
    assert.ok(Object.isFrozen(fthores), "BYZ_FTHORES array itself must be frozen");
    assert.ok(Object.isFrozen(fthores[0]), "each fthora object must be frozen");
  });
});

test("the martyria compatibility table", async (t) => {
  await t.test("gives every one of the 21 notes a non-empty genus list", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleGenera(note.id);
      assert.ok(list.length > 0, `${note.id} has no compatible genera`);
    }
  });

  await t.test("names only genera that exist, with no duplicates", () => {
    const h = loadApp();
    t.after(() => h.close());

    const known = Array.from(h.app.BYZ_GENERA).map((g) => g.id);
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleGenera(note.id);
      for (const id of list) assert.ok(known.includes(id), `${note.id}: unknown genus ${id}`);
      assert.equal(new Set(list).size, list.length, `${note.id}: duplicated genus`);
    }
  });

  await t.test("keeps the modes table's column order", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(
      h.app.compatibleGenera("midDi"),
      ["deltaDotted", "softChromaticDi", "hardChromaticDi", "zygos", "hardChromaticPa"]
    );
  });

  await t.test("lists every remaining genus as 'other', in block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    const compatible = h.app.compatibleGenera("lowZo");
    const other = h.app.otherGenera("lowZo");

    assert.equal(compatible.length + other.length, 12, "every genus is in exactly one list");
    assert.equal(other.filter((id) => compatible.includes(id)).length, 0, "the lists must not overlap");
    equalArray(
      other,
      ["zo", "delta", "alpha", "legetos", "deltaDotted", "alphaDotted", "hardChromaticPa", "softChromaticKe", "zygos"],
      "the others follow BYZ_GENERA order"
    );
  });

  await t.test("is frozen: the object and each genus list cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const table = h.app.MARTYRIA_COMPATIBILITY;
    assert.ok(Object.isFrozen(table), "MARTYRIA_COMPATIBILITY object itself must be frozen");
    for (const noteId of Object.keys(table)) {
      assert.ok(Object.isFrozen(table[noteId]), `${noteId}'s genus list must be frozen`);
    }
  });
});
