"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  selectOption,
  typeInto,
  buildRelativeScale,
  intervalRows,
  measureTextWidth,
  setNotation,
  noteRows,
  pickFthora,
} = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

// These tests assert the *geometry* render() computes — sizes, positions and
// draw order — not the appearance of the result. See docs/TESTING.md.

const TONE = 203.91000173077484; // 9/8
const MINOR_TONE = 182.40371213406; // 10/9

test("chart sizing", async (t) => {
  await t.test("is tall enough for the whole stack plus padding", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    const { CANVAS_PADDING, PX_PER_CENT } = h.app;

    const expected = CANVAS_PADDING * 2 + (TONE + MINOR_TONE) * PX_PER_CENT;
    closeTo(parseFloat(h.canvas().style.height), expected, 1e-6);
  });

  await t.test("is wide enough for the boxes and the widest note name", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], { names: ["Pa", "Vou"] });
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const widestText = measureTextWidth("Vou", "24px sans-serif");
    const expected = CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + (widestText + TEXT_MARGIN * 2) + CANVAS_PADDING;
    closeTo(parseFloat(h.canvas().style.width), expected, 1e-6);
  });

  await t.test("grows when a longer note name is typed", () => {
    const h = loadApp();
    t.after(() => h.close());
    const before = parseFloat(h.canvas().style.width);

    typeInto(h, h.el(".note-name"), "a very long note name");

    assert.ok(parseFloat(h.canvas().style.width) > before);
  });

  await t.test("backs the display size with a device-pixel-ratio-scaled bitmap", () => {
    for (const dpr of [1, 2, 3]) {
      const h = loadApp({ devicePixelRatio: dpr });
      const displayHeight = parseFloat(h.canvas().style.height);

      assert.equal(h.canvas().height, Math.round(displayHeight * dpr), `dpr=${dpr}`);
      assert.deepEqual(h.ctx.transform, [dpr, 0, 0, dpr, 0, 0], `dpr=${dpr} transform`);
      h.close();
    }
  });

  await t.test("clears the full drawing area before redrawing", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();
    h.app.render();

    const [clear] = h.ctx.callsOf("clearRect");
    assert.deepEqual(clear.args.slice(0, 2), [0, 0]);
    closeTo(clear.args[2], parseFloat(h.canvas().style.width), 1e-6);
    closeTo(clear.args[3], parseFloat(h.canvas().style.height), 1e-6);
  });
});

test("vertical boxes (the default chart)", async (t) => {
  await t.test("draws one filled, outlined box per interval", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);
    h.ctx.reset();
    h.app.render();

    assert.equal(h.ctx.callsOf("fillRect").length, 3);
    assert.equal(h.ctx.callsOf("strokeRect").length, 3);
    assert.deepEqual(
      h.ctx.callsOf("strokeRect").map((c) => c.state.lineWidth),
      [h.app.BORDER_WIDTH, h.app.BORDER_WIDTH, h.app.BORDER_WIDTH]
    );
  });

  await t.test("gives each box a height proportional to its size in cents", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();
    h.app.render();

    const heights = h.ctx.callsOf("fillRect").map((c) => c.args[3]);
    closeTo(heights[0], TONE * h.app.PX_PER_CENT, 1e-9, "first box drawn");
    closeTo(heights[1], MINOR_TONE * h.app.PX_PER_CENT, 1e-9, "second box drawn");
  });

  await t.test("stacks the boxes upward from the bottom of the chart", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();
    h.app.render();

    const { CANVAS_PADDING } = h.app;
    const rects = h.ctx.callsOf("fillRect").map((c) => c.args);
    const bottomOfFirst = rects[0][1] + rects[0][3];
    closeTo(bottomOfFirst, CANVAS_PADDING + TONE + MINOR_TONE, 1e-6, "the first interval sits on the base line");
    closeTo(rects[1][1] + rects[1][3], rects[0][1], 1e-9, "the second box rests on top of the first");
    closeTo(rects[1][1], CANVAS_PADDING, 1e-6, "the last box reaches the top padding");
  });

  await t.test("aligns every box on the same left edge and width", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();
    h.app.render();

    for (const call of h.ctx.callsOf("fillRect")) {
      assert.equal(call.args[0], h.app.CANVAS_PADDING);
      assert.equal(call.args[2], h.app.RECT_WIDTH);
    }
  });

  await t.test("fills each box with its interval's colour", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"], { colors: ["#FFCCCC", "#CCE5FF"] });
    h.ctx.reset();
    h.app.render();

    assert.deepEqual(
      h.ctx.callsOf("fillRect").map((c) => c.state.fillStyle),
      ["#FFCCCC", "#CCE5FF"]
    );
  });
});

