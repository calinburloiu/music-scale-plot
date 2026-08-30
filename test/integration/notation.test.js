"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  typeInto,
  setNoteCount,
} = require("../helpers/harness.js");

test("the Notation setting", async (t) => {
  await t.test("starts as Generic, so nothing changes until the user opts in", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.document.getElementById("notation").value, "generic");
    assert.equal(h.app.getNotation(), "generic");
  });

  await t.test("offers exactly Generic and Byzantine", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      [...h.document.getElementById("notation").options].map((o) => o.value),
      ["generic", "byzantine"]
    );
  });

  await t.test("sits in Settings, above Base Note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.el(".settings-panel");
    const rows = [...panel.querySelectorAll(".notation-row, .base-note-row")];
    assert.ok(rows[0].classList.contains("notation-row"), "Notation must come first");
  });

  await t.test("marks the editor when Byzantine is chosen, and unmarks it again", () => {
    const h = loadApp();
    t.after(() => h.close());

    setNotation(h, "byzantine");
    assert.ok(h.editor().classList.contains("notation-byzantine"));

    setNotation(h, "generic");
    assert.ok(!h.editor().classList.contains("notation-byzantine"));
  });

  await t.test("redraws the chart when the notation changes", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    setNotation(h, "byzantine");
    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });
});

test("the symbol wells on a note row", async (t) => {
  await t.test("gives every note row a fthora well and a martyria well", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);

    for (const row of noteRows(h)) {
      assert.ok(row.querySelector(".fthora-well"), "no fthora well");
      assert.ok(row.querySelector(".martyria-well"), "no martyria well");
      assert.ok(row.querySelector(".fthora-picker"), "no fthora picker panel");
      assert.ok(row.querySelector(".martyria-picker"), "no martyria picker panel");
    }
  });

  await t.test("puts the fthora well to the left of the martyria well, mirroring the chart", () => {
    const h = loadApp();
    t.after(() => h.close());

    const row = noteRows(h)[0];
    const wells = [...row.querySelectorAll(".fthora-well-wrapper, .martyria-well-wrapper")];
    assert.ok(wells[0].classList.contains("fthora-well-wrapper"));
    assert.ok(wells[1].classList.contains("martyria-well-wrapper"));
  });

  await t.test("keeps the name input on the row in both notations, so nothing is discarded", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    setNotation(h, "byzantine");
    setNotation(h, "generic");

    assert.equal(noteRows(h)[0].querySelector(".note-name").value, "Pa", "the typed name was lost");
  });

  await t.test("gives a new note the wells too", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    setNoteCount(h, 3);

    const last = noteRows(h).at(-1);
    assert.ok(last.querySelector(".fthora-well"));
    assert.ok(last.querySelector(".martyria-well"));
  });

  await t.test("keeps the wells when the scale mode changes and the rows are rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    for (const row of noteRows(h)) {
      assert.ok(row.querySelector(".martyria-well"), "the rebuild dropped the wells");
    }
  });
});

test("symbol state on a note row", async (t) => {
  await t.test("reads nothing from a fresh row", () => {
    const h = loadApp();
    t.after(() => h.close());

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.fthora, "");
    assert.equal(symbols.martyria, null);
  });

  await t.test("stores a martyria as data attributes and reads it back", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);

    assert.equal(row.dataset.martyriaNote, "midPa");
    assert.equal(row.dataset.martyriaGenus, "alpha");
    assert.equal(row.dataset.martyriaTicks, "0");
    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 0,
    });
  });

  await t.test("defaults a martyria written with no genus to the 'none' sentinel", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "", 0);

    assert.equal(h.app.readNoteSymbols(row).martyria.genus, h.app.GENUS_NONE);
  });

  await t.test("clears a martyria completely, leaving no stale attributes", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 1);
    h.app.clearMartyria(row);

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(row.dataset.martyriaNote, undefined);
    assert.equal(row.dataset.martyriaGenus, undefined);
    assert.equal(row.dataset.martyriaTicks, undefined);
  });

  await t.test("treats writing an empty note as clearing the martyria", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 1);
    h.app.writeMartyria(row, "", "alpha", 1);

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(
      row.dataset.martyriaNote,
      undefined,
      "an empty note id must leave no attribute behind, not an empty one"
    );
    assert.equal(row.dataset.martyriaGenus, undefined);
    assert.equal(row.dataset.martyriaTicks, undefined);
  });

  await t.test("stores and clears a fthora independently of the martyria", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");

    h.app.writeFthora(row, "");
    assert.equal(h.app.readNoteSymbols(row).fthora, "");
    assert.equal(row.dataset.fthora, undefined);
    assert.ok(h.app.readNoteSymbols(row).martyria, "clearing the fthora must not touch the martyria");
  });
});

