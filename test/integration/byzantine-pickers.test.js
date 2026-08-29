"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  openWell,
  pickFthora,
  pickMartyria,
  setNoteCount,
  fireClick,
} = require("../helpers/harness.js");

function byzantineApp(t) {
  const h = loadApp();
  t.after(() => h.close());
  setNotation(h, "byzantine");
  return h;
}

test("the fthora picker", async (t) => {
  await t.test("opens when the well is clicked and closes when it is clicked again", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "fthora");
    assert.ok(panel.classList.contains("open"), "the panel did not open");

    fireClick(h, row.querySelector(".fthora-well"));
    assert.ok(!panel.classList.contains("open"), "the panel did not close");
  });

  await t.test("lists None first, then all sixteen fthores in block order", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    const ids = [...panel.querySelectorAll(".fthora-option")].map((o) => o.dataset.fthora);
    assert.equal(ids[0], "", "None must come first");
    assert.deepEqual(ids.slice(1), Array.from(h.app.BYZ_FTHORES).map((f) => f.id));
  });

  await t.test("shows each fthora's glyph and its label", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    const option = panel.querySelector('.fthora-option[data-fthora="diatonicPa"]');
    assert.equal(option.querySelector(".byz-glyph").textContent, h.app.resolveFthoraGlyph("diatonicPa"));
    assert.equal(option.querySelector(".byz-label").textContent, h.app.byzFthoraById("diatonicPa").label);
  });

  await t.test("writes the pick to the row and closes the panel", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa");

    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");
    assert.ok(!row.querySelector(".fthora-picker").classList.contains("open"));
    assert.equal(
      row.querySelector(".fthora-well").textContent,
      h.app.resolveFthoraGlyph("diatonicPa"),
      "the well was not repainted"
    );
  });

  await t.test("clears the slot when None is picked", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickFthora(h, row, "diatonicPa");

    pickFthora(h, row, "");

    assert.equal(h.app.readNoteSymbols(row).fthora, "");
    assert.ok(row.querySelector(".fthora-well").classList.contains("is-empty"));
  });

  await t.test("redraws the chart when a fthora is picked", () => {
    const h = byzantineApp(t);
    h.ctx.reset();

    pickFthora(h, noteRows(h)[0], "diatonicPa");

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("keeps only one picker open at a time", () => {
    const h = byzantineApp(t);

    const first = openWell(h, noteRows(h)[0], "fthora");
    const second = openWell(h, noteRows(h)[1], "fthora");

    assert.ok(!first.classList.contains("open"), "the first panel stayed open");
    assert.ok(second.classList.contains("open"));
  });

  await t.test("closes when the colour picker opens, and the other way round", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    fireClick(h, h.el(".interval-row .color-swatch"));

    assert.ok(!panel.classList.contains("open"), "opening a colour dropdown must close the fthora panel");

    const colorDropdown = h.el(".interval-row .color-dropdown.open");
    fireClick(h, noteRows(h)[0].querySelector(".fthora-well"));

    assert.ok(
      !colorDropdown.classList.contains("open"),
      "opening the fthora panel must close the colour dropdown"
    );
  });

  await t.test("closes when the user clicks outside the editor", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    fireClick(h, h.document.body);

    assert.ok(!panel.classList.contains("open"));
  });
});

