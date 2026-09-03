"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, selectOption } = require("../helpers/harness.js");
const { closeTo, isNaNValue } = require("../helpers/assertions.js");

/** Boots the app with a given interval type selected. */
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

test("intervalToCents with the 'ratio' interval type", async (t) => {
  const h = appWith("ratio");
  t.after(() => h.close());

  await t.test("converts just intervals", () => {
    closeTo(h.app.intervalToCents("1/1"), 0, 1e-9, "unison");
    closeTo(h.app.intervalToCents("9/8"), 203.91000173077484, 1e-9, "major tone");
    closeTo(h.app.intervalToCents("10/9"), 182.40371213406, 1e-9, "minor tone");
    closeTo(h.app.intervalToCents("3/2"), 701.9550008653874, 1e-9, "just fifth");
    closeTo(h.app.intervalToCents("2/1"), 1200, 1e-9, "octave");
  });

  await t.test("accepts unreduced ratios", () => {
    closeTo(h.app.intervalToCents("18/16"), h.app.intervalToCents("9/8"), 1e-9);
  });

  await t.test("accepts descending ratios as negative cents", () => {
    closeTo(h.app.intervalToCents("8/9"), -203.91000173077484, 1e-9);
  });

  await t.test("returns NaN for unparseable input", () => {
    isNaNValue(h.app.intervalToCents(""), "empty");
    isNaNValue(h.app.intervalToCents("nonsense"), "not a ratio");
    isNaNValue(h.app.intervalToCents("9"), "no denominator");
    isNaNValue(h.app.intervalToCents("9/0"), "zero denominator");
  });

  await t.test("returns NaN for a ratio whose terms are not whole numbers", () => {
    // A ratio is a pair of integers. "9.5/8" used to read as 9/8, because
    // parseInt stops at the dot — the chart drew a value the user never typed.
    isNaNValue(h.app.intervalToCents("9.5/8"), "fractional numerator");
    isNaNValue(h.app.intervalToCents("9/8.5"), "fractional denominator");
    isNaNValue(h.app.intervalToCents("9x/8"), "trailing junk on the numerator");
    isNaNValue(h.app.intervalToCents("9/8x"), "trailing junk on the denominator");
    isNaNValue(h.app.intervalToCents("9/8/7"), "three terms");
  });

  await t.test("returns NaN for a non-positive ratio, which has no cents value", () => {
    isNaNValue(h.app.intervalToCents("-9/8"));
    isNaNValue(h.app.intervalToCents("9/-8"));
  });

  await t.test("intervalToDisplayString shows the ratio as typed", () => {
    assert.equal(h.app.intervalToDisplayString("9/8"), "9/8");
    assert.equal(h.app.intervalToDisplayString("  9/8  "), "9/8", "trimmed");
    assert.equal(h.app.intervalToDisplayString("18/16"), "18/16", "not reduced for display");
  });
});

test("intervalToCents with the 'edo' interval type", async (t) => {
  const h = appWith("edo", 12);
  t.after(() => h.close());

  await t.test("counts steps of the current division", () => {
    closeTo(h.app.intervalToCents("0"), 0);
    closeTo(h.app.intervalToCents("1"), 100);
    closeTo(h.app.intervalToCents("2"), 200);
    closeTo(h.app.intervalToCents("12"), 1200, 1e-9, "12 steps of 12-EDO is an octave");
  });

  await t.test("accepts negative step counts", () => {
    closeTo(h.app.intervalToCents("-2"), -200);
  });

  await t.test("returns NaN for unparseable input", () => {
    isNaNValue(h.app.intervalToCents(""));
    isNaNValue(h.app.intervalToCents("abc"));
  });

  await t.test("returns NaN for a step count that is not a whole number", () => {
    // A division of the octave is counted in whole steps. "7.5" used to read
    // as 7, and "7x" as 7, because parseInt stops where the digits do.
    isNaNValue(h.app.intervalToCents("7.5"), "fractional");
    isNaNValue(h.app.intervalToCents("7x"), "trailing junk");
    isNaNValue(h.app.intervalToCents("7 8"), "two numbers");
  });

  await t.test("intervalToDisplayString shows the bare step count", () => {
    assert.equal(h.app.intervalToDisplayString("2"), "2");
  });
});

