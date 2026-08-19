"use strict";

const assert = require("node:assert/strict");

const DEFAULT_TOLERANCE = 1e-9;

/** Floating-point comparison for cents/frequency maths. */
function closeTo(actual, expected, tolerance = DEFAULT_TOLERANCE, message) {
  assert.equal(
    typeof actual,
    "number",
    message ? `${message}: expected a number, got ${actual}` : `expected a number, got ${actual}`
  );
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= tolerance,
    `${message ? message + ": " : ""}expected ${actual} to be within ${tolerance} of ${expected} (off by ${delta})`
  );
}

/** Asserts a value is NaN — the app's signal for "unparseable interval". */
function isNaNValue(actual, message) {
  assert.ok(
    typeof actual === "number" && Number.isNaN(actual),
    `${message ? message + ": " : ""}expected NaN, got ${actual}`
  );
}

/**
 * deepEqual for arrays that came out of the jsdom realm.
 *
 * Values created inside the jsdom window have that window's `Array.prototype`,
 * so `assert.deepEqual` from `node:assert/strict` rejects them as
 * "same structure but not reference-equal". Copying into a host-realm array
 * first keeps the strict comparison for the contents.
 */
function equalArray(actual, expected, message) {
  assert.ok(
    actual != null && typeof actual.length === "number",
    `${message ? message + ": " : ""}expected an array-like value, got ${actual}`
  );
  assert.deepEqual(Array.from(actual), expected, message);
}

module.exports = { closeTo, isNaNValue, equalArray, DEFAULT_TOLERANCE };
