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
  pickAlteration,
  pickFthora,
} = require("../helpers/harness.js");
const { closeTo, equalArray } = require("../helpers/assertions.js");

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

  // The martyria alone is written straight onto the row rather than picked:
  // these are chart-geometry tests, each naming the exact arrangement it
  // wants, and applying a martyria propagates the ladder over the rest of the
  // scale and overwrites that arrangement. The two single-value wells carry no
  // such side effect, so they go through their pickers like a user would.
  noteRows(h).forEach((row, i) => {
    const spec = symbols[i];
    if (!spec) return;
    if (spec.note) {
      h.app.writeMartyria(row, spec.note, spec.genus || h.app.GENUS_NONE, spec.ticks || 0);
    }
    if (spec.alteration) pickAlteration(h, row, spec.alteration);
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
function signInkBoxes(h, font = byzFontOf(h)) {
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

function assertSignsFitTheCanvas(h, font = byzFontOf(h)) {
  const width = parseFloat(h.canvas().style.width);
  const height = parseFloat(h.canvas().style.height);
  const signs = signInkBoxes(h, font);
  const EPS = 1e-9; // the extreme signs touch the edge exactly

  assert.ok(signs.length > 0, `no sign was drawn at all in ${font}`);
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

// The four chart shapes, so a run's geometry is checked in each of them
// rather than in whichever one happened to be convenient.
// `horizontal` also says how the gutter is anchored: a horizontal chart's
// gutter runs along the top, so a run is bottom-anchored there and centred on
// the separator; a vertical chart's runs down the left, so it is right-anchored
// and ink-centred on the separator instead.
const CHART_SHAPES = [
  { name: "vertical boxes", horizontal: false, options: {} },
  { name: "horizontal boxes", horizontal: true, options: { orientation: "horizontal" } },
  { name: "vertical lines", horizontal: false, options: { style: "lines" } },
  {
    name: "horizontal lines",
    horizontal: true,
    options: { style: "lines", orientation: "horizontal" },
  },
];

test("laying out a run of signs", async (t) => {
  await t.test("measures a lone sign as its own ink", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);
    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const box = h.app.inkBox(h.ctx, text, font);

    const extent = h.app.glyphRunExtent([text], font);
    closeTo(extent.width, box.right - box.left, 1e-9);
    closeTo(extent.height, box.bottom - box.top, 1e-9);
  });

  await t.test("sums the parts' ink and one gap between them", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);
    const parts = [h.app.resolveAlterationGlyph("diesis4"), h.app.resolveFthoraGlyph("diatonicPa")];

    const expected = parts
      .map((text) => {
        const box = h.app.inkBox(h.ctx, text, font);
        return box.right - box.left;
      })
      .reduce((a, b) => a + b);

    closeTo(h.app.glyphRunExtent(parts, font).width, expected + h.app.BYZ_SIGN_GAP, 1e-9);
  });

  await t.test("never measures the advance, which is zero for every alteration", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);

    const text = h.app.resolveAlterationGlyph("diesis4");
    assert.equal(h.app.inkBox(h.ctx, text, font).adv, 0, "the model must give it no advance");
    assert.ok(
      h.app.glyphRunExtent([text], font).width > 0,
      "measuring the advance would give a zero-wide run and collapse the gutter"
    );
  });

  await t.test("takes its height from the tallest part", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);
    const alteration = h.app.resolveAlterationGlyph("diesisGeniki");
    const fthora = h.app.resolveFthoraGlyph("diatonicPa");

    const heights = [alteration, fthora].map((text) => {
      const box = h.app.inkBox(h.ctx, text, font);
      return box.bottom - box.top;
    });

    closeTo(h.app.glyphRunExtent([alteration, fthora], font).height, Math.max(...heights), 1e-9);
  });

  await t.test("skips the empty parts, so a lone sign gets no gap", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);
    const text = h.app.resolveFthoraGlyph("diatonicPa");

    closeTo(
      h.app.glyphRunExtent(["", text], font).width,
      h.app.glyphRunExtent([text], font).width,
      1e-9
    );
    closeTo(h.app.glyphRunExtent([], font).width, 0, 1e-9);
    closeTo(h.app.glyphRunExtent([], font).height, 0, 1e-9);
  });

  await t.test("takes the widest and tallest run, degree by degree", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = byzFontOf(h);
    const alteration = h.app.resolveAlterationGlyph("diesis4");
    const fthora = h.app.resolveFthoraGlyph("diatonicPa");

    const spread = h.app.maxRunExtent([[alteration], [fthora]], font);
    const paired = h.app.maxRunExtent([[alteration, fthora]], font);

    closeTo(
      spread.width,
      Math.max(
        h.app.glyphRunExtent([alteration], font).width,
        h.app.glyphRunExtent([fthora], font).width
      ),
      1e-9,
      "two degrees carrying one sign each never make a pair"
    );
    assert.ok(paired.width > spread.width, "a degree carrying both is the wider run");
  });
});

