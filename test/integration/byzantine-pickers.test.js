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

function martyriaNotes(h) {
  return noteRows(h).map((row) => {
    const m = h.app.readNoteSymbols(row).martyria;
    return m ? m.note : null;
  });
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

  await t.test("writes the pick to the row and closes the panel on Apply", () => {
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

  await t.test("redraws the chart when a fthora is applied", () => {
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
  await t.test("writes the letter on Apply, with no genus", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "midPa" });

    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "none",
      ticks: 0,
    });
  });

  await t.test("keeps the panel open after a letter is drafted, so the genus can follow", () => {
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

  await t.test("redraws the chart when the draft is applied", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));
    h.ctx.reset();

    fireClick(h, row.querySelector(".martyria-picker .byz-apply"));

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("closes the panel when Apply is pressed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    fireClick(h, row.querySelector(".martyria-picker .byz-apply"));

    assert.ok(!row.querySelector(".martyria-picker").classList.contains("open"));
  });

  // The panel is a tall scroller, so clicks land on its own chrome constantly.
  // Those must not reach the document listener that closes everything.
  await t.test("stays open when its column title is clicked", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    fireClick(h, panel.querySelector(".byz-column-title"));

    assert.ok(panel.classList.contains("open"));
  });

  await t.test("stays open when the genus separator is clicked", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    const panel = openWell(h, row, "martyria");
    fireClick(h, panel.querySelector('.martyria-note-option[data-note="midPa"]'));

    fireClick(h, panel.querySelector(".byz-separator"));

    assert.ok(panel.classList.contains("open"));
  });

  await t.test("does nothing when a disabled row is clicked", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const row = noteRows(h)[2];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-note-option[data-note="lowZo"]'));

    assert.equal(
      panel.querySelector(".byz-preview").textContent,
      "",
      "an illegal position must not even be drafted"
    );
    assert.ok(panel.classList.contains("open"), "and the panel stays open");
  });
});

// A picker is a draft, not a live edit: every click inside it moves the panel's
// own pending value, and only Apply pushes that into the scale. Cancel, a click
// outside, a second click on the well and opening another picker all discard it.
test("drafting a symbol", async (t) => {
  await t.test("leaves the row's fthora alone while one is drafted", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa", { dismiss: "none" });

    assert.equal(h.app.readNoteSymbols(row).fthora, "", "the draft must not reach the row");
    assert.ok(row.querySelector(".fthora-well").classList.contains("is-empty"));
  });

  await t.test("marks the drafted fthora inside the panel", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "fthora");
    fireClick(h, panel.querySelector('.fthora-option[data-fthora="diatonicPa"]'));

    const selected = panel.querySelectorAll(".fthora-option.is-selected");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.fthora, "diatonicPa");
  });

  await t.test("keeps the fthora panel open, so the pick can be reconsidered", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa", { dismiss: "none" });

    assert.ok(row.querySelector(".fthora-picker").classList.contains("open"));
  });

  await t.test("leaves the row's martyria alone while a letter is drafted", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "midPa", dismiss: "none" });

    assert.equal(h.app.readNoteSymbols(row).martyria, null, "the draft must not reach the row");
    assert.ok(row.querySelector(".martyria-well").classList.contains("is-empty"));
  });

  await t.test("does not redraw the chart while drafting", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    h.ctx.reset();

    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));
    fireClick(h, row.querySelector('.martyria-genus-option[data-genus="alpha"]'));

    assert.equal(h.ctx.callsOf("fillRect").length, 0, "a draft changes nothing to draw");
  });
});

