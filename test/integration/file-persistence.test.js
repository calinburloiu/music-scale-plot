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
  pickScaleFile,
} = require("../helpers/harness.js");

/** What the toolbar's message bar currently says, without the dismiss button. */
function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

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

  await t.test("writes nothing at all when a box does not parse", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // The writer still has a raw-string branch for an interval slot, and the
    // reader still accepts one — a hand-edited file has to open. But that
    // branch is no longer reachable through Save: the guard refuses first, so
    // the app never builds a document from a scale with a hole in it. What the
    // user is told instead is interval-validation.test.js's subject.
    selectOption(h, "interval-type", "cents");
    buildRelativeScale(h, ["mid-thought"]);
    await saveScale(h);

    assert.equal(h.downloads.length, 0, "no document should have been written");
  });

  await t.test("names the file after the scale, and falls back when it has none", async () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");
    await saveScale(h);
    assert.equal(savedScaleFile(h).name, "hicaz-humayun.musp.json");

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

  await t.test("shows an error when the Save dialog fails for another reason", async () => {
    const h = loadApp({ fileSystemAccess: { saveFails: true } });
    t.after(() => h.close());

    await saveScale(h);

    assert.equal(h.writtenFiles.length, 0);
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, false);
    assert.equal(messageText(h), "Could not save the file.");
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

test("escaping interval values that came from a file", async (t) => {
  // makeNoteRowHTML/makeIntervalRowHTML build their markup by string
  // concatenation, then set it via innerHTML. Every other caller passes
  // app-computed text, but applyDocumentState() (persistence-ui.js) is the
  // first caller that can pass an arbitrary string straight out of a file:
  // validateScaleDocument only requires an interval to be "a string or a
  // finite number" (persistence.js), with no character restrictions.
  await t.test("paints the chart once, and never from the scale it is replacing", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // Build a scale, save it, then start from a different one so the outgoing
    // rows are visibly not the incoming ones.
    buildRelativeScale(h, ["9/8"]);
    await saveScale(h);
    const saved = savedScaleFile(h).text;

    buildRelativeScale(h, ["5/4", "5/4", "5/4", "5/4"]);
    h.ctx.reset();
    await pickScaleFile(h, saved);

    // render() clears once per paint. Two clears means the chart was drawn
    // before #editor was rebuilt — the old rows read under the incoming mode
    // and interval type, a full wasted paint of a scale nobody asked for.
    assert.equal(
      h.ctx.callsOf("clearRect").length,
      1,
      "Open must paint the chart once, after the editor is rebuilt"
    );
  });

  const TRICKY = '9"8<b>weird</b>';

  // A value carrying markup is not a number in any interval type, so the reader
  // now turns such a document away by name and it never reaches a row. These
  // guard the boundary that makes that true: if validation is ever loosened,
  // the payload reaches makeIntervalRowHTML() again and the injection
  // assertions below are what catch it.
  function docWithIntervals(intervals, mode) {
    return JSON.stringify({
      formatVersion: 1,
      settings: { notation: "generic", baseNote: 0 },
      scaleEditor: {
        mode: mode,
        intervalType: { type: "ratio" },
        intervals: intervals,
        noteProperties: [{}, {}],
        intervalProperties: [{ color: "#CCFFCC", label: "" }],
      },
      chart: { style: "boxes", orientation: "vertical", zoom: 100 },
    });
  }

  await t.test("refuses a relative interval containing quote and angle-bracket characters", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["10/9"]);
    await pickScaleFile(h, docWithIntervals([TRICKY], "relativeIntervals"));

    assert.match(messageText(h), /must be a valid ratio/);
    assert.equal(
      intervalRows(h)[0].querySelector(".interval").value,
      "10/9",
      "the editor must keep the scale it had"
    );
  });

  await t.test("refuses an absolute interval containing quote and angle-bracket characters", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await pickScaleFile(h, docWithIntervals(["1/1", TRICKY], "absoluteIntervals"));

    assert.match(messageText(h), /must be a valid ratio/);
    assert.equal(noteRows(h).length, 2, "the default scale must still be there");
  });

  await t.test("opening a crafted document with markup in an interval injects no element into #editor", async () => {
    const h = loadApp();
    t.after(() => h.close());

    const payload = '"><img src=x onerror="window.__pwned=true">';
    const fileText = JSON.stringify({
      formatVersion: 1,
      settings: { notation: "generic", baseNote: 0 },
      scaleEditor: {
        mode: "relativeIntervals",
        intervalType: { type: "ratio" },
        intervals: [payload],
        noteProperties: [{}, {}],
        intervalProperties: [{ color: "#CCFFCC", label: "" }],
      },
      chart: { style: "boxes", orientation: "vertical", zoom: 100 },
    });

    await pickScaleFile(h, fileText);

    // Two layers, asserted together. The outer one is validation: the payload
    // is not a ratio, so the document never reaches a row at all. The inner one
    // is escapeAttribute() in makeIntervalRowHTML(), which is what would have
    // to hold if validation were ever loosened — so these two assertions stay
    // even though nothing can currently get past the first.
    assert.match(messageText(h), /must be a valid ratio/, "the document must be refused by name");
    assert.equal(h.document.querySelectorAll("#editor img").length, 0, "no <img> was injected");
    assert.equal(h.document.querySelectorAll("#editor b").length, 0, "no <b> was injected");
    assert.equal(h.window.__pwned, undefined, "no script ran");
    assert.equal(
      intervalRows(h)[0].querySelector(".interval").value,
      "9/8",
      "the editor keeps the default scale it had"
    );
  });
});

