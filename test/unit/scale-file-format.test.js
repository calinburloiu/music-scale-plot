"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

/** A fully populated state: every field present, no defaults omitted. */
function sampleState() {
  return {
    name: "Hicaz",
    settings: { notation: "generic", baseNote: 0 },
    scaleEditor: {
      mode: "relativeIntervals",
      intervalType: { type: "edo", divisionCount: 72 },
      intervals: [7, 5, 12],
      noteProperties: [
        {
          generic: { accidental: "accidentalSharp", name: "hicaz" },
          byzantine: {
            alteration: "diesisGeniki",
            fthora: "diatonicPa",
            martyria: { note: "midPa", genus: "alpha", ticks: 1 },
          },
        },
        {
          generic: { accidental: "", name: "neva" },
          byzantine: { alteration: "", fthora: "", martyria: null },
        },
        {
          generic: { accidental: "", name: "" },
          byzantine: { alteration: "", fthora: "", martyria: null },
        },
        {
          generic: { accidental: "", name: "" },
          byzantine: { alteration: "", fthora: "", martyria: null },
        },
      ],
      intervalProperties: [
        { color: "#CCFFCC", label: "s" },
        { color: "#FFFFFF", label: "" },
        { color: "#CCFFCC", label: "s" },
      ],
    },
    chart: { style: "boxes", orientation: "vertical", zoom: 75 },
  };
}

test("writing a .musp.json document", async (t) => {
  await t.test("stamps the format version and pretty-prints with a trailing newline", () => {
    const h = loadApp();
    t.after(() => h.close());

    const text = h.app.serializeScaleDocument(sampleState());
    assert.ok(text.endsWith("\n"), "a text file ends with a newline");
    assert.ok(text.includes('\n  "formatVersion": 1,'), "2-space indent, version first");
    assert.equal(JSON.parse(text).formatVersion, 1);
  });

  await t.test("writes the file's own words for mode and chart style", () => {
    const h = loadApp();
    t.after(() => h.close());

    const state = sampleState();
    state.scaleEditor.mode = "absoluteIntervals";
    state.scaleEditor.intervals = [0, 7, 12, 19];
    state.chart.style = "segments";
    const doc = JSON.parse(h.app.serializeScaleDocument(state));
    assert.equal(doc.scaleEditor.mode, "absoluteIntervals");
    assert.equal(doc.chart.style, "segments", '"segments" is the file\'s word for the DOM\'s "lines"');
  });

  await t.test("maps every file word back to its DOM value", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.SCALE_MODE_NAMES.relativeIntervals, "relative");
    assert.equal(h.app.SCALE_MODE_NAMES.absoluteIntervals, "absolute");
    assert.equal(h.app.CHART_STYLE_NAMES.boxes, "boxes");
    assert.equal(h.app.CHART_STYLE_NAMES.segments, "lines");
    assert.equal(h.app.fileWordFor(h.app.CHART_STYLE_NAMES, "lines"), "segments");
    assert.equal(h.app.fileWordFor(h.app.SCALE_MODE_NAMES, "absolute"), "absoluteIntervals");
  });

  await t.test("writes divisionCount only for the edo interval type", () => {
    const h = loadApp();
    t.after(() => h.close());

    const edo = JSON.parse(h.app.serializeScaleDocument(sampleState()));
    assert.deepEqual(edo.scaleEditor.intervalType, { type: "edo", divisionCount: 72 });

    const state = sampleState();
    state.scaleEditor.intervalType = { type: "ratio" };
    state.scaleEditor.intervals = ["9/8", "10/9", "16/15"];
    const ratio = JSON.parse(h.app.serializeScaleDocument(state));
    assert.deepEqual(ratio.scaleEditor.intervalType, { type: "ratio" });
  });

  await t.test("omits the top-level name when it is empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    const state = sampleState();
    state.name = "";
    assert.ok(!("name" in JSON.parse(h.app.serializeScaleDocument(state))));
  });

  await t.test("omits every note property that sits at its default", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = JSON.parse(h.app.serializeScaleDocument(sampleState())).scaleEditor.noteProperties;
    assert.deepEqual(notes[1], { generic: { name: "neva" } }, "an empty byzantine half is dropped whole");
    assert.deepEqual(notes[2], {}, "an untouched note serialises as {}");
  });

  await t.test("omits a martyria's default genus and ticks, and the well when it is empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    const state = sampleState();
    state.scaleEditor.noteProperties[1].byzantine.martyria = {
      note: "midPa",
      genus: h.app.GENUS_NONE,
      ticks: 0,
    };
    const notes = JSON.parse(h.app.serializeScaleDocument(state)).scaleEditor.noteProperties;
    assert.deepEqual(notes[1].byzantine.martyria, { note: "midPa" });
    assert.deepEqual(
      notes[0].byzantine.martyria,
      { note: "midPa", genus: "alpha", ticks: 1 },
      "a martyria that is not at its defaults is written out in full"
    );
    assert.deepEqual(notes[2], {}, "a note with no martyria writes no martyria key");
  });

  await t.test("always writes an interval's colour, and its label only when set", () => {
    const h = loadApp();
    t.after(() => h.close());

    const props = JSON.parse(h.app.serializeScaleDocument(sampleState())).scaleEditor.intervalProperties;
    assert.deepEqual(props[0], { color: "#CCFFCC", label: "s" });
    assert.deepEqual(props[1], { color: "#FFFFFF" }, "no single default colour, so it is always written");
  });
});

test("the suggested file name", async (t) => {
  const CASES = [
    ["Hicaz", "hicaz.musp.json"],
    ["Hicaz Hümayun", "hicaz-h-mayun.musp.json"],
    ["  Rast  ", "rast.musp.json"],
    ["12-EDO / chromatic", "12-edo-chromatic.musp.json"],
    ["", "scale.musp.json"],
    ["???", "scale.musp.json"],
  ];

  for (const [name, expected] of CASES) {
    await t.test(`${JSON.stringify(name)} becomes ${expected}`, () => {
      const h = loadApp();
      t.after(() => h.close());
      assert.equal(h.app.suggestedFileName(name), expected);
    });
  }
});
