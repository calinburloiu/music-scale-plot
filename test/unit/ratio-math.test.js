"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");
const { closeTo, equalArray } = require("../helpers/assertions.js");

test("ratio arithmetic", async (t) => {
  const h = loadApp();
  const app = h.app;
  t.after(() => h.close());

  await t.test("gcd", async (t) => {
    await t.test("returns the greatest common divisor", () => {
      assert.equal(app.gcd(12, 18), 6);
      assert.equal(app.gcd(9, 8), 1);
      assert.equal(app.gcd(100, 25), 25);
    });

    await t.test("ignores sign", () => {
      assert.equal(app.gcd(-12, 18), 6);
      assert.equal(app.gcd(12, -18), 6);
    });

    await t.test("never returns 0, so it is always safe to divide by", () => {
      assert.equal(app.gcd(0, 0), 1);
      assert.equal(app.gcd(0, 7), 7);
      assert.equal(app.gcd(7, 0), 7);
    });
  });

  await t.test("parseRatioPair", async (t) => {
    await t.test("splits a p/q string into numbers", () => {
      equalArray(app.parseRatioPair("9/8"), [9, 8]);
      equalArray(app.parseRatioPair("2/1"), [2, 1]);
      equalArray(app.parseRatioPair("81/64"), [81, 64]);
    });

    await t.test("tolerates whitespace around the numbers", () => {
      equalArray(app.parseRatioPair(" 9 / 8 "), [9, 8]);
    });

    await t.test("rejects anything that is not exactly two non-zero parts", () => {
      assert.equal(app.parseRatioPair("9"), null, "missing denominator");
      assert.equal(app.parseRatioPair("9/8/7"), null, "too many parts");
      assert.equal(app.parseRatioPair(""), null, "empty");
      assert.equal(app.parseRatioPair("abc/def"), null, "not numeric");
      assert.equal(app.parseRatioPair("0/8"), null, "zero numerator");
      assert.equal(app.parseRatioPair("9/0"), null, "zero denominator");
    });

    await t.test("rejects terms that are not whole numbers", () => {
      // parseInt used to stop where the digits did, so "9.5/8" parsed as 9/8
      // and "9x/8" as 9/8 — the chart drew a value nobody typed. A ratio is a
      // pair of integers or it is not a ratio.
      assert.equal(app.parseRatioPair("9.5/8"), null, "fractional numerator");
      assert.equal(app.parseRatioPair("9/8.5"), null, "fractional denominator");
      assert.equal(app.parseRatioPair("9x/8"), null, "trailing junk on the numerator");
      assert.equal(app.parseRatioPair("9/8x"), null, "trailing junk on the denominator");
    });

    await t.test("rejects a signed term, since neither sign names a pitch", () => {
      // These used to parse and were turned away one layer later, by
      // intervalToCents refusing a non-positive ratio. Turning them away here
      // makes "parses" and "is a usable interval" the same question, which is
      // what the editor's invalid marking and the save guard both ask.
      assert.equal(app.parseRatioPair("-9/8"), null, "negative numerator");
      assert.equal(app.parseRatioPair("9/-8"), null, "negative denominator");
      assert.equal(app.parseRatioPair("+9/8"), null, "explicit plus");
    });
  });

  await t.test("simplifyRatio reduces to lowest terms", () => {
    equalArray(app.simplifyRatio(18, 16), [9, 8]);
    equalArray(app.simplifyRatio(9, 8), [9, 8]);
    equalArray(app.simplifyRatio(100, 50), [2, 1]);
  });

  await t.test("multiplyRatios stacks intervals and simplifies", () => {
    equalArray(app.multiplyRatios([9, 8], [10, 9]), [5, 4], "9/8 * 10/9 = 5/4");
    equalArray(app.multiplyRatios([3, 2], [4, 3]), [2, 1], "fifth + fourth = octave");
    equalArray(app.multiplyRatios([1, 1], [9, 8]), [9, 8], "unison is the identity");
  });

  await t.test("divideRatios subtracts intervals and simplifies", () => {
    equalArray(app.divideRatios([5, 4], [9, 8]), [10, 9], "5/4 / 9/8 = 10/9");
    equalArray(app.divideRatios([3, 2], [3, 2]), [1, 1], "an interval minus itself is the unison");
    equalArray(app.divideRatios([2, 1], [3, 2]), [4, 3], "octave minus fifth = fourth");
  });

  await t.test("ratioToCents converts a frequency ratio to cents", () => {
    closeTo(app.ratioToCents(1), 0, 1e-9, "unison");
    closeTo(app.ratioToCents(2), 1200, 1e-9, "octave");
    closeTo(app.ratioToCents(3 / 2), 701.9550008653874, 1e-9, "just fifth");
    closeTo(app.ratioToCents(9 / 8), 203.91000173077484, 1e-9, "major tone");
  });

  await t.test("ratioToCents is additive over multiplication", () => {
    const stacked = app.ratioToCents((9 / 8) * (10 / 9));
    const summed = app.ratioToCents(9 / 8) + app.ratioToCents(10 / 9);
    closeTo(stacked, summed, 1e-9);
  });
});
