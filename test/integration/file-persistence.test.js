"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  selectOption,
  setNotation,
  buildRelativeScale,
  buildAbsoluteScale,
  setNoteCount,
  noteRows,
  intervalRows,
  pickAccidental,
  pickAlteration,
  pickFthora,
  pickMartyria,
  savedScaleFile,
} = require("../helpers/harness.js");

/** Clicks Save ▸ Save As Music Scale Plot file, the way a user reaches it. */
async function saveScale(h) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById("save-scale"));
  await new Promise((resolve) => h.window.setTimeout(resolve, 0));
}

test("saving a scale document", async (t) => {
  await t.test("writes the editor's state, in the file's own vocabulary", async () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");
    selectOption(h, "interval-type", "edo");
    typeInto(h, h.document.getElementById("edo-divisions"), "72");
    buildRelativeScale(h, ["7", "5", "12"], { labels: ["s", "", "s"] });
    selectOption(h, "chart-style", "lines");

    await saveScale(h);

    const doc = JSON.parse(savedScaleFile(h).text);
    assert.equal(doc.formatVersion, 1);
    assert.equal(doc.name, "Hicaz");
    assert.equal(doc.settings.baseNote, 0, "C, the default, written as the DOM holds it");
    assert.deepEqual(doc.scaleEditor.intervalType, { type: "edo", divisionCount: 72 });
    assert.equal(doc.scaleEditor.mode, "relativeIntervals");
    assert.deepEqual(doc.scaleEditor.intervals, [7, 5, 12], "edo steps are written as numbers");
    assert.equal(doc.chart.style, "segments", "the file's word for the DOM's \"lines\"");
    assert.equal(doc.scaleEditor.intervalProperties.length, 3);
    assert.equal(doc.scaleEditor.intervalProperties[0].label, "s");
  });

  await t.test("writes one interval per note in absolute mode", async () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);
    await saveScale(h);

    const doc = JSON.parse(savedScaleFile(h).text);
    assert.equal(doc.scaleEditor.mode, "absoluteIntervals");
    assert.deepEqual(doc.scaleEditor.intervals, ["1/1", "9/8", "5/4"]);
    assert.equal(doc.scaleEditor.intervalProperties.length, 2, "always between successive notes");
  });

  await t.test("writes the raw text of an interval that does not parse", async () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "cents");
    buildRelativeScale(h, ["mid-thought"]);
    await saveScale(h);

    assert.deepEqual(
      JSON.parse(savedScaleFile(h).text).scaleEditor.intervals,
      ["mid-thought"],
      "nothing is lost and nothing is invented"
    );
  });

  await t.test("names the file after the scale, and falls back when it has none", async () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");
    await saveScale(h);
    assert.equal(savedScaleFile(h).name, "hicaz-h-mayun.musp.json");

    typeInto(h, h.document.getElementById("scale-name"), "");
    await saveScale(h);
    assert.equal(savedScaleFile(h).name, "scale.musp.json");
  });

  await t.test("closes the Save menu behind it", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveScale(h);
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
  });

  await t.test("uses the real Save dialog where the browser has one", async () => {
    const h = loadApp({ fileSystemAccess: true });
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Rast");
    await saveScale(h);

    assert.equal(h.downloads.length, 0, "no <a download> fallback when a picker exists");
    assert.equal(h.writtenFiles.length, 1);
    assert.equal(h.writtenFiles[0].name, "rast.musp.json");
    assert.equal(JSON.parse(h.writtenFiles[0].text).name, "Rast");

    // Read field by field: the options object was made inside the jsdom window,
    // so deepEqual against a Node literal hits the cross-realm gotcha.
    const call = h.filePickerCalls[0];
    assert.equal(call.picker, "save");
    assert.equal(call.options.types.length, 1);
    assert.equal(call.options.types[0].description, "Music Scale Plot file");
    assert.deepEqual(
      Array.from(call.options.types[0].accept["application/json"]),
      [".musp.json"]
    );
  });

  await t.test("says nothing when the user cancels the Save dialog", async () => {
    const h = loadApp({ fileSystemAccess: { saveAborts: true } });
    t.after(() => h.close());

    await saveScale(h);
    assert.equal(h.writtenFiles.length, 0);
    assert.equal(
      h.document.getElementById("toolbar-message").hidden,
      true,
      "choosing not to save is not an error to report"
    );
  });
});

test("what a saved document carries", async (t) => {
  await t.test("records both notations, whatever the Notation setting says", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // Switching Notation hides half of every note row but discards nothing, so
    // a file records both halves. This is the issue's explicit requirement.
    pickAccidental(h, noteRows(h)[0], "accidentalSharp");
    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "hicaz");

    setNotation(h, "byzantine");
    pickMartyria(h, noteRows(h)[0], { note: "midPa", genus: "alpha" });
    pickFthora(h, noteRows(h)[0], "diatonicPa");
    pickAlteration(h, noteRows(h)[0], "diesisGeniki");

    await saveScale(h);

    const note = JSON.parse(savedScaleFile(h).text).scaleEditor.noteProperties[0];
    assert.deepEqual(note.generic, { accidental: "accidentalSharp", name: "hicaz" });
    assert.equal(note.byzantine.fthora, "diatonicPa");
    assert.equal(note.byzantine.alteration, "diesisGeniki");
    assert.deepEqual(note.byzantine.martyria, { note: "midPa", genus: "alpha" });
  });

  await t.test("records a martyria's octave ticks", async () => {
    const h = loadApp();
    t.after(() => h.close());

    setNotation(h, "byzantine");
    setNoteCount(h, 3);
    // The ladder is the only thing that reaches the tick octave — above high Ke
    // there is nowhere else for the next degree to go, and the picker does not
    // offer tick rows until some degree already carries one. ticks is
    // user-visible state: without it a scale up there reloads an octave wrong.
    pickMartyria(h, noteRows(h)[0], { note: "highKe" });
    await saveScale(h);

    const notes = JSON.parse(savedScaleFile(h).text).scaleEditor.noteProperties;
    assert.deepEqual(notes[0].byzantine.martyria, { note: "highKe" }, "ticks 0 is omitted");
    assert.deepEqual(notes[1].byzantine.martyria, { note: "highZo", ticks: 1 });
    assert.deepEqual(notes[2].byzantine.martyria, { note: "highNi", ticks: 1 });
  });
});