test("what a well shows", async (t) => {
  await t.test("paints the resolved glyphs into the well button", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
    assert.equal(
      row.querySelector(".fthora-well").textContent,
      h.app.resolveFthoraGlyph("diatonicPa")
    );
  });

  await t.test("marks a well empty when it holds nothing, and filled when it does", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    assert.ok(well.classList.contains("is-empty"), "a fresh well is empty");

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    assert.ok(!well.classList.contains("is-empty"), "a written well is not empty");

    h.app.clearMartyria(row);
    assert.ok(well.classList.contains("is-empty"), "a cleared well is empty again");
    assert.equal(well.textContent, "", "a cleared well shows nothing");
  });

  await t.test("shows the letter alone when the genus is none", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0),
      "the well shows the bare letter"
    );
  });
});

test("symbols across an editor rebuild", async (t) => {
  await t.test("survive a notation switch, because nothing is rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");

    setNotation(h, "generic");
    setNotation(h, "byzantine");

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.martyria.note, "midPa");
    assert.equal(symbols.fthora, "diatonicPa");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0),
      "the well was not repainted"
    );
  });

  await t.test("survive a scale-mode change, which rebuilds the rows but keeps names", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 1);
    h.app.writeFthora(noteRows(h)[1], "diatonicVou");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.deepEqual({ ...h.app.readNoteSymbols(noteRows(h)[0]).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 1,
    });
    assert.equal(h.app.readNoteSymbols(noteRows(h)[1]).fthora, "diatonicVou");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 1),
      "the rebuilt well was not repainted"
    );
  });

  await t.test("are dropped by an interval-type change, which resets the scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    h.document.getElementById("interval-type").value = "cents";
    h.document.getElementById("interval-type").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.equal(
      h.app.readNoteSymbols(noteRows(h)[0]).martyria,
      null,
      "resetScaleToDefault drops symbols, exactly as it already drops names"
    );
  });
});

test("readScaleData and the note symbols", async (t) => {
  await t.test("reports no symbols for a row that has none", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "");
    assert.equal(notes[0].martyria, null);
  });

  await t.test("reports the symbols each note row holds", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeMartyria(noteRows(h)[1], "midVou", h.app.GENUS_NONE, 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "diatonicPa");
    assert.deepEqual({ ...notes[0].martyria }, { note: "midPa", genus: "alpha", ticks: 0 });
    assert.equal(notes[1].fthora, "");
    assert.deepEqual({ ...notes[1].martyria }, { note: "midVou", genus: "none", ticks: 0 });
  });

  await t.test("keeps reporting the name alongside the symbols", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].name, "Pa", "the name is still part of the reading");
    assert.equal(notes[0].martyria.note, "midPa");
  });

  await t.test("reports the same symbols in either notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const generic = h.app.readScaleData().filter((item) => item.type === "note")[0];
    setNotation(h, "byzantine");
    const byzantine = h.app.readScaleData().filter((item) => item.type === "note")[0];

    assert.deepEqual({ ...byzantine.martyria }, { ...generic.martyria });
  });
});

test("waiting for the Neanes face", async (t) => {
  await t.test("asks the browser for Neanes at the chart's size on startup", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.fontLoads.length, 1, "the font was never requested");
    assert.equal(
      h.fontLoads[0],
      h.app.byzantineFont(h.app.BYZ_FONT_SIZE),
      "the face that is preloaded must be the one the chart draws with, " +
        "or a font swap preloads the wrong family and the first paint is blank boxes"
    );
  });

  await t.test("redraws once the face has resolved", async () => {
    const h = loadApp();
    t.after(() => h.close());
    const before = h.ctx.callsOf("fillRect").length;

    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(
      h.ctx.callsOf("fillRect").length > before,
      "the first paint used fallback metrics and was never replaced"
    );
    assert.equal(h.app.byzFontReady, true);
  });

  await t.test("boots without a FontFaceSet, because jsdom and old browsers have none", () => {
    const h = loadApp({ fonts: false });
    t.after(() => h.close());

    assert.deepEqual(h.jsdomErrors, [], "app.js threw when document.fonts was missing");
    assert.equal(h.app.loadByzantineFont(), null);
  });

  await t.test("re-measures on every render, so no pre-font measurement survives", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", h.app.GENUS_NONE, 0);
    h.app.render();
    const narrow = parseFloat(h.canvas().style.width);

    h.app.writeMartyria(noteRows(h)[0], "highKe", "softChromaticDi", 1);
    h.app.render();

    assert.ok(
      parseFloat(h.canvas().style.width) > narrow,
      "a cached measurement would have kept the canvas at its old width"
    );
  });
});
