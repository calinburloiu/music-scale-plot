"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, measureTextInk } = require("../helpers/harness.js");
const { equalArray, closeTo } = require("../helpers/assertions.js");

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

  await t.test("names the four chroes by their makam equivalents too", () => {
    // Enharmonic and the three chroes are the fthores a reader is most likely
    // to know under an Ottoman name rather than a psaltic one, so each label
    // carries both. The diatonic and chromatic fthores are named for the degree
    // they sit on and need no gloss.
    const h = loadApp();
    t.after(() => h.close());
    const labelOf = (id) => h.app.byzFthoraById(id).label;

    assert.equal(labelOf("enharmonic"), "Enharmonic (Acem)");
    assert.equal(labelOf("chroaZygos"), "Zygos (Mu\u015ftar)");
    assert.equal(labelOf("chroaKliton"), "Kliton (Ni\u015fabur)");
    assert.equal(labelOf("chroaSpathi"), "Spathi (Hisar)");
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

test("the fthora compatibility table", async (t) => {
  await t.test("gives every one of the 21 notes a non-empty fthora list", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleFthores(note.id);
      assert.ok(list.length > 0, `${note.id} has no compatible fthores`);
    }
  });

  await t.test("names only fthores that exist, with no duplicates", () => {
    const h = loadApp();
    t.after(() => h.close());

    const known = Array.from(h.app.BYZ_FTHORES).map((f) => f.id);
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleFthores(note.id);
      for (const id of list) assert.ok(known.includes(id), `${note.id}: unknown fthora ${id}`);
      assert.equal(new Set(list).size, list.length, `${note.id}: duplicated fthora`);
    }
  });

  await t.test("partitions the sixteen fthores for every note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const known = Array.from(h.app.BYZ_FTHORES).map((f) => f.id);
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const compatible = h.app.compatibleFthores(note.id);
      const other = h.app.otherFthores(note.id);
      assert.equal(
        compatible.length + other.length,
        known.length,
        `${note.id}: every fthora must be in exactly one of the two lists`
      );
      assert.equal(
        other.filter((id) => compatible.includes(id)).length,
        0,
        `${note.id}: the two lists must not overlap`
      );
    }
  });

  await t.test("lists the others in BYZ_FTHORES block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(
      h.app.otherFthores("midPa"),
      [
        "diatonicNiLow",
        "diatonicVou",
        "diatonicGa",
        "diatonicDi",
        "diatonicKe",
        "diatonicZo",
        "diatonicNiHigh",
        "hardChromaticDi",
        "softChromaticDi",
        "enharmonic",
        "chroaZygos",
        "chroaKliton",
        "chroaSpathi",
      ]
    );
  });

  await t.test("offers each note its own diatonic fthora, by letter", () => {
    const h = loadApp();
    t.after(() => h.close());

    const expected = {
      Zo: "diatonicZo",
      Pa: "diatonicPa",
      Vou: "diatonicVou",
      Ga: "diatonicGa",
      Di: "diatonicDi",
      Ke: "diatonicKe",
    };
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      if (note.latin === "Ni") continue; // two Νη signs, one per octave — below
      assert.ok(
        h.app.compatibleFthores(note.id).includes(expected[note.latin]),
        `${note.id} must offer ${expected[note.latin]}`
      );
    }
  });

  await t.test("splits the two Νη fthores strictly by register", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const noteId of ["lowNi", "midNi"]) {
      const list = h.app.compatibleFthores(noteId);
      assert.ok(list.includes("diatonicNiLow"), `${noteId} must offer diatonicNiLow`);
      assert.ok(!list.includes("diatonicNiHigh"), `${noteId} must not offer diatonicNiHigh`);
    }
    const high = h.app.compatibleFthores("highNi");
    assert.ok(high.includes("diatonicNiHigh"), "highNi must offer diatonicNiHigh");
    assert.ok(!high.includes("diatonicNiLow"), "highNi must not offer diatonicNiLow");
  });

  await t.test("picks the chromatic pair by the parity of the note's value", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = Array.from(h.app.BYZ_NOTES);
    const chromatic = ["hardChromaticPa", "hardChromaticDi", "softChromaticDi", "softChromaticKe"];
    notes.forEach((note, index) => {
      // midPa is 0, the same origin Neanes' getRootSign counts parity from.
      const even = (index - 9) % 2 === 0;
      const offered = h.app.compatibleFthores(note.id).filter((id) => chromatic.includes(id));
      const expected = even
        ? ["hardChromaticPa", "softChromaticKe"]
        : ["hardChromaticDi", "softChromaticDi"];
      // midNi is the one documented exception; it is pinned on its own below.
      if (note.id === "midNi") return;
      equalArray(
        [...offered].sort(),
        [...expected].sort(),
        `${note.id} (${even ? "even" : "odd"}) must offer exactly ${expected.join(" + ")}`
      );
    });
  });

  await t.test("withholds hardChromaticDi from Νη, though parity would admit it", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Deliberate: Neanes' own Fthora Note dropdown offers that sign on Ζω′, Δι
    // and Βου only. MARTYRIA_COMPATIBILITY still lists it for midNi — the two
    // tables are about different signs. See the design's §2.3.
    assert.ok(
      !h.app.compatibleFthores("midNi").includes("hardChromaticDi"),
      "midNi must not offer hardChromaticDi"
    );
    assert.ok(
      h.app.compatibleGenera("midNi").includes("hardChromaticDi"),
      "the martyria table keeps it, and the divergence is on purpose"
    );
  });

  await t.test("offers the enharmonic fthora on Βου, Γα and Ζω only", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const offered = h.app.compatibleFthores(note.id).includes("enharmonic");
      const expected = ["Vou", "Ga", "Zo"].includes(note.latin);
      assert.equal(offered, expected, `${note.id}: enharmonic should be ${expected}`);
    }
  });

  await t.test("offers zygos and kliton on Δι, and spathi on Γα and Κε", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleFthores(note.id);
      assert.equal(list.includes("chroaZygos"), note.latin === "Di", `${note.id}: zygos`);
      assert.equal(list.includes("chroaKliton"), note.latin === "Di", `${note.id}: kliton`);
      assert.equal(
        list.includes("chroaSpathi"),
        note.latin === "Ga" || note.latin === "Ke",
        `${note.id}: spathi`
      );
    }
  });

  await t.test("keeps each row in BYZ_FTHORES block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(h.app.compatibleFthores("midDi"), [
      "diatonicDi",
      "hardChromaticDi",
      "softChromaticDi",
      "chroaZygos",
      "chroaKliton",
    ]);
    equalArray(h.app.compatibleFthores("midNi"), ["diatonicNiLow", "softChromaticDi"]);
    equalArray(h.app.compatibleFthores("midGa"), [
      "diatonicGa",
      "hardChromaticPa",
      "softChromaticKe",
      "enharmonic",
      "chroaSpathi",
    ]);
    equalArray(h.app.compatibleFthores("highNi"), [
      "diatonicNiHigh",
      "hardChromaticPa",
      "softChromaticKe",
    ]);
  });

  await t.test("keeps *every* row in block order, not just the worked samples", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The four samples above are read by eye; this is the guard that catches a
    // row nobody thought to pin. Block order is what keeps a row stable when it
    // gains an entry, so it is a property of the whole table, not of four of it.
    const blockOrder = Array.from(h.app.BYZ_FTHORES).map((f) => f.id);
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleFthores(note.id);
      equalArray(
        list,
        blockOrder.filter((id) => list.includes(id)),
        `${note.id} is not in BYZ_FTHORES block order`
      );
    }
  });

  await t.test("has nothing to offer a note it does not know", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(h.app.compatibleFthores("nowhere"), []);
    assert.equal(
      h.app.otherFthores("nowhere").length,
      Array.from(h.app.BYZ_FTHORES).length,
      "with nothing compatible, every fthora is an 'other'"
    );
  });

  await t.test("is frozen: the object and each fthora list cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const table = h.app.FTHORES_COMPATIBILITY;
    assert.ok(Object.isFrozen(table), "FTHORES_COMPATIBILITY object itself must be frozen");
    for (const noteId of Object.keys(table)) {
      assert.ok(Object.isFrozen(table[noteId]), `${noteId}'s fthora list must be frozen`);
    }
  });
});

