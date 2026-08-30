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
