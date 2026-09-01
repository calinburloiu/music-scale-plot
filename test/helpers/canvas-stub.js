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

// The ink model. A genus mark and a sign of alteration have no advance, an
// …Above mark raises the modelled ascent and a …Below mark deepens the
// descent, so the stub has the same shape as a real SBMuFL font. See
// docs/TESTING.md §5.
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

// The signs of alteration are cut the same way — zero advance, ink entirely
// above the baseline, so the descent is negative here too. The two geniki are
// drawn a whole em higher than the eight numbered signs, and they are
// *interleaved* with them in the encoding (U+E1F4 and U+E204 close their
// family's block), so membership is explicit rather than a range test.
const ALTERATION_ASCENT_RATIO = 0.68;
const ALTERATION_DESCENT_RATIO = -0.2;
const GENIKI_ASCENT_RATIO = 1.23;
const GENIKI_DESCENT_RATIO = -0.64;

// The strut: the ascent and descent the *face* declares, which decide where a
// line box puts its baseline. Asymmetric, as a real face is — so the baseline
// is not the middle of the line box, which is what ink-centring corrects for.
const FONT_ASCENT_RATIO = 0.775;
const FONT_DESCENT_RATIO = 0.25;

// The three octave blocks of note letters are *drawn at three heights*. A low
// letter and its middle-octave twin have the same outline and the same advance;
// where the ink sits relative to the baseline is the only thing that tells them
// apart, which is why anything that re-centres a letter on its own ink erases
// the register. Measured from Neanes and expressed in em, relative to a middle
// letter: a low letter is the same shape pushed down, a high one is the same
// shape with the octave stroke added on top. Middle is left at the model's base
// ratios, so every measurement not about registers is unchanged.
const LETTER_FIRST = 0xe130;
const LETTER_LAST = 0xe144;
const LETTERS_PER_OCTAVE = 7;
const LOW_REGISTER_DROP_RATIO = 0.53;
const HIGH_REGISTER_RISE_RATIO = 0.18;

const MARK_BELOW_FIRST = 0xe150;
const MARK_BELOW_LAST = 0xe15b;
const MARK_ABOVE_FIRST = 0xe170;
const MARK_ABOVE_LAST = 0xe17b;
const FTHORA_FIRST = 0xe1d0;
const FTHORA_LAST = 0xe1df;
const ALTERATION_FIRST = 0xe1f0;
const ALTERATION_LAST = 0xe20f;

// The carrier a sign with no advance rides into the DOM on — a no-break space.
// Modelled as the face draws it: no ink at all, and a hair of advance (Neanes
// gives its space 0.007em), so a box holding a carried sign measures very
// nearly the same as one holding the sign alone.
const CARRIER_CODE = 0x00a0;
const CARRIER_ADVANCE_RATIO = 0.007;
const GENIKI_CODES = [0xe1f4, 0xe204];

/** 0 low, 1 middle, 2 high — or -1 when the codepoint is not a note letter. */
function letterOctave(code) {
  if (code < LETTER_FIRST || code > LETTER_LAST) return -1;
  return Math.floor((code - LETTER_FIRST) / LETTERS_PER_OCTAVE);
}