test("cancelling a picker", async (t) => {
  await t.test("closes the panel when Cancel is pressed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector(".byz-cancel"));

    assert.ok(!panel.classList.contains("open"));
  });

  await t.test("leaves the fthora alone when Cancel is pressed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickFthora(h, row, "diatonicPa");

    pickFthora(h, row, "hardChromaticDi", { dismiss: "cancel" });

    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");
  });

  await t.test("leaves the fthora alone when the user clicks outside", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa", { dismiss: "outside" });

    assert.equal(h.app.readNoteSymbols(row).fthora, "");
  });

  await t.test("leaves the fthora alone when the well is clicked again", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa", { dismiss: "well" });

    assert.equal(h.app.readNoteSymbols(row).fthora, "");
  });

  await t.test("leaves the scale alone when Cancel is pressed", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", dismiss: "cancel" });

    assert.deepEqual(martyriaNotes(h), [null, null, null], "no letter, so no ladder");
  });

  await t.test("leaves the scale alone when the user clicks outside", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", dismiss: "outside" });

    assert.deepEqual(martyriaNotes(h), [null, null, null]);
  });

  await t.test("leaves the scale alone when the well is clicked again", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", dismiss: "well" });

    assert.deepEqual(martyriaNotes(h), [null, null, null]);
  });

  await t.test("leaves the scale alone when another degree's picker takes its place", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const rows = noteRows(h);

    pickMartyria(h, rows[0], { note: "midZo", dismiss: "none" });
    openWell(h, rows[2], "martyria");

    assert.deepEqual(martyriaNotes(h), [null, null, null]);
  });

  await t.test("does not redraw the chart, because nothing changed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midZo", dismiss: "none" });
    h.ctx.reset();

    fireClick(h, h.document.body);

    assert.equal(h.ctx.callsOf("fillRect").length, 0, "a cancel has nothing to draw");
  });

  await t.test("reopens the martyria picker on the committed letter, not the cancelled one", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa" });

    pickMartyria(h, row, { note: "midVou", dismiss: "cancel" });
    const panel = openWell(h, row, "martyria");

    const selected = panel.querySelectorAll(".martyria-note-option.is-selected");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.note, "midPa", "the discarded draft must not survive");
  });

  await t.test("reopens the fthora picker on the committed fthora, not the cancelled one", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickFthora(h, row, "diatonicPa");

    pickFthora(h, row, "hardChromaticDi", { dismiss: "cancel" });
    const panel = openWell(h, row, "fthora");

    const selected = panel.querySelectorAll(".fthora-option.is-selected");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.fthora, "diatonicPa");
  });
});

test("the martyria picker: the footer preview", async (t) => {
  await t.test("is empty while no letter is drafted", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(panel.querySelector(".byz-preview").textContent, "");
  });

  await t.test("starts from the martyria the well already holds", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(
      panel.querySelector(".byz-preview").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
  });

  await t.test("composes the drafted letter with the drafted genus", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "midDi", genus: "zygos", dismiss: "none" });

    assert.equal(
      row.querySelector(".martyria-picker .byz-preview").textContent,
      h.app.resolveMartyriaGlyphs("midDi", "zygos", 0)
    );
  });

  // The genus rows deliberately preview without the tick, so the footer is the
  // only place the drafted register is visible.
  await t.test("shows the octave tick, which the genus rows leave off", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[1], "highZo", h.app.GENUS_NONE, 1);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "highZo", ticks: 1, dismiss: "none" });

    const preview = row.querySelector(".martyria-picker .byz-preview").textContent;
    assert.equal(preview, h.app.resolveMartyriaGlyphs("highZo", h.app.GENUS_NONE, 1));
    assert.notEqual(
      preview,
      h.app.resolveMartyriaGlyphs("highZo", h.app.GENUS_NONE, 0),
      "the tick must be visible somewhere"
    );
  });
});

test("the Apply button", async (t) => {
  await t.test("is disabled in a picker that has just been opened", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.ok(panel.querySelector(".byz-apply").disabled, "there is nothing to apply yet");
  });

  await t.test("becomes available once the draft differs from the row", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(!panel.querySelector(".byz-apply").disabled);
  });

  await t.test("goes back to disabled when the draft is put back to what the row holds", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa" });
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-note-option[data-note="midVou"]'));
    fireClick(h, panel.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(panel.querySelector(".byz-apply").disabled);
  });

  await t.test("notices a genus change on its own", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midDi" });
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-genus-option[data-genus="zygos"]'));

    assert.ok(!panel.querySelector(".byz-apply").disabled, "the letter is the same, the genus is not");
  });

  await t.test("is disabled in a fresh fthora picker and enabled by a pick", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");
    assert.ok(panel.querySelector(".byz-apply").disabled);

    fireClick(h, panel.querySelector('.fthora-option[data-fthora="diatonicPa"]'));

    assert.ok(!panel.querySelector(".byz-apply").disabled);
  });

  await t.test("does nothing when it is clicked while disabled", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector(".byz-apply"));

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.ok(panel.classList.contains("open"), "a dead button must not close the panel either");
  });
});

