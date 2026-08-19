"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  selectOption,
  typeInto,
  buildRelativeScale,
  buildAbsoluteScale,
  intervalRows,
  noteRows,
  pickColor,
} = require("../helpers/harness.js");

const colors = (h) => intervalRows(h).map((r) => r.querySelector(".color-swatch").dataset.color);
const labels = (h) => intervalRows(h).map((r) => r.querySelector(".interval-label").value);

// Equal intervals should look alike on the chart: colour and label are shared
// between every row with the same value.
test("colour synchronisation", async (t) => {
  await t.test("painting one interval paints every row with the same value", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "9/8"]);

    pickColor(h, intervalRows(h)[0], "#FFCCCC");

    assert.deepEqual(colors(h), ["#FFCCCC", "#FFFFFF", "#FFCCCC"]);
  });

  await t.test("leaves differently-valued intervals alone", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pickColor(h, intervalRows(h)[0], "#FFCCCC");
    pickColor(h, intervalRows(h)[1], "#CCE5FF");

    assert.deepEqual(colors(h), ["#FFCCCC", "#CCE5FF"]);
  });

  await t.test("typing an existing value adopts that value's colour", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    pickColor(h, intervalRows(h)[0], "#FFCCCC");

    typeInto(h, intervalRows(h)[1].querySelector(".interval"), "9/8");

    assert.deepEqual(colors(h), ["#FFCCCC", "#FFCCCC"]);
  });

  await t.test("the neutral default colour is not propagated", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    pickColor(h, intervalRows(h)[1], "#FFCCCC");

    // Row 0 is still the default white; typing 10/9 into it must adopt the
    // painted colour rather than pushing white onto row 1.
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "10/9");

    assert.deepEqual(colors(h), ["#FFCCCC", "#FFCCCC"]);
  });

  await t.test("matching is on the value as typed, not on the interval size", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "18/16"]);

    pickColor(h, intervalRows(h)[0], "#FFCCCC");

    assert.deepEqual(
      colors(h),
      ["#FFCCCC", "#FFFFFF"],
      "18/16 sounds like 9/8 but is a different key, so it keeps its own colour"
    );
  });

  await t.test("a colour already assigned survives a later edit of the value", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    pickColor(h, intervalRows(h)[1], "#CCE5FF");

    typeInto(h, intervalRows(h)[1].querySelector(".interval"), "16/15");

    assert.deepEqual(colors(h), ["#FFFFFF", "#CCE5FF"], "editing a value never clears its colour");
  });

  await t.test("the chosen colour reaches the chart", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();

    pickColor(h, intervalRows(h)[0], "#FFCCCC");

    const fills = h.ctx.callsOf("fillRect").map((c) => c.state.fillStyle);
    assert.ok(fills.includes("#FFCCCC"), `expected a #FFCCCC rectangle, drew ${fills}`);
  });
});

test("label synchronisation", async (t) => {
  await t.test("labelling one interval labels every row with the same value", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "9/8"]);

    typeInto(h, intervalRows(h)[0].querySelector(".interval-label"), "major tone");

    assert.deepEqual(labels(h), ["major tone", "", "major tone"]);
  });

  await t.test("typing an existing value adopts that value's label", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    typeInto(h, intervalRows(h)[0].querySelector(".interval-label"), "major tone");

    typeInto(h, intervalRows(h)[1].querySelector(".interval"), "9/8");

    assert.deepEqual(labels(h), ["major tone", "major tone"]);
  });

  await t.test("clearing a label clears it everywhere", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "9/8"], { labels: ["major tone"] });
    assert.deepEqual(labels(h), ["major tone", "major tone"]);

    typeInto(h, intervalRows(h)[0].querySelector(".interval-label"), "");

    assert.deepEqual(labels(h), ["", ""]);
  });

  await t.test("an empty label is not propagated onto a labelled row", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    typeInto(h, intervalRows(h)[0].querySelector(".interval-label"), "major tone");

    typeInto(h, intervalRows(h)[1].querySelector(".interval"), "9/8");

    assert.deepEqual(labels(h), ["major tone", "major tone"]);
  });
});

test("interval row keys", async (t) => {
  await t.test("in relative mode the key is the typed value", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "18/16"]);

    assert.equal(h.app.getIntervalRowKey(intervalRows(h)[0]), "9/8");
    assert.equal(h.app.getIntervalRowKey(intervalRows(h)[1]), "18/16");
  });

  await t.test("in absolute mode the key is the derived size in cents", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);

    assert.equal(h.app.getIntervalRowKey(intervalRows(h)[0]), "203.91");
    assert.equal(h.app.getIntervalRowKey(intervalRows(h)[1]), "182.40");
  });

  await t.test("an unparseable row has no key, so it never syncs", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", ""]);

    assert.equal(h.app.getIntervalRowKey(intervalRows(h)[1]), "");
    pickColor(h, intervalRows(h)[1], "#FFCCCC");
    assert.deepEqual(colors(h), ["#FFFFFF", "#FFCCCC"], "the blank row keeps its colour to itself");
  });
});

test("colour synchronisation in absolute mode", async (t) => {
  await t.test("equal steps share a colour even when written differently", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    // 1/1 -> 9/8 and 4/3 -> 3/2 are both a 9/8 step.
    buildAbsoluteScale(h, ["1/1", "9/8", "4/3", "3/2"]);

    pickColor(h, intervalRows(h)[0], "#FFCCCC");

    assert.deepEqual(colors(h), ["#FFCCCC", "#FFFFFF", "#FFCCCC"]);
  });

  await t.test("editing a note re-syncs the intervals on both sides of it", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4", "3/2"]);
    pickColor(h, intervalRows(h)[0], "#FFCCCC"); // the 9/8 step from 1/1 to 9/8
    assert.deepEqual(colors(h), ["#FFCCCC", "#FFFFFF", "#FFFFFF"]);

    // Move the third note up so the step below it becomes a 9/8 as well.
    typeInto(h, noteRows(h)[2].querySelector(".absolute-interval"), "81/64");

    assert.deepEqual(
      colors(h),
      ["#FFCCCC", "#FFCCCC", "#FFFFFF"],
      "9/8 -> 81/64 is a 9/8 step, so it adopts that interval's colour"
    );
  });
});

test("switching the chart style remaps swatches to the other palette", async (t) => {
  await t.test("keeps each interval's palette position", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    const index = 6;
    pickColor(h, intervalRows(h)[0], h.app.PALETTE_LIGHT[index]);

    selectOption(h, "chart-style", "lines");

    assert.equal(colors(h)[0], h.app.PALETTE_DARK[index]);
    assert.equal(colors(h)[1], h.app.PALETTE_DARK[0], "the default maps to the dark default");
  });

  await t.test("maps back when switching to boxes again", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    pickColor(h, intervalRows(h)[0], h.app.PALETTE_LIGHT[3]);

    selectOption(h, "chart-style", "lines");
    selectOption(h, "chart-style", "boxes");

    assert.equal(colors(h)[0], h.app.PALETTE_LIGHT[3]);
  });

  await t.test("leaves a colour that is in neither palette untouched", () => {
    const h = loadApp();
    t.after(() => h.close());
    const swatch = h.el(".color-swatch");
    swatch.dataset.color = "#123456";

    selectOption(h, "chart-style", "lines");

    assert.equal(swatch.dataset.color, "#123456");
  });
});
