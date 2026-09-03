"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  buildRelativeScale,
  selectOption,
  intervalRows,
  typeInto,
} = require("../helpers/harness.js");
const { closeTo, equalArray } = require("../helpers/assertions.js");

test("scaleFrequencies", async (t) => {
  await t.test("gives one frequency per note, multiplying the intervals up", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 3, "three notes, two intervals");
    closeTo(frequencies[0], 220);
    closeTo(frequencies[1], 220 * (9 / 8), 1e-9);
    closeTo(frequencies[2], 220 * (5 / 4), 1e-9, "9/8 * 10/9");
  });

  await t.test("skips an unparseable interval rather than poisoning the rest", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops", "10/9"]);

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 4, "the broken interval still separates two notes");
    closeTo(frequencies[2], 220 * (9 / 8), 1e-9, "the broken interval contributes nothing");
    closeTo(frequencies[3], 220 * (5 / 4), 1e-9);
  });

  await t.test("a descending interval lowers the pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "-1200");

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    closeTo(frequencies[1], 110, 1e-9, "an octave down");
  });

  await t.test("a zero-width interval leaves two notes at the same pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "0");

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 2, "both notes are still there");
    closeTo(frequencies[1], 220, 1e-9);
  });

  await t.test("gives nothing for an empty scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    equalArray(h.app.scaleFrequencies([], 220), []);
  });
});

test("scalePlaybackPlan", async (t) => {
  await t.test("goes up and back down without repeating the top note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const plan = h.app.scalePlaybackPlan([100, 200, 300, 400]);
    assert.equal(plan.length, 7, "2N-1 notes for N = 4 degrees");
    equalArray(plan.map((e) => e.degree), [1, 2, 3, 4, 3, 2, 1]);
    equalArray(plan.map((e) => e.frequency), [100, 200, 300, 400, 300, 200, 100]);
  });

  await t.test("lays the notes end to end, one quarter each", () => {
    const h = loadApp();
    t.after(() => h.close());

    const quarter = h.app.QUARTER_SECONDS;
    closeTo(quarter, 60 / 90, 1e-12, "quarter notes at 90 BPM");

    const plan = h.app.scalePlaybackPlan([100, 200, 300]);
    plan.forEach((entry, i) => {
      closeTo(entry.start, i * quarter, 1e-12, `note ${i + 1} starts a quarter after note ${i}`);
      closeTo(entry.duration, quarter, 1e-12);
    });
  });

  await t.test("the smallest legal scale is three notes long", () => {
    const h = loadApp();
    t.after(() => h.close());

    const plan = h.app.scalePlaybackPlan([100, 200]);
    equalArray(plan.map((e) => e.degree), [1, 2, 1]);
    closeTo(plan.length * h.app.QUARTER_SECONDS, 2, 1e-12, "two seconds at 90 BPM");
  });

  await t.test("a single degree sounds once, and no degrees sound not at all", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(h.app.scalePlaybackPlan([440]).map((e) => e.degree), [1]);
    equalArray(h.app.scalePlaybackPlan([]), []);
  });
});
