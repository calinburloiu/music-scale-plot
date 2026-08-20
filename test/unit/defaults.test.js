"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, selectOption, noteRows } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

function appWith(type, divisions) {
  const h = loadApp();
  selectOption(h, "interval-type", type);
  if (divisions !== undefined) {
    const input = h.document.getElementById("edo-divisions");
    input.value = String(divisions);
    input.dispatchEvent(new h.window.Event("input", { bubbles: true }));
  }
  return h;
}

test("default values depend on the interval type", async (t) => {
  await t.test("ratio mode defaults to a major tone", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    assert.equal(h.app.getDefaultIntervalValue(), "9/8");
    assert.equal(h.app.getIntervalPlaceholder(), "ratio");
    assert.equal(h.app.getUnisonValue(), "1/1");
  });

  await t.test("edo mode defaults to the step count nearest 200 cents", () => {
    const h = appWith("edo", 12);
    t.after(() => h.close());
    assert.equal(h.app.getDefaultIntervalValue(), "2", "200 cents is 2 steps of 12-EDO");
    assert.equal(h.app.getIntervalPlaceholder(), "steps");
    assert.equal(h.app.getUnisonValue(), "0");
  });

  await t.test("the edo default rounds for divisions that do not fit 200 cents", () => {
    const h = appWith("edo", 53);
    t.after(() => h.close());
    // 200 / (1200/53) = 8.83 steps, rounded to 9
    assert.equal(h.app.getDefaultIntervalValue(), "9");
  });

  await t.test("cents mode defaults to 200 cents", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    assert.equal(h.app.getDefaultIntervalValue(), "200");
    assert.equal(h.app.getIntervalPlaceholder(), "cents");
    assert.equal(h.app.getUnisonValue(), "0");
  });

  await t.test("every interval type's default is a positive, plottable interval", () => {
    for (const type of ["ratio", "edo", "cents"]) {
      const h = appWith(type);
      const cents = h.app.intervalToCents(h.app.getDefaultIntervalValue());
      assert.ok(cents > 0, `${type} default is ${cents} cents`);
      h.close();
    }
  });
});

test("getDefaultAbsoluteForNewNote stacks the default interval on the last note", async (t) => {
  await t.test("multiplies ratios", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    // Default scale in absolute mode is 1/1 then 9/8; the next note is 9/8 * 9/8.
    assert.equal(h.app.getDefaultAbsoluteForNewNote(), "81/64");
  });

  await t.test("adds edo steps", () => {
    const h = appWith("edo", 12);
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    assert.equal(h.app.getDefaultAbsoluteForNewNote(), "4", "2 steps on top of 2");
  });

  await t.test("adds cents with two decimals", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    assert.equal(h.app.getDefaultAbsoluteForNewNote(), "400.00");
  });

  await t.test("treats an unparseable last value as the unison", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    const last = noteRows(h).at(-1).querySelector(".absolute-interval");
    last.value = "not a ratio";
    assert.equal(h.app.getDefaultAbsoluteForNewNote(), "9/8");
  });
});

test("getBaseFrequency follows the base note selector", async (t) => {
  const h = loadApp();
  t.after(() => h.close());

  await t.test("A is 220 Hz", () => {
    selectOption(h, "base-note", "0");
    closeTo(h.app.getBaseFrequency(), 220);
  });

  await t.test("other notes are equal-tempered semitones above A", () => {
    const cases = { 2: "B", 3: "C", 5: "D", 7: "E", 8: "F", 10: "G" };
    for (const [semitones, name] of Object.entries(cases)) {
      selectOption(h, "base-note", semitones);
      closeTo(
        h.app.getBaseFrequency(),
        220 * Math.pow(2, Number(semitones) / 12),
        1e-9,
        `base note ${name}`
      );
    }
  });
});