test("the martyria picker: the Notes column", async (t) => {
  await t.test("lists None, then the 21 letters in three labelled octave groups", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const ids = [...panel.querySelectorAll(".martyria-note-option")].map((o) => o.dataset.note);
    assert.equal(ids[0], "", "None must come first");
    assert.deepEqual(ids.slice(1), Array.from(h.app.BYZ_NOTES).map((n) => n.id));

    assert.deepEqual(
      [...panel.querySelectorAll(".martyria-notes-column .byz-group-title")].map((el) => el.textContent),
      ["Low", "Middle", "High"]
    );
  });

  await t.test("shows the bare letter and its Greek and Latin name", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const option = panel.querySelector('.martyria-note-option[data-note="midPa"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0),
      "the Notes column previews the letter without a genus"
    );
    assert.equal(option.querySelector(".byz-label").textContent, "Πα Pa");
  });

  await t.test("disables the positions that would not leave room for the whole scale", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    // Degree 2 of 3: one degree below, one above. Legal range is 1 … 26.
    const panel = openWell(h, noteRows(h)[1], "martyria");

    const disabled = (noteId) =>
      panel.querySelector(`.martyria-note-option[data-note="${noteId}"]`).disabled;

    assert.equal(disabled("lowZo"), true, "no predecessor could sit below low Ζω");
    assert.equal(disabled("lowNi"), false);
    assert.equal(disabled("highKe"), false, "high Κε still leaves the tick octave above");
  });

  await t.test("shows the illegal rows rather than hiding them, so the range is visible", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const panel = openWell(h, noteRows(h)[2], "martyria");

    assert.ok(
      panel.querySelector('.martyria-note-option[data-note="lowZo"]'),
      "an illegal row must still be listed"
    );
  });

  await t.test("hides the tick rows until some degree has actually reached them", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(
      panel.querySelector('.martyria-note-option[data-ticks="1"]'),
      null,
      "the tick octave is a consequence of a pick, not an ordinary choice"
    );
  });

  await t.test("shows the tick rows once a degree carries a tick", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[1], "highZo", h.app.GENUS_NONE, 1);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.ok(
      panel.querySelector('.martyria-note-option[data-note="highZo"][data-ticks="1"]'),
      "the ticked rows should be listed now"
    );
    assert.deepEqual(
      [...panel.querySelectorAll(".martyria-notes-column .byz-group-title")].map((el) => el.textContent),
      ["Low", "Middle", "High", "High + octave tick"]
    );
  });

  await t.test("marks the row the well currently holds", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const selected = panel.querySelectorAll(".martyria-note-option.is-selected");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.note, "midPa");
  });
});

test("the martyria picker: the Genus column", async (t) => {
  await t.test("is inert until a note is selected", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(panel.querySelectorAll(".martyria-genus-option").length, 0);
    assert.ok(panel.querySelector(".martyria-genus-column").classList.contains("is-inert"));
  });

  await t.test("puts None first, then the compatible genera in the modes table's order", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const ids = [...row.querySelectorAll(".martyria-genus-option")].map((o) => o.dataset.genus);
    assert.equal(ids[0], h.app.GENUS_NONE);
    assert.deepEqual(ids.slice(1, 6), Array.from(h.app.compatibleGenera("midDi")));
  });

  await t.test("separates the compatible genera from the uncommon ones with a rule", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const column = row.querySelector(".martyria-genus-column");
    const children = [...column.children];
    const ruleIndex = children.findIndex((el) => el.classList.contains("byz-separator"));
    assert.ok(ruleIndex > 0, "there is no separator");

    const before = children.slice(0, ruleIndex).filter((el) => el.dataset.genus);
    const after = children.slice(ruleIndex).filter((el) => el.dataset.genus);
    assert.deepEqual(
      before.map((el) => el.dataset.genus).slice(1),
      Array.from(h.app.compatibleGenera("midDi"))
    );
    assert.deepEqual(after.map((el) => el.dataset.genus), Array.from(h.app.otherGenera("midDi")));
  });

  await t.test("previews every genus composed on the selected letter", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const option = row.querySelector('.martyria-genus-option[data-genus="zygos"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("midDi", "zygos", 0),
      "a genus is only ever seen on a letter, so that is what the row shows"
    );
  });

  await t.test("recomposes the previews when a different letter is picked", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));
    fireClick(h, row.querySelector('.martyria-note-option[data-note="lowDi"]'));

    const option = row.querySelector('.martyria-genus-option[data-genus="delta"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("lowDi", "delta", 0),
      "the low register takes the Above mark set, so the preview must change"
    );
  });
});