function isZeroAdvance(code) {
  if (code >= ALTERATION_FIRST && code <= ALTERATION_LAST) return true;
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
  let left = 0;
  let right = 0;
  // The ink box is the union of the characters', so a glyph whose ink never
  // crosses the baseline keeps its sign instead of being merged into a
  // baseline-straddling default.
  let top = 0;
  let bottom = 0;
  // A carrier contributes advance and no ink, so it cannot seed the box: the
  // first *inked* character does.
  let inked = false;

  chars.forEach(function (ch) {
    const code = ch.codePointAt(0);
    if (code === CARRIER_CODE) {
      pen += size * CARRIER_ADVANCE_RATIO;
      return;
    }
    left = inked ? Math.min(left, pen + size * INK_LEFT_BEARING_RATIO)
                 : pen + size * INK_LEFT_BEARING_RATIO;
    right = Math.max(right, pen + size * (INK_LEFT_BEARING_RATIO + INK_WIDTH_RATIO));

    let charTop = -size * ASCENT_RATIO;
    let charBottom = size * DESCENT_RATIO;
    const octave = letterOctave(code);
    if (code >= FTHORA_FIRST && code <= FTHORA_LAST) {
      charTop = -size * FTHORA_ASCENT_RATIO;
      charBottom = size * FTHORA_DESCENT_RATIO;
    } else if (GENIKI_CODES.includes(code)) {
      charTop = -size * GENIKI_ASCENT_RATIO;
      charBottom = size * GENIKI_DESCENT_RATIO;
    } else if (code >= ALTERATION_FIRST && code <= ALTERATION_LAST) {
      charTop = -size * ALTERATION_ASCENT_RATIO;
      charBottom = size * ALTERATION_DESCENT_RATIO;
    } else if (code >= MARK_ABOVE_FIRST && code <= MARK_ABOVE_LAST) {
      charTop = -size * MARK_ABOVE_ASCENT_RATIO;
    } else if (code >= MARK_BELOW_FIRST && code <= MARK_BELOW_LAST) {
      charBottom = size * MARK_BELOW_DESCENT_RATIO;
    } else if (octave === 0) {
      charTop += size * LOW_REGISTER_DROP_RATIO;
      charBottom += size * LOW_REGISTER_DROP_RATIO;
    } else if (octave === 2) {
      charTop -= size * HIGH_REGISTER_RISE_RATIO;
    }

    if (!inked) {
      top = charTop;
      bottom = charBottom;
    } else {
      top = Math.min(top, charTop);
      bottom = Math.max(bottom, charBottom);
    }
    inked = true;

    if (!isZeroAdvance(code)) pen += size * CHAR_WIDTH_RATIO;
  });

  return {
    width: pen,
    actualBoundingBoxLeft: inked ? -left : 0,
    actualBoundingBoxRight: inked ? right : 0,
    actualBoundingBoxAscent: inked ? -top : 0,
    actualBoundingBoxDescent: inked ? bottom : 0,
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

/**
 * The same measurement as a browser that reports the ink box *unioned with the
 * text's advance rect and its baseline* — which is what WebKit does, and the
 * reason a sign whose ink never crosses the baseline (every fthora and every
 * sign of alteration in this face) measures wrong there: its descent comes back
 * as 0 and its box reaches the full advance.
 *
 * Nothing is invented here. The union is applied to the model's own ink box, so
 * a test can hold the two modes side by side and ask that the app arrive at the
 * same ink either way.
 */
function unionInkWithAdvance(metrics) {
  return Object.assign({}, metrics, {
    actualBoundingBoxLeft: Math.max(metrics.actualBoundingBoxLeft, 0),
    actualBoundingBoxRight: Math.max(metrics.actualBoundingBoxRight, metrics.width),
    actualBoundingBoxAscent: Math.max(metrics.actualBoundingBoxAscent, 0),
    actualBoundingBoxDescent: Math.max(metrics.actualBoundingBoxDescent, 0),
  });
}

class RecordingContext2D {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    // "exact" reports the ink alone; "union" reports it the way WebKit does.
    this.inkMetrics = options.inkMetrics || "exact";
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
    const ink = anchorInk(measureTextInk(text, this.font), this.textAlign, this.textBaseline);
    return this.inkMetrics === "union" ? unionInkWithAdvance(ink) : ink;
  }

  /**
   * A bitmap of what was drawn, so ink measured from pixels can be tested.
   *
   * Only `fillText` leaves ink, and the model says exactly where that ink is,
   * so the region is filled opaque and everything else is left transparent —
   * a real rasteriser's answer without a rasteriser, and without the
   * anti-aliased fringe that would make an assertion approximate.
   */
  getImageData(x, y, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    const clamp = (v, limit) => Math.max(0, Math.min(limit, Math.round(v)));
    const paint = (box, alpha) => {
      for (let row = clamp(box.top, height); row < clamp(box.bottom, height); row++) {
        for (let col = clamp(box.left, width); col < clamp(box.right, width); col++) {
          data[(row * width + col) * 4 + 3] = alpha;
        }
      }
    };

    // Nothing before the last clear of the whole region can still be visible,
    // so replay starts there: one scratch canvas measuring a whole vocabulary
    // would otherwise re-walk every sign it has ever drawn.
    let first = 0;
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const call = this.calls[i];
      if (call.method !== "clearRect") continue;
      const [cx, cy, cw, ch] = call.args;
      if (cx <= x && cy <= y && cx + cw >= x + width && cy + ch >= y + height) {
        first = i;
        break;
      }
    }

    for (const call of this.calls.slice(first)) {
      // Drawing in order, so a surface cleared between two signs shows only the
      // second — which is how one scratch canvas measures a whole vocabulary.
      if (call.method === "clearRect") {
        const [cx, cy, cw, ch] = call.args;
        paint({ left: cx - x, right: cx + cw - x, top: cy - y, bottom: cy + ch - y }, 0);
        continue;
      }
      if (call.method !== "fillText") continue;
      const [text, penX, penY] = call.args;
      const metrics = anchorInk(
        measureTextInk(text, call.state.font),
        call.state.textAlign,
        call.state.textBaseline
      );
      const box = {
        left: penX - metrics.actualBoundingBoxLeft - x,
        right: penX + metrics.actualBoundingBoxRight - x,
        top: penY - metrics.actualBoundingBoxAscent - y,
        bottom: penY + metrics.actualBoundingBoxDescent - y,
      };
      if (text) paint(box, 255);
    }
    return { data, width, height, colorSpace: "srgb" };
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
  ALTERATION_ASCENT_RATIO,
  ALTERATION_DESCENT_RATIO,
  GENIKI_ASCENT_RATIO,
  GENIKI_DESCENT_RATIO,
  FONT_ASCENT_RATIO,
  FONT_DESCENT_RATIO,
  anchorInk,
};
