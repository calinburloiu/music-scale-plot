"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, selectOption } = require("../helpers/harness.js");
const { equalArray } = require("../helpers/assertions.js");

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

test("relativeToAbsoluteStrings", async (t) => {
  await t.test("accumulates ratios from the unison", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    equalArray(h.app.relativeToAbsoluteStrings(["9/8", "10/9", "16/15"]), [
      "1/1",
      "9/8",
      "5/4",
      "4/3",
    ]);
  });

  await t.test("returns n+1 absolutes for n relative intervals", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    assert.equal(h.app.relativeToAbsoluteStrings([]).length, 1);
    assert.equal(h.app.relativeToAbsoluteStrings(["9/8", "9/8"]).length, 3);
  });

  await t.test("treats an unparseable ratio as the unison, so later notes still stack", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    equalArray(h.app.relativeToAbsoluteStrings(["9/8", "oops", "10/9"]), [
      "1/1",
      "9/8",
      "9/8",
      "5/4",
    ]);
  });

  await t.test("accumulates edo steps", () => {
    const h = appWith("edo", 12);
    t.after(() => h.close());
    equalArray(h.app.relativeToAbsoluteStrings(["2", "2", "1"]), ["0", "2", "4", "5"]);
  });

  await t.test("accumulates cents with two decimals", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    equalArray(h.app.relativeToAbsoluteStrings(["203.91", "182.40"]), ["0", "203.91", "386.31"]);
  });
});

test("absoluteToRelativeStrings", async (t) => {
  await t.test("divides successive ratios", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    equalArray(h.app.absoluteToRelativeStrings(["1/1", "9/8", "5/4", "4/3"]), [
      "9/8",
      "10/9",
      "16/15",
    ]);
  });

  await t.test("returns n-1 relative intervals for n absolutes", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    assert.equal(h.app.absoluteToRelativeStrings(["1/1"]).length, 0);
    assert.equal(h.app.absoluteToRelativeStrings(["1/1", "9/8", "5/4"]).length, 2);
  });

  await t.test("subtracts edo steps", () => {
    const h = appWith("edo", 12);
    t.after(() => h.close());
    equalArray(h.app.absoluteToRelativeStrings(["0", "2", "4", "5"]), ["2", "2", "1"]);
  });

  await t.test("subtracts cents with two decimals", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    equalArray(h.app.absoluteToRelativeStrings(["0", "203.91", "386.31"]), ["203.91", "182.40"]);
  });
});

test("relative and absolute representations round-trip", async (t) => {
  await t.test("ratios survive a round trip exactly", () => {
    const h = appWith("ratio");
    t.after(() => h.close());
    const relative = ["9/8", "10/9", "16/15", "9/8"];
    const absolute = h.app.relativeToAbsoluteStrings(relative);
    equalArray(h.app.absoluteToRelativeStrings(absolute), relative);
  });

  await t.test("edo steps survive a round trip exactly", () => {
    const h = appWith("edo", 53);
    t.after(() => h.close());
    const relative = ["9", "8", "5", "9"];
    const absolute = h.app.relativeToAbsoluteStrings(relative);
    equalArray(h.app.absoluteToRelativeStrings(absolute), relative);
  });

  await t.test("cents survive a round trip at two-decimal precision", () => {
    const h = appWith("cents");
    t.after(() => h.close());
    const relative = ["203.91", "182.40", "111.73"];
    const absolute = h.app.relativeToAbsoluteStrings(relative);
    equalArray(h.app.absoluteToRelativeStrings(absolute), relative);
  });
});