test("resolving a martyria to glyphs", async (t) => {
  await t.test("puts the letter first and the genus mark second", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Middle Pa + alpha: the worked example in MARTYRIA-COMPOSITION.md §6.
    assert.equal(h.app.resolveMartyriaGlyphs("midPa", "alpha", 0), "");
  });

  await t.test("takes the mark from the Above set for the low register", () => {
    const h = loadApp();
    t.after(() => h.close());

    // A low letter carries only a martyriaTop anchor, so it accepts …Above.
    assert.equal(h.app.resolveMartyriaGlyphs("lowZo", "nana", 0), "");
    assert.equal(h.app.resolveMartyriaGlyphs("lowKe", "alpha", 0), "");
  });

  await t.test("takes the mark from the Below set for the middle and high registers", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("midZo", "zo", 0), "");
    assert.equal(h.app.resolveMartyriaGlyphs("highKe", "softChromaticDi", 0), "");
  });

  await t.test("draws the letter alone when the genus is none", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0), "");
    assert.equal(h.app.resolveMartyriaGlyphs("midPa", "", 0), "", "a missing genus is the same as none");
  });

  await t.test("appends the octave tick after the mark", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("highKe", "softChromaticDi", 1), "");
    assert.equal(h.app.resolveMartyriaGlyphs("highKe", h.app.GENUS_NONE, 1), "");
  });

  await t.test("keeps the tick after the letter, not before it", () => {
    // SBMuFL documents `martyriaTick` as the ornament set *before* a martyria,
    // and a review read that as "this is prepended wrongly". It is not the same
    // use. Here the tick is the octave extension above high Κε (§4 of the
    // design), and the two placements render differently: a high letter already
    // carries its own octave stroke, so a tick after it reads as the second
    // stroke of a double prime — the octave-above-the-octave the ladder means.
    // Before the letter it is a separate ornament, and the letter's wide left
    // side bearing (0.38em in Neanes) opens a visible gap that says "tick, then
    // martyria" instead. The leading ornament is explicitly out of scope.
    const h = loadApp();
    t.after(() => h.close());
    const tick = String.fromCharCode(0xe145);

    const ticked = h.app.resolveMartyriaGlyphs("highKe", "alpha", 1);

    assert.equal(ticked.at(-1), tick, "the tick belongs at the end of the composition");
    assert.notEqual(ticked[0], tick, "putting it first would make it a leading ornament");
  });

  await t.test("leaves the genus mark next to the letter it attaches to", () => {
    // The real constraint on the ordering, and the one that would break
    // silently: the font stacks a mark on a letter with a mark-to-base lookup,
    // which needs the mark to *follow its base*. Whatever else the composition
    // carries must not come between them.
    const h = loadApp();
    t.after(() => h.close());

    for (const noteId of ["lowPa", "midDi", "highKe"]) {
      for (const ticks of [0, 1]) {
        const composed = h.app.resolveMartyriaGlyphs(noteId, "alpha", ticks);
        assert.equal(
          composed.indexOf(h.app.resolveGenusGlyph(noteId, "alpha")),
          1,
          noteId + " with " + ticks + " tick(s) put something between the letter and its mark"
        );
      }
    }
  });

  await t.test("resolves nothing for an unknown note", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("nonesuch", "alpha", 0), "");
  });
});

