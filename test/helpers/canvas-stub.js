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

/** The measurement model, exposed so tests can predict layout maths. */
function measureTextWidth(text, font) {
  return String(text).length * fontSizeOf(font) * CHAR_WIDTH_RATIO;
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
    return { width: measureTextWidth(text, this.font) };
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

module.exports = { RecordingContext2D, measureTextWidth, CHAR_WIDTH_RATIO };