test("the ladder", async (t) => {
  await t.test("runs the other degrees through the consecutive letters on Apply", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 4);

    pickMartyria(h, noteRows(h)[1], { note: "midNi" });

    assert.deepEqual(martyriaNotes(h), ["midZo", "midNi", "midPa", "midVou"]);
  });

  await t.test("propagates downward as well as upward", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[2], { note: "midPa" });

    // midZo=7, midNi=8, midPa=9 (see test/unit/byzantine-symbols.test.js);
    // degree 3 fixed at 9 puts degree 2 at 8 and degree 1 at 7.
    assert.deepEqual(martyriaNotes(h), ["midZo", "midNi", "midPa"]);
  });

  await t.test("leaves each degree's own genus alone", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo" });
    pickMartyria(h, noteRows(h)[2], { note: "midPa", genus: "alpha" });

    pickMartyria(h, noteRows(h)[1], { note: "midNi" });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "alpha"],
      "propagation moves letters, never genera"
    );
  });

  await t.test("gives an empty neighbour the letter with no genus", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo" });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "none"]
    );
  });

  await t.test("never touches the fthores", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickFthora(h, noteRows(h)[2], "diatonicPa");

    pickMartyria(h, noteRows(h)[0], { note: "midZo" });

    assert.equal(h.app.readNoteSymbols(noteRows(h)[2]).fthora, "diatonicPa");
  });

  await t.test("carries the octave tick into the top register", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "highKe" });

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
    pickMartyria(h, noteRows(h)[0], { note: "midZo" });

    pickMartyria(h, noteRows(h)[0], { note: "" });

    assert.deepEqual(martyriaNotes(h), [null, "midNi", "midPa"], "only that one well is cleared");
  });

  // Growing a scale can push its anchor off the top of the ladder: the letters
  // were legal for two degrees and are not for nine. Confirming re-anchors the
  // scale so the whole of it fits again — the ladder is never left stranded.
  await t.test("re-anchors a scale that outgrew the top of the ladder", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "highKe" });
    setNoteCount(h, 9);

    pickMartyria(h, noteRows(h)[0], { genus: "nana" });

    // Nine degrees ending at the ladder's last rung (27) must start at 19.
    assert.deepEqual(martyriaNotes(h), [
      "highDi",
      "highKe",
      "highZo",
      "highNi",
      "highPa",
      "highVou",
      "highGa",
      "highDi",
      "highKe",
    ]);
  });

  await t.test("keeps every degree's genus when the anchor is re-anchored", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "highKe" });
    setNoteCount(h, 9);

    pickMartyria(h, noteRows(h)[0], { genus: "nana" });

    assert.equal(
      h.app.readNoteSymbols(noteRows(h)[0]).martyria.genus,
      "nana",
      "moving a degree down the ladder must not drop its genus"
    );
  });

  await t.test("leaves the degrees past the ladder's end empty when the scale outruns it", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "lowZo" });
    setNoteCount(h, 29); // one more degree than the ladder has rungs

    pickMartyria(h, noteRows(h)[0], { genus: "nana" });

    const notes = martyriaNotes(h);
    assert.equal(notes[0], "lowZo", "the scale still starts on the bottom rung");
    assert.equal(notes[27], "highKe", "and runs up to the top one");
    assert.equal(notes[28], null, "there is no rung above it, so that degree stays empty");
  });
});

test("adding and removing notes in Byzantine notation", async (t) => {
  await t.test("continues the ladder onto the new degree, with no genus", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo" });

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
    pickMartyria(h, noteRows(h)[0], { note: "midZo" });

    fireClick(h, h.document.getElementById("remove-note"));

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.note),
      ["midZo", "midNi", "midPa"]
    );
  });
});