test("horizontal boxes", async (t) => {
  await t.test("lays the intervals out left to right", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    selectOption(h, "orientation", "horizontal");
    h.ctx.reset();
    h.app.render();

    const rects = h.ctx.callsOf("fillRect").map((c) => c.args);
    closeTo(rects[0][0], h.app.CANVAS_PADDING, 1e-9);
    closeTo(rects[0][2], TONE, 1e-9, "width tracks cents");
    closeTo(rects[1][0], rects[0][0] + rects[0][2], 1e-9, "boxes abut");
    closeTo(rects[1][2], MINOR_TONE, 1e-9);
  });

  await t.test("keeps a constant box thickness", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    selectOption(h, "orientation", "horizontal");
    h.ctx.reset();
    h.app.render();

    for (const call of h.ctx.callsOf("fillRect")) {
      assert.equal(call.args[1], h.app.CANVAS_PADDING);
      assert.equal(call.args[3], h.app.RECT_WIDTH);
    }
  });

  await t.test("swaps which canvas dimension carries the stack", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    selectOption(h, "orientation", "horizontal");

    const shortWidth = parseFloat(h.canvas().style.width);
    const shortHeight = parseFloat(h.canvas().style.height);

    buildRelativeScale(h, ["9/8", "10/9", "16/15", "9/8"]);

    assert.ok(
      parseFloat(h.canvas().style.width) > shortWidth,
      "a longer scale needs a wider canvas"
    );
    closeTo(
      parseFloat(h.canvas().style.height),
      shortHeight,
      1e-6,
      "the cross-axis stays a fixed band"
    );
  });
});

test("the line chart style", async (t) => {
  function linesChart(t, orientation) {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    selectOption(h, "chart-style", "lines");
    if (orientation) selectOption(h, "orientation", orientation);
    h.ctx.reset();
    h.app.render();
    return h;
  }

  await t.test("draws no boxes at all", () => {
    const h = linesChart(t);
    assert.equal(h.ctx.callsOf("fillRect").length, 0);
    assert.equal(h.ctx.callsOf("strokeRect").length, 0);
  });

  await t.test("draws one coloured segment per interval plus a tick per note", () => {
    const h = linesChart(t);
    const segments = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.LINE_STYLE_WIDTH);
    const ticks = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.TICK_WIDTH);

    assert.equal(segments.length, 2, "two intervals");
    assert.equal(ticks.length, 3, "three notes bound two intervals");
  });

  await t.test("gives each vertical segment a length proportional to its cents", () => {
    const h = linesChart(t, "vertical");
    const points = h.ctx.calls.filter((c) => ["moveTo", "lineTo"].includes(c.method));
    const [from1, to1, from2, to2] = points.slice(0, 4).map((c) => c.args[1]);

    closeTo(from1 - to1, TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(from2 - to2, MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(to1, from2, 1e-9, "the second segment continues where the first ended");
  });

  await t.test("gives each horizontal segment a length proportional to its cents", () => {
    const h = linesChart(t, "horizontal");
    const points = h.ctx.calls.filter((c) => ["moveTo", "lineTo"].includes(c.method));
    const [from1, to1, from2, to2] = points.slice(0, 4).map((c) => c.args[0]);

    closeTo(to1 - from1, TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(to2 - from2, MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(to1, from2, 1e-9);
  });

  await t.test("keeps the ticks a fixed length, centred on the axis", () => {
    const h = linesChart(t, "vertical");
    const tickPoints = h.ctx.calls.filter(
      (c) => ["moveTo", "lineTo"].includes(c.method) && c.state.lineWidth === h.app.TICK_WIDTH
    );
    assert.equal(tickPoints.length, 6, "three ticks, two points each");
    for (let i = 0; i < tickPoints.length; i += 2) {
      closeTo(tickPoints[i + 1].args[0] - tickPoints[i].args[0], h.app.TICK_LENGTH, 1e-9);
      closeTo(tickPoints[i].args[1], tickPoints[i + 1].args[1], 1e-9, "ticks are perpendicular");
    }
  });

  await t.test("strokes each segment in its interval's colour", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    selectOption(h, "chart-style", "lines");
    // The palette swapped to dark, so pick from the dark palette now.
    const red = h.app.PALETTE_DARK[6];
    const swatch = intervalRows(h)[0].querySelector(".color-swatch");
    swatch.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    intervalRows(h)[0]
      .querySelector(`.color-option[data-color="${red}"]`)
      .dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));

    h.ctx.reset();
    h.app.render();
    const segmentColors = h.ctx
      .callsOf("stroke")
      .filter((c) => c.state.lineWidth === h.app.LINE_STYLE_WIDTH)
      .map((c) => c.state.strokeStyle);
    assert.equal(segmentColors[0], red);
  });
});

