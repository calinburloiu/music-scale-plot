"use strict";

/**
 * A recording stand-in for CanvasRenderingContext2D.
 *
 * jsdom ships no canvas implementation, and the tests are not interested in
 * pixels anyway. What matters is the *geometry* the app computes: how many
 * shapes it draws, where, how big, and in which colour. This stub records
 * every drawing call together with a snapshot of the drawing state that was
 * active at the time, so tests can assert on that geometry as data.
 *
 * `measureText` uses a deterministic model instead of real font metrics:
 *
 *     width = text.length * fontSizeInPx * CHAR_WIDTH_RATIO
 *
 * The font size is parsed out of `ctx.font`, so the 24px UI font and the 21px
 * monospace font measure differently, exactly as they do in a browser. Tests
 * that need an expected canvas size compute it with `measureTextWidth()`
 * rather than hard-coding numbers.
 */

const CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_FONT_SIZE = 10;

// The ink model. A genus mark has no advance, an …Above mark raises the
// modelled ascent and a …Below mark deepens the descent, so the stub has the
// same shape as a real SBMuFL font. See docs/TESTING.md §5.
const INK_LEFT_BEARING_RATIO = 0.05;
const INK_WIDTH_RATIO = 0.6;
const ASCENT_RATIO = 0.75;
const DESCENT_RATIO = 0.2;
const MARK_ABOVE_ASCENT_RATIO = 1.15;
const MARK_BELOW_DESCENT_RATIO = 0.6;

const MARK_BELOW_FIRST = 0xe150;
const MARK_BELOW_LAST = 0xe15b;
const MARK_ABOVE_FIRST = 0xe170;
const MARK_ABOVE_LAST = 0xe17b;

function isZeroAdvance(code) {
  return code >= MARK_BELOW_FIRST && code <= MARK_ABOVE_LAST;
}

const RECORDED_STATE = [
  "font",
  "fillStyle",
  "strokeStyle",
  "lineWidth",
  "textAlign",
  "textBaseline",
];

function fontSizeOf(font) {
  const size = parseFloat(font);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_FONT_SIZE;
}

/** The full measurement model, exposed so tests can predict layout maths. */
function measureTextInk(text, font) {
  const size = fontSizeOf(font);
  const chars = [...String(text)];

  let pen = 0;
  let right = 0;
  let ascent = size * ASCENT_RATIO;
  let descent = size * DESCENT_RATIO;

  for (const ch of chars) {
    const code = ch.codePointAt(0);
    right = Math.max(right, pen + size * (INK_LEFT_BEARING_RATIO + INK_WIDTH_RATIO));
    if (code >= MARK_ABOVE_FIRST && code <= MARK_ABOVE_LAST) {
      ascent = Math.max(ascent, size * MARK_ABOVE_ASCENT_RATIO);
    } else if (code >= MARK_BELOW_FIRST && code <= MARK_BELOW_LAST) {
      descent = Math.max(descent, size * MARK_BELOW_DESCENT_RATIO);
    }
    if (!isZeroAdvance(code)) pen += size * CHAR_WIDTH_RATIO;
  }

  return {
    width: pen,
    actualBoundingBoxLeft: chars.length ? -size * INK_LEFT_BEARING_RATIO : 0,
    actualBoundingBoxRight: right,
    actualBoundingBoxAscent: chars.length ? ascent : 0,
    actualBoundingBoxDescent: chars.length ? descent : 0,
  };
}

/** Advance width only — what the app's non-Byzantine measurement uses. */
function measureTextWidth(text, font) {
  return measureTextInk(text, font).width;
}

class RecordingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.calls = [];
    this.font = "10px sans-serif";
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this.textAlign = "start";
    this.textBaseline = "alphabetic";
    this.transform = null;

    for (const method of [
      "beginPath",
      "moveTo",
      "lineTo",
      "stroke",
      "fill",
      "closePath",
      "save",
      "restore",
      "clearRect",
      "fillRect",
      "strokeRect",
      "fillText",
      "strokeText",
    ]) {
      this[method] = (...args) => this.#record(method, args);
    }
  }

  #record(method, args) {
    const state = {};
    for (const key of RECORDED_STATE) state[key] = this[key];
    this.calls.push({ method, args, state });
  }

  setTransform(a, b, c, d, e, f) {
    this.transform = [a, b, c, d, e, f];
    this.#record("setTransform", [a, b, c, d, e, f]);
  }

  measureText(text) {
    return measureTextInk(text, this.font);
  }

  /** All recorded calls to `method`, in draw order. */
  callsOf(method) {
    return this.calls.filter((call) => call.method === method);
  }

  /** Every string passed to `fillText`, in draw order. */
  drawnText() {
    return this.callsOf("fillText").map((call) => call.args[0]);
  }

  reset() {
    this.calls.length = 0;
  }
}

module.exports = {
  RecordingContext2D,
  measureTextWidth,
  measureTextInk,
  CHAR_WIDTH_RATIO,
  INK_LEFT_BEARING_RATIO,
  INK_WIDTH_RATIO,
  ASCENT_RATIO,
  DESCENT_RATIO,
  MARK_ABOVE_ASCENT_RATIO,
  MARK_BELOW_DESCENT_RATIO,
};
