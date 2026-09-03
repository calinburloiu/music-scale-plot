"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  selectOption,
  noteRows,
  intervalRows,
  buildRelativeScale,
  buildAbsoluteScale,
  pickScaleFile,
} = require("../helpers/harness.js");

function intervalBox(h, index) {
  return intervalRows(h)[index].querySelector(".interval");
}

function absoluteBox(h, degree) {
  return noteRows(h)[degree - 1].querySelector(".absolute-interval");
}

function isMarked(input) {
  return input.classList.contains("is-invalid");
}

test("marking an interval the app cannot read", async (t) => {
  await t.test("marks a box whose value does not parse", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "9.5/8");

    assert.equal(isMarked(intervalBox(h, 0)), true, "an unreadable ratio must be marked");
  });

  await t.test("leaves a box the app can read alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "10/9");

    assert.equal(isMarked(intervalBox(h, 0)), false);
  });

  await t.test("clears the mark as soon as the value is fixed", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "9.5/8");
    assert.equal(isMarked(intervalBox(h, 0)), true, "should be marked to start");

    typeInto(h, intervalBox(h, 0), "9/8");

    assert.equal(isMarked(intervalBox(h, 0)), false, "fixing it must clear the mark");
  });

  await t.test("marks an empty box, which names no interval at all", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("marks only the offending row", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "nonsense", "16/15"]);

    assert.deepEqual(
      intervalRows(h).map((row) => isMarked(row.querySelector(".interval"))),
      [false, true, false]
    );
  });

  await t.test("marks a step count that is not whole, in EDO", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    typeInto(h, intervalBox(h, 0), "7.5");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("accepts a negative step count, which is a descending interval", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    typeInto(h, intervalBox(h, 0), "-7");

    assert.equal(isMarked(intervalBox(h, 0)), false, "descending is legal, not invalid");
  });

  await t.test("marks a cents value with anything trailing it", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalBox(h, 0), "203.91c");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("marks the box on a note row in absolute mode", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    typeInto(h, absoluteBox(h, 2), "9.5/8");

    assert.equal(isMarked(absoluteBox(h, 2)), true);
  });

  await t.test("never marks Note 1, whose unison the editor pins for it", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Its input is disabled and always holds getUnisonValue(); there is nothing
    // the user could have got wrong there.
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    typeInto(h, absoluteBox(h, 2), "nonsense");

    assert.equal(isMarked(absoluteBox(h, 1)), false, "Note 1 must never be marked");
  });

  await t.test("gives a freshly added note a clean box", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(isMarked(intervalBox(h, 1)), false, "the seeded default must not flash red");
  });

  await t.test("marks a value that arrived from a file", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // The reader stays tolerant of an interval string it cannot parse — a
    // hand-edited file still opens — so the editor is where that value is
    // reported, the same way one the user typed is.
    await pickScaleFile(
      h,
      JSON.stringify({
        formatVersion: 1,
        settings: { notation: "generic", baseNote: 0 },
        scaleEditor: {
          mode: "relativeIntervals",
          intervalType: { type: "ratio" },
          intervals: ["9.5/8"],
          noteProperties: [{}, {}],
          intervalProperties: [{ color: "#FFFFFF" }],
        },
        chart: { style: "boxes", orientation: "vertical", zoom: 100 },
      })
    );

    assert.equal(intervalBox(h, 0).value, "9.5/8", "the file's value should have loaded");
    assert.equal(isMarked(intervalBox(h, 0)), true, "and been marked on arrival");
  });
});