test("resolving a fthora to a glyph", async (t) => {
  await t.test("indexes the standalone block", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveFthoraGlyph("diatonicNiLow"), "");
    assert.equal(h.app.resolveFthoraGlyph("diatonicPa"), "");
    assert.equal(h.app.resolveFthoraGlyph("chroaSpathi"), "");
  });

  await t.test("resolves nothing for an unknown or empty id", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveFthoraGlyph("nonesuch"), "");
    assert.equal(h.app.resolveFthoraGlyph(""), "");
  });
});

test("the sign-of-alteration vocabulary", async (t) => {
  await t.test("holds ten signs: two families of five, in SBMuFL block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(
      Array.from(h.app.BYZ_ALTERATIONS).map((a) => a.id),
      [
        "diesis2",
        "diesis4",
        "diesis6",
        "diesis8",
        "diesisGeniki",
        "yfesis2",
        "yfesis4",
        "yfesis6",
        "yfesis8",
        "yfesisGeniki",
      ]
    );
  });

  await t.test("numbers each sign by its offset within its own family's block", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const family of ["diesis", "yfesis"]) {
      const members = Array.from(h.app.BYZ_ALTERATIONS).filter((a) => a.family === family);
      assert.equal(members.length, 5, `${family} must have five members`);
      equalArray(members.map((a) => a.index), [0, 1, 2, 3, 4], `${family} offsets`);
    }
  });

  await t.test("labels every sign, and says how many moria the numbered ones move", () => {
    const h = loadApp();
    t.after(() => h.close());

    const byId = (id) => Array.from(h.app.BYZ_ALTERATIONS).find((a) => a.id === id);
    assert.match(byId("diesis4").label, /\+4 moria/);
    assert.match(byId("yfesis6").label, /−6 moria/);
    for (const a of Array.from(h.app.BYZ_ALTERATIONS)) {
      assert.ok(a.label && a.label.length > 0, `${a.id} has no label`);
    }
  });

  await t.test("names no codepoint: every row is a family and an offset", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const a of Array.from(h.app.BYZ_ALTERATIONS)) {
      assert.deepEqual(
        Object.keys(a).sort(),
        ["family", "id", "index", "label"],
        `${a.id} carries something other than a family and an offset`
      );
    }
  });

  await t.test("is frozen: the vocabulary table cannot be mutated", () => {
    const h = loadApp();
    t.after(() => h.close());

    const table = h.app.BYZ_ALTERATIONS;
    assert.ok(Object.isFrozen(table), "BYZ_ALTERATIONS itself must be frozen");
    for (const row of Array.from(table)) assert.ok(Object.isFrozen(row), `${row.id} must be frozen`);
  });

  await t.test("finds a sign by its id, and nothing for one it does not know", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.byzAlterationById("yfesis8").index, 3);
    assert.equal(h.app.byzAlterationById("nope"), null);
  });
});

test("resolving a sign of alteration to a glyph", async (t) => {
  await t.test("indexes each family's own block", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveAlterationGlyph("diesis2"), String.fromCharCode(0xe1f0));
    assert.equal(h.app.resolveAlterationGlyph("diesis8"), String.fromCharCode(0xe1f3));
    assert.equal(h.app.resolveAlterationGlyph("yfesis2"), String.fromCharCode(0xe200));
    assert.equal(h.app.resolveAlterationGlyph("yfesis8"), String.fromCharCode(0xe203));
  });

  await t.test("takes the Above variant for the two geniki", () => {
    const h = loadApp();
    t.after(() => h.close());

    // diesisGenikiAbove / yfesisGenikiAbove: the Below variant's ink crosses
    // the baseline, and every other sign in the family clears it.
    assert.equal(h.app.resolveAlterationGlyph("diesisGeniki"), String.fromCharCode(0xe1f4));
    assert.equal(h.app.resolveAlterationGlyph("yfesisGeniki"), String.fromCharCode(0xe204));
  });

  await t.test("gives every sign in the table a glyph of its own", () => {
    const h = loadApp();
    t.after(() => h.close());

    const glyphs = Array.from(h.app.BYZ_ALTERATIONS).map((a) => h.app.resolveAlterationGlyph(a.id));
    assert.equal(glyphs.filter((g) => g === "").length, 0, "every sign must resolve");
    assert.equal(new Set(glyphs).size, glyphs.length, "no two signs may share a glyph");
  });

  await t.test("resolves nothing for an unknown or empty id", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveAlterationGlyph("diesis3"), "");
    assert.equal(h.app.resolveAlterationGlyph(""), "");
  });
});

