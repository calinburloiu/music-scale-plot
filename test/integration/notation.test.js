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
