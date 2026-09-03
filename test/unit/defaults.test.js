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

test("the base note selector", async (t) => {
  await t.test("offers all twelve chromatic notes, C first", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The list is also the file format's vocabulary: settings.baseNote is this
    // value verbatim, so nothing translates at the boundary.
    assert.deepEqual(
      [...h.document.getElementById("base-note").options].map((o) => o.value),
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]
    );
  });

  await t.test("every one of the twelve sounds at the pitch it names", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Semitones above C, wrapped onto A220 … G#415 — exactly the octave the
    // old A-based encoding spanned, so every note that could be chosen before
    // still sounds at the pitch it did.
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (let s = 0; s < 12; s++) {
      selectOption(h, "base-note", String(s));
      closeTo(
        h.app.getBaseFrequency(),
        220 * Math.pow(2, ((s + 3) % 12) / 12),
        1e-9,
        `base note ${names[s]}`
      );
    }
  });

  await t.test("A is still 220 Hz, now at value 9", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9");
    closeTo(h.app.getBaseFrequency(), 220, 1e-9);
  });

  await t.test("the default is C, at 261.63 Hz", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.document.getElementById("base-note").value, "0", "C is the first option");
    closeTo(h.app.getBaseFrequency(), 261.6255653, 1e-6);
  });
});
