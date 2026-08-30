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

test("the chart does not change when the editor's Mode does", async (t) => {
  // Mode changes only how intervals are *typed*: relative values on the
  // interval rows, or absolute positions on the note rows. The scale is the
  // same scale either way, so everything the chart draws — the cents it stacks
  // and the text it writes in each box — has to come out identical. It did not:
  // absolute mode ran the interval through a second, differently-worded
  // formatter, so an EDO chart grew the word "steps" and a cents chart grew two
  // decimal places the user never typed.
  // Copied out of the jsdom realm, or deepEqual rejects them — see TESTING.md §5.
  const chartText = (h) =>
    Array.from(h.app.readScaleData().filter((i) => i.type === "interval"), (i) => i.displayInterval);
  const chartCents = (h) =>
    Array.from(h.app.readScaleData().filter((i) => i.type === "interval"), (i) => i.cents);

  // Cents are the deliberate exception: absolute mode subtracts two positions
  // and rounds, so it writes "200.00￠" where relative mode echoes the typed
  // "200￠". Both carry the ￠ sign, and the figure is the same size; only the
  // trailing zeros differ, and that is left alone on purpose.
  for (const [type, values] of [
    ["edo", ["2", "1", "3"]],
    ["ratio", ["9/8", "10/9", "16/15"]],
  ]) {
    await t.test("keeps the same interval text in " + type, () => {
      const h = loadApp();
      t.after(() => h.close());
      selectOption(h, "interval-type", type);
      buildRelativeScale(h, values);

      const before = chartText(h);
      selectOption(h, "scale-mode", "absolute");
      const inAbsolute = chartText(h);
      selectOption(h, "scale-mode", "relative");

      assert.deepEqual(inAbsolute, before, type + ": switching to Absolute changed the chart");
      assert.deepEqual(chartText(h), before, type + ": switching back changed the chart");
    });

    await t.test("keeps the same interval sizes in " + type, () => {
      const h = loadApp();
      t.after(() => h.close());
      selectOption(h, "interval-type", type);
      buildRelativeScale(h, values);

      const before = chartCents(h);
      selectOption(h, "scale-mode", "absolute");

      for (let i = 0; i < before.length; i++) {
        closeTo(chartCents(h)[i], before[i], 1e-9, type + ": interval " + i + " changed size");
      }
    });
  }

  await t.test("keeps a cents chart's sizes and its ￠ sign across the switch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    buildRelativeScale(h, ["200", "100", "350.5"]);

    const before = chartCents(h);
    selectOption(h, "scale-mode", "absolute");

    for (let i = 0; i < before.length; i++) {
      closeTo(chartCents(h)[i], before[i], 1e-9, "interval " + i + " changed size");
    }
    for (const text of chartText(h)) {
      assert.ok(text.endsWith("￠"), "a cents interval keeps its sign in either mode; got " + text);
    }
  });

  await t.test("writes an EDO interval as a bare step count, with no unit word", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    buildRelativeScale(h, ["2", "1"]);
    selectOption(h, "scale-mode", "absolute");

    // The chart is a picture, not a sentence: the boxes are already labelled by
    // the axis, so a unit word in every box is noise the relative mode never
    // showed.
    assert.deepEqual(chartText(h), ["2", "1"]);
  });
});