test("the note ladder", async (t) => {
  await t.test("numbers the 21 letters 0 to 20 in pitch order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderPosition("lowZo", 0), 0);
    assert.equal(h.app.ladderPosition("midZo", 0), 7);
    assert.equal(h.app.ladderPosition("highKe", 0), 20);
    assert.equal(h.app.ladderPosition("nonesuch", 0), -1);
  });

  await t.test("extends upward by an octave tick, to 27", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderPosition("highZo", 1), 21);
    assert.equal(h.app.ladderPosition("highKe", 1), 27);
    assert.equal(h.app.LADDER_MAX, 27);
  });

  await t.test("maps a position back to a letter and a tick count", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual({ ...h.app.ladderNoteAt(0) }, { noteId: "lowZo", ticks: 0 });
    assert.deepEqual({ ...h.app.ladderNoteAt(20) }, { noteId: "highKe", ticks: 0 });
    assert.deepEqual({ ...h.app.ladderNoteAt(21) }, { noteId: "highZo", ticks: 1 });
    assert.deepEqual({ ...h.app.ladderNoteAt(27) }, { noteId: "highKe", ticks: 1 });
  });

  await t.test("has nothing below the bottom or above the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderNoteAt(-1), null, "there is no register below low Ζω");
    assert.equal(h.app.ladderNoteAt(28), null, "there is no second tick");
  });

  await t.test("round-trips every legal position", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (let p = 0; p <= h.app.LADDER_MAX; p++) {
      const at = h.app.ladderNoteAt(p);
      assert.ok(at, `position ${p} has no note`);
      assert.equal(h.app.ladderPosition(at.noteId, at.ticks), p, `position ${p} did not round-trip`);
    }
  });
});

test("which ladder positions a degree may take", async (t) => {
  await t.test("refuses a position that would push a predecessor below the bottom", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5: two degrees sit below it, so it cannot start below 2.
    assert.equal(h.app.isLadderPositionLegal(1, 3, 5), false);
    assert.equal(h.app.isLadderPositionLegal(2, 3, 5), true);
  });

  await t.test("refuses a position that would push a successor above the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5: two degrees sit above it, so it cannot start above 25.
    assert.equal(h.app.isLadderPositionLegal(25, 3, 5), true);
    assert.equal(h.app.isLadderPositionLegal(26, 3, 5), false);
  });

  await t.test("lets the only degree of a one-note scale sit anywhere", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.isLadderPositionLegal(0, 1, 1), true);
    assert.equal(h.app.isLadderPositionLegal(27, 1, 1), true);
    assert.equal(h.app.isLadderPositionLegal(28, 1, 1), false, "still off the ladder");
  });
});

// A scale grows and shrinks after its martyries are set, so an anchor that was
// legal can stop being so. clampLadderPosition is what propagation anchors
// from: it slides an illegal anchor to the nearest position that still leaves
// room for the whole scale, which is why propagation can never strand a degree.
test("clamping a ladder anchor into its legal window", async (t) => {
  await t.test("leaves a position that is already legal alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.clampLadderPosition(10, 3, 5), 10);
  });

  await t.test("raises an anchor that leaves too little ladder below it", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5 needs two rungs beneath it, so 0 becomes 2.
    assert.equal(h.app.clampLadderPosition(0, 3, 5), 2);
  });

  await t.test("lowers an anchor that leaves too little ladder above it", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5 needs two rungs above it, so 27 becomes 25.
    assert.equal(h.app.clampLadderPosition(27, 3, 5), 25);
  });

  await t.test("anchors to the bottom when the scale is longer than the ladder", () => {
    const h = loadApp();
    t.after(() => h.close());

    // 29 degrees cannot fit 28 rungs at all. Anchoring the first degree at the
    // bottom fills as much of the scale as the ladder can reach.
    assert.equal(h.app.clampLadderPosition(10, 1, 29), 0);
  });
});

test("the ink model in the canvas stub", async (t) => {
  await t.test("gives a genus mark no advance, so it lands on the letter", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    const letter = measureTextInk("", font);
    const composed = measureTextInk("", font);

    assert.equal(composed.width, letter.width, "the mark must not move the pen");
  });

  await t.test("gives the octave tick a normal advance, because it is a spacing glyph", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    assert.ok(
      measureTextInk("", font).width > measureTextInk("", font).width,
      "martyriaTick is not a mark"
    );
  });

  await t.test("gives a sign of alteration no advance, like every other mark", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    for (const id of Array.from(h.app.BYZ_ALTERATIONS).map((a) => a.id)) {
      const glyph = h.app.resolveAlterationGlyph(id);
      assert.equal(
        measureTextInk(glyph, font).width,
        0,
        `${id} must not move the pen — the chart measures ink, never the advance`
      );
    }
  });

  await t.test("puts a sign of alteration's ink entirely above the baseline", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    for (const id of Array.from(h.app.BYZ_ALTERATIONS).map((a) => a.id)) {
      const ink = measureTextInk(h.app.resolveAlterationGlyph(id), font);
      assert.ok(
        ink.actualBoundingBoxDescent < 0,
        `${id}: the ink must clear the baseline, so the descent is negative`
      );
      assert.ok(
        ink.actualBoundingBoxAscent > -ink.actualBoundingBoxDescent,
        `${id}: the ink must have height`
      );
    }
  });

  await t.test("draws the two geniki higher than the numbered signs, at both edges", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    const numbered = measureTextInk(h.app.resolveAlterationGlyph("diesis4"), font);
    const geniki = measureTextInk(h.app.resolveAlterationGlyph("diesisGeniki"), font);

    assert.ok(
      geniki.actualBoundingBoxAscent > numbered.actualBoundingBoxAscent,
      "the geniki's ink must reach higher"
    );
    assert.ok(
      -geniki.actualBoundingBoxDescent > -numbered.actualBoundingBoxDescent,
      "and start higher: a box that centres one family member cannot fit the other"
    );
    assert.ok(
      geniki.actualBoundingBoxAscent + geniki.actualBoundingBoxDescent >
        numbered.actualBoundingBoxAscent + numbered.actualBoundingBoxDescent,
      "the geniki are the taller sign, so they are what a gutter has to clear"
    );
  });

  await t.test("raises the ascent for an Above mark and deepens the descent for a Below one", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    const plain = measureTextInk("", font);
    const above = measureTextInk("", font);
    const below = measureTextInk("", font);

    assert.ok(above.actualBoundingBoxAscent > plain.actualBoundingBoxAscent);
    assert.ok(below.actualBoundingBoxDescent > plain.actualBoundingBoxDescent);
  });
});

