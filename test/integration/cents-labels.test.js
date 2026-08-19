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
} = require("../helpers/harness.js");

// These labels are the app's numeric feedback to the user. The assertions are
// about the computed values, not about styling or markup.
const CENTS = "￠";

test("interval cents labels (relative mode)", async (t) => {
  await t.test("show each interval's size in cents to two decimals", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".cents-label").textContent),
      [`203.91${CENTS}`, `182.40${CENTS}`]
    );
  });

  await t.test("update as the interval is edited", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".interval"), "3/2");
    assert.equal(h.el(".cents-label").textContent, `701.96${CENTS}`);
  });

  await t.test("go blank for an unparseable interval", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".interval"), "oops");
    assert.equal(h.el(".cents-label").textContent, "");
  });

  await t.test("follow the interval type", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    assert.equal(h.el(".cents-label").textContent, `200.00${CENTS}`, "2 steps of 12-EDO");

    const divisions = h.document.getElementById("edo-divisions");
    typeInto(h, divisions, "53");
    assert.equal(h.el(".cents-label").textContent, `203.77${CENTS}`, "9 steps of 53-EDO");
  });
});

test("cumulative cents on note rows (relative mode)", async (t) => {
  await t.test("start at zero and accumulate the intervals below each note", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".cumulative-cents").textContent),
      [`0.00${CENTS}`, `203.91${CENTS}`, `386.31${CENTS}`, `498.04${CENTS}`]
    );
  });

  await t.test("ignore unparseable intervals instead of going blank downstream", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops", "10/9"]);

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".cumulative-cents").textContent),
      [`0.00${CENTS}`, `203.91${CENTS}`, `203.91${CENTS}`, `386.31${CENTS}`]
    );
  });

  await t.test("reach 1200 cents for a scale that spans an octave", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15", "9/8", "10/9", "9/8", "16/15"]);
    assert.equal(noteRows(h).at(-1).querySelector(".cumulative-cents").textContent, `1200.00${CENTS}`);
  });
});

test("absolute mode labels", async (t) => {
  await t.test("note rows show their distance from the base note", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".abs-cents-label").textContent),
      [`0.00${CENTS}`, `203.91${CENTS}`, `386.31${CENTS}`]
    );
  });

  await t.test("interval rows show the step between the notes around them", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);

    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".relative-cents-display").textContent),
      [`203.91${CENTS}`, `182.40${CENTS}`]
    );
  });

  await t.test("both go blank around an unparseable absolute value", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);
    typeInto(h, noteRows(h)[1].querySelector(".absolute-interval"), "oops");

    assert.equal(noteRows(h)[1].querySelector(".abs-cents-label").textContent, "");
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".relative-cents-display").textContent),
      ["", ""]
    );
  });

  await t.test("update as an absolute value is edited", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    typeInto(h, noteRows(h)[1].querySelector(".absolute-interval"), "3/2");

    assert.equal(noteRows(h)[1].querySelector(".abs-cents-label").textContent, `701.96${CENTS}`);
    assert.equal(intervalRows(h)[0].querySelector(".relative-cents-display").textContent, `701.96${CENTS}`);
  });
});