test("EDO divisions", async (t) => {
  await t.test("getCentsPerEdoDivision splits the octave evenly", () => {
    const h = appWith("edo", 53);
    t.after(() => h.close());
    closeTo(h.app.getCentsPerEdoDivision(), 1200 / 53);
    closeTo(h.app.intervalToCents("9"), (1200 / 53) * 9, 1e-9, "9 steps of 53-EDO");
    closeTo(h.app.intervalToCents("53"), 1200, 1e-9, "53 steps of 53-EDO is an octave");
  });

  await t.test("getEdoDivisions falls back to 12 when the input is unusable", () => {
    const h = appWith("edo");
    t.after(() => h.close());
    const input = h.document.getElementById("edo-divisions");
    for (const bad of ["", "0", "-5", "abc"]) {
      input.value = bad;
      assert.equal(h.app.getEdoDivisions(), 12, `divisions="${bad}"`);
    }
    input.value = "31";
    assert.equal(h.app.getEdoDivisions(), 31);
  });
});

test("intervalToCents with the 'cents' interval type", async (t) => {
  const h = appWith("cents");
  t.after(() => h.close());

  await t.test("passes the number through", () => {
    closeTo(h.app.intervalToCents("0"), 0);
    closeTo(h.app.intervalToCents("200"), 200);
    closeTo(h.app.intervalToCents("203.91"), 203.91);
    closeTo(h.app.intervalToCents("-150.5"), -150.5);
  });

  await t.test("returns NaN for unparseable input", () => {
    isNaNValue(h.app.intervalToCents(""));
    isNaNValue(h.app.intervalToCents("abc"));
  });

  await t.test("returns NaN for a number with anything after it", () => {
    // "203.91c" used to read as 203.91, because parseFloat stops at the c.
    isNaNValue(h.app.intervalToCents("203.91c"), "trailing junk");
    isNaNValue(h.app.intervalToCents("200 300"), "two numbers");
    isNaNValue(h.app.intervalToCents("Infinity"), "not a finite cents value");
  });

  await t.test("intervalToDisplayString appends the cents sign", () => {
    assert.equal(h.app.intervalToDisplayString("200"), "200￠");
    assert.equal(h.app.intervalToDisplayString(" 200 "), "200￠", "trimmed first");
  });
});

test("computeRelativeDisplay renders the step between two absolute positions", async (t) => {
  await t.test("as a reduced ratio in 'ratio' mode", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    assert.equal(h.app.computeRelativeDisplay("9/8", "5/4"), "10/9");
    assert.equal(h.app.computeRelativeDisplay("1/1", "9/8"), "9/8");
    assert.equal(h.app.computeRelativeDisplay("1/1", "18/16"), "9/8", "reduced");
    assert.equal(h.app.computeRelativeDisplay("bad", "5/4"), "", "unparseable input yields no display");
  });

  await t.test("as a step count in 'edo' mode", () => {
    const h = appWith("edo", 12);
    t.after(() => h.close());
    assert.equal(h.app.computeRelativeDisplay("2", "4"), "2", "a bare step count, as relative mode writes it");
    assert.equal(h.app.computeRelativeDisplay("4", "2"), "-2", "descending");
    assert.equal(h.app.computeRelativeDisplay("x", "4"), "");
  });

  await t.test("as a cents difference in 'cents' mode", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    assert.equal(h.app.computeRelativeDisplay("200", "350"), "150.00￠");
    assert.equal(h.app.computeRelativeDisplay("0", "203.91"), "203.91￠");
    assert.equal(h.app.computeRelativeDisplay("", "350"), "");
  });
});