test("intervals that cannot be plotted", async (t) => {
  await t.test("skips an unparseable interval and the note pair around it", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops", "10/9"]);
    h.ctx.reset();
    h.app.render();

    assert.equal(h.ctx.callsOf("fillRect").length, 2, "only the two valid intervals are drawn");
  });

  await t.test("skips a zero-width interval", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "1/1"]);
    h.ctx.reset();
    h.app.render();

    assert.equal(h.ctx.callsOf("fillRect").length, 1);
  });

  await t.test("skips a descending interval, which has no height to draw", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "8/9"]);
    h.ctx.reset();
    h.app.render();

    assert.equal(h.ctx.callsOf("fillRect").length, 1);
  });

  await t.test("collapses the canvas when nothing can be plotted", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".interval"), "oops");

    assert.equal(h.canvas().width, 0);
    assert.equal(h.canvas().height, 0);
    assert.equal(parseFloat(h.canvas().style.width) || 0, 0);
    assert.equal(parseFloat(h.canvas().style.height) || 0, 0);
  });

  await t.test("comes back once the interval is valid again", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".interval"), "oops");
    typeInto(h, h.el(".interval"), "3/2");

    assert.ok(h.canvas().height > 0);
    assert.equal(h.ctx.callsOf("fillRect").at(-1).args[3], h.app.intervalToCents("3/2"));
  });
});

test("chart text", async (t) => {
  await t.test("draws the label above the interval's value when both are set", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], { labels: ["major tone"] });
    h.ctx.reset();
    h.app.render();

    assert.deepEqual(h.ctx.drawnText(), ["major tone", "9/8"]);
    const [label, value] = h.ctx.callsOf("fillText");
    assert.ok(label.args[2] < value.args[2], "the label sits above the value");
  });

  await t.test("draws only the interval's value when there is no label", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();
    h.app.render();

    assert.deepEqual(h.ctx.drawnText(), ["9/8"]);
  });

  await t.test("shows the interval derived in absolute mode", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    typeInto(h, h.el(".interval-label"), "some step");
    h.ctx.reset();
    h.app.render();

    assert.deepEqual(h.ctx.drawnText(), ["some step", "9/8"]);
  });

  await t.test("draws each note name once, at the boundary between intervals", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"], { names: ["Pa", "Vou", "Ga"] });
    h.ctx.reset();
    h.app.render();

    const text = h.ctx.drawnText();
    for (const name of ["Pa", "Vou", "Ga"]) {
      assert.equal(text.filter((s) => s === name).length, 1, `${name} drawn once`);
    }
  });

  await t.test("uses the monospace font for interval values and the UI font for names", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], { names: ["Pa", "Vou"] });
    h.ctx.reset();
    h.app.render();

    const byText = Object.fromEntries(h.ctx.callsOf("fillText").map((c) => [c.args[0], c.state.font]));
    assert.match(byText["9/8"], /monospace$/);
    assert.doesNotMatch(byText["Pa"], /monospace$/);
  });
});

test("line chart text", async (t) => {
  function linesChart(t, orientation) {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"], {
      names: ["Pa", "Vou", "Ga"],
      labels: ["major tone", "minor tone"],
    });
    selectOption(h, "chart-style", "lines");
    selectOption(h, "orientation", orientation);
    h.ctx.reset();
    h.app.render();
    return h;
  }

  for (const orientation of ["vertical", "horizontal"]) {
    await t.test(`${orientation}: draws every label, value and note name once`, () => {
      const h = linesChart(t, orientation);
      const text = h.ctx.drawnText();

      for (const expected of ["major tone", "9/8", "minor tone", "10/9", "Pa", "Vou", "Ga"]) {
        assert.equal(text.filter((s) => s === expected).length, 1, `${expected} drawn once`);
      }
    });

    await t.test(`${orientation}: separates the label from the interval value`, () => {
      const h = linesChart(t, orientation);
      const byText = Object.fromEntries(
        h.ctx.callsOf("fillText").map((c) => [c.args[0], { x: c.args[1], y: c.args[2] }])
      );

      assert.notDeepEqual(byText["major tone"], byText["9/8"], "they must not overlap");
      // In both orientations the label is stacked above the interval value.
      assert.ok(
        byText["major tone"].y < byText["9/8"].y,
        "the label sits above the value"
      );
    });

    await t.test(`${orientation}: puts the note names at the interval boundaries`, () => {
      const h = linesChart(t, orientation);
      const byText = Object.fromEntries(
        h.ctx.callsOf("fillText").map((c) => [c.args[0], { x: c.args[1], y: c.args[2] }])
      );
      const axis = orientation === "vertical" ? "y" : "x";
      const step = orientation === "vertical" ? -1 : 1;

      const positions = ["Pa", "Vou", "Ga"].map((n) => byText[n][axis] * step);
      assert.ok(
        positions[0] < positions[1] && positions[1] < positions[2],
        `note names run in scale order, got ${positions}`
      );
    });
  }
});