test("alterations on the chart", async (t) => {
  const PAIR = { note: "midPa", genus: "alpha", alteration: "diesis4", fthora: "diatonicPa" };
  const VOU = { note: "midVou" };

  /** The ink rectangle of one drawn sign, in canvas coordinates. */
  function inkOf(h, text) {
    return signInkBoxes(h).find((sign) => sign.text === text);
  }

  for (const shape of CHART_SHAPES) {
    await t.test(`draws the alteration left of the fthora in ${shape.name}`, () => {
      const h = byzantineChart(t, [PAIR, VOU], shape.options);
      const alteration = inkOf(h, h.app.resolveAlterationGlyph("diesis4"));
      const fthora = inkOf(h, h.app.resolveFthoraGlyph("diatonicPa"));

      assert.ok(alteration, "the alteration was never drawn");
      assert.ok(fthora, "the fthora was never drawn");
      closeTo(
        fthora.left - alteration.right,
        h.app.BYZ_SIGN_GAP,
        1e-6,
        "the pair must read as one unit, one gap apart"
      );
    });

    await t.test(`draws the alteration before the fthora in ${shape.name}`, () => {
      const h = byzantineChart(t, [PAIR, VOU], shape.options);
      const drawn = h.ctx.drawnText();

      assert.ok(drawn.includes(h.app.resolveAlterationGlyph("diesis4")), "no alteration was drawn");
      assert.ok(drawn.includes(h.app.resolveFthoraGlyph("diatonicPa")), "no fthora was drawn");
      assert.ok(
        drawn.indexOf(h.app.resolveAlterationGlyph("diesis4")) <
          drawn.indexOf(h.app.resolveFthoraGlyph("diatonicPa")),
        "an alteration qualifies the fthora after it, so it is drawn first"
      );
    });

    await t.test(`anchors a lone alteration at the gutter's inner edge in ${shape.name}`, () => {
      const h = byzantineChart(t, [{ ...VOU, alteration: "diesis4" }, VOU], shape.options);
      const { CANVAS_PADDING } = h.app;

      const text = h.app.resolveAlterationGlyph("diesis4");
      const run = h.app.glyphRunExtent([text], byzFontOf(h));
      const inner = CANVAS_PADDING + (shape.horizontal ? run.height : run.width);
      const sign = inkOf(h, text);

      // Exactly where a lone fthora sits: a well the user filled must draw its
      // sign in the fthora's place, not somewhere of its own.
      if (shape.horizontal) closeTo(sign.bottom, inner, 1e-6, "ink bottom edge");
      else closeTo(sign.right, inner, 1e-6, "ink right edge");
    });

    await t.test(`lines a lone alteration up with its own martyria in ${shape.name}`, () => {
      const spec = { ...VOU, alteration: "diesis4" };
      const h = byzantineChart(t, [spec, VOU], shape.options);

      const sign = inkOf(h, h.app.resolveAlterationGlyph("diesis4"));
      const martyria = inkOf(h, martyriaOf(h, spec));

      if (shape.horizontal) {
        closeTo(
          (sign.left + sign.right) / 2,
          (martyria.left + martyria.right) / 2,
          1e-6,
          "both are centred on the same separator"
        );
      } else {
        closeTo(
          (sign.top + sign.bottom) / 2,
          (martyria.top + martyria.bottom) / 2,
          1e-6,
          "both are ink-centred on the same separator"
        );
      }
    });

    await t.test(`keeps every sign's ink inside the canvas in ${shape.name}`, () => {
      assertSignsFitTheCanvas(byzantineChart(t, [PAIR, VOU], shape.options));
    });
  }

  await t.test("sizes the left gutter from the widest run, not the widest fthora", () => {
    const paired = byzantineChart(t, [PAIR, VOU]);
    const fthoraOnly = byzantineChart(t, [{ ...PAIR, alteration: "" }, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = paired.app;

    const run = paired.app.glyphRunExtent(
      [paired.app.resolveAlterationGlyph("diesis4"), paired.app.resolveFthoraGlyph("diatonicPa")],
      byzFontOf(paired)
    );

    closeTo(
      paired.ctx.callsOf("fillRect")[0].args[0],
      CANVAS_PADDING + run.width + TEXT_MARGIN,
      1e-6,
      "the boxes start clear of a gutter sized for the pair"
    );
    assert.ok(
      parseFloat(paired.canvas().style.width) > parseFloat(fthoraOnly.canvas().style.width),
      "the canvas must grow for the wider gutter"
    );
  });

  await t.test("sizes the top gutter from the tallest run", () => {
    const h = byzantineChart(t, [{ ...PAIR, alteration: "diesisGeniki" }, VOU], {
      orientation: "horizontal",
    });
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const run = h.app.glyphRunExtent(
      [h.app.resolveAlterationGlyph("diesisGeniki"), h.app.resolveFthoraGlyph("diatonicPa")],
      byzFontOf(h)
    );

    closeTo(
      h.ctx.callsOf("fillRect")[0].args[1],
      CANVAS_PADDING + run.height + TEXT_MARGIN,
      1e-6,
      "the boxes start below a gutter sized for the taller of the pair"
    );
  });

  await t.test("reserves no gutter for a pair that no single degree carries", () => {
    const spread = byzantineChart(t, [
      { ...VOU, alteration: "diesis4" },
      { note: "midGa", fthora: "diatonicPa" },
    ]);
    const { CANVAS_PADDING, TEXT_MARGIN } = spread.app;

    const widest = Math.max(
      inkWidth(spread, spread.app.resolveAlterationGlyph("diesis4")),
      inkWidth(spread, spread.app.resolveFthoraGlyph("diatonicPa"))
    );

    closeTo(
      spread.ctx.callsOf("fillRect")[0].args[0],
      CANVAS_PADDING + widest + TEXT_MARGIN,
      1e-6,
      "one sign per degree is one sign wide — the gutter must not reserve a gap and a second sign"
    );
  });

  await t.test("opens no gutter at all when no degree carries either sign", () => {
    const h = byzantineChart(t, [{ note: "midPa" }, VOU]);

    closeTo(
      h.ctx.callsOf("fillRect")[0].args[0],
      h.app.CANVAS_PADDING,
      1e-9,
      "the canvas must not grow for signs it never draws"
    );
  });

  await t.test("draws nothing extra in Generic notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    h.app.writeAlteration(noteRows(h)[0], "diesis4");
    h.ctx.reset();
    h.app.render();

    assert.ok(
      !h.ctx.drawnText().includes(h.app.resolveAlterationGlyph("diesis4")),
      "a Generic chart draws no Byzantine sign"
    );
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

test("Generic notation with an accidental", async (t) => {
  const SHARP = "accidentalSharp";

  function genericChart(t, accidentals, options = {}) {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    if (options.orientation) selectOption(h, "orientation", options.orientation);
    if (options.style) selectOption(h, "chart-style", options.style);
    noteRows(h).forEach((row, i) => {
      if (accidentals[i]) h.app.writeNoteSign(row, "accidental", accidentals[i]);
    });
    h.ctx.reset();
    h.app.render();
    return h;
  }

  const smuflFontOf = (h) => h.app.smuflFont(h.app.SMUFL_FONT_SIZE);
  const glyphOf = (h, id) => h.app.resolveAccidentalGlyphs(id);

  await t.test("draws the accidental in Bravura Text at the SMuFL size", () => {
    const h = genericChart(t, [SHARP, null]);

    const call = drawnCall(h, glyphOf(h, SHARP));
    assert.equal(call.state.font, smuflFontOf(h), "the gutter run takes the notation's own face");
  });

  await t.test("draws no Byzantine glyph, whatever the Byzantine wells hold", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    h.app.writeNoteSign(noteRows(h)[0], "accidental", SHARP);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.ctx.reset();
    h.app.render();

    const byzFont = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    assert.equal(
      h.ctx.callsOf("fillText").filter((c) => c.state.font === byzFont).length,
      0,
      "a fthora set while Generic is selected belongs to the other notation"
    );
  });

  await t.test("keeps the typed note name, which the accidental does not replace", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], { names: ["Pa", "Vou"] });
    h.app.writeNoteSign(noteRows(h)[0], "accidental", SHARP);
    h.ctx.reset();
    h.app.render();

    assert.ok(h.ctx.drawnText().includes("Pa"), "the name band is unchanged in Generic");
    assert.ok(h.ctx.drawnText().includes(glyphOf(h, SHARP)));
  });

  await t.test("puts the gutter on the left when vertical, one margin clear of the boxes", () => {
    const h = genericChart(t, [SHARP, null]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = glyphOf(h, SHARP);
    const box = h.app.inkBox(h.ctx, text, smuflFontOf(h));
    const call = drawnCall(h, text);

    // signAnchor = CANVAS_PADDING + gutter - TEXT_MARGIN, and the gutter is the
    // run's width plus one TEXT_MARGIN, so the anchor lands one run width in.
    closeTo(
      call.args[1] + box.right,
      CANVAS_PADDING + (box.right - box.left),
      1e-6,
      "the run is right-aligned at the gutter's inner edge"
    );
  });

  await t.test("grows the canvas by the gutter, exactly as Byzantine does", () => {
    const withSign = genericChart(t, [SHARP, null]);
    const plain = genericChart(t, [null, null]);

    const runWidth = (() => {
      const box = withSign.app.inkBox(withSign.ctx, glyphOf(withSign, SHARP), smuflFontOf(withSign));
      return box.right - box.left;
    })();

    closeTo(
      parseFloat(withSign.canvas().style.width) - parseFloat(plain.canvas().style.width),
      runWidth + withSign.app.TEXT_MARGIN,
      1e-6,
      "the gutter is the widest run plus one text margin"
    );
  });

  await t.test("draws exactly as today when no degree carries an accidental", () => {
    const withWells = genericChart(t, [null, null]);

    const plain = loadApp();
    t.after(() => plain.close());
    buildRelativeScale(plain, ["9/8"]);

    assert.equal(withWells.canvas().style.width, plain.canvas().style.width);
    assert.equal(
      withWells.canvas().style.height,
      plain.canvas().style.height,
      "a Generic chart must not reserve a gutter for signs it never draws"
    );
  });

  await t.test("keeps the first and last accidental whole in every chart", () => {
    for (const orientation of ["vertical", "horizontal"]) {
      for (const style of ["boxes", "lines"]) {
        const h = genericChart(t, [SHARP, SHARP], { orientation, style });
        assertSignsFitTheCanvas(h, smuflFontOf(h));
      }
    }
  });

  await t.test("puts the gutter above the chart when horizontal", () => {
    const h = genericChart(t, [SHARP, null], { orientation: "horizontal" });
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = glyphOf(h, SHARP);
    const box = h.app.inkBox(h.ctx, text, smuflFontOf(h));
    const call = drawnCall(h, text);

    closeTo(
      call.args[2] + box.bottom,
      CANVAS_PADDING + (box.bottom - box.top),
      1e-6,
      "the run is bottom-aligned at the gutter's inner edge"
    );
  });

  await t.test("measures a composed accidental wider than its two glyphs alone", () => {
    const pair = genericChart(t, ["sagittalEvoPlus4", null]);

    const composed = pair.app.inkBox(pair.ctx, glyphOf(pair, "sagittalEvoPlus4"), smuflFontOf(pair));
    const bare = pair.app.inkBox(
      pair.ctx,
      String.fromCharCode(0xe305, 0xe262),
      smuflFontOf(pair)
    );

    closeTo(
      composed.right - composed.left - (bare.right - bare.left),
      pair.app.SMUFL_FONT_SIZE * 0.1,
      1e-6,
      "the U+0020 spacer is half a staff space of real advance, and it must reach the canvas"
    );
  });
});

test("the gutter run's order across both notations", async (t) => {
  await t.test("is the order the wells appear on a note row", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The invariant is structural: signRunOf reads SYMBOL_WELLS, so the chart
    // cannot drift from the editor.
    const note = { accidental: "accidentalSharp", alteration: "diesis2", fthora: "diatonicPa" };

    // signRunOf's array is built inside jsdom's realm, so it is compared with
    // equalArray rather than assert.deepEqual — see docs/TESTING.md §5.
    equalArray(h.app.signRunOf(note, "generic"), [
      h.app.resolveAccidentalGlyphs("accidentalSharp"),
    ]);
    equalArray(h.app.signRunOf(note, "byzantine"), [
      h.app.resolveAlterationGlyph("diesis2"),
      h.app.resolveFthoraGlyph("diatonicPa"),
    ]);
  });

  await t.test("drops the wells a degree left empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(h.app.signRunOf({ accidental: "", alteration: "", fthora: "" }, "generic"), []);
    equalArray(
      h.app.signRunOf({ alteration: "", fthora: "diatonicPa" }, "byzantine"),
      [h.app.resolveFthoraGlyph("diatonicPa")],
      "a well the user left empty must not open a hole in the run"
    );
  });
});
