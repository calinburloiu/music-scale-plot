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