test("measuring a glyph string's ink", async (t) => {
  await t.test("reports the ink's extent relative to the pen, not the advance", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const text = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);

    const box = h.app.inkBox(h.ctx, text, font);
    const metrics = measureTextInk(text, font);

    closeTo(box.adv, metrics.width, 1e-9, "adv is the advance");
    closeTo(box.left, -metrics.actualBoundingBoxLeft, 1e-9, "left is the ink's left edge");
    closeTo(box.right, metrics.actualBoundingBoxRight, 1e-9);
    closeTo(box.top, -metrics.actualBoundingBoxAscent, 1e-9, "y grows downward, so top is negative");
    closeTo(box.bottom, metrics.actualBoundingBoxDescent, 1e-9);
  });

  await t.test("leaves the context's font as it found it", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.font = "24px sans-serif";

    h.app.inkBox(h.ctx, "", '40px "Neanes"');

    assert.equal(h.ctx.font, "24px sans-serif", "measuring must not leak a font change");
  });
});

test("resolving a genus mark on its own", async (t) => {
  await t.test("returns the mark a martyria would stack, with no letter", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const noteId of ["lowPa", "midDi", "highKe"]) {
      const composed = h.app.resolveMartyriaGlyphs(noteId, "nana", 0);
      assert.equal(
        h.app.resolveGenusGlyph(noteId, "nana"),
        composed[1],
        noteId + ": the isolated mark must be the very glyph the composition uses"
      );
    }
  });

  await t.test("draws on the register's own mark set", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.notEqual(
      h.app.resolveGenusGlyph("lowPa", "alpha"),
      h.app.resolveGenusGlyph("midPa", "alpha"),
      "a low letter anchors its marks at the top, so they come from another block"
    );
  });

  await t.test("has nothing to draw for None, or for a letter it does not know", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveGenusGlyph("midPa", h.app.GENUS_NONE), "");
    assert.equal(h.app.resolveGenusGlyph("midPa", ""), "");
    assert.equal(h.app.resolveGenusGlyph("nope", "alpha"), "");
  });
});

test("which side of the letter a genus mark lands on", async (t) => {
  await t.test("rides above a low-octave letter and below the others", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.martyriaMarkSide("lowZo"), "above");
    assert.equal(h.app.martyriaMarkSide("lowKe"), "above");
    assert.equal(h.app.martyriaMarkSide("midNi"), "below");
    assert.equal(h.app.martyriaMarkSide("highKe"), "below");
  });

  await t.test("agrees with the mark the resolver actually picks", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of h.app.BYZ_NOTES) {
      const composed = h.app.resolveMartyriaGlyphs(note.id, "nana", 0);
      const mark = composed.charCodeAt(1);
      const expected = mark >= 0xe170 ? "above" : "below";
      assert.equal(
        h.app.martyriaMarkSide(note.id),
        expected,
        note.id + " reports the wrong side for the mark the resolver emits"
      );
    }
  });
});