test("picking a martyria", async (t) => {
  await t.test("writes the letter as soon as it is clicked, with no genus", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "none",
      ticks: 0,
    });
  });

  await t.test("keeps the panel open after a pick, so the genus can follow", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(row.querySelector(".martyria-picker").classList.contains("open"));
  });

  await t.test("adds the genus without disturbing the letter", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "midPa", genus: "alpha" });

    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 0,
    });
    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
  });

  await t.test("keeps the genus when the letter is changed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa", genus: "alpha" });

    pickMartyria(h, row, { note: "midVou" });

    assert.equal(h.app.readNoteSymbols(row).martyria.genus, "alpha");
  });

  await t.test("clears the well when None is picked, without touching the fthora", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa", genus: "alpha" });
    pickFthora(h, row, "diatonicPa");

    pickMartyria(h, row, { note: "" });

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");
  });

  await t.test("ignores a genus click while no letter is selected", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");

    assert.equal(row.querySelector(".martyria-genus-option"), null);
    assert.equal(h.app.readNoteSymbols(row).martyria, null);
  });

  await t.test("redraws the chart on every pick", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    h.ctx.reset();

    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("closes the panel when Done is pressed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");

    fireClick(h, row.querySelector(".martyria-done"));

    assert.ok(!row.querySelector(".martyria-picker").classList.contains("open"));
  });

  await t.test("does nothing when a disabled row is clicked", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const row = noteRows(h)[2];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-note-option[data-note="lowZo"]'));

    assert.equal(h.app.readNoteSymbols(row).martyria, null, "an illegal position must not be written");
    assert.ok(panel.classList.contains("open"), "and the panel stays open");
  });
});