// --- Byzantine notation -----------------------------------------------------

function byzantineChart(t, symbols, options = {}) {
  const h = loadApp();
  t.after(() => h.close());
  setNotation(h, "byzantine");
  buildRelativeScale(h, options.intervals || ["9/8"]);

  // Symbols are written straight onto the rows rather than picked. These are
  // chart-geometry tests, and each one names the exact arrangement it wants;
  // driving the martyria picker would propagate the ladder over the rest of
  // the scale and overwrite that arrangement. The picker has its own suite.
  noteRows(h).forEach((row, i) => {
    const spec = symbols[i];
    if (!spec) return;
    if (spec.note) {
      h.app.writeMartyria(row, spec.note, spec.genus || h.app.GENUS_NONE, spec.ticks || 0);
    }
    if (spec.fthora) pickFthora(h, row, spec.fthora);
  });

  if (options.style) selectOption(h, "chart-style", options.style);
  if (options.orientation) selectOption(h, "orientation", options.orientation);
  h.ctx.reset();
  h.app.render();
  return h;
}

/** The martyria glyph string the chart should be drawing for one degree. */
function martyriaOf(h, spec) {
  return h.app.resolveMartyriaGlyphs(spec.note, spec.genus || h.app.GENUS_NONE, spec.ticks || 0);
}

function byzFontOf(h) {
  return h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
}

function inkWidth(h, text) {
  const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
  return box.right - box.left;
}

function drawnCall(h, text) {
  const call = h.ctx.callsOf("fillText").find((c) => c.args[0] === text);
  assert.ok(call, `"${text}" was never drawn; drawn: ${JSON.stringify(h.ctx.drawnText())}`);
  return call;
}

/**
 * Every Byzantine sign the chart drew, as an ink rectangle in canvas
 * coordinates. `drawGlyphs` draws at the alphabetic baseline with `textAlign`
 * left, so the pen position plus the ink box *is* the ink's place on the
 * canvas.
 */
function signInkBoxes(h) {
  const font = byzFontOf(h);
  return h.ctx
    .callsOf("fillText")
    .filter((c) => c.state.font === font)
    .map((c) => {
      const box = h.app.inkBox(h.ctx, c.args[0], font);
      return {
        text: c.args[0],
        left: c.args[1] + box.left,
        right: c.args[1] + box.right,
        top: c.args[2] + box.top,
        bottom: c.args[2] + box.bottom,
      };
    });
}

function assertSignsFitTheCanvas(h) {
  const width = parseFloat(h.canvas().style.width);
  const height = parseFloat(h.canvas().style.height);
  const signs = signInkBoxes(h);
  const EPS = 1e-9; // the extreme signs touch the edge exactly

  assert.ok(signs.length > 0, "no Byzantine sign was drawn at all");
  for (const sign of signs) {
    assert.ok(
      sign.left >= -EPS && sign.right <= width + EPS &&
        sign.top >= -EPS && sign.bottom <= height + EPS,
      `ink x [${sign.left}, ${sign.right}] y [${sign.top}, ${sign.bottom}] ` +
        `falls outside the ${width}x${height} canvas`
    );
  }
}

/**
 * The `isByzantine` seam, from the Generic side. Symbols live on the note rows
 * whichever notation is selected, so the guard in `render()` is the only thing
 * keeping them off a Generic chart.
 */