test("centring a glyph's ink inside a box", async (t) => {
  // The wells centre a glyph with flexbox, which centres the glyph's *line
  // box* and its *advance* — neither of which the ink sits in the middle of.
  // `inkCenteringShift` is the correction, and these tests state the invariant
  // it has to satisfy rather than the arithmetic it uses to get there.

  /** Where the ink's centre lands, relative to the centre of the box. */
  function inkCentreAfterShift(h, text, font) {
    const shift = h.app.inkCenteringShift(h.ctx, text, font);
    const m = measureTextInk(text, font);
    // A line box puts its baseline (fontAscent - fontDescent) / 2 below its
    // middle; the ink then sits (top + bottom) / 2 from that baseline.
    const baselineBelowCentre = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    const inkBelowBaseline = (-m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 2;
    // The advance box is centred, so the ink's own centre is measured from it.
    const inkRightOfCentre =
      (-m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 2 - m.width / 2;
    return {
      dx: inkRightOfCentre + shift.dx,
      dy: baselineBelowCentre + inkBelowBaseline + shift.dy,
    };
  }

  await t.test("puts a fthora's ink in the middle, though it never crosses the baseline", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const text = h.app.resolveFthoraGlyph("diatonicPa");

    const shift = h.app.inkCenteringShift(h.ctx, text, font);
    const landed = inkCentreAfterShift(h, text, font);

    assert.ok(
      shift.dy > 0,
      "a fthora's ink sits above the baseline, so centring must move it down; got dy=" + shift.dy
    );
    closeTo(landed.dy, 0, 1e-9, "the fthora's ink centre must land on the box's centre");
  });

  await t.test("puts a martyria's ink in the middle, mark and all", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const text = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);

    const landed = inkCentreAfterShift(h, text, font);

    closeTo(landed.dy, 0, 1e-9, "the martyria's ink centre must land on the box's centre");
    closeTo(landed.dx, 0, 1e-9, "and a zero-advance mark must not pull it off centre");
  });

  await t.test("moves a fthora and a martyria by different amounts", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);

    const fthora = h.app.inkCenteringShift(h.ctx, h.app.resolveFthoraGlyph("diatonicPa"), font);
    const martyria = h.app.inkCenteringShift(h.ctx, h.app.resolveMartyriaGlyphs("midPa", "none", 0), font);

    assert.ok(
      Math.abs(fthora.dy - martyria.dy) > h.app.BYZ_FONT_SIZE / 2,
      "one constant cannot serve both signs: dy differed by only " +
        Math.abs(fthora.dy - martyria.dy) + "px"
    );
  });

  await t.test("can pin the ink to the top or the bottom of the line box instead", () => {
    const h = loadApp();
    t.after(() => h.close());
    const size = h.app.BYZ_FONT_SIZE;
    const font = h.app.byzantineFont(size);
    const text = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);
    const m = measureTextInk(text, font);
    // .glyph-ink is line-height: 1, so the line box is one font size tall.
    const baselineFromTop = size / 2 + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;

    const top = h.app.inkCenteringShift(h.ctx, text, font, "top");
    const bottom = h.app.inkCenteringShift(h.ctx, text, font, "bottom");

    closeTo(
      baselineFromTop - m.actualBoundingBoxAscent + top.dy, 0, 1e-9,
      "top should land the ink's top edge on the line box's top edge"
    );
    closeTo(
      baselineFromTop + m.actualBoundingBoxDescent + bottom.dy, size, 1e-9,
      "bottom should land the ink's bottom edge on the line box's bottom edge"
    );
  });

  await t.test("asks for no shift for an empty string", () => {
    const h = loadApp();
    t.after(() => h.close());

    const shift = h.app.inkCenteringShift(h.ctx, "", h.app.byzantineFont(h.app.BYZ_FONT_SIZE));

    closeTo(shift.dx, 0, 1e-9);
    closeTo(shift.dy, 0, 1e-9);
  });

  await t.test("leaves the context's text state as it found it", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.font = "24px sans-serif";
    h.ctx.textAlign = "right";
    h.ctx.textBaseline = "middle";

    h.app.inkCenteringShift(h.ctx, "\ue139", '40px "Neanes"');

    assert.equal(h.ctx.font, "24px sans-serif");
    assert.equal(h.ctx.textAlign, "right", "measuring must not leak an alignment change");
    assert.equal(h.ctx.textBaseline, "middle");
  });
});

test("seating every martyria on one shared baseline", async (t) => {
  // Centring a martyria on its *own* ink throws away the one thing that tells
  // the three octaves apart: a low letter and its middle-octave twin are the
  // same outline drawn at two heights, so once each is centred in its own box
  // they are indistinguishable — and a genus mark, which grows the composition
  // on one side only, drags the letter off the position the reader is judging.
  // The whole family therefore shares one baseline, taken from the range the
  // *vocabulary* spans, so a letter lands where the face draws it.

  await t.test("spans every letter, mark and tick the vocabulary can compose", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);

    const range = h.app.martyriaInkRange(h.ctx, font);

    for (const note of h.app.BYZ_NOTES) {
      for (const genus of ["none"].concat(h.app.BYZ_GENERA.map((g) => g.id))) {
        const ticks = note.octave === "high" ? 1 : 0;
        const box = h.app.inkBox(h.ctx, h.app.resolveMartyriaGlyphs(note.id, genus, ticks), font);
        assert.ok(
          box.top >= range.top - 1e-9 && box.bottom <= range.bottom + 1e-9,
          note.id + "+" + genus + " escapes the shared range: ink [" + box.top + ", " +
            box.bottom + "] vs range [" + range.top + ", " + range.bottom + "]"
        );
      }
    }
  });

  // Where the top edge of a composition's ink lands, measured down from the top
  // of its line box, once the shared-baseline shift has been applied.
  function inkTopAfterShift(h, text, font, range) {
    const size = parseFloat(font);
    const m = measureTextInk(text, font);
    const shift = h.app.inkCenteringShift(h.ctx, text, font, "center", range);
    const baselineFromTop =
      size / 2 + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + shift.dy;
    return baselineFromTop - m.actualBoundingBoxAscent;
  }

  await t.test("lands a low letter below its middle-octave twin", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const range = h.app.martyriaInkRange(h.ctx, font);
    const top = (id) => inkTopAfterShift(h, h.app.resolveMartyriaGlyphs(id, "none", 0), font, range);

    assert.ok(
      top("lowPa") > top("midPa") + 1,
      "the face draws the low Πα below the middle one; centring each on its own " +
        "ink would hide that, so the shared baseline must keep it; got " +
        top("lowPa") + " and " + top("midPa")
    );
    assert.ok(
      top("midPa") > top("highPa"),
      "and the high Πα, which carries the octave stroke, must reach higher still; got " +
        top("midPa") + " and " + top("highPa")
    );
  });

  await t.test("does not move the letter when a genus mark is hung under it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const range = h.app.martyriaInkRange(h.ctx, font);
    // A middle letter takes its mark below, so the composition's top edge is
    // the letter's own top edge either way.
    const top = (genus) =>
      inkTopAfterShift(h, h.app.resolveMartyriaGlyphs("midPa", genus, 0), font, range);

    closeTo(
      top("alpha"), top("none"), 1e-9,
      "the letter is the fixed point a reader judges the mark's side against, so " +
        "hanging a mark under it must not shift it"
    );
  });

  await t.test("centres that shared range in the box, so the family fits", () => {
    const h = loadApp();
    t.after(() => h.close());
    const size = h.app.BYZ_FONT_SIZE;
    const font = h.app.byzantineFont(size);
    const range = h.app.martyriaInkRange(h.ctx, font);
    const text = h.app.resolveMartyriaGlyphs("midPa", "none", 0);
    const m = measureTextInk(text, font);
    const shift = h.app.inkCenteringShift(h.ctx, text, font, "center", range);
    // .glyph-ink is line-height: 1, so the line box is one font size tall.
    const baselineFromTop =
      size / 2 + (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + shift.dy;

    closeTo(
      baselineFromTop + (range.top + range.bottom) / 2, size / 2, 1e-9,
      "the shared range's middle should land on the box's middle"
    );
  });

  await t.test("measures the range once and reuses it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);

    const first = h.app.martyriaInkRange(h.ctx, font);
    const real = h.ctx.measureText.bind(h.ctx);
    let measured = 0;
    h.ctx.measureText = (text) => {
      measured++;
      return real(text);
    };
    const second = h.app.martyriaInkRange(h.ctx, font);

    assert.equal(second, first, "the range for a font is a constant; it should be cached");
    assert.equal(measured, 0, "a cached range must not measure the vocabulary again");
  });

  await t.test("leaves the context's text state as it found it", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.font = "24px sans-serif";
    h.ctx.textAlign = "right";
    h.ctx.textBaseline = "middle";

    h.app.martyriaInkRange(h.ctx, '37px "Neanes"');

    assert.equal(h.ctx.font, "24px sans-serif");
    assert.equal(h.ctx.textAlign, "right", "measuring must not leak an alignment change");
    assert.equal(h.ctx.textBaseline, "middle");
  });
});