test("the ladder", async (t) => {
  function martyriaNotes(h) {
    return noteRows(h).map((row) => {
      const m = h.app.readNoteSymbols(row).martyria;
      return m ? m.note : null;
    });
  }

  await t.test("runs the other degrees through the consecutive letters on Done", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 4);

    pickMartyria(h, noteRows(h)[1], { note: "midNi", done: true });

    assert.deepEqual(martyriaNotes(h), ["midZo", "midNi", "midPa", "midVou"]);
  });

  await t.test("propagates downward as well as upward", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[2], { note: "midPa", done: true });

    // midZo=7, midNi=8, midPa=9 (see test/unit/byzantine-symbols.test.js);
    // degree 3 fixed at 9 puts degree 2 at 8 and degree 1 at 7.
    assert.deepEqual(martyriaNotes(h), ["midZo", "midNi", "midPa"]);
  });

  await t.test("does not propagate until Done is pressed", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo" });

    assert.deepEqual(martyriaNotes(h), ["midZo", null, null]);
  });

  await t.test("leaves each degree's own genus alone", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo" });
    pickMartyria(h, noteRows(h)[2], { note: "midPa", genus: "alpha" });

    pickMartyria(h, noteRows(h)[1], { note: "midNi", done: true });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "alpha"],
      "propagation moves letters, never genera"
    );
  });

  await t.test("gives an empty neighbour the letter with no genus", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo", done: true });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "none"]
    );
  });

  await t.test("never touches the fthores", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickFthora(h, noteRows(h)[2], "diatonicPa");

    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    assert.equal(h.app.readNoteSymbols(noteRows(h)[2]).fthora, "diatonicPa");
  });

  await t.test("carries the octave tick into the top register", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "highKe", done: true });

    assert.deepEqual(martyriaNotes(h), ["highKe", "highZo", "highNi"]);
    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.ticks),
      [0, 1, 1],
      "above high Κε the tick marks the extra octave"
    );
  });

  await t.test("does not propagate when the well is cleared", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    pickMartyria(h, noteRows(h)[0], { note: "", done: true });

    assert.deepEqual(martyriaNotes(h), [null, "midNi", "midPa"], "only that one well is cleared");
  });

  await t.test("leaves a neighbour untouched when its target falls below the ladder", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 5);
    const rows = noteRows(h);

    // Pre-existing, deliberately mismatched martyria on the two rows whose
    // propagated target would fall below position 0 (source at "lowZo" = 0,
    // rows 0 and 1 sit two and one below it).
    h.app.writeMartyria(rows[0], "midPa", "zo", 0);
    h.app.writeMartyria(rows[1], "midVou", "alpha", 0);
    h.app.writeMartyria(rows[2], "lowZo", h.app.GENUS_NONE, 0);

    pickMartyria(h, rows[2], { done: true });

    assert.deepEqual(
      { ...h.app.readNoteSymbols(rows[0]).martyria },
      { note: "midPa", genus: "zo", ticks: 0 },
      "off-ladder below: row 0 must be left exactly as it was"
    );
    assert.deepEqual(
      { ...h.app.readNoteSymbols(rows[1]).martyria },
      { note: "midVou", genus: "alpha", ticks: 0 },
      "off-ladder below: row 1 must be left exactly as it was"
    );
    // Rows within range still propagate, proving the loop actually ran.
    assert.equal(h.app.readNoteSymbols(rows[3]).martyria.note, "lowNi");
    assert.equal(h.app.readNoteSymbols(rows[4]).martyria.note, "lowPa");
  });

  await t.test("leaves a neighbour untouched when its target falls above the ladder", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 5);
    const rows = noteRows(h);

    // Source at "highKe" + tick = position 27, the top of the ladder. Rows 3
    // and 4 sit one and two above it, so their targets fall past 27.
    h.app.writeMartyria(rows[2], "highKe", h.app.GENUS_NONE, 1);
    h.app.writeMartyria(rows[3], "lowGa", "delta", 0);
    h.app.writeMartyria(rows[4], "lowDi", "legetos", 0);

    pickMartyria(h, rows[2], { done: true });

    assert.deepEqual(
      { ...h.app.readNoteSymbols(rows[3]).martyria },
      { note: "lowGa", genus: "delta", ticks: 0 },
      "off-ladder above: row 3 must be left exactly as it was"
    );
    assert.deepEqual(
      { ...h.app.readNoteSymbols(rows[4]).martyria },
      { note: "lowDi", genus: "legetos", ticks: 0 },
      "off-ladder above: row 4 must be left exactly as it was"
    );
    // Rows within range still propagate, proving the loop actually ran.
    assert.equal(h.app.readNoteSymbols(rows[0]).martyria.note, "highGa");
    assert.equal(h.app.readNoteSymbols(rows[1]).martyria.note, "highDi");
  });
});

test("adding and removing notes in Byzantine notation", async (t) => {
  await t.test("continues the ladder onto the new degree, with no genus", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo", done: true });

    fireClick(h, h.document.getElementById("add-note"));

    const added = h.app.readNoteSymbols(noteRows(h).at(-1)).martyria;
    assert.deepEqual({ ...added }, { note: "midPa", genus: "none", ticks: 0 });
  });

  await t.test("leaves the new well empty when the previous degree has no martyria", () => {
    const h = byzantineApp(t);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(h.app.readNoteSymbols(noteRows(h).at(-1)).martyria, null);
  });

  await t.test("leaves the new well empty when the ladder is exhausted", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h).at(-1), "highKe", h.app.GENUS_NONE, 1);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(
      h.app.readNoteSymbols(noteRows(h).at(-1)).martyria,
      null,
      "there is nothing above high Κε plus a tick"
    );
  });

  await t.test("does not continue the ladder in Generic notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeMartyria(noteRows(h).at(-1), "midZo", h.app.GENUS_NONE, 0);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(h.app.readNoteSymbols(noteRows(h).at(-1)).martyria, null);
  });

  await t.test("leaves the remaining degrees alone when the last note is removed", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 4);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    fireClick(h, h.document.getElementById("remove-note"));

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.note),
      ["midZo", "midNi", "midPa"]
    );
  });
});