test("Generic notation with symbols set on the rows", async (t) => {
  function withSymbols(t) {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeMartyria(noteRows(h)[1], "midVou", h.app.GENUS_NONE, 0);
    h.ctx.reset();
    h.app.render();
    return h;
  }

  await t.test("draws no Byzantine sign at all", () => {
    const h = withSymbols(t);
    const byzFont = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);

    assert.equal(
      h.ctx.callsOf("fillText").filter((c) => c.state.font === byzFont).length,
      0,
      "nothing may be drawn in the Byzantine font while the notation is Generic"
    );
    assert.deepEqual(
      h.ctx.drawnText().filter((s) => s.charCodeAt(0) >= 0xe000),
      [],
      "no glyph from the font's private use area may reach the canvas either"
    );
  });

  await t.test("sizes the canvas as if the symbols were not there", () => {
    const withSigns = withSymbols(t);

    const plain = loadApp();
    t.after(() => plain.close());
    buildRelativeScale(plain, ["9/8"]);

    assert.equal(withSigns.canvas().style.width, plain.canvas().style.width);
    assert.equal(
      withSigns.canvas().style.height,
      plain.canvas().style.height,
      "a Generic chart must not reserve a gutter, a band or an overhang for signs it never draws"
    );
  });
});

test("Byzantine notation, vertical boxes", async (t) => {
  const PA = { note: "midPa", genus: "alpha" };
  const VOU = { note: "midVou", genus: "legetos" };

  await t.test("draws a martyria for each degree instead of a note name", () => {
    const h = byzantineChart(t, [PA, VOU]);

    const text = h.ctx.drawnText();
    assert.ok(text.includes(martyriaOf(h, PA)), "the first martyria is missing");
    assert.ok(text.includes(martyriaOf(h, VOU)), "the second martyria is missing");
  });

  await t.test("draws nothing for a degree whose wells are empty", () => {
    const h = byzantineChart(t, [PA, {}]);

    assert.deepEqual(
      h.ctx.drawnText().filter((s) => s.charCodeAt(0) >= 0xe000),
      [martyriaOf(h, PA)],
      "an empty well draws nothing, exactly as an empty name does"
    );
  });

  await t.test("draws a martyria carried only by the last degree", () => {
    const h = byzantineChart(t, [{}, VOU]);

    assert.deepEqual(
      h.ctx.drawnText().filter((s) => s.charCodeAt(0) >= 0xe000),
      [martyriaOf(h, VOU)],
      "a martyria on the top degree alone must still be drawn"
    );
    assertSignsFitTheCanvas(h);
  });

  await t.test("ignores the typed note names, which belong to Generic notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".note-name"), "Pa");
    setNotation(h, "byzantine");
    h.ctx.reset();
    h.app.render();

    assert.ok(!h.ctx.drawnText().includes("Pa"), "the name must not be drawn in Byzantine notation");
  });

  await t.test("draws the martyria in Neanes at the Byzantine size", () => {
    const h = byzantineChart(t, [PA, VOU]);

    assert.equal(drawnCall(h, martyriaOf(h, PA)).state.font, byzFontOf(h));
  });

  await t.test("puts the martyria's ink left edge where the note name starts", () => {
    const h = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(
      call.args[1] + box.left,
      CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN,
      1e-6,
      "ink left edge, no fthora so no gutter"
    );
  });

  await t.test("centres the martyria's ink on the separator, not its baseline", () => {
    const h = byzantineChart(t, [PA, VOU]);

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    // Degree 1 sits at the base of the stack, i.e. the bottom edge of the
    // lowest box — wherever the layout has put it.
    const [, boxY, , boxH] = h.ctx.callsOf("fillRect")[0].args;

    closeTo(call.args[2] + (box.top + box.bottom) / 2, boxY + boxH, 1e-6, "ink vertical centre");
  });

  await t.test("opens a left gutter for the fthora and shifts the boxes into it", () => {
    const withFthora = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);
    const without = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = withFthora.app;

    const gutter = inkWidth(withFthora, withFthora.app.resolveFthoraGlyph("diatonicPa")) + TEXT_MARGIN;

    closeTo(
      withFthora.ctx.callsOf("fillRect")[0].args[0],
      CANVAS_PADDING + gutter,
      1e-6,
      "the boxes start clear of the gutter"
    );
    closeTo(
      parseFloat(withFthora.canvas().style.width) - parseFloat(without.canvas().style.width),
      gutter,
      1e-6,
      "the canvas grew by exactly the gutter"
    );
  });

  await t.test("right-aligns the fthora's ink a text margin clear of the boxes", () => {
    const h = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = inkWidth(h, text) + TEXT_MARGIN;

    closeTo(
      call.args[1] + box.right,
      CANVAS_PADDING + gutter - TEXT_MARGIN,
      1e-6,
      "ink right edge"
    );
  });

  await t.test("centres the fthora's ink on the same separator as its martyria", () => {
    const h = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);

    const martyria = drawnCall(h, martyriaOf(h, PA));
    const martyriaBox = h.app.inkBox(h.ctx, martyriaOf(h, PA), byzFontOf(h));
    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthora = drawnCall(h, fthoraText);
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));

    closeTo(
      fthora.args[2] + (fthoraBox.top + fthoraBox.bottom) / 2,
      martyria.args[2] + (martyriaBox.top + martyriaBox.bottom) / 2,
      1e-6,
      "the two signs sit on the same line"
    );
  });

  await t.test("opens no gutter when no degree carries a fthora", () => {
    const h = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    closeTo(h.ctx.callsOf("fillRect")[0].args[0], CANVAS_PADDING, 1e-9);
  });

  await t.test("sizes the canvas from the widest martyria", () => {
    const narrow = byzantineChart(t, [{ note: "midPa" }, { note: "midVou" }]);
    // Above high Κε the ladder marks the extra octave with a tick, and that
    // tick is a second, advancing glyph — so this martyria is the wider one.
    const wide = byzantineChart(t, [{ note: "highKe" }, { note: "highZo", ticks: 1 }]);

    assert.ok(
      parseFloat(wide.canvas().style.width) > parseFloat(narrow.canvas().style.width),
      "the ticked martyria is wider, so the canvas must grow"
    );
  });

  await t.test("keeps every sign's ink inside the canvas", () => {
    assertSignsFitTheCanvas(byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]));
  });

  await t.test("leaves the box geometry, colours and interval labels untouched", () => {
    const h = byzantineChart(t, [PA, VOU], { intervals: ["9/8", "10/9"] });

    const heights = h.ctx.callsOf("fillRect").map((c) => c.args[3]);
    closeTo(heights[0], TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(heights[1], MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
    assert.ok(h.ctx.drawnText().includes("9/8"), "the interval value is still drawn");
  });
});