test("expressing an ink offset in em", async (t) => {
  // A box's offset used to be measured in pixels, at whatever size
  // `getComputedStyle` reported for that box. A box that is not in the document
  // yet reports no size at all, so the offset was measured against the wrong
  // font and the sign sat visibly wrong — see the scale-mode switch. Measuring
  // once and reporting the answer in em removes the question: the ink metrics
  // are exactly proportional to the font size, and CSS resolves em against the
  // size the box really renders at, attached or not.

  await t.test("reports the shift as a fraction of the em", () => {
    const h = loadApp();
    t.after(() => h.close());
    const size = h.app.BYZ_FONT_SIZE;
    const font = h.app.byzantineFont(size);
    const text = h.app.resolveFthoraGlyph("diatonicPa");

    const px = h.app.inkCenteringShift(h.ctx, text, font);
    const em = h.app.inkCenteringShiftEm(h.ctx, text);

    closeTo(em.dy, px.dy / size, 1e-9, "dy should be the pixel shift divided by the font size");
    closeTo(em.dx, px.dx / size, 1e-9, "and dx likewise");
  });

  await t.test("is the same offset whatever size the box renders at", () => {
    const h = loadApp();
    t.after(() => h.close());
    const text = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);

    const em = h.app.inkCenteringShiftEm(h.ctx, text);
    const small = h.app.inkCenteringShift(h.ctx, text, h.app.byzantineFont(22));

    closeTo(
      em.dy * 22, small.dy, 1e-9,
      "an em offset must land the 22px well's glyph exactly where measuring at 22px would"
    );
  });
});

test("drawing ink-anchored glyphs", async (t) => {
  function drawn(h, text, x, y, options) {
    h.ctx.reset();
    h.ctx.font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    h.app.drawGlyphs(h.ctx, text, x, y, options);
    const [call] = h.ctx.callsOf("fillText");
    return { call, box: h.app.inkBox(h.ctx, text, h.ctx.font) };
  }

  await t.test("puts the ink's left edge on x when asked to align left", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "", 100, 50, { align: "left", vAlign: "middle" });

    closeTo(call.args[1] + box.left, 100, 1e-9, "ink left edge");
  });

  await t.test("puts the ink's right edge on x when asked to align right", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "", 100, 50, { align: "right", vAlign: "middle" });

    closeTo(call.args[1] + box.right, 100, 1e-9, "ink right edge");
  });

  await t.test("centres the ink horizontally when asked", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "", 100, 50, { align: "center", vAlign: "middle" });

    closeTo(call.args[1] + (box.left + box.right) / 2, 100, 1e-9, "ink centre");
  });

  await t.test("centres the ink vertically on y, measured, not guessed", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "", 100, 50, { align: "left", vAlign: "middle" });

    closeTo(call.args[2] + (box.top + box.bottom) / 2, 50, 1e-9, "ink vertical centre");
  });

  await t.test("puts the ink's top or bottom edge on y when asked", () => {
    const h = loadApp();
    t.after(() => h.close());

    const top = drawn(h, "", 100, 50, { align: "center", vAlign: "top" });
    closeTo(top.call.args[2] + top.box.top, 50, 1e-9, "ink top edge");

    const bottom = drawn(h, "", 100, 50, { align: "center", vAlign: "bottom" });
    closeTo(bottom.call.args[2] + bottom.box.bottom, 50, 1e-9, "ink bottom edge");
  });

  await t.test("draws from a neutral alignment, so the caller's anchoring is the only one", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.textAlign = "center";
    h.ctx.textBaseline = "top";
    const { call } = drawn(h, "", 100, 50, { align: "left", vAlign: "middle" });

    assert.equal(call.state.textAlign, "left");
    assert.equal(call.state.textBaseline, "alphabetic");
  });

  await t.test("draws nothing for an empty string", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    h.app.drawGlyphs(h.ctx, "", 100, 50, { align: "left", vAlign: "middle" });

    assert.equal(h.ctx.callsOf("fillText").length, 0);
  });
});

