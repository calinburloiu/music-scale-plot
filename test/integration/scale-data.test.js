"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  selectOption,
  buildRelativeScale,
  buildAbsoluteScale,
  intervalRows,
  noteRows,
  typeInto,
} = require("../helpers/harness.js");
const { closeTo, isNaNValue } = require("../helpers/assertions.js");

// readScaleData() is the seam between the DOM (which is the app's data model)
// and everything that consumes a scale: rendering, playback and labels.
test("readScaleData in relative mode", async (t) => {
  await t.test("returns alternating note and interval items", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    const data = h.app.readScaleData();
    assert.deepEqual(
      Array.from(data, (item) => item.type),
      ["note", "interval", "note", "interval", "note"]
    );
  });

  await t.test("numbers note degrees from 1", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);

    const degrees = h.app.readScaleData().filter((i) => i.type === "note").map((i) => i.degree);
    assert.deepEqual(Array.from(degrees), [1, 2, 3, 4]);
  });

  await t.test("converts each interval to cents and to a display string", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    closeTo(intervals[0].cents, 203.91000173077484, 1e-9);
    assert.equal(intervals[0].displayInterval, "9/8");
    assert.equal(intervals[0].rawValue, "9/8");
    closeTo(intervals[1].cents, 182.40371213406, 1e-9);
    assert.equal(intervals[1].displayInterval, "10/9");
  });

  await t.test("carries note names, interval labels and colours", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], {
      names: ["Pa", "Vou"],
      labels: ["major tone"],
      colors: ["#FFCCCC"],
    });

    const data = h.app.readScaleData();
    assert.equal(data[0].name, "Pa");
    assert.equal(data[2].name, "Vou");
    assert.equal(data[1].label, "major tone");
    assert.equal(data[1].color, "#FFCCCC");
  });

  await t.test("trims whitespace from names, labels and values", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".note-name"), "  Pa  ");
    typeInto(h, h.el(".interval-label"), "  tone  ");
    typeInto(h, h.el(".interval"), "  9/8  ");

    const data = h.app.readScaleData();
    assert.equal(data[0].name, "Pa");
    assert.equal(data[1].label, "tone");
    closeTo(data[1].cents, 203.91000173077484, 1e-9);
  });

  await t.test("reports an unparseable interval as NaN cents with no display string", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    isNaNValue(intervals[1].cents);
    assert.equal(intervals[1].displayInterval, "");
    assert.equal(intervals[1].rawValue, "");
  });

  await t.test("defaults an unpainted interval to the palette's first colour", () => {
    const h = loadApp();
    t.after(() => h.close());
    const data = h.app.readScaleData();
    assert.equal(data[1].color, "#FFFFFF");
  });
});

test("readScaleData in absolute mode", async (t) => {
  await t.test("derives each interval from the two notes around it", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    closeTo(intervals[0].cents, 203.91000173077484, 1e-9, "1/1 -> 9/8");
    closeTo(intervals[1].cents, 182.40371213406, 1e-9, "9/8 -> 5/4");
  });

  await t.test("displays derived intervals as reduced ratios", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    assert.deepEqual(
      Array.from(intervals, (i) => i.displayInterval),
      ["9/8", "10/9"]
    );
  });

  await t.test("reports rawValue in cents, since there is no typed relative value", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);

    const interval = h.app.readScaleData()[1];
    assert.equal(interval.rawValue, "203.91");
  });

  await t.test("reports NaN cents when either surrounding note is unparseable", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);
    typeInto(h, noteRows(h)[1].querySelector(".absolute-interval"), "oops");

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    isNaNValue(intervals[0].cents, "interval below the broken note");
    isNaNValue(intervals[1].cents, "interval above the broken note");
  });

  await t.test("yields negative cents for a descending step", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "5/4", "9/8"]);

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    assert.ok(intervals[1].cents < 0, "5/4 down to 9/8 is a descending interval");
  });

  await t.test("keeps labels and colours, which belong to the interval row", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"], { labels: ["major tone"], colors: ["#CCE5FF"] });

    const interval = h.app.readScaleData()[1];
    assert.equal(interval.label, "major tone");
    assert.equal(interval.color, "#CCE5FF");
  });

  await t.test("note 1 is pinned to the unison and cannot be edited", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");

    const first = noteRows(h)[0].querySelector(".absolute-interval");
    assert.equal(first.value, "1/1");
    assert.equal(first.disabled, true);
  });
});