test("opening a scale document", async (t) => {
  await t.test("round-trips a full scale through Save, New and Open", async () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");
    selectOption(h, "interval-type", "edo");
    typeInto(h, h.document.getElementById("edo-divisions"), "72");
    selectOption(h, "scale-mode", "absolute");
    // Chosen before the colours: getActivePalette() follows chart-style
    // ("lines" -> PALETTE_DARK), so the colours below are picked from the
    // palette this scale will actually use, and none of them gets remapped
    // by onChartStyleChange() later in this fixture.
    selectOption(h, "chart-style", "lines");
    // Degrees chosen so every consecutive gap (5, 7, 8 steps) is distinct: two
    // interval rows with the same underlying value are "the same interval"
    // to the app's own colour/label sync (CLAUDE.md, Color sync), which would
    // propagate row 2's colour and label onto row 1 while this fixture is
    // still being typed in — nothing to do with Open.
    buildAbsoluteScale(h, ["0", "5", "12", "20"], {
      names: ["rast", "dugah", "segah", "chargah"],
      labels: ["s", "", "s"],
      colors: ["#006600", "#000000", "#006600"],
    });
    selectOption(h, "base-note", "9");
    selectOption(h, "orientation", "horizontal");
    typeInto(h, h.document.getElementById("zoom"), "75");
    setNotation(h, "byzantine");
    // High Ke on the first degree pushes the three above it into the tick
    // octave, which is the only way the UI reaches a tick — and the state the
    // file most needs to carry, since without it the scale reloads an octave
    // wrong.
    pickMartyria(h, noteRows(h)[0], { note: "highKe", genus: "alpha" });
    pickFthora(h, noteRows(h)[2], "diatonicPa");

    await saveScale(h);
    const saved = savedScaleFile(h).text;

    fireClick(h, h.document.getElementById("new-file"));
    assert.equal(noteRows(h).length, 2, "New really did reset it");

    await pickScaleFile(h, saved);

    const valueOf = (id) => h.document.getElementById(id).value;
    assert.equal(valueOf("scale-name"), "Hicaz");
    assert.equal(valueOf("interval-type"), "edo");
    assert.equal(valueOf("edo-divisions"), "72");
    assert.equal(valueOf("scale-mode"), "absolute");
    assert.equal(valueOf("base-note"), "9");
    assert.equal(valueOf("chart-style"), "lines", "the file's \"segments\" reads back as the DOM's \"lines\"");
    assert.equal(valueOf("orientation"), "horizontal");
    assert.equal(valueOf("zoom"), "75");
    assert.equal(valueOf("notation"), "byzantine");

    assert.equal(noteRows(h).length, 4);
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["0", "5", "12", "20"]
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      ["rast", "dugah", "segah", "chargah"]
    );
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".interval-label").value),
      ["s", "", "s"]
    );
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".color-swatch").dataset.color),
      ["#006600", "#000000", "#006600"]
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.dataset.martyriaNote),
      ["highKe", "highZo", "highNi", "highPa"]
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.dataset.martyriaTicks),
      ["0", "1", "1", "1"],
      "the octave ticks came back"
    );
    assert.equal(noteRows(h)[0].dataset.martyriaGenus, "alpha");
    assert.equal(noteRows(h)[2].dataset.fthora, "diatonicPa");
  });

  await t.test("restores both notations' halves, not just the visible one", async () => {
    const h = loadApp();
    t.after(() => h.close());

    pickAccidental(h, noteRows(h)[0], "accidentalSharp");
    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "hicaz");
    setNotation(h, "byzantine");
    pickMartyria(h, noteRows(h)[0], { note: "midPa", genus: "alpha" });
    await saveScale(h);
    const saved = savedScaleFile(h).text;

    fireClick(h, h.document.getElementById("new-file"));
    await pickScaleFile(h, saved);

    assert.equal(h.document.getElementById("notation").value, "byzantine");
    assert.equal(noteRows(h)[0].dataset.martyriaNote, "midPa", "the visible half");
    assert.equal(noteRows(h)[0].dataset.accidental, "accidentalSharp", "the hidden half too");
    assert.equal(noteRows(h)[0].querySelector(".note-name").value, "hicaz");
  });

  await t.test("does not rerun the ladder or the colour sync over the file's own values", async () => {
    const h = loadApp();
    t.after(() => h.close());

    setNotation(h, "byzantine");
    setNoteCount(h, 3);
    // Deliberately unladdered: two rows a degree apart carrying the same letter
    // is something the ladder would never produce, and reopening must not
    // "fix" it — the file's martyrias are authoritative, per degree.
    const fileText = JSON.stringify({
      formatVersion: 1,
      settings: { notation: "byzantine", baseNote: 0 },
      scaleEditor: {
        mode: "relativeIntervals",
        intervalType: { type: "ratio" },
        intervals: ["9/8", "9/8"],
        noteProperties: [
          { byzantine: { martyria: { note: "midKe" } } },
          {},
          { byzantine: { martyria: { note: "midPa" } } },
        ],
        intervalProperties: [
          { color: "#CCFFCC", label: "a" },
          { color: "#FFCCCC", label: "b" },
        ],
      },
      chart: { style: "boxes", orientation: "vertical", zoom: 100 },
    });

    await pickScaleFile(h, fileText);

    assert.equal(noteRows(h)[0].dataset.martyriaNote, "midKe");
    assert.equal(noteRows(h)[1].dataset.martyriaNote, undefined, "the empty well stays empty");
    assert.equal(noteRows(h)[2].dataset.martyriaNote, "midPa");
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".color-swatch").dataset.color),
      ["#CCFFCC", "#FFCCCC"],
      "two 9/8 rows keep the different colours the file gave them"
    );
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".interval-label").value),
      ["a", "b"]
    );
  });

  await t.test("leaves the editor untouched when the file is bad, and says why", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9"], { names: ["do", "re", "mi"] });
    const before = noteRows(h).map((r) => r.querySelector(".note-name").value);

    await pickScaleFile(h, '{"formatVersion": 1, "settings": {"baseNote": 12}}');

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      before,
      "a rejected file must never leave a half-loaded editor"
    );
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, false);
    assert.equal(
      messageText(h),
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12."
    );
  });

  await t.test("clears an old message once a good file opens", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // Save first: saveScaleFile() clears the bar itself, so saving after the
    // bad open would make this pass for the wrong reason.
    await saveScale(h);
    const good = savedScaleFile(h).text;

    await pickScaleFile(h, "{ not json");
    assert.equal(h.document.getElementById("toolbar-message-text").textContent, "Not a valid JSON file.");

    await pickScaleFile(h, good);
    assert.equal(h.document.getElementById("toolbar-message").hidden, true);
  });

  await t.test("uses the real Open dialog where the browser has one", async () => {
    const h = loadApp({ fileSystemAccess: true });
    t.after(() => h.close());

    // Save first so the picker hands back a document this app actually wrote.
    await saveScale(h);
    const saved = h.writtenFiles[0].text;
    h.window.showOpenFilePicker = () =>
      Promise.resolve([{ getFile: () => Promise.resolve({ text: () => Promise.resolve(saved) }) }]);

    typeInto(h, h.document.getElementById("scale-name"), "changed");
    fireClick(h, h.document.getElementById("open-file"));
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    assert.equal(h.document.getElementById("scale-name").value, "");
  });

  await t.test("says nothing when the user cancels the Open dialog", async () => {
    const h = loadApp({ fileSystemAccess: { openAborts: true } });
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9"]);
    fireClick(h, h.document.getElementById("open-file"));
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    assert.equal(noteRows(h).length, 3, "nothing changed");
    assert.equal(h.document.getElementById("toolbar-message").hidden, true);
  });

  await t.test("shows an error when the Open dialog fails for another reason", async () => {
    const h = loadApp({ fileSystemAccess: { openFails: true } });
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9"]);
    fireClick(h, h.document.getElementById("open-file"));
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    assert.equal(noteRows(h).length, 3, "nothing changed");
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, false);
    assert.equal(messageText(h), "Could not open the file.");
  });

  await t.test("opens the fallback file dialog when there is no picker", () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = h.document.getElementById("open-file-input");
    let clicks = 0;
    input.click = () => { clicks++; };

    fireClick(h, h.document.getElementById("open-file"));
    assert.equal(clicks, 1);
    assert.equal(input.getAttribute("accept"), ".musp.json,application/json");
  });

  await t.test("shows an error when the fallback file's own read fails", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9"]);
    await pickScaleFile(h, new Error("could not read file"));

    assert.equal(noteRows(h).length, 3, "nothing changed");
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, false);
    assert.equal(messageText(h), "Could not open the file.");
  });
});
