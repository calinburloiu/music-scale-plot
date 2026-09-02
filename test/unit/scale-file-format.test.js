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

const fs = require("node:fs");
const path = require("node:path");

const EXAMPLE = path.join(__dirname, "..", "..", "issues", "015-file-persistence", "example.musp.json");

function docText(overrides) {
  const base = {
    formatVersion: 1,
    settings: { notation: "generic", baseNote: 0 },
    scaleEditor: {
      mode: "relativeIntervals",
      intervalType: { type: "ratio" },
      intervals: ["9/8"],
      noteProperties: [{}, {}],
      intervalProperties: [{ color: "#FFFFFF" }],
    },
    chart: { style: "boxes", orientation: "vertical", zoom: 100 },
  };
  return JSON.stringify(overrides ? overrides(base) || base : base);
}

test("reading a .musp.json document", async (t) => {
  await t.test("round-trips a state that exercises every field", () => {
    const h = loadApp();
    t.after(() => h.close());

    const state = sampleState();
    const result = h.app.parseScaleDocument(h.app.serializeScaleDocument(state));
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(JSON.parse(JSON.stringify(result.doc)), state);
  });

  await t.test("parses the design's own example, which is checked in", () => {
    const h = loadApp();
    t.after(() => h.close());

    const result = h.app.parseScaleDocument(fs.readFileSync(EXAMPLE, "utf8"));
    assert.equal(result.ok, true, result.error);
    assert.equal(result.doc.name, "Hicaz");
    assert.equal(result.doc.scaleEditor.intervalType.divisionCount, 72);
    assert.deepEqual(Array.from(result.doc.scaleEditor.intervals), [7, 5, 12]);
    assert.equal(result.doc.scaleEditor.noteProperties.length, 4);
  });

  await t.test("reads all three spellings of a default as the same note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const spellings = [
      { generic: { name: "ni" }, byzantine: { martyria: { note: "midPa", genus: "none", ticks: 0 } } },
      { generic: { name: "ni" }, byzantine: { martyria: { note: "midPa" } } },
    ];
    const [explicit, terse] = spellings.map((note) => {
      const result = h.app.parseScaleDocument(
        docText((base) => {
          base.scaleEditor.noteProperties[0] = note;
        })
      );
      assert.equal(result.ok, true, result.error);
      return result.doc.scaleEditor.noteProperties[0];
    });
    assert.deepEqual(JSON.parse(JSON.stringify(explicit)), JSON.parse(JSON.stringify(terse)));

    const bare = h.app.parseScaleDocument(docText()).doc.scaleEditor.noteProperties[0];
    assert.deepEqual(JSON.parse(JSON.stringify(bare)), {
      generic: { accidental: "", name: "" },
      byzantine: { alteration: "", fthora: "", martyria: null },
    });
  });

  await t.test("accepts a number or an unparseable string in an interval slot", () => {
    const h = loadApp();
    t.after(() => h.close());

    // A box may hold text that does not parse — a scale saved mid-thought. The
    // reader puts it straight back, exactly as it was written.
    const result = h.app.parseScaleDocument(
      docText((base) => {
        base.scaleEditor.intervalType = { type: "cents" };
        base.scaleEditor.intervals = ["not a number"];
      })
    );
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(Array.from(result.doc.scaleEditor.intervals), ["not a number"]);
  });

  await t.test("counts absolute-mode intervals as one per note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const result = h.app.parseScaleDocument(
      docText((base) => {
        base.scaleEditor.mode = "absoluteIntervals";
        base.scaleEditor.intervals = ["1/1", "9/8"];
      })
    );
    assert.equal(result.ok, true, result.error);
    assert.equal(result.doc.scaleEditor.intervals.length, 2);
  });

  await t.test("ignores keys it does not know, so a future minor addition still opens", () => {
    const h = loadApp();
    t.after(() => h.close());

    const result = h.app.parseScaleDocument(
      docText((base) => {
        base.somethingNew = true;
        base.scaleEditor.alsoNew = { deeply: "nested" };
      })
    );
    assert.equal(result.ok, true, result.error);
  });

  await t.test("clamps the zoom rather than rejecting it", () => {
    const h = loadApp();
    t.after(() => h.close());

    const zoomOf = (value) =>
      h.app.parseScaleDocument(docText((base) => { base.chart.zoom = value; })).doc.chart.zoom;
    assert.equal(zoomOf(500), 100);
    assert.equal(zoomOf(1), 10);
    assert.equal(zoomOf(75), 75);
    assert.equal(zoomOf(undefined), 100, "an absent zoom is the markup default");
  });

  await t.test("defaults a whole absent section rather than rejecting the file", () => {
    const h = loadApp();
    t.after(() => h.close());

    const result = h.app.parseScaleDocument(
      docText((base) => {
        delete base.settings;
        delete base.chart;
      })
    );
    assert.equal(result.ok, true, result.error);
    assert.equal(result.doc.settings.notation, "generic");
    assert.equal(result.doc.settings.baseNote, 0);
    assert.equal(result.doc.chart.style, "boxes");
  });
});