test("Byzantine notation, vertical lines", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  await t.test("draws the martyria where the note name goes, right of the axis", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines" });
    const { CANVAS_PADDING, TEXT_MARGIN, TICK_LENGTH } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    const gutter = inkWidth(h, h.app.resolveFthoraGlyph("diatonicPa")) + TEXT_MARGIN;
    const maxIntervalTextWidth = measureTextWidth("9/8", '21px "SF Mono", monospace');
    const axisCenterX = CANVAS_PADDING + gutter + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH / 2;

    closeTo(
      call.args[1] + box.left,
      axisCenterX + TICK_LENGTH / 2 + TEXT_MARGIN,
      1e-6,
      "ink left edge, clear of the tick"
    );
  });

  await t.test("shifts the axis right by the fthora gutter", () => {
    const withFthora = byzantineChart(t, [PA, VOU], { style: "lines" });
    const without = byzantineChart(t, [{ note: "midPa", genus: "alpha" }, VOU], { style: "lines" });
    const gutter =
      inkWidth(withFthora, withFthora.app.resolveFthoraGlyph("diatonicPa")) + withFthora.app.TEXT_MARGIN;

    const axisOf = (h) =>
      h.ctx.calls.find((c) => c.method === "moveTo" && c.state.lineWidth === h.app.LINE_STYLE_WIDTH).args[0];

    closeTo(axisOf(withFthora) - axisOf(without), gutter, 1e-6);
  });

  await t.test("right-aligns the fthora's ink at the edge of the gutter", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines" });
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(call.args[1] + box.right, CANVAS_PADDING + inkWidth(h, text), 1e-6, "ink right edge");
  });

  await t.test("keeps every sign's ink inside the canvas", () => {
    assertSignsFitTheCanvas(byzantineChart(t, [PA, VOU], { style: "lines" }));
  });

  await t.test("still draws one coloured segment per interval and a tick per note", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines", intervals: ["9/8", "10/9"] });

    const segments = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.LINE_STYLE_WIDTH);
    const ticks = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.TICK_WIDTH);
    assert.equal(segments.length, 2);
    assert.equal(ticks.length, 3);
  });
});

