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

// A fthora is cut to ride above a neume, so its ink clears the baseline
// outright: the descent is *negative*, the whole glyph sitting between about
// -1.1em and -0.65em. Nothing else in the model has ink on one side of the
// baseline only, and it is the case ink-centring exists for.
const FTHORA_ASCENT_RATIO = 1.1;
const FTHORA_DESCENT_RATIO = -0.65;

// The strut: the ascent and descent the *face* declares, which decide where a
// line box puts its baseline. Asymmetric, as a real face is — so the baseline
// is not the middle of the line box, which is what ink-centring corrects for.
const FONT_ASCENT_RATIO = 0.775;
const FONT_DESCENT_RATIO = 0.25;

const MARK_BELOW_FIRST = 0xe150;
const MARK_BELOW_LAST = 0xe15b;
const MARK_ABOVE_FIRST = 0xe170;
const MARK_ABOVE_LAST = 0xe17b;
const FTHORA_FIRST = 0xe1d0;
const FTHORA_LAST = 0xe1df;

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
  // The ink box is the union of the characters', so a glyph whose ink never
  // crosses the baseline keeps its sign instead of being merged into a
  // baseline-straddling default.
  let top = 0;
  let bottom = 0;

  chars.forEach(function (ch, index) {
    const code = ch.codePointAt(0);
    right = Math.max(right, pen + size * (INK_LEFT_BEARING_RATIO + INK_WIDTH_RATIO));

    let charTop = -size * ASCENT_RATIO;
    let charBottom = size * DESCENT_RATIO;
    if (code >= FTHORA_FIRST && code <= FTHORA_LAST) {
      charTop = -size * FTHORA_ASCENT_RATIO;
      charBottom = size * FTHORA_DESCENT_RATIO;
    } else if (code >= MARK_ABOVE_FIRST && code <= MARK_ABOVE_LAST) {
      charTop = -size * MARK_ABOVE_ASCENT_RATIO;
    } else if (code >= MARK_BELOW_FIRST && code <= MARK_BELOW_LAST) {
      charBottom = size * MARK_BELOW_DESCENT_RATIO;
    }

    if (index === 0) {
      top = charTop;
      bottom = charBottom;
    } else {
      top = Math.min(top, charTop);
      bottom = Math.max(bottom, charBottom);
    }

    if (!isZeroAdvance(code)) pen += size * CHAR_WIDTH_RATIO;
  });

  return {
    width: pen,
    actualBoundingBoxLeft: chars.length ? -size * INK_LEFT_BEARING_RATIO : 0,
    actualBoundingBoxRight: right,
    actualBoundingBoxAscent: chars.length ? -top : 0,
    actualBoundingBoxDescent: chars.length ? bottom : 0,
    // Font metrics, not ink: they belong to the face, so they are reported for
    // the empty string too, exactly as a browser reports them.
    fontBoundingBoxAscent: size * FONT_ASCENT_RATIO,
    fontBoundingBoxDescent: size * FONT_DESCENT_RATIO,
  };
}

/**
 * The same ink box, reported from the anchor `textAlign` and `textBaseline`
 * choose — which is what a real canvas does, and what a caller that forgets to
 * pin them trips over. `actualBoundingBoxLeft` is the distance *leftwards*
 * from the anchor, so aligning right moves it by a whole advance; the vertical
 * pair shifts with the baseline in the same way.
 *
 * Modelled, like the rest of this file: "middle" is taken as the middle of the
 * em box, which is close to but not identical to what a browser computes.
 */
function anchorInk(metrics, textAlign, textBaseline) {
  let anchorX = 0;
  if (textAlign === "right" || textAlign === "end") anchorX = metrics.width;
  else if (textAlign === "center") anchorX = metrics.width / 2;

  let anchorY = 0;
  if (textBaseline === "top" || textBaseline === "hanging") {
    anchorY = -metrics.fontBoundingBoxAscent;
  } else if (textBaseline === "middle") {
    anchorY = -(metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
  } else if (textBaseline === "bottom" || textBaseline === "ideographic") {
    anchorY = metrics.fontBoundingBoxDescent;
  }

  // Back to pen-relative edges, then out again relative to the anchor.
  const inkLeft = -metrics.actualBoundingBoxLeft;
  const inkRight = metrics.actualBoundingBoxRight;
  const inkTop = -metrics.actualBoundingBoxAscent;
  const inkBottom = metrics.actualBoundingBoxDescent;

  return Object.assign({}, metrics, {
    actualBoundingBoxLeft: anchorX - inkLeft,
    actualBoundingBoxRight: inkRight - anchorX,
    actualBoundingBoxAscent: anchorY - inkTop,
    actualBoundingBoxDescent: inkBottom - anchorY,
  });
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
    return anchorInk(measureTextInk(text, this.font), this.textAlign, this.textBaseline);
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
  FTHORA_ASCENT_RATIO,
  FTHORA_DESCENT_RATIO,
  FONT_ASCENT_RATIO,
  FONT_DESCENT_RATIO,
  anchorInk,
};