test("rejecting a bad .musp.json document", async (t) => {
  const REJECTIONS = [
    ["not JSON at all", "{ nope", "Not a valid JSON file."],
    ["a JSON array", "[1, 2, 3]", "Not a Music Scale Plot file."],
    [
      "no formatVersion",
      JSON.stringify({ scaleEditor: {} }),
      "Not a Music Scale Plot file: no formatVersion.",
    ],
    [
      "a newer format",
      docText((b) => { b.formatVersion = 2; }),
      "This file was saved by a newer version of Music Scale Plot (format 2).",
    ],
    [
      "a malformed formatVersion",
      docText((b) => { b.formatVersion = "1"; }),
      'Not a Music Scale Plot file: formatVersion must be a whole number, got "1".',
    ],
    ["a non-text name", docText((b) => { b.name = 7; }), "name must be text."],
    [
      "an unknown notation",
      docText((b) => { b.settings.notation = "x"; }),
      'settings.notation must be "generic" or "byzantine", got "x".',
    ],
    [
      "a base note out of range",
      docText((b) => { b.settings.baseNote = 12; }),
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12.",
    ],
    [
      "an unknown mode",
      docText((b) => { b.scaleEditor.mode = "x"; }),
      'scaleEditor.mode must be "relativeIntervals" or "absoluteIntervals", got "x".',
    ],
    [
      "an unknown interval type",
      docText((b) => { b.scaleEditor.intervalType = { type: "x" }; }),
      'scaleEditor.intervalType.type must be "ratio", "edo" or "cents", got "x".',
    ],
    [
      "an edo type with no divisionCount",
      docText((b) => { b.scaleEditor.intervalType = { type: "edo" }; }),
      "scaleEditor.intervalType.divisionCount must be a whole number of at least 1.",
    ],
    [
      "a one-note scale",
      docText((b) => { b.scaleEditor.noteProperties = [{}]; }),
      "scaleEditor.noteProperties must list at least 2 notes.",
    ],
    [
      "the wrong number of interval properties",
      docText((b) => {
        b.scaleEditor.noteProperties = [{}, {}, {}, {}];
        b.scaleEditor.intervals = ["9/8", "9/8", "9/8"];
        b.scaleEditor.intervalProperties = [{ color: "#FFFFFF" }, { color: "#FFFFFF" }];
      }),
      "scaleEditor.intervalProperties has 2 entries, expected 3.",
    ],
    [
      "the wrong number of intervals",
      docText((b) => {
        b.scaleEditor.noteProperties = [{}, {}, {}, {}, {}];
        b.scaleEditor.intervals = ["9/8", "9/8", "9/8"];
        b.scaleEditor.intervalProperties = [
          { color: "#FFFFFF" }, { color: "#FFFFFF" }, { color: "#FFFFFF" }, { color: "#FFFFFF" },
        ];
      }),
      "scaleEditor.intervals has 3 entries, expected 4.",
    ],
    [
      "an interval that is neither a number nor text",
      docText((b) => {
        b.scaleEditor.noteProperties = [{}, {}, {}, {}];
        b.scaleEditor.intervals = ["9/8", "9/8", { nope: true }];
        b.scaleEditor.intervalProperties = [
          { color: "#FFFFFF" }, { color: "#FFFFFF" }, { color: "#FFFFFF" },
        ];
      }),
      "scaleEditor.intervals[2] must be a number or text.",
    ],
    [
      "an unknown accidental",
      docText((b) => {
        b.scaleEditor.noteProperties[1] = { generic: { accidental: "accidentalSharpp" } };
      }),
      'Unknown accidental "accidentalSharpp" on note 2.',
    ],
    [
      "an unknown fthora",
      docText((b) => { b.scaleEditor.noteProperties[0] = { byzantine: { fthora: "nope" } }; }),
      'Unknown fthora "nope" on note 1.',
    ],
    [
      "an unknown sign of alteration",
      docText((b) => { b.scaleEditor.noteProperties[0] = { byzantine: { alteration: "nope" } }; }),
      'Unknown sign of alteration "nope" on note 1.',
    ],
    [
      "an unknown martyria note",
      docText((b) => {
        b.scaleEditor.noteProperties[0] = { byzantine: { martyria: { note: "midQa" } } };
      }),
      'Unknown martyria note "midQa" on note 1.',
    ],
    [
      "an unknown martyria genus",
      docText((b) => {
        b.scaleEditor.noteProperties[0] = {
          byzantine: { martyria: { note: "midPa", genus: "omega" } },
        };
      }),
      'Unknown martyria genus "omega" on note 1.',
    ],
    [
      "a martyria tick count off the ladder",
      docText((b) => {
        b.scaleEditor.noteProperties[0] = { byzantine: { martyria: { note: "midPa", ticks: 2 } } };
      }),
      "The martyria tick count on note 1 must be 0 or 1.",
    ],
    [
      "a colour that is not a hex triple",
      docText((b) => { b.scaleEditor.intervalProperties[0] = { color: "green" }; }),
      'scaleEditor.intervalProperties[0].color must be a hex colour like "#CCFFCC".',
    ],
    [
      "an unknown chart style",
      docText((b) => { b.chart.style = "x"; }),
      'chart.style must be "boxes" or "segments", got "x".',
    ],
    [
      "an unknown orientation",
      docText((b) => { b.chart.orientation = "x"; }),
      'chart.orientation must be "vertical" or "horizontal", got "x".',
    ],
  ];

  for (const [description, text, message] of REJECTIONS) {
    await t.test(`${description} is refused by name`, () => {
      const h = loadApp();
      t.after(() => h.close());

      const result = h.app.parseScaleDocument(text);
      assert.equal(result.ok, false, "this document should not have been accepted");
      assert.equal(result.error, message);
    });
  }
});