test("handing a sign to the DOM", async (t) => {
  // A canvas paints whatever it is given. DOM text is shaped first, and WebKit
  // drops a run made up of nothing but zero-advance marks — every sign of
  // alteration in this face — so it paints no sign at all where Blink and Gecko
  // paint one. A carrier in front of the mark gives the run a glyph with an
  // advance and the mark comes back. It is measured with the sign, so the ink
  // centring accounts for whatever advance the carrier turns out to have.
  await t.test("gives a sign with no advance of its own something to ride on", () => {
    const h = loadApp();
    t.after(() => h.close());

    const sign = h.app.resolveAlterationGlyph("diesis4");
    closeTo(h.app.inkBox(h.ctx, sign, h.app.byzantineFont()).adv, 0, 1e-9, "the sign's advance");

    assert.equal(
      h.app.domGlyphText(h.ctx, sign, h.app.byzantineFont()),
      h.app.BYZ_DOM_GLYPH_CARRIER + sign
    );
  });

  await t.test("hands over a sign that has an advance unchanged", () => {
    const h = loadApp();
    t.after(() => h.close());

    const fthora = h.app.resolveFthoraGlyph("diatonicPa");
    assert.ok(h.app.inkBox(h.ctx, fthora, h.app.byzantineFont()).adv > 0, "a fthora advances");

    assert.equal(h.app.domGlyphText(h.ctx, fthora, h.app.byzantineFont()), fthora);
  });

  await t.test("carries a composition on its letter, not on a carrier", () => {
    const h = loadApp();
    t.after(() => h.close());

    const martyria = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);

    assert.equal(h.app.domGlyphText(h.ctx, martyria, h.app.byzantineFont()), martyria);
  });

  await t.test("leaves an empty string empty, so an empty well stays empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.domGlyphText(h.ctx, "", h.app.byzantineFont()), "");
  });
});

test("measuring ink where the engine will not report it on its own", async (t) => {
  // WebKit answers `measureText` with the ink box unioned with the text's
  // advance rect and its baseline. Every fthora and every sign of alteration in
  // this face has ink that clears the baseline entirely, so there the descent
  // comes back as 0 and the box reaches the whole advance — and a sign placed
  // from those numbers lands a third of an em out, in the chart and in the
  // wells alike. The app finds the ink in the pixels instead. Same face, same
  // signs, so the answer has to be the same as an engine that reports ink.
  const boxOf = (h, text) => h.app.inkBox(h.ctx, text, h.app.byzantineFont());

  const sameInkAs = (name, textOf) => async () => {
    const exact = loadApp();
    t.after(() => exact.close());
    const union = loadApp({ inkMetrics: "union" });
    t.after(() => union.close());

    const text = textOf(exact.app);
    const wanted = boxOf(exact, text);
    const got = boxOf(union, text);

    for (const edge of ["left", "right", "top", "bottom"]) {
      closeTo(got[edge], wanted[edge], 1, name + ": the ink's " + edge + " edge");
    }
    closeTo(got.adv, wanted.adv, 1e-9, name + ": the advance");
  };

  await t.test(
    "for a fthora, whose ink sits a whole em above the baseline",
    sameInkAs("fthora", (app) => app.resolveFthoraGlyph("diatonicPa"))
  );

  await t.test(
    "for a sign of alteration, which has no advance to be confused with",
    sameInkAs("alteration", (app) => app.resolveAlterationGlyph("diesis4"))
  );

  await t.test(
    "for a geniki, drawn higher again",
    sameInkAs("geniki", (app) => app.resolveAlterationGlyph("diesisGeniki"))
  );

  await t.test(
    "for a martyria, whose letter straddles the baseline and whose mark hangs below",
    sameInkAs("martyria", (app) => app.resolveMartyriaGlyphs("lowPa", "alpha", 0))
  );

  await t.test("over a whole vocabulary measured on one surface", () => {
    // The martyria range is a few hundred measurements. They share one scratch
    // canvas, so each has to start from a cleared surface: leave the last sign
    // on it and the range grows to the union of everything ever drawn.
    const exact = loadApp();
    t.after(() => exact.close());
    const union = loadApp({ inkMetrics: "union" });
    t.after(() => union.close());

    const font = exact.app.byzantineFont();
    const wanted = exact.app.martyriaInkRange(exact.ctx, font);
    const got = union.app.martyriaInkRange(union.ctx, font);

    closeTo(got.top, wanted.top, 1, "the top of the range every martyria shares");
    closeTo(got.bottom, wanted.bottom, 1, "and its bottom");
  });

  await t.test("and centres a sign on that ink, not on the advance", async () => {
    const exact = loadApp();
    t.after(() => exact.close());
    const union = loadApp({ inkMetrics: "union" });
    t.after(() => union.close());

    const sign = exact.app.resolveFthoraGlyph("diatonicPa");
    const wanted = exact.app.inkCenteringShiftEm(exact.ctx, sign, "center");
    const got = union.app.inkCenteringShiftEm(union.ctx, sign, "center");

    closeTo(got.dy, wanted.dy, 0.03, "the vertical offset a fthora well is given");
    closeTo(got.dx, wanted.dx, 0.03, "the horizontal offset a fthora well is given");
  });
});