test("Byzantine notation, horizontal boxes", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  function chart(t, symbols) {
    return byzantineChart(t, symbols, { orientation: "horizontal" });
  }

  await t.test("draws each martyria below the boxes, centred on its separator", () => {
    const h = chart(t, [PA, VOU]);

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    // Degree 1 sits at the start of the stack, i.e. the left edge of the
    // first box — wherever the layout has put it.
    const boxX = h.ctx.callsOf("fillRect")[0].args[0];

    closeTo(
      call.args[1] + (box.left + box.right) / 2,
      boxX,
      1e-6,
      "the first separator is the left edge of the first box"
    );
  });

  await t.test("puts the martyria's ink top edge where the note text band starts", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));
    const gutter = fthoraBox.bottom - fthoraBox.top + TEXT_MARGIN;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(
      call.args[2] + box.top,
      CANVAS_PADDING + gutter + RECT_WIDTH + TEXT_MARGIN,
      1e-6,
      "ink top edge"
    );
  });

  await t.test("opens a top gutter for the fthora and pushes the boxes down into it", () => {
    const withFthora = chart(t, [PA, VOU]);
    const without = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = withFthora.app;

    const fthoraText = withFthora.app.resolveFthoraGlyph("diatonicPa");
    const box = withFthora.app.inkBox(withFthora.ctx, fthoraText, byzFontOf(withFthora));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(
      withFthora.ctx.callsOf("fillRect")[0].args[1],
      CANVAS_PADDING + gutter,
      1e-6,
      "the boxes start below the gutter"
    );
    closeTo(
      parseFloat(withFthora.canvas().style.height) - parseFloat(without.canvas().style.height),
      gutter,
      1e-6,
      "the canvas grew by exactly the gutter"
    );
  });

  await t.test("bottom-aligns the fthora's ink a text margin clear of the boxes", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(call.args[2] + box.bottom, CANVAS_PADDING + gutter - TEXT_MARGIN, 1e-6, "ink bottom edge");
  });

  await t.test("centres the fthora over the same separator as its martyria", () => {
    const h = chart(t, [PA, VOU]);

    const martyriaText = martyriaOf(h, PA);
    const martyria = drawnCall(h, martyriaText);
    const martyriaBox = h.app.inkBox(h.ctx, martyriaText, byzFontOf(h));
    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthora = drawnCall(h, fthoraText);
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));

    closeTo(
      fthora.args[1] + (fthoraBox.left + fthoraBox.right) / 2,
      martyria.args[1] + (martyriaBox.left + martyriaBox.right) / 2,
      1e-6,
      "the two signs sit on the same vertical"
    );
  });

  await t.test("sizes the note band from the martyria's ink, not the 28px name band", () => {
    const h = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const tallest = Math.max(
      ...[martyriaOf(h, { note: "midPa", genus: "alpha" }), martyriaOf(h, VOU)].map((text) => {
        const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
        return box.bottom - box.top;
      })
    );

    closeTo(
      parseFloat(h.canvas().style.height),
      CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + (tallest + TEXT_MARGIN * 2) + CANVAS_PADDING,
      1e-6
    );
  });

  await t.test("keeps every sign's ink inside the canvas", () => {
    assertSignsFitTheCanvas(chart(t, [PA, VOU]));
  });

  await t.test("leaves the box geometry untouched", () => {
    const h = byzantineChart(t, [PA, VOU], {
      orientation: "horizontal",
      intervals: ["9/8", "10/9"],
    });

    const widths = h.ctx.callsOf("fillRect").map((c) => c.args[2]);
    closeTo(widths[0], TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(widths[1], MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
  });
});

