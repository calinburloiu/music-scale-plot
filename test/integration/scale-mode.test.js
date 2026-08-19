"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  selectOption,
  typeInto,
  buildRelativeScale,
  buildAbsoluteScale,
  noteRows,
  intervalRows,
  setNoteCount,
} = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

const relativeValues = (h) => intervalRows(h).map((r) => r.querySelector(".interval").value);
const absoluteValues = (h) => noteRows(h).map((r) => r.querySelector(".absolute-interval").value);
const names = (h) => noteRows(h).map((r) => r.querySelector(".note-name").value);
const labels = (h) => intervalRows(h).map((r) => r.querySelector(".interval-label").value);
const colors = (h) => intervalRows(h).map((r) => r.querySelector(".color-swatch").dataset.color);

test("switching from relative to absolute intervals", async (t) => {
  await t.test("replaces interval inputs with absolute inputs on the note rows", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    selectOption(h, "scale-mode", "absolute");

    assert.equal(h.all("#editor .interval").length, 0, "no relative inputs remain");
    assert.equal(h.all("#editor .absolute-interval").length, 3, "one per note");
  });

  await t.test("accumulates the relative intervals into absolute positions", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);

    selectOption(h, "scale-mode", "absolute");

    assert.deepEqual(absoluteValues(h), ["1/1", "9/8", "5/4", "4/3"]);
  });

  await t.test("preserves note names, interval labels and colours", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"], {
      names: ["Pa", "Vou", "Ga"],
      labels: ["major tone", "minor tone"],
      colors: ["#FFCCCC", "#CCE5FF"],
    });

    selectOption(h, "scale-mode", "absolute");

    assert.deepEqual(names(h), ["Pa", "Vou", "Ga"]);
    assert.deepEqual(labels(h), ["major tone", "minor tone"]);
    assert.deepEqual(colors(h), ["#FFCCCC", "#CCE5FF"]);
  });

  await t.test("keeps the note count", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 5);

    selectOption(h, "scale-mode", "absolute");

    assert.equal(noteRows(h).length, 5);
    assert.equal(intervalRows(h).length, 4);
  });

  await t.test("plots the same intervals as before the switch", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    const before = h.app.readScaleData().filter((i) => i.type === "interval").map((i) => i.cents);

    selectOption(h, "scale-mode", "absolute");
    const after = h.app.readScaleData().filter((i) => i.type === "interval").map((i) => i.cents);

    assert.equal(after.length, before.length);
    before.forEach((cents, i) => closeTo(after[i], cents, 1e-9, `interval ${i}`));
  });
});

test("switching from absolute back to relative intervals", async (t) => {
  await t.test("differences the absolute positions", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4", "4/3"]);

    selectOption(h, "scale-mode", "relative");

    assert.deepEqual(relativeValues(h), ["9/8", "10/9", "16/15"]);
  });

  await t.test("preserves note names, interval labels and colours", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"], {
      names: ["Pa", "Vou", "Ga"],
      labels: ["major tone", "minor tone"],
      colors: ["#FFCCCC", "#CCE5FF"],
    });

    selectOption(h, "scale-mode", "relative");

    assert.deepEqual(names(h), ["Pa", "Vou", "Ga"]);
    assert.deepEqual(labels(h), ["major tone", "minor tone"]);
    assert.deepEqual(colors(h), ["#FFCCCC", "#CCE5FF"]);
  });
});

test("a relative -> absolute -> relative round trip", async (t) => {
  await t.test("restores the original ratios", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15", "9/8"]);

    selectOption(h, "scale-mode", "absolute");
    selectOption(h, "scale-mode", "relative");

    assert.deepEqual(relativeValues(h), ["9/8", "10/9", "16/15", "9/8"]);
  });

  await t.test("restores cents intervals at two-decimal precision", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    buildRelativeScale(h, ["203.91", "182.40", "111.73"]);

    selectOption(h, "scale-mode", "absolute");
    selectOption(h, "scale-mode", "relative");

    assert.deepEqual(relativeValues(h), ["203.91", "182.40", "111.73"]);
  });

  await t.test("restores edo step counts", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    typeInto(h, h.document.getElementById("edo-divisions"), "53");
    buildRelativeScale(h, ["9", "8", "5"]);

    selectOption(h, "scale-mode", "absolute");
    assert.deepEqual(absoluteValues(h), ["0", "9", "17", "22"]);

    selectOption(h, "scale-mode", "relative");
    assert.deepEqual(relativeValues(h), ["9", "8", "5"]);
  });

  await t.test("leaves the chart unchanged", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    const before = h.canvas().height;

    selectOption(h, "scale-mode", "absolute");
    selectOption(h, "scale-mode", "relative");

    assert.equal(h.canvas().height, before);
  });
});
