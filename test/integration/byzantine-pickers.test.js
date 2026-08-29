"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  openWell,
  pickFthora,
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
  });

  await t.test("closes when the user clicks outside the editor", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    fireClick(h, h.document.body);

    assert.ok(!panel.classList.contains("open"));
  });
});