test("Byzantine notation, horizontal lines", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  function chart(t, symbols) {
    return byzantineChart(t, symbols, { orientation: "horizontal", style: "lines" });
  }

  await t.test("draws the martyria below the tick, centred on the separator", () => {
    const h = chart(t, [PA, VOU]);
    const { TICK_WIDTH } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    const firstTickX = h.ctx.calls.find(
      (c) => c.method === "moveTo" && c.state.lineWidth === TICK_WIDTH
    ).args[0];

    closeTo(call.args[1] + (box.left + box.right) / 2, firstTickX, 1e-6, "ink centred on the tick");
  });

  await t.test("shifts the axis down by the fthora gutter", () => {
    const withFthora = chart(t, [PA, VOU]);
    const without = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);

    const box = withFthora.app.inkBox(
      withFthora.ctx,
      withFthora.app.resolveFthoraGlyph("diatonicPa"),
      byzFontOf(withFthora)
    );
    const gutter = box.bottom - box.top + withFthora.app.TEXT_MARGIN;

    const axisOf = (h) =>
      h.ctx.calls.find((c) => c.method === "moveTo" && c.state.lineWidth === h.app.LINE_STYLE_WIDTH).args[1];

    closeTo(axisOf(withFthora) - axisOf(without), gutter, 1e-6);
  });

  await t.test("moves the interval text down with the axis, clear of the gutter", () => {
    const withFthora = chart(t, [PA, VOU]);
    const without = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);

    const box = withFthora.app.inkBox(
      withFthora.ctx,
      withFthora.app.resolveFthoraGlyph("diatonicPa"),
      byzFontOf(withFthora)
    );
    const gutter = box.bottom - box.top + withFthora.app.TEXT_MARGIN;

    const valueY = (h) => drawnCall(h, "9/8").args[2];

    closeTo(
      valueY(withFthora) - valueY(without),
      gutter,
      1e-6,
      "the interval text must clear the gutter, or the fthora is drawn through it"
    );
  });

  await t.test("bottom-aligns the fthora above the axis", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(call.args[2] + box.bottom, CANVAS_PADDING + gutter - TEXT_MARGIN, 1e-6, "ink bottom edge");
  });

  await t.test("makes the side padding half the widest martyria", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    const widest = Math.max(
      ...[martyriaOf(h, PA), martyriaOf(h, VOU)].map((text) => inkWidth(h, text))
    );
    const firstTickX = h.ctx.calls.find(
      (c) => c.method === "moveTo" && c.state.lineWidth === h.app.TICK_WIDTH
    ).args[0];

    closeTo(firstTickX, CANVAS_PADDING + widest / 2, 1e-6, "the axis starts half a martyria in");
  });

  await t.test("sizes that padding from the fthora when no degree carries a martyria", () => {
    const h = chart(t, [{ fthora: "diatonicPa" }, {}]);
    const { CANVAS_PADDING } = h.app;

    const fthoraInk = inkWidth(h, h.app.resolveFthoraGlyph("diatonicPa"));
    const firstTickX = h.ctx.calls.find(
      (c) => c.method === "moveTo" && c.state.lineWidth === h.app.TICK_WIDTH
    ).args[0];

    closeTo(
      firstTickX,
      CANVAS_PADDING + fthoraInk / 2,
      1e-6,
      "with no martyria in the scale the fthora's own ink must set the side padding"
    );
  });

  await t.test("keeps a lone fthora's ink out of the canvas padding", () => {
    const h = chart(t, [{ fthora: "diatonicPa" }, {}]);
    const { CANVAS_PADDING } = h.app;
    const width = parseFloat(h.canvas().style.width);
    const signs = signInkBoxes(h);

    assert.ok(signs.length > 0, "no Byzantine sign was drawn at all");
    for (const sign of signs) {
      assert.ok(
        sign.left >= CANVAS_PADDING - 1e-9 && sign.right <= width - CANVAS_PADDING + 1e-9,
        `ink x [${sign.left}, ${sign.right}] eats into the ${CANVAS_PADDING}px side padding ` +
          `of a ${width}px canvas; a wider fthora would fall off the edge`
      );
    }
  });

  await t.test("keeps every sign's ink inside the canvas", () => {
    assertSignsFitTheCanvas(chart(t, [PA, VOU]));
  });

  await t.test("draws every martyria exactly once", () => {
    const h = byzantineChart(
      t,
      [PA, VOU, { note: "midGa", genus: "nana" }],
      { orientation: "horizontal", style: "lines", intervals: ["9/8", "10/9"] }
    );

    const text = h.ctx.drawnText();
    for (const spec of [PA, VOU, { note: "midGa", genus: "nana" }]) {
      const glyphs = martyriaOf(h, spec);
      assert.equal(text.filter((s) => s === glyphs).length, 1, `${spec.note} drawn once`);
    }
  });
});

test("the Byzantine note band", async (t) => {
  await t.test("reserves no band when no degree carries a martyria", () => {
    const h = byzantineChart(t, [{}, {}], { orientation: "horizontal" });
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    closeTo(
      parseFloat(h.canvas().style.height),
      CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + TEXT_MARGIN * 2 + CANVAS_PADDING,
      1e-6,
      "the canvas must not grow a note band for a scale that has no martyria"
    );
  });

  await t.test("never shrinks the band below the generic name band", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { NOTE_TEXT_HEIGHT, byzantineNoteBandHeight } = h.app;

    assert.equal(
      byzantineNoteBandHeight(NOTE_TEXT_HEIGHT - 10),
      NOTE_TEXT_HEIGHT,
      "a martyria shorter than the name band still gets the whole band"
    );
    assert.equal(
      byzantineNoteBandHeight(NOTE_TEXT_HEIGHT + 10),
      NOTE_TEXT_HEIGHT + 10,
      "a taller martyria sizes the band from its own ink"
    );
    assert.equal(byzantineNoteBandHeight(0), 0, "no martyria, no band");
  });
});
