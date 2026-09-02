# File Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Music Scale Plot a sticky toolbar with New / Open / Save / Add note / Remove last note, and the ability to save its whole state to a `.musp.json` file and restore it.

**Architecture:** Two new classic scripts split model from DOM the way the repo already does — `persistence.js` holds the format (serialise, parse, validate; no DOM) and `persistence-ui.js` holds the toolbar, the file dialogs and the collect/apply pair that reads and rewrites `#editor`. The DOM stays the data model: saving reads the rows, opening rebuilds them. A sticky `#toolbar` before `.container` gathers the file actions and the two relocated note buttons.

**Tech Stack:** Vanilla ES2020 in classic `<script>` files, no build step, no runtime dependencies. File System Access API where it exists, `<a download>` / `<input type="file">` everywhere else. Tests: `node --test` + jsdom.

**Spec:** [`issues/015-file-persistence/2026-09-03-file-persistence-design.md`](2026-09-03-file-persistence-design.md) — read it before Task 1. Its §-numbers are cited throughout.

## Global Constraints

- **No dependencies in the app.** `index.html` loads `style.css`, the seven own scripts and nothing else. No bundler, no ES modules — `<script type="module">` is fetched under CORS and a `file://` page has an opaque origin, which would break "open `index.html` in a browser". `jsdom` stays a dev-only dependency.
- **Load order, after this plan:** `byzantine.js` → `smufl.js` → `persistence.js` → `symbols-ui.js` → `byzantine-ui.js` → `persistence-ui.js` → `app.js`. `app.js` stays last because it runs at load time.
- **One global scope.** No top-level name may be declared in two scripts — that is a load-time `SyntaxError` before any test runs. Names introduced here that must stay unique: `SCALE_FILE_VERSION`, `SCALE_FILE_EXTENSION`, `SCALE_MODE_NAMES`, `CHART_STYLE_NAMES`, `NOTATION_NAMES`, `INTERVAL_TYPE_NAMES`, `CHART_ORIENTATION_NAMES`, `HEX_COLOR_PATTERN`, `isPlainObject`, `hasEnumWord`, `fileWordFor`, `scaleFileError`, `serializeScaleDocument`, `scaleDocumentFrom`, `noteDocumentFrom`, `intervalDocumentFrom`, `suggestedFileName`, `parseScaleDocument`, `validateScaleDocument`, `validateNoteProperties`, `validateIntervalProperties`, `clampZoom`, `countOf`, `newBtn`, `openBtn`, `saveMenuBtn`, `saveMenuPanel`, `saveScaleItem`, `toolbarMessage`, `openFileInput`, `SCALE_FILE_PICKER_TYPES`, `toggleSaveMenu`, `closeSaveMenu`, `showToolbarMessage`, `clearToolbarMessage`, `newScaleFile`, `openScaleFile`, `saveScaleFile`, `downloadScaleFile`, `loadScaleFileText`, `handleFileShortcut`, `collectDocumentState`, `applyDocumentState`, `noteStateFrom`, `intervalStateFrom`, `intervalItemFrom`, `valueOfInput`, `applyNoteState`, `applyIntervalState`, `makeNoteRowElement`, `makeIntervalRowElement`, `scaleNameInput`.
- **TDD is mandatory** (`docs/TESTING.md` §2). Write the failing test, run it, watch it fail for the right reason, then implement. Never delete, skip or loosen a test to get green. Run the **whole** suite (`npm test`) before every commit.
- **Format version:** `formatVersion: 1`, required. Extension `.musp.json`.
- **Commit messages** are prefixed `[#15]` and end with:

  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW
  ```

- **Deliberate behaviour changes** (Task 1's base-note re-encoding, Task 5–7's relocations) update the affected tests **in the same commit**, with the reason in the message.
- **Out of scope** (design §10): overwrite-in-place, dirty flag, unsaved-changes prompt, recent files, autosave, `localStorage`, drag-and-drop, the scale name on the chart, `formatVersion` migration machinery.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `persistence.js` | The `.musp.json` format. Enum maps, `serializeScaleDocument`, `suggestedFileName`, `parseScaleDocument`, `validateScaleDocument`. **No DOM.** |
| `persistence-ui.js` | The DOM half: toolbar elements and listeners, the Save menu, the message bar, `collectDocumentState`, `applyDocumentState`, the New/Open/Save flows, the keyboard shortcuts. |
| `icons/new.svg`, `icons/open.svg`, `icons/save.svg`, `icons/add-note.svg`, `icons/remove-note.svg` | Toolbar glyphs, ink baked at `--ink` (`#1a1814`). |
| `test/unit/scale-file-format.test.js` | Design §3 and §6 without a page. |
| `test/integration/toolbar.test.js` | The toolbar shell, the Save menu, the relocated controls, New, the message bar. |
| `test/integration/file-persistence.test.js` | Save, Open, the round trip, both I/O branches. |

**Modified**

| File | Change |
|---|---|
| `index.html` | Toolbar markup; twelve base-note options; Interval Type, EDO and the new Name box move into the Scale Editor; `#save-png` moves into the Save menu; two new `<script>` tags. |
| `style.css` | Toolbar block; the editor-panel row family; `.editor-controls` and the `#save-png` chart-toolbar rules removed. |
| `app.js` | `getBaseFrequency` re-encoded; `scaleNameInput` added; `resetControlsToDefaults` clears the name; `closeAllDropdowns` closes the Save menu; `makeNoteRowElement`/`makeIntervalRowElement` extracted. |
| `test/helpers/harness.js` | `loadApp({ fileSystemAccess })`, `openScaleFile`, `savedScaleFile`. |
| `test/integration/harness.test.js` | The asserted script list grows twice. |
| `test/unit/defaults.test.js`, `test/unit/pitch.test.js`, `test/integration/startup-reset.test.js` | The base-note re-encoding and `#scale-name`. |
| `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`, `.claude/rules/testing.md` | Documentation (Task 12). |

**Gaps in the design this plan fills**, so the executor does not have to invent them:

1. **A malformed `formatVersion`** that is neither missing nor a higher number (`0`, `"1"`, `null`) gets its own message rather than being forced into one of the design's two.
2. **`martyria.ticks` range.** Design §6 lists no rule; the ladder only ever holds 0 or 1 (`ladderNoteAt`, `byzantine.js:345`), so anything else is rejected.
3. **Top-level `name` is omitted when empty**, by the same "omit anything at its default" rule §3.4 gives note properties. The reader fills `""` back, so the round trip holds.
4. **Optional sections default rather than being required.** A file with no `settings`, `chart` or `scaleEditor.intervalType` opens with the markup defaults, matching §3.4's "omitted, `{}`, or written out explicitly are the same". `scaleEditor.noteProperties`, `.intervals` and `.intervalProperties` remain required — they are the scale.
5. **Non-`AbortError` picker failures** show `Could not save the file.` / `Could not open the file.` A write that fails in silence is worse than one that says so.
6. **Identity enum maps** (`NOTATION_NAMES`, `INTERVAL_TYPE_NAMES`, `CHART_ORIENTATION_NAMES`) exist alongside the design's two translating maps, so validation has one way to check membership.
7. **`test/integration/toolbar.test.js`** is a third new test file. Design §8 names two; the toolbar's own behaviour is not file persistence and gets a file named after its feature, per `docs/TESTING.md` §4.

---

### Task 1: Base Note — twelve chromatic notes, encoded from C

Design §5.1. Independent of everything else, and a prerequisite: the file's `settings.baseNote` is the DOM's own value, so the two encodings must already agree.

**Files:**
- Modify: `index.html:20-30` (the `#base-note` `<select>`)
- Modify: `app.js:94-97` (`getBaseFrequency`)
- Test: `test/unit/defaults.test.js:94-115` (rewritten), `test/unit/pitch.test.js:26-34`, `test/integration/startup-reset.test.js:23,60`

**Interfaces:**
- Consumes: nothing.
- Produces: `#base-note` values are integers `0`–`11`, semitones above C. `getBaseFrequency(): number` maps them with `220 * 2 ** (((s + 3) % 12) / 12)`.

- [ ] **Step 1: Write the failing tests**

Replace `test/unit/defaults.test.js:94-115` (the whole `test("getBaseFrequency follows the base note selector", …)` block) with:

```js
test("the base note selector", async (t) => {
  await t.test("offers all twelve chromatic notes, C first", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The list is also the file format's vocabulary: settings.baseNote is this
    // value verbatim, so nothing translates at the boundary.
    assert.deepEqual(
      [...h.document.getElementById("base-note").options].map((o) => o.value),
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]
    );
  });

  await t.test("every one of the twelve sounds at the pitch it names", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Semitones above C, wrapped onto A220 … G#415 — exactly the octave the
    // old A-based encoding spanned, so every note that could be chosen before
    // still sounds at the pitch it did.
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    for (let s = 0; s < 12; s++) {
      selectOption(h, "base-note", String(s));
      closeTo(
        h.app.getBaseFrequency(),
        220 * Math.pow(2, ((s + 3) % 12) / 12),
        1e-9,
        `base note ${names[s]}`
      );
    }
  });

  await t.test("A is still 220 Hz, now at value 9", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9");
    closeTo(h.app.getBaseFrequency(), 220, 1e-9);
  });

  await t.test("the default is C, at 261.63 Hz", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.document.getElementById("base-note").value, "0", "C is the first option");
    closeTo(h.app.getBaseFrequency(), 261.6255653, 1e-6);
  });
});
```

In `test/unit/pitch.test.js:30`, change the selection and its comment:

```js
    selectOption(h, "base-note", "0"); // C, the default; three semitones above A
    const baseC = 220 * Math.pow(2, 3 / 12);
```

In `test/integration/startup-reset.test.js:23`, the restored value keeps its shape but changes meaning:

```js
  "#base-note": "3", // D#/Eb — anything but the default, which is now C
```

and at line 60:

```js
      assert.equal(valueOf("base-note"), "0", "0 is C now, not A: the list is chromatic from C");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/unit/defaults.test.js test/unit/pitch.test.js`
Expected: FAIL — the options list is `["0","2","3","5","7","8","10"]`, `getBaseFrequency()` at `"0"` returns 220 not 261.63.

- [ ] **Step 3: Widen the selector**

Replace `index.html:20-30` (the `<select id="base-note">` and its seven options) with:

```html
        <select id="base-note">
          <option value="0">C</option>
          <option value="1">C&#9839;/D&#9837;</option>
          <option value="2">D</option>
          <option value="3">D&#9839;/E&#9837;</option>
          <option value="4">E</option>
          <option value="5">F</option>
          <option value="6">F&#9839;/G&#9837;</option>
          <option value="7">G</option>
          <option value="8">G&#9839;/A&#9837;</option>
          <option value="9">A</option>
          <option value="10">A&#9839;/B&#9837;</option>
          <option value="11">B</option>
        </select>
```

- [ ] **Step 4: Re-encode the frequency**

Replace `app.js:94-97`:

```js
function getBaseFrequency() {
  // Semitones above C. The wrap keeps the audible range at A220 … G#415, which
  // is exactly the octave the old A-based encoding spanned — so every note that
  // could be chosen before still sounds at the pitch it did. C=0 is the
  // conventional pitch class, and it is what the .musp.json file stores, so the
  // DOM and the file need no translation between them.
  const semitones = parseInt(baseNoteSelect.value, 10);
  return 220 * Math.pow(2, ((semitones + 3) % 12) / 12);
}
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. If `startup-reset.test.js` is red, the two edits from Step 1 were not applied.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js test/unit/defaults.test.js test/unit/pitch.test.js test/integration/startup-reset.test.js
git commit -m "[#15] Base Note — twelve chromatic notes, encoded from C

The selector gains the five accidentals and is re-encoded as semitones above
C, so the DOM value and the file format's settings.baseNote are the same
number. getBaseFrequency() wraps by (s + 3) % 12, which keeps every note that
could be chosen before at the pitch it had.

One deliberate behaviour change: the default moves from A (220 Hz) to C
(261.63 Hz), because the chromatic list starts at C and the first option is
the default. Audio only; the chart is unaffected. defaults.test.js,
pitch.test.js and startup-reset.test.js move with the encoding.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 2: `persistence.js` — writing a document

Design §3, §4. The write half of the format: state object → pretty JSON, plus the filename slug.

**Files:**
- Create: `persistence.js`
- Create: `test/unit/scale-file-format.test.js`
- Modify: `index.html` (script tag, after `smufl.js`)
- Modify: `.claude/rules/testing.md` (add `persistence.js` to `paths:`)
- Modify: `test/integration/harness.test.js:70-77` (the asserted script list)

**Interfaces:**
- Consumes: `GENUS_NONE` (`byzantine.js:48`).
- Produces:
  - `SCALE_FILE_VERSION = 1`, `SCALE_FILE_EXTENSION = ".musp.json"`.
  - `SCALE_MODE_NAMES`, `CHART_STYLE_NAMES`, `NOTATION_NAMES`, `INTERVAL_TYPE_NAMES`, `CHART_ORIENTATION_NAMES` — frozen objects mapping **file word → DOM value**.
  - `fileWordFor(map, domValue): string` — the reverse lookup.
  - `serializeScaleDocument(state): string` — pretty JSON, 2-space indent, trailing newline.
  - `suggestedFileName(name): string`.
  - The **state shape** every later task uses, fully populated (no defaults omitted):

    ```js
    {
      name: "Hicaz",
      settings: { notation: "generic", baseNote: 0 },
      scaleEditor: {
        mode: "relativeIntervals",                       // file vocabulary
        intervalType: { type: "edo", divisionCount: 72 },// divisionCount only when edo
        intervals: [7, 5, 12],                           // number | string per §3.3
        noteProperties: [{
          generic:   { accidental: "", name: "" },
          byzantine: { alteration: "", fthora: "",
                       martyria: null /* | { note, genus, ticks } */ },
        }],
        intervalProperties: [{ color: "#FFFFFF", label: "" }],
      },
      chart: { style: "boxes", orientation: "vertical", zoom: 100 },
    }
    ```

- [ ] **Step 1: Write the failing tests**

Create `test/unit/scale-file-format.test.js`:

```js
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
```

Update `test/integration/harness.test.js:70-77` so the asserted list holds the new script:

```js
    assert.deepEqual(
      h.scriptFiles.map((f) => path.basename(f)),
      ["byzantine.js", "smufl.js", "persistence.js", "symbols-ui.js", "byzantine-ui.js", "app.js"],
      "the load order is load-bearing: smufl.js before symbols-ui.js, which names " +
        "byzantine-ui.js's picker builders, and app.js last because it wires the page up"
    );
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/unit/scale-file-format.test.js`
Expected: FAIL — `h.app.serializeScaleDocument is not a function`.

- [ ] **Step 3: Create `persistence.js`**

```js
// ---------------------------------------------------------------------------
// The .musp.json format, version 1.
//
// No DOM. This file turns a plain state object into JSON text and back, and
// says what a document must look like; persistence-ui.js is the half that reads
// and rewrites the page.
//
// The file's vocabulary is its own — `relativeIntervals` where the DOM says
// `relative`, `segments` where it says `lines` — because a document is written
// for a person to read and hand-edit, and the DOM's words are an implementation
// detail. The maps below are the whole translation; `settings.baseNote` needs
// none, because the selector is encoded from C for exactly that reason.
// ---------------------------------------------------------------------------

const SCALE_FILE_VERSION = 1;
const SCALE_FILE_EXTENSION = ".musp.json";

// file word -> DOM value. The identity maps earn their place by giving
// validation one way to ask "is this word in the vocabulary?".
const SCALE_MODE_NAMES = Object.freeze({
  relativeIntervals: "relative",
  absoluteIntervals: "absolute",
});
const CHART_STYLE_NAMES = Object.freeze({ boxes: "boxes", segments: "lines" });
const NOTATION_NAMES = Object.freeze({ generic: "generic", byzantine: "byzantine" });
const INTERVAL_TYPE_NAMES = Object.freeze({ ratio: "ratio", edo: "edo", cents: "cents" });
const CHART_ORIENTATION_NAMES = Object.freeze({ vertical: "vertical", horizontal: "horizontal" });

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasEnumWord(map, word) {
  return typeof word === "string" && Object.prototype.hasOwnProperty.call(map, word);
}

/** The file's word for a DOM value, given a `file word -> DOM value` map. */
function fileWordFor(map, domValue) {
  for (const word of Object.keys(map)) {
    if (map[word] === domValue) return word;
  }
  return domValue;
}

// --- writing ---------------------------------------------------------------

/** A state object as pretty JSON: 2-space indent, trailing newline. */
function serializeScaleDocument(state) {
  return JSON.stringify(scaleDocumentFrom(state), null, 2) + "\n";
}

function scaleDocumentFrom(state) {
  const editorState = state.scaleEditor;
  const intervalType = { type: editorState.intervalType.type };
  if (intervalType.type === "edo") {
    intervalType.divisionCount = editorState.intervalType.divisionCount;
  }

  const doc = { formatVersion: SCALE_FILE_VERSION };
  if (state.name) doc.name = state.name;
  doc.settings = { notation: state.settings.notation, baseNote: state.settings.baseNote };
  doc.scaleEditor = {
    mode: editorState.mode,
    intervalType: intervalType,
    intervals: editorState.intervals.slice(),
    noteProperties: editorState.noteProperties.map(noteDocumentFrom),
    intervalProperties: editorState.intervalProperties.map(intervalDocumentFrom),
  };
  doc.chart = {
    style: state.chart.style,
    orientation: state.chart.orientation,
    zoom: state.chart.zoom,
  };
  return doc;
}

/**
 * One note, with everything at its default left out — so an untouched note is
 * `{}` and a half with nothing in it disappears entirely. The reader accepts
 * the omission and the explicit default alike, so nothing is lost by it.
 */
function noteDocumentFrom(note) {
  const out = {};

  const generic = {};
  if (note.generic.accidental) generic.accidental = note.generic.accidental;
  if (note.generic.name) generic.name = note.generic.name;
  if (Object.keys(generic).length > 0) out.generic = generic;

  const byzantine = {};
  if (note.byzantine.alteration) byzantine.alteration = note.byzantine.alteration;
  if (note.byzantine.fthora) byzantine.fthora = note.byzantine.fthora;
  const source = note.byzantine.martyria;
  if (source && source.note) {
    // No note is no martyria, the same rule writeMartyria() keeps.
    const martyria = { note: source.note };
    if (source.genus && source.genus !== GENUS_NONE) martyria.genus = source.genus;
    if (source.ticks) martyria.ticks = source.ticks;
    byzantine.martyria = martyria;
  }
  if (Object.keys(byzantine).length > 0) out.byzantine = byzantine;

  return out;
}

function intervalDocumentFrom(interval) {
  const out = { color: interval.color };
  if (interval.label) out.label = interval.label;
  return out;
}

/**
 * "Hicaz Hümayun" -> "hicaz-h-mayun.musp.json". Lowercased, every run outside
 * a-z0-9 collapsed to one dash, the ends trimmed. A name that slugs away to
 * nothing gives "scale".
 */
function suggestedFileName(name) {
  const slug = String(name == null ? "" : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "scale") + SCALE_FILE_EXTENSION;
}
```

- [ ] **Step 4: Load it from the page**

In `index.html`, insert between the `smufl.js` and `symbols-ui.js` tags:

```html
  <script src="persistence.js" defer></script>
```

- [ ] **Step 5: Guard the new file with the testing rule**

In `.claude/rules/testing.md`, add to `paths:` after `- "smufl.js"`:

```yaml
  - "persistence.js"
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, including `harness.test.js`'s script-list assertion.

- [ ] **Step 7: Commit**

```bash
git add persistence.js index.html .claude/rules/testing.md test/unit/scale-file-format.test.js test/integration/harness.test.js
git commit -m "[#15] File persistence — write a .musp.json document

persistence.js is the no-DOM half of the format: the enum maps that translate
between the file's vocabulary and the DOM's, serializeScaleDocument() and
suggestedFileName(). The writer omits anything sitting at its default, so an
untouched note serialises as {}.

harness.test.js's asserted script list grows by one, deliberately: the load
order is what the assertion is for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 3: `persistence.js` — reading a document

Design §3.3, §3.4, §6. Parse, then validate the **whole** document before anything is touched, so a rejected file leaves the editor exactly as it was.

**Files:**
- Modify: `persistence.js` (append the reading half)
- Modify: `test/unit/scale-file-format.test.js` (append)

**Interfaces:**
- Consumes: `SCALE_FILE_VERSION`, the five enum maps, `isPlainObject`, `hasEnumWord`, `HEX_COLOR_PATTERN` (Task 2); `smuflAccidentalById` (`smufl.js:715`), `byzAlterationById`, `byzFthoraById`, `byzNoteById`, `byzGenusById`, `GENUS_NONE` (`byzantine.js`).
- Produces:
  - `parseScaleDocument(text): { ok: true, doc } | { ok: false, error: string }`
  - `validateScaleDocument(raw): { ok: true, doc } | { ok: false, error: string }`
  - `doc` is the fully populated state shape from Task 2, so `parseScaleDocument(serializeScaleDocument(x)).doc` deep-equals `x`.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/scale-file-format.test.js` (it already defines `sampleState()`):

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/unit/scale-file-format.test.js`
Expected: FAIL — `h.app.parseScaleDocument is not a function`.

- [ ] **Step 3: Append the reading half to `persistence.js`**

```js
// --- reading ---------------------------------------------------------------
//
// Everything is checked before anything is handed back, so a rejected file
// leaves the editor exactly as it was — there is never a half-loaded scale.
// Unknown keys are ignored, so a document from a future minor addition still
// opens; symbol ids are resolved against the real tables, so a typo in a
// hand-edited file is named rather than dropped into an empty well.

function scaleFileError(message) {
  return { ok: false, error: message };
}

function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}

function clampZoom(value) {
  if (value === undefined || value === null) return 100;
  const zoom = Math.round(Number(value));
  if (!Number.isFinite(zoom)) return 100;
  return Math.min(100, Math.max(10, zoom));
}

function parseScaleDocument(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return scaleFileError("Not a valid JSON file.");
  }
  return validateScaleDocument(raw);
}

function validateScaleDocument(raw) {
  if (!isPlainObject(raw)) return scaleFileError("Not a Music Scale Plot file.");

  const version = raw.formatVersion;
  if (version === undefined) {
    return scaleFileError("Not a Music Scale Plot file: no formatVersion.");
  }
  if (!Number.isInteger(version) || version < 1) {
    return scaleFileError(
      `Not a Music Scale Plot file: formatVersion must be a whole number, got ${JSON.stringify(version)}.`
    );
  }
  if (version > SCALE_FILE_VERSION) {
    return scaleFileError(
      `This file was saved by a newer version of Music Scale Plot (format ${version}).`
    );
  }

  if (raw.name !== undefined && typeof raw.name !== "string") {
    return scaleFileError("name must be text.");
  }
  const name = raw.name === undefined ? "" : raw.name;

  const settings = isPlainObject(raw.settings) ? raw.settings : {};
  const notation = settings.notation === undefined ? "generic" : settings.notation;
  if (!hasEnumWord(NOTATION_NAMES, notation)) {
    return scaleFileError(
      `settings.notation must be "generic" or "byzantine", got ${JSON.stringify(notation)}.`
    );
  }
  const baseNote = settings.baseNote === undefined ? 0 : settings.baseNote;
  if (!Number.isInteger(baseNote) || baseNote < 0 || baseNote > 11) {
    return scaleFileError(
      `settings.baseNote must be a whole number from 0 to 11 (0 = C), got ${JSON.stringify(baseNote)}.`
    );
  }

  const editorRaw = isPlainObject(raw.scaleEditor) ? raw.scaleEditor : {};

  const mode = editorRaw.mode === undefined ? "relativeIntervals" : editorRaw.mode;
  if (!hasEnumWord(SCALE_MODE_NAMES, mode)) {
    return scaleFileError(
      `scaleEditor.mode must be "relativeIntervals" or "absoluteIntervals", got ${JSON.stringify(mode)}.`
    );
  }

  const typeRaw = isPlainObject(editorRaw.intervalType) ? editorRaw.intervalType : {};
  const type = typeRaw.type === undefined ? "ratio" : typeRaw.type;
  if (!hasEnumWord(INTERVAL_TYPE_NAMES, type)) {
    return scaleFileError(
      `scaleEditor.intervalType.type must be "ratio", "edo" or "cents", got ${JSON.stringify(type)}.`
    );
  }
  const intervalType = { type: type };
  if (type === "edo") {
    // Required here and written nowhere else: an EDO scale without it has no
    // step size, so there is nothing sensible to fall back on.
    if (!Number.isInteger(typeRaw.divisionCount) || typeRaw.divisionCount < 1) {
      return scaleFileError(
        "scaleEditor.intervalType.divisionCount must be a whole number of at least 1."
      );
    }
    intervalType.divisionCount = typeRaw.divisionCount;
  }

  if (!Array.isArray(editorRaw.noteProperties) || editorRaw.noteProperties.length < 2) {
    return scaleFileError("scaleEditor.noteProperties must list at least 2 notes.");
  }
  const noteCount = editorRaw.noteProperties.length;

  if (countOf(editorRaw.intervalProperties) !== noteCount - 1) {
    return scaleFileError(
      `scaleEditor.intervalProperties has ${countOf(editorRaw.intervalProperties)} entries, ` +
        `expected ${noteCount - 1}.`
    );
  }
  // Relative intervals sit between the notes; absolute ones sit on them, and
  // the first is the unison the editor shows disabled on Note 1.
  const expectedIntervals = mode === "absoluteIntervals" ? noteCount : noteCount - 1;
  if (countOf(editorRaw.intervals) !== expectedIntervals) {
    return scaleFileError(
      `scaleEditor.intervals has ${countOf(editorRaw.intervals)} entries, expected ${expectedIntervals}.`
    );
  }

  const intervals = [];
  for (let i = 0; i < editorRaw.intervals.length; i++) {
    const item = editorRaw.intervals[i];
    const usable =
      typeof item === "string" || (typeof item === "number" && Number.isFinite(item));
    if (!usable) return scaleFileError(`scaleEditor.intervals[${i}] must be a number or text.`);
    intervals.push(item);
  }

  const noteProperties = [];
  for (let i = 0; i < noteCount; i++) {
    const note = validateNoteProperties(editorRaw.noteProperties[i], i + 1);
    if (!note.ok) return note;
    noteProperties.push(note.value);
  }

  const intervalProperties = [];
  for (let i = 0; i < editorRaw.intervalProperties.length; i++) {
    const properties = validateIntervalProperties(editorRaw.intervalProperties[i], i);
    if (!properties.ok) return properties;
    intervalProperties.push(properties.value);
  }

  const chart = isPlainObject(raw.chart) ? raw.chart : {};
  const style = chart.style === undefined ? "boxes" : chart.style;
  if (!hasEnumWord(CHART_STYLE_NAMES, style)) {
    return scaleFileError(`chart.style must be "boxes" or "segments", got ${JSON.stringify(style)}.`);
  }
  const orientation = chart.orientation === undefined ? "vertical" : chart.orientation;
  if (!hasEnumWord(CHART_ORIENTATION_NAMES, orientation)) {
    return scaleFileError(
      `chart.orientation must be "vertical" or "horizontal", got ${JSON.stringify(orientation)}.`
    );
  }

  return {
    ok: true,
    doc: {
      name: name,
      settings: { notation: notation, baseNote: baseNote },
      scaleEditor: {
        mode: mode,
        intervalType: intervalType,
        intervals: intervals,
        noteProperties: noteProperties,
        intervalProperties: intervalProperties,
      },
      // Clamped, not rejected: the value has one obvious safe reading and the
      // slider would clamp it anyway.
      chart: { style: style, orientation: orientation, zoom: clampZoom(chart.zoom) },
    },
  };
}

function validateNoteProperties(raw, degree) {
  const source = isPlainObject(raw) ? raw : {};
  const generic = isPlainObject(source.generic) ? source.generic : {};
  const byzantine = isPlainObject(source.byzantine) ? source.byzantine : {};

  const accidental = generic.accidental === undefined ? "" : generic.accidental;
  if (typeof accidental !== "string" || (accidental && !smuflAccidentalById(accidental))) {
    return scaleFileError(`Unknown accidental ${JSON.stringify(accidental)} on note ${degree}.`);
  }
  const noteName = generic.name === undefined ? "" : generic.name;
  if (typeof noteName !== "string") {
    return scaleFileError(`The name on note ${degree} must be text.`);
  }

  const alteration = byzantine.alteration === undefined ? "" : byzantine.alteration;
  if (typeof alteration !== "string" || (alteration && !byzAlterationById(alteration))) {
    return scaleFileError(
      `Unknown sign of alteration ${JSON.stringify(alteration)} on note ${degree}.`
    );
  }
  const fthora = byzantine.fthora === undefined ? "" : byzantine.fthora;
  if (typeof fthora !== "string" || (fthora && !byzFthoraById(fthora))) {
    return scaleFileError(`Unknown fthora ${JSON.stringify(fthora)} on note ${degree}.`);
  }

  let martyria = null;
  if (byzantine.martyria !== undefined && byzantine.martyria !== null) {
    const martyriaRaw = isPlainObject(byzantine.martyria) ? byzantine.martyria : {};
    // The one martyria field that is not optional: no note is no martyria.
    if (typeof martyriaRaw.note !== "string" || !byzNoteById(martyriaRaw.note)) {
      return scaleFileError(
        `Unknown martyria note ${JSON.stringify(martyriaRaw.note)} on note ${degree}.`
      );
    }
    const genus = martyriaRaw.genus === undefined ? GENUS_NONE : martyriaRaw.genus;
    if (genus !== GENUS_NONE && (typeof genus !== "string" || !byzGenusById(genus))) {
      return scaleFileError(`Unknown martyria genus ${JSON.stringify(genus)} on note ${degree}.`);
    }
    // The ladder only ever holds 0 or 1 (ladderNoteAt, byzantine.js).
    const ticks = martyriaRaw.ticks === undefined ? 0 : martyriaRaw.ticks;
    if (!Number.isInteger(ticks) || ticks < 0 || ticks > 1) {
      return scaleFileError(`The martyria tick count on note ${degree} must be 0 or 1.`);
    }
    martyria = { note: martyriaRaw.note, genus: genus, ticks: ticks };
  }

  return {
    ok: true,
    value: {
      generic: { accidental: accidental, name: noteName },
      byzantine: { alteration: alteration, fthora: fthora, martyria: martyria },
    },
  };
}

function validateIntervalProperties(raw, index) {
  const source = isPlainObject(raw) ? raw : {};
  // Always written, so always required: there is no single default colour —
  // it depends on the active palette, which depends on chart.style.
  if (typeof source.color !== "string" || !HEX_COLOR_PATTERN.test(source.color)) {
    return scaleFileError(
      `scaleEditor.intervalProperties[${index}].color must be a hex colour like "#CCFFCC".`
    );
  }
  const label = source.label === undefined ? "" : source.label;
  if (typeof label !== "string") {
    return scaleFileError(`scaleEditor.intervalProperties[${index}].label must be text.`);
  }
  return { ok: true, value: { color: source.color, label: label } };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/unit/scale-file-format.test.js`
Expected: PASS, including the round-trip and every rejection message.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add persistence.js test/unit/scale-file-format.test.js
git commit -m "[#15] File persistence — read and validate a .musp.json document

parseScaleDocument() parses and hands the result to validateScaleDocument(),
which checks the whole document before anything is handed back — so a rejected
file can never leave a half-loaded editor. Symbol ids resolve against the real
tables, so a typo in a hand-edited file is named rather than silently dropped
into an empty well.

Unknown keys are ignored and chart.zoom is clamped rather than refused; both
are deliberate softenings. Every rejection is tested by its message.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 4: Extract the row builders

Design §4, edit 4. `resetScaleToDefault`, `addNote` and the coming `applyDocumentState` all build a row the same six-line way, and today two of them repeat it verbatim. Pure REFACTOR: no assertion changes, and the existing suite is the gate.

**Files:**
- Modify: `app.js:271-311` (after `makeIntervalRowHTML`), `app.js:332-370` (`addNote`), `app.js:1195-1225` (`resetScaleToDefault`)

**Interfaces:**
- Consumes: `makeNoteRowHTML`, `makeIntervalRowHTML`, `refreshNoteRowWells`.
- Produces:
  - `makeNoteRowElement(degree, mode, absoluteValue): HTMLDivElement` — a detached `.row.note-row` with `data-degree` set and its wells already painted.
  - `makeIntervalRowElement(value, mode): HTMLDivElement` — a detached `.row.interval-row`.

- [ ] **Step 1: Confirm the suite is green before touching anything**

Run: `npm test`
Expected: PASS. A refactor starts from green or it is not a refactor.

- [ ] **Step 2: Add the two builders**

Insert into `app.js` immediately after `makeIntervalRowHTML` (which ends at line 311):

```js
/**
 * A note row, built and painted but not yet in the document.
 *
 * `resetScaleToDefault`, `addNote` and `applyDocumentState` all want the same
 * six lines — element, classes, degree, markup, wells — so they say it once
 * here. `refreshNoteRowWells` works on a detached row: it measures on its own
 * offscreen context and never reads layout.
 */
function makeNoteRowElement(degree, mode, absoluteValue) {
  const row = document.createElement("div");
  row.className = "row note-row";
  row.dataset.degree = degree;
  row.innerHTML = makeNoteRowHTML(degree, mode, absoluteValue);
  refreshNoteRowWells(row);
  return row;
}

function makeIntervalRowElement(value, mode) {
  const row = document.createElement("div");
  row.className = "row interval-row";
  row.innerHTML = makeIntervalRowHTML(value, mode);
  return row;
}
```

- [ ] **Step 3: Use them in `addNote`**

In `app.js:332-370`, replace the six lines that build the two rows — from `const intervalRow = document.createElement("div");` through `refreshNoteRowWells(noteRow);` — with:

```js
  const intervalRow = makeIntervalRowElement(defaultVal, mode);
  const absVal = mode === "absolute" ? getDefaultAbsoluteForNewNote() : undefined;
  const noteRow = makeNoteRowElement(degree, mode, absVal);
```

`getDefaultAbsoluteForNewNote()` still runs **before** the new rows are appended — it reads the last existing note row, so the order is load-bearing.

- [ ] **Step 4: Use them in `resetScaleToDefault`**

Replace the body of `app.js:1195-1225` between `editor.innerHTML = "";` and `updateRemoveBtn();` with:

```js
  editor.appendChild(makeNoteRowElement(1, mode));
  editor.appendChild(makeIntervalRowElement(defaultVal, mode));
  // In absolute mode, Note 2's absolute = the relative default (stacked on unison).
  editor.appendChild(makeNoteRowElement(2, mode, defaultVal));
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, with **no assertion edited**. If a test went red, this was not behaviour-preserving — revert and find the difference rather than changing the test.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "[#15] Extract makeNoteRowElement and makeIntervalRowElement

resetScaleToDefault and addNote built their rows the same six-line way,
verbatim; applyDocumentState will want the third copy. Behaviour-preserving,
so no assertion changed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 5: The toolbar shell, the icons, and the relocated note buttons

Design §5.2. A sticky bar across the top of the page, and Add note / Remove last note move into it — with their **IDs unchanged**, which is what keeps every listener in `app.js` and every existing test working.

**Files:**
- Create: `icons/new.svg`, `icons/open.svg`, `icons/save.svg`, `icons/add-note.svg`, `icons/remove-note.svg`
- Create: `test/integration/toolbar.test.js`
- Modify: `index.html` (add `#toolbar` before `.container`; delete `.editor-controls`)
- Modify: `style.css` (new Toolbar section; delete the `.editor-controls` / `#add-note` / `#remove-note` block at `style.css:1082-1151`)

**Interfaces:**
- Consumes: nothing new from JS. `#add-note` and `#remove-note` keep their IDs, so `app.js:52-53` and `app.js:1776-1777` are untouched.
- Produces: `#toolbar` (sticky, `role="toolbar"`), `.toolbar-btn` buttons `#new-file`, `#open-file`, `#save-menu`, `#add-note`, `#remove-note`, a `.toolbar-separator`, `#toolbar-message` (`role="alert"`, `hidden`) and a hidden `#open-file-input`. `#new-file`, `#open-file` and `#save-menu` are markup only until Tasks 6–10 wire them; the file input lands here rather than with its handler so `persistence-ui.js` never holds a `null` element handle.

- [ ] **Step 1: Write the failing tests**

Create `test/integration/toolbar.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, fireClick, noteRows } = require("../helpers/harness.js");

function toolbar(h) {
  return h.document.getElementById("toolbar");
}

test("the toolbar", async (t) => {
  await t.test("sits before the page container so it can stick to the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bar = toolbar(h);
    assert.ok(bar, "there is no #toolbar");
    assert.equal(bar.parentElement, h.document.body, "it must be a direct child of body");
    assert.equal(
      bar.nextElementSibling,
      h.el(".container"),
      "the container follows it, so the toolbar is above the panels"
    );
  });

  await t.test("names every button, because none of them carries text", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The buttons are icons only, so aria-label is their whole accessible
    // name — function, not appearance.
    const labels = h.all("#toolbar .toolbar-btn").map((b) => b.getAttribute("aria-label"));
    assert.deepEqual(labels, ["New", "Open", "Save", "Add note", "Remove last note"]);
    for (const button of h.all("#toolbar .toolbar-btn")) {
      assert.ok(button.querySelector("img"), `${button.id} has no icon`);
      assert.equal(button.querySelector("img").alt, "", "the label is on the button, not the image");
    }
  });

  await t.test("holds the note buttons, which the Scale Editor no longer does", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.document.getElementById("add-note").closest("#toolbar"), toolbar(h));
    assert.equal(h.document.getElementById("remove-note").closest("#toolbar"), toolbar(h));
    assert.equal(h.el(".editor-controls"), null, "the old editor control strip is gone");
  });

  await t.test("adds and removes notes from its new home", () => {
    const h = loadApp();
    t.after(() => h.close());

    const addBtn = h.document.getElementById("add-note");
    const removeBtn = h.document.getElementById("remove-note");

    assert.equal(noteRows(h).length, 2);
    assert.equal(removeBtn.disabled, true, "two notes is the smallest legal scale");

    fireClick(h, addBtn);
    assert.equal(noteRows(h).length, 3);
    assert.equal(removeBtn.disabled, false);

    fireClick(h, removeBtn);
    assert.equal(noteRows(h).length, 2);
  });

  await t.test("keeps a message bar, empty and hidden until something goes wrong", () => {
    const h = loadApp();
    t.after(() => h.close());

    const message = h.document.getElementById("toolbar-message");
    assert.ok(message, "there is no #toolbar-message");
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
    assert.equal(message.getAttribute("role"), "alert");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/toolbar.test.js`
Expected: FAIL — "there is no #toolbar".

- [ ] **Step 3: Draw the icons**

Five files under a new `icons/` directory. Each bakes `#1a1814` (the `--ink` token) because an SVG loaded through `<img>` renders in a document no page CSS reaches, so `currentColor` never resolves.

`icons/new.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>
  <path d="M14 3v5h5"/>
</svg>
```

`icons/open.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <path d="M3 11h18"/>
</svg>
```

`icons/save.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/>
  <path d="M8 3v6h7V3"/>
  <path d="M7 21v-6h10v6"/>
</svg>
```

`icons/add-note.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="2" stroke-linecap="round">
  <path d="M12 5v14"/>
  <path d="M5 12h14"/>
</svg>
```

`icons/remove-note.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="2" stroke-linecap="round">
  <path d="M5 12h14"/>
</svg>
```

- [ ] **Step 4: Add the toolbar markup**

In `index.html`, insert immediately after `<body>` and before `<div class="container">`:

```html
  <div id="toolbar" role="toolbar" aria-label="File and scale actions">
    <button type="button" id="new-file" class="toolbar-btn" aria-label="New" title="New">
      <img src="icons/new.svg" alt="">
    </button>
    <button type="button" id="open-file" class="toolbar-btn" aria-label="Open" title="Open">
      <img src="icons/open.svg" alt="">
    </button>
    <button type="button" id="save-menu" class="toolbar-btn" aria-label="Save" title="Save">
      <img src="icons/save.svg" alt="">
    </button>
    <span class="toolbar-separator"></span>
    <button type="button" id="add-note" class="toolbar-btn" aria-label="Add note" title="Add note">
      <img src="icons/add-note.svg" alt="">
    </button>
    <button type="button" id="remove-note" class="toolbar-btn" aria-label="Remove last note" title="Remove last note">
      <img src="icons/remove-note.svg" alt="">
    </button>
    <div id="toolbar-message" role="alert" hidden></div>
    <input type="file" id="open-file-input" accept=".musp.json,application/json" hidden>
  </div>
```

Then delete the old control strip:

```html
      <div class="editor-controls">
        <button id="add-note">Add note</button>
        <button id="remove-note">Remove last note</button>
      </div>
```

- [ ] **Step 5: Style it**

Delete `style.css:1082-1151` — the whole `/* --- Editor controls --- */` block, from `.editor-controls {` through `#remove-note:disabled { … }` — and add a new section before `/* === Chart Panel === */`:

```css
/* === Toolbar ================================================= */

/* z-index 200 clears the symbol pickers' 100. Both live in the root stacking
   context — a picker escapes the editor panel into it (see Motion, below) — so
   200 is the number "always on top" actually has to beat. */
#toolbar {
  position: sticky;
  top: 0;
  z-index: 200;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 2rem;
  background: var(--paper-warm);
  border-bottom: 1px solid var(--rule);
  box-shadow: 0 2px 10px -8px rgba(30, 20, 10, 0.55);
}

/* An SVG loaded through <img> renders in an isolated document that no page CSS
   reaches, so `currentColor` never resolves and each file's ink is baked at
   --ink. Every state is therefore opacity plus the button's own background —
   which is also why all five buttons share one treatment rather than Add note
   keeping its old filled-primary emphasis. */
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}

.toolbar-btn img {
  width: 1.2rem;
  height: 1.2rem;
  opacity: 0.72;
  pointer-events: none;
  transition: opacity 0.15s;
}

.toolbar-btn:hover:not(:disabled),
.toolbar-btn:focus-visible,
.toolbar-btn:active:not(:disabled) { background: var(--paper-deep); }

.toolbar-btn:hover:not(:disabled) img,
.toolbar-btn:focus-visible img { opacity: 1; }

.toolbar-btn:disabled { background: transparent; cursor: not-allowed; }
.toolbar-btn:disabled img { opacity: 0.3; }

.toolbar-separator {
  width: 1px;
  height: 1.4rem;
  margin: 0 0.35rem;
  background: var(--rule);
}

#toolbar-message {
  flex: 1 0 100%;
  margin-top: 0.35rem;
  padding: 0.4rem 0.6rem;
  border-radius: 3px;
  background: rgba(138, 46, 26, 0.1);
  color: var(--accent);
  font-size: 0.82rem;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test test/integration/toolbar.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS. `editor.test.js`, `settings.test.js` and `byzantine-pickers.test.js` reach the note buttons by ID, so nothing there moves.

- [ ] **Step 8: Commit**

```bash
git add icons index.html style.css test/integration/toolbar.test.js
git commit -m "[#15] Add the sticky toolbar and move the note buttons into it

A sticky #toolbar before .container, z-index 200 so it clears the symbol
pickers' 100 in the root stacking context. Add note and Remove last note move
out of the Scale Editor with their IDs unchanged, so every listener and every
existing test still reaches them — which is what makes the move cheap.

Icons are real .svg files loaded through <img>, so their ink is baked at
--ink and every state is opacity plus the button's background. Add note
loses its filled-primary emphasis, deliberately: it is one of five peers in a
toolbar now. New, Open and Save are markup only until they are wired.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 6: The Save menu, and Save as PNG moves into it

Design §5.2. `persistence-ui.js` is born here, holding the menu and nothing else yet.

**Files:**
- Create: `persistence-ui.js`
- Modify: `index.html` (wrap `#save-menu` in a panel; move `#save-png` out of `.chart-toolbar`; add the `persistence-ui.js` tag before `app.js`)
- Modify: `style.css` (the menu panel; drop the `.chart-toolbar #save-png` and `.chart-toolbar button` rules)
- Modify: `app.js:1592-1600` (`closeAllDropdowns`)
- Modify: `.claude/rules/testing.md` (`persistence-ui.js` in `paths:`)
- Modify: `test/integration/harness.test.js` (script list)
- Modify: `test/integration/toolbar.test.js` (append)

**Interfaces:**
- Consumes: `closeAllDropdowns` (`app.js:1592`), resolved at click time.
- Produces:
  - `newBtn`, `openBtn`, `saveMenuBtn`, `saveMenuPanel`, `saveScaleItem`, `toolbarMessage`, `openFileInput` — top-level element handles in `persistence-ui.js`.
  - `toggleSaveMenu(open?): void` — omit `open` to flip.
  - `closeSaveMenu(): void` — called by `closeAllDropdowns()`.

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/toolbar.test.js`:

```js
test("the Save menu", async (t) => {
  await t.test("opens under the Save button and says so", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = h.document.getElementById("save-menu");
    const panel = h.document.getElementById("save-menu-panel");
    assert.equal(button.getAttribute("aria-haspopup"), "menu");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.classList.contains("open"), false);

    fireClick(h, button);
    assert.equal(panel.classList.contains("open"), true);
    assert.equal(button.getAttribute("aria-expanded"), "true");
  });

  await t.test("closes on a second click of the button", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = h.document.getElementById("save-menu");
    fireClick(h, button);
    fireClick(h, button);
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
    assert.equal(button.getAttribute("aria-expanded"), "false");
  });

  await t.test("closes with every other transient overlay", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    // closeAllDropdowns() means "close every transient overlay" — the colour
    // dropdowns, the symbol pickers and now this.
    h.app.closeAllDropdowns();
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
  });

  await t.test("closes when a click lands outside it", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.body);
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
  });

  await t.test("holds the two save items, the PNG one moved from the Chart panel", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.document.getElementById("save-menu-panel");
    assert.deepEqual(
      [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ["Save As Music Scale Plot file", "Save As PNG"]
    );
    assert.equal(h.document.getElementById("save-png").closest("#save-menu-panel"), panel);
    assert.equal(h.el(".chart-toolbar #save-png"), null, "it no longer sits in the Chart panel");
  });

  await t.test("still exports a PNG from its new home", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-png"));
    assert.equal(h.downloads.length, 1, "no PNG was exported");
    assert.equal(h.downloads[0].download, "scale.png");
  });
});
```

Update the script list in `test/integration/harness.test.js`:

```js
      ["byzantine.js", "smufl.js", "persistence.js", "symbols-ui.js", "byzantine-ui.js",
       "persistence-ui.js", "app.js"],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/toolbar.test.js`
Expected: FAIL — `#save-menu-panel` is null.

- [ ] **Step 3: Wrap the Save button in a menu**

In `index.html`, replace the `#save-menu` button from Task 5 with:

```html
    <div class="save-menu-wrapper">
      <button type="button" id="save-menu" class="toolbar-btn has-caret" aria-label="Save" title="Save"
              aria-haspopup="menu" aria-expanded="false">
        <img src="icons/save.svg" alt="">
      </button>
      <div class="save-menu-panel" id="save-menu-panel" role="menu">
        <button type="button" role="menuitem" id="save-scale">Save As Music Scale Plot file</button>
        <hr>
        <button type="button" role="menuitem" id="save-png">Save As PNG</button>
      </div>
    </div>
```

Delete the row that held the button in the Chart panel:

```html
        <div class="chart-toolbar-row">
          <button id="save-png">Save as PNG</button>
        </div>
```

Add the script tag between `byzantine-ui.js` and `app.js`:

```html
  <script src="persistence-ui.js" defer></script>
```

- [ ] **Step 4: Create `persistence-ui.js`**

```js
// ---------------------------------------------------------------------------
// The toolbar, and the file flows behind it.
//
// This file only *defines* functions and *wires* listeners at its top level: it
// loads before app.js, which runs at load time, so it must never call into
// app.js here. Its handlers resolve app.js's globals at click time, which is
// long afterwards.
// ---------------------------------------------------------------------------

const newBtn = document.getElementById("new-file");
const openBtn = document.getElementById("open-file");
const saveMenuBtn = document.getElementById("save-menu");
const saveMenuPanel = document.getElementById("save-menu-panel");
const saveScaleItem = document.getElementById("save-scale");
const toolbarMessage = document.getElementById("toolbar-message");
const openFileInput = document.getElementById("open-file-input");

// --- the Save menu ---------------------------------------------------------

/** Opens or closes the Save menu; omit `open` to flip it. */
function toggleSaveMenu(open) {
  const show = open === undefined ? !saveMenuPanel.classList.contains("open") : Boolean(open);
  saveMenuPanel.classList.toggle("open", show);
  saveMenuBtn.setAttribute("aria-expanded", String(show));
}

/** Called by app.js's closeAllDropdowns(), which closes every transient overlay. */
function closeSaveMenu() {
  toggleSaveMenu(false);
}

saveMenuBtn.addEventListener("click", function (event) {
  // Read the state first: closeAllDropdowns() closes this menu too, so asking
  // afterwards would always say "closed" and the button would never toggle off.
  const wasOpen = saveMenuPanel.classList.contains("open");
  event.stopPropagation();
  closeAllDropdowns();
  toggleSaveMenu(!wasOpen);
});
```

- [ ] **Step 5: Let `closeAllDropdowns` close it**

In `app.js:1592-1600`, add one line beside `closeSymbolPickers()`:

```js
  closeSymbolPickers();
  closeSaveMenu();
```

- [ ] **Step 6: Style the menu**

Add to the Toolbar section of `style.css`:

```css
.save-menu-wrapper { position: relative; }

/* The caret is a CSS triangle rather than a sixth .svg, so it follows the
   button's own colour instead of being baked like the icons. */
.toolbar-btn.has-caret::after {
  content: '';
  margin-left: 0.15rem;
  border: 3px solid transparent;
  border-top-color: var(--ink);
  border-bottom: 0;
  opacity: 0.72;
}

.save-menu-panel {
  display: none;
  position: absolute;
  top: calc(100% + 0.3rem);
  left: 0;
  min-width: 15rem;
  padding: 0.3rem;
  background: var(--paper-fade);
  border: 1px solid var(--rule);
  border-radius: 3px;
  box-shadow: 0 10px 24px -12px rgba(30, 20, 10, 0.5);
}

.save-menu-panel.open { display: block; }

.save-menu-panel button {
  display: block;
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ink);
  font-family: inherit;
  font-size: 0.85rem;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.save-menu-panel button:hover { background: var(--paper-deep); }

.save-menu-panel hr {
  margin: 0.25rem 0.3rem;
  border: 0;
  border-top: 1px solid var(--rule-soft);
}
```

Delete the two rules the moved button leaves behind — `style.css`'s `/* Save button row has no label … */ .chart-toolbar #save-png { margin-left: … }` and the `.chart-toolbar button`, `.chart-toolbar button:hover`, `.chart-toolbar button:active` block.

- [ ] **Step 7: Add `persistence-ui.js` to the testing rule**

In `.claude/rules/testing.md`, add after `- "byzantine-ui.js"`:

```yaml
  - "persistence-ui.js"
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS, including `settings.test.js`'s PNG export tests, which click `#save-png` by ID.

- [ ] **Step 9: Commit**

```bash
git add persistence-ui.js index.html style.css app.js .claude/rules/testing.md test/integration/toolbar.test.js test/integration/harness.test.js
git commit -m "[#15] Add the Save menu and move Save as PNG into it

persistence-ui.js is the DOM half of file persistence; it starts with the Save
menu. closeAllDropdowns() now closes it too, so the one function keeps meaning
\"close every transient overlay\".

Save as PNG moves out of the Chart panel into the menu, keeping its #save-png
id, so its listener and its export tests are untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 7: Name, Interval Type and EDO Divisions move into the Scale Editor

Design §5.2 ("What moves"), §2 (the two location decisions). Settings is left with Notation and Base Note.

**Files:**
- Modify: `index.html` (three rows into the editor panel; a new `.scale-name-row`)
- Modify: `style.css:134-206` (the settings family), `style.css:218-260` (the editor family), the responsive block at `style.css:1323-1348`
- Modify: `app.js:49-66` (add `scaleNameInput`), `app.js:1246-1259` (`resetControlsToDefaults`)
- Modify: `test/integration/toolbar.test.js` (append), `test/integration/startup-reset.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `scaleNameInput` — the `#scale-name` text input, declared in `app.js` beside the other editor controls. `resetControlsToDefaults()` clears it along with `#edo-divisions` and `#zoom`, by reading `defaultValue` off the markup.

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/toolbar.test.js`:

```js
test("the Scale Editor's own settings", async (t) => {
  await t.test("holds Name, Interval Type, EDO Divisions and Mode, in that order", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Interval Type and Mode are the two axes that decide what an interval box
    // means, and changing either rebuilds the editor — so they are editor
    // operations, not settings. A name is a property of the scale.
    const panel = h.el(".editor-panel");
    assert.deepEqual(
      [...panel.querySelectorAll(".scale-name-row, .interval-type-row, .edo-settings-row, .scale-mode-row")]
        .map((row) => row.className),
      ["scale-name-row", "interval-type-row", "edo-settings-row", "scale-mode-row"]
    );
  });

  await t.test("leaves Settings with Notation and Base Note alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.el(".settings-panel");
    assert.equal(panel.querySelector(".interval-type-row"), null);
    assert.equal(panel.querySelector(".edo-settings-row"), null);
    assert.ok(panel.querySelector(".notation-row"));
    assert.ok(panel.querySelector(".base-note-row"));
  });

  await t.test("starts with an empty scale name", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.document.getElementById("scale-name").value, "");
  });
});
```

In `test/integration/startup-reset.test.js`, add to `RESTORED` (after line 31):

```js
  "#scale-name": "a name the browser restored",
```

and to the "puts every setting back to its markup default" assertions (after line 67):

```js
      assert.equal(valueOf("scale-name"), "", "the scale name is part of the reset too");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/toolbar.test.js test/integration/startup-reset.test.js`
Expected: FAIL — `.scale-name-row` is missing, and `#scale-name` does not exist.

- [ ] **Step 3: Move the markup**

In `index.html`, delete `.interval-type-row` and `.edo-settings-row` from the settings panel, leaving it with `<h2>Settings</h2>`, `.notation-row` and `.base-note-row`. Then in the editor panel, insert between `<h2>Scale Editor</h2>` and `.scale-mode-row`:

```html
      <div class="scale-name-row">
        <label for="scale-name">Name</label>
        <input type="text" id="scale-name" placeholder="untitled">
      </div>
      <div class="interval-type-row">
        <label for="interval-type">Interval Type</label>
        <select id="interval-type">
          <option value="ratio">Ratio</option>
          <option value="edo">Equal Division of the Octave (EDO)</option>
          <option value="cents">Cents</option>
        </select>
      </div>
      <div class="edo-settings-row" id="edo-settings" style="display: none;">
        <label for="edo-divisions">Divisions per Octave</label>
        <div class="edo-input-stack">
          <input type="number" id="edo-divisions" value="12" min="1">
          <span id="edo-cents-label"></span>
        </div>
      </div>
```

- [ ] **Step 4: Reconcile the two CSS families**

In `style.css`, narrow the Settings family — replace every four-selector list under `/* --- Settings Panel --- */` (`.notation-row, .base-note-row, .interval-type-row, .edo-settings-row` and its `label`, `select`, `:hover`, `:focus` variants) with just `.notation-row, .base-note-row` and their `label` / `select` variants. Delete the `.edo-settings-row  { margin-top: 0.65rem; align-items: flex-start; }` line and the `.edo-input-stack`, `.edo-settings-row input`, `#edo-cents-label` rules from that block — they move below.

Then replace the `.scale-mode-row` block (`style.css:220-255`) with one editor-panel family:

```css
/* One visual family for the editor's own settings: Name, Interval Type, EDO
   Divisions and Mode. They share a label column and a full-width control, and
   Mode carries the rule that separates them from the rows below. */
.scale-name-row,
.interval-type-row,
.edo-settings-row,
.scale-mode-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.7rem;
}

.edo-settings-row { align-items: flex-start; }

.scale-mode-row {
  margin-bottom: 1.1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--rule);
}

.scale-name-row label,
.interval-type-row label,
.edo-settings-row label,
.scale-mode-row label {
  font-weight: 500;
  font-size: 0.72rem;
  flex: 0 0 auto;
  width: 9.5rem;
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.scale-name-row input,
.interval-type-row select,
.edo-settings-row input,
.scale-mode-row select {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-family: inherit;
  font-size: 0.9rem;
  background: var(--paper-fade);
  color: var(--ink);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.scale-name-row input,
.edo-settings-row input { cursor: text; }

.scale-name-row input:hover,
.interval-type-row select:hover,
.edo-settings-row input:hover,
.scale-mode-row select:hover { border-color: var(--ink-soft); }

.scale-name-row input:focus,
.interval-type-row select:focus,
.edo-settings-row input:focus,
.scale-mode-row select:focus {
  outline: none;
  border-color: var(--ink);
  background: #fff;
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.edo-input-stack {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

#edo-cents-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.76rem;
  color: var(--ink-soft);
  white-space: nowrap;
  padding-top: 0.05rem;
}
```

In the phone breakpoint (`style.css:1323-1348`), split the same way: leave `.notation-row, .base-note-row` in the "Settings rows: stack label above full-width input" rules, and replace the "Scale mode row stays inline but label shrinks" pair with:

```css
  /* Editor settings rows: stack label above full-width control, like Settings */
  .scale-name-row,
  .interval-type-row,
  .edo-settings-row,
  .scale-mode-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
  }
  .scale-name-row label,
  .interval-type-row label,
  .edo-settings-row label,
  .scale-mode-row label {
    width: auto;
    font-size: 0.68rem;
  }
  .edo-input-stack { width: 100%; }
```

- [ ] **Step 5: Reset the name with everything else**

In `app.js`, add beside the other element handles (after `const notationSelect = …`, line 66):

```js
const scaleNameInput = document.getElementById("scale-name");
```

and in `resetControlsToDefaults()` (`app.js:1256`), extend the input loop — the defaults stay read off the markup, so `index.html` remains the one place a default is written down:

```js
  for (const input of [scaleNameInput, edoDivisionsInput, zoomSlider]) {
    input.value = input.defaultValue;
  }
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS, including `notation.test.js`'s "sits in Settings, above Base Note" — Notation and Base Note did not move.

- [ ] **Step 7: Commit**

```bash
git add index.html style.css app.js test/integration/toolbar.test.js test/integration/startup-reset.test.js
git commit -m "[#15] Move Interval Type and EDO into the Scale Editor, and add Name

Interval Type and Mode are the two axes that decide what an interval box
means, and changing Interval Type calls resetScaleToDefault() — editor
operations, not settings. The new Name box is a property of the scale, so it
joins them. Settings is left with Notation and Base Note.

The four editor rows are reconciled into one visual family, and
resetControlsToDefaults() clears #scale-name along with the other inputs by
reading its markup default. startup-reset.test.js gains the assertion.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 8: The New button and the message bar

Design §7 (New). `initUI()` already *is* "as if you opened the page in a new private session"; New is that plus clearing whatever the toolbar was saying.

**Files:**
- Modify: `persistence-ui.js` (append)
- Modify: `test/integration/toolbar.test.js` (append)

**Interfaces:**
- Consumes: `initUI` (`app.js:1790`), `toolbarMessage`, `newBtn`.
- Produces:
  - `showToolbarMessage(text): void`
  - `clearToolbarMessage(): void`
  - `newScaleFile(): void` — the New button's handler.

- [ ] **Step 1: Write the failing tests**

First widen the `require` at the top of `test/integration/toolbar.test.js`:

```js
const {
  loadApp,
  fireClick,
  typeInto,
  selectOption,
  buildRelativeScale,
  noteRows,
  intervalRows,
} = require("../helpers/harness.js");
```

Then append:

```js
test("New", async (t) => {
  await t.test("puts the whole page back to its defaults", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    selectOption(h, "scale-mode", "absolute");
    selectOption(h, "notation", "byzantine");
    selectOption(h, "chart-style", "lines");
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");

    fireClick(h, h.document.getElementById("new-file"));

    const valueOf = (id) => h.document.getElementById(id).value;
    assert.equal(valueOf("scale-name"), "", "the name is part of the reset");
    assert.equal(valueOf("interval-type"), "ratio");
    assert.equal(valueOf("scale-mode"), "relative");
    assert.equal(valueOf("notation"), "generic");
    assert.equal(valueOf("chart-style"), "boxes");
    assert.equal(noteRows(h).length, 2);
    assert.deepEqual(intervalRows(h).map((r) => r.querySelector(".interval").value), ["9/8"]);
  });

  await t.test("dismisses whatever the toolbar was saying", () => {
    const h = loadApp();
    t.after(() => h.close());

    h.app.showToolbarMessage("Not a valid JSON file.");
    assert.equal(h.document.getElementById("toolbar-message").hidden, false);

    fireClick(h, h.document.getElementById("new-file"));
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
  });

  await t.test("discards a scale that was built up", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9", "16/15"], { names: ["do", "re", "mi", "fa"] });
    fireClick(h, h.document.getElementById("new-file"));

    assert.equal(noteRows(h).length, 2);
    assert.deepEqual(noteRows(h).map((r) => r.querySelector(".note-name").value), ["", ""]);
  });
});

test("the toolbar message bar", async (t) => {
  await t.test("shows text and hides again when cleared", () => {
    const h = loadApp();
    t.after(() => h.close());

    const message = h.document.getElementById("toolbar-message");
    h.app.showToolbarMessage("settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12.");
    assert.equal(message.hidden, false);
    assert.equal(
      message.textContent,
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12."
    );

    h.app.clearToolbarMessage();
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/toolbar.test.js`
Expected: FAIL — `h.app.showToolbarMessage is not a function`.

- [ ] **Step 3: Implement**

Append to `persistence-ui.js`:

```js
// --- the message bar -------------------------------------------------------
//
// Where a rejected file says why. The bar is the only place the file flows
// report anything: a bad document never reaches the editor, so there is
// nothing on screen to show what went wrong.

function showToolbarMessage(text) {
  toolbarMessage.textContent = text;
  toolbarMessage.hidden = false;
}

function clearToolbarMessage() {
  toolbarMessage.textContent = "";
  toolbarMessage.hidden = true;
}

// --- New -------------------------------------------------------------------

/**
 * initUI() is already both the startup path and the pageshow handler, and it
 * is already exactly "as if you opened the page in a new private session" —
 * every control back to its markup default and the editor rebuilt. New is that,
 * plus dismissing anything the bar was still saying.
 */
function newScaleFile() {
  clearToolbarMessage();
  initUI();
}

newBtn.addEventListener("click", newScaleFile);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/integration/toolbar.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add persistence-ui.js test/integration/toolbar.test.js
git commit -m "[#15] Wire the New button and the toolbar message bar

New is initUI() — already the startup path and the pageshow handler, and
already exactly a fresh private session — plus dismissing whatever the
message bar was saying.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 9: `collectDocumentState()` and Save

Design §7 (Save). Always Save-As: no dirty tracking, no remembered handle, no overwrite-in-place.

**Files:**
- Modify: `persistence-ui.js` (append)
- Modify: `test/helpers/harness.js` (the FS Access stubs and `savedScaleFile`)
- Create: `test/integration/file-persistence.test.js`

**Interfaces:**
- Consumes: `editor`, `getScaleMode`, `getIntervalType`, `getEdoDivisions`, `getNotation`, `baseNoteSelect`, `styleSelect`, `orientationSelect`, `zoomSlider`, `scaleNameInput`, `getActivePalette` (all `app.js`); `readNoteSymbols` (`symbols-ui.js:415`); `serializeScaleDocument`, `suggestedFileName`, `SCALE_MODE_NAMES`, `CHART_STYLE_NAMES`, `fileWordFor`, `SCALE_FILE_EXTENSION` (`persistence.js`).
- Produces:
  - `collectDocumentState(): state` — the Task 2 state shape, read off the page.
  - `noteStateFrom(row)`, `intervalStateFrom(row)`, `intervalItemFrom(rawValue, type)`.
  - `SCALE_FILE_PICKER_TYPES` — the `types` array both pickers use.
  - `saveScaleFile(): Promise<void>` — wired to `#save-scale`.
  - `downloadScaleFile(fileName, text): void`.
- Harness: `loadApp({ fileSystemAccess })`, `harness.writtenFiles`, `harness.filePickerCalls`, `savedScaleFile(harness)`.

- [ ] **Step 1: Add the harness support**

In `test/helpers/harness.js`, extend the JSDoc for `loadApp` with:

```js
 * @param {boolean|object} [options.fileSystemAccess] installs `showSaveFilePicker`
 *   and `showOpenFilePicker` stubs. **Absent by default**, so most tests exercise
 *   the download / file-input fallback — the path every browser reaches. Pass
 *   `{ text }` to say what the open picker hands back, `{ saveAborts: true }` or
 *   `{ openAborts: true }` to have the picker reject with an AbortError, the way
 *   a cancelled dialog does
```

and insert after the `// --- downloads ---` block (which ends with the `HTMLAnchorElement.prototype.click` assignment):

```js
  // --- File System Access -------------------------------------------------
  // Absent unless a test asks for it: Firefox, Safari and every file:// page
  // reach the fallback, so that is the path most tests should be on.
  const writtenFiles = [];
  const filePickerCalls = [];
  if (options.fileSystemAccess) {
    const settings = options.fileSystemAccess === true ? {} : options.fileSystemAccess;
    const abort = () =>
      Promise.reject(new window.DOMException("The user aborted a request.", "AbortError"));

    window.showSaveFilePicker = function showSaveFilePicker(pickerOptions) {
      filePickerCalls.push({ picker: "save", options: pickerOptions });
      if (settings.saveAborts) return abort();
      return Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (data) => {
              writtenFiles.push({ name: pickerOptions.suggestedName, text: String(data) });
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
    };

    window.showOpenFilePicker = function showOpenFilePicker(pickerOptions) {
      filePickerCalls.push({ picker: "open", options: pickerOptions });
      if (settings.openAborts) return abort();
      const text = settings.text === undefined ? "" : settings.text;
      return Promise.resolve([{ getFile: () => Promise.resolve({ text: () => Promise.resolve(text) }) }]);
    };
  }
```

Add both arrays to the returned `harness` object, beside `downloads`:

```js
    /** `{ name, text }` for every file written through showSaveFilePicker. */
    writtenFiles,
    /** `{ picker, options }` for every File System Access picker call. */
    filePickerCalls,
```

Add the reader helper beside `pickColor`, and export it:

```js
/**
 * The scale document the app last handed to `<a download>`, read back out of
 * the data: URL — the same mechanism savePNG() uses, so no URL.createObjectURL
 * shim is needed and the existing anchor recorder does the work.
 */
function savedScaleFile(harness) {
  const download = harness.downloads[harness.downloads.length - 1];
  if (!download) throw new Error("Nothing was downloaded");
  const comma = download.href.indexOf(",");
  return { name: download.download, text: decodeURIComponent(download.href.slice(comma + 1)) };
}
```

- [ ] **Step 2: Write the failing tests**

Create `test/integration/file-persistence.test.js`:

```js
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/integration/file-persistence.test.js`
Expected: FAIL — clicking `#save-scale` does nothing, so `savedScaleFile` throws "Nothing was downloaded".

- [ ] **Step 4: Implement collect and save**

Append to `persistence-ui.js`:

```js
// --- reading the page ------------------------------------------------------

/**
 * One interval box, typed for the file.
 *
 * §3.3's one deliberate loosening: a box may hold text that does not parse — a
 * scale saved mid-thought — and the raw string then goes to the file even where
 * a number is canonical. Nothing is lost and nothing is invented; a file written
 * from a valid scale is always canonically typed.
 */
function intervalItemFrom(rawValue, type) {
  const text = String(rawValue == null ? "" : rawValue).trim();
  if (type === "ratio") return text;
  const number = type === "edo" ? parseInt(text, 10) : parseFloat(text);
  if (!Number.isFinite(number) || String(number) !== text) return text;
  return number;
}

function noteStateFrom(row) {
  const symbols = readNoteSymbols(row);
  const nameInput = row.querySelector(".note-name");
  return {
    // The name box is shared markup but hidden by CSS in Byzantine, so it
    // belongs under `generic`.
    generic: { accidental: symbols.accidental, name: nameInput ? nameInput.value : "" },
    byzantine: {
      alteration: symbols.alteration,
      fthora: symbols.fthora,
      martyria: symbols.martyria,
    },
  };
}

function intervalStateFrom(row) {
  const swatch = row.querySelector(".color-swatch");
  const label = row.querySelector(".interval-label");
  return {
    color: swatch ? swatch.dataset.color : getActivePalette()[0],
    label: label ? label.value : "",
  };
}

/** The whole page as a state object, in the file's own vocabulary. */
function collectDocumentState() {
  const rows = [...editor.querySelectorAll(".row")];
  const notes = rows.filter((row) => row.classList.contains("note-row"));
  const intervals = rows.filter((row) => row.classList.contains("interval-row"));
  const mode = getScaleMode();
  const type = getIntervalType();

  const intervalType = { type: type };
  if (type === "edo") intervalType.divisionCount = getEdoDivisions();

  // Relative values sit on the interval rows; absolute ones sit on the note
  // rows, one per note, the first of them the disabled unison.
  const intervalValues =
    mode === "absolute"
      ? notes.map((row) => intervalItemFrom(valueOfInput(row, ".absolute-interval"), type))
      : intervals.map((row) => intervalItemFrom(valueOfInput(row, ".interval"), type));

  return {
    name: scaleNameInput.value.trim(),
    settings: {
      notation: getNotation(),
      baseNote: parseInt(baseNoteSelect.value, 10),
    },
    scaleEditor: {
      mode: fileWordFor(SCALE_MODE_NAMES, mode),
      intervalType: intervalType,
      intervals: intervalValues,
      noteProperties: notes.map(noteStateFrom),
      intervalProperties: intervals.map(intervalStateFrom),
    },
    chart: {
      style: fileWordFor(CHART_STYLE_NAMES, styleSelect.value),
      orientation: orientationSelect.value,
      zoom: parseInt(zoomSlider.value, 10),
    },
  };
}

function valueOfInput(row, selector) {
  const input = row.querySelector(selector);
  return input ? input.value : "";
}

// --- Save ------------------------------------------------------------------
//
// Always Save-As. The menu item says so, so there is no dirty tracking, no
// overwrite-in-place and no remembered handle.

const SCALE_FILE_PICKER_TYPES = [
  {
    description: "Music Scale Plot file",
    accept: { "application/json": [SCALE_FILE_EXTENSION] },
  },
];

async function saveScaleFile() {
  closeSaveMenu();
  clearToolbarMessage();
  const text = serializeScaleDocument(collectDocumentState());
  const fileName = suggestedFileName(scaleNameInput.value);

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: SCALE_FILE_PICKER_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    } catch (error) {
      // A cancelled dialog is not an error to report: the user chose not to save.
      if (error && error.name === "AbortError") return;
      showToolbarMessage("Could not save the file.");
    }
    return;
  }

  downloadScaleFile(fileName, text);
}

/**
 * The fallback, for Firefox, Safari and every file:// page.
 *
 * A data: URL, the same mechanism savePNG() already uses — it needs no
 * URL.createObjectURL shim, and a scale document is a few KB, far inside what
 * <a download> accepts.
 */
function downloadScaleFile(fileName, text) {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = "data:application/json;charset=utf-8," + encodeURIComponent(text);
  link.click();
}

saveScaleItem.addEventListener("click", saveScaleFile);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/integration/file-persistence.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add persistence-ui.js test/helpers/harness.js test/integration/file-persistence.test.js
git commit -m "[#15] Save the app state as a .musp.json file

collectDocumentState() reads the editor and the controls into the format's
state shape; saveScaleFile() writes it through showSaveFilePicker where the
browser has one and an <a download> data: URL everywhere else — the same
mechanism savePNG() uses, so the harness's anchor recorder reads it straight
back. Always Save-As; a cancelled dialog is silent.

Both notations' halves are written whatever the Notation setting says, and a
martyria carries its octave ticks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 10: `applyDocumentState()` and Open

Design §7 (Open, `applyDocumentState`). The order matters, and so does what is *not* called.

**Files:**
- Modify: `persistence-ui.js` (append)
- Modify: `test/helpers/harness.js` (`openScaleFile`)
- Modify: `test/integration/file-persistence.test.js` (append)

**Interfaces:**
- Consumes: `closeAllDropdowns`, `editor`, `notationSelect`, `baseNoteSelect`, `intervalTypeSelect`, `edoDivisionsInput`, `edoSettingsRow`, `scaleModeSelect`, `styleSelect`, `orientationSelect`, `zoomSlider`, `scaleNameInput`, `updateEdoCentsLabel`, `updateZoom`, `onNotationChange`, `makeNoteRowElement`, `makeIntervalRowElement`, `setSwatchColor`, `updateRemoveBtn`, `updateAllLabels`, `render` (all `app.js`); `writeNoteSign` (`symbols-ui.js:432`), `writeMartyria` / `clearMartyria` (`byzantine-ui.js:56,69`); `parseScaleDocument`, `SCALE_MODE_NAMES`, `CHART_STYLE_NAMES` (`persistence.js`).
- Produces:
  - `applyDocumentState(doc): void`
  - `applyNoteState(row, note)`, `applyIntervalState(row, properties)`
  - `openScaleFile(): Promise<void>` — wired to `#open-file`
  - `loadScaleFileText(text): boolean`
- Harness: `openScaleFile(harness, text, fileName?): Promise<void>`.

- [ ] **Step 1: Add the harness helper**

In `test/helpers/harness.js`, add beside `savedScaleFile`, and export it:

```js
/**
 * Hands the hidden file input a file and fires `change`, the way a browser does
 * once the user has picked one in the fallback dialog. The handler reads the
 * file asynchronously, so this resolves on the next macrotask — `await` it.
 */
function openScaleFile(harness, text, fileName = "scale.musp.json") {
  const input = harness.document.getElementById("open-file-input");
  const file = { name: fileName, text: () => Promise.resolve(text) };
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireChange(harness, input);
  return new Promise((resolve) => harness.window.setTimeout(resolve, 0));
}
```

- [ ] **Step 2: Write the failing tests**

Append to `test/integration/file-persistence.test.js` (add `openScaleFile` to the `require` at the top):

```js
test("opening a scale document", async (t) => {
  await t.test("round-trips a full scale through Save, New and Open", async () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");
    selectOption(h, "interval-type", "edo");
    typeInto(h, h.document.getElementById("edo-divisions"), "72");
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["0", "5", "12", "19"], {
      names: ["rast", "dugah", "segah", "chargah"],
      labels: ["s", "", "s"],
      colors: ["#CCFFCC", "#FFFFFF", "#CCFFCC"],
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

    await openScaleFile(h, saved);

    const valueOf = (id) => h.document.getElementById(id).value;
    assert.equal(valueOf("scale-name"), "Hicaz");
    assert.equal(valueOf("interval-type"), "edo");
    assert.equal(valueOf("edo-divisions"), "72");
    assert.equal(valueOf("scale-mode"), "absolute");
    assert.equal(valueOf("base-note"), "9");
    assert.equal(valueOf("orientation"), "horizontal");
    assert.equal(valueOf("zoom"), "75");
    assert.equal(valueOf("notation"), "byzantine");

    assert.equal(noteRows(h).length, 4);
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["0", "5", "12", "19"]
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
      ["#CCFFCC", "#FFFFFF", "#CCFFCC"]
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
    await openScaleFile(h, saved);

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

    await openScaleFile(h, fileText);

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

    await openScaleFile(h, '{"formatVersion": 1, "settings": {"baseNote": 12}}');

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      before,
      "a rejected file must never leave a half-loaded editor"
    );
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, false);
    assert.equal(
      message.textContent,
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

    await openScaleFile(h, "{ not json");
    assert.equal(h.document.getElementById("toolbar-message").textContent, "Not a valid JSON file.");

    await openScaleFile(h, good);
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
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/integration/file-persistence.test.js`
Expected: FAIL — the `change` on `#open-file-input` has no listener, so nothing is loaded and the assertions on the restored controls fail.

- [ ] **Step 4: Implement apply and open**

Append to `persistence-ui.js`:

```js
// --- writing the page ------------------------------------------------------

function applyNoteState(row, note) {
  const nameInput = row.querySelector(".note-name");
  if (nameInput) nameInput.value = note.generic.name;
  // Through the sanctioned writers, so a well is painted exactly as a picker
  // would have painted it.
  writeNoteSign(row, "accidental", note.generic.accidental);
  writeNoteSign(row, "alteration", note.byzantine.alteration);
  writeNoteSign(row, "fthora", note.byzantine.fthora);
  const martyria = note.byzantine.martyria;
  if (martyria) writeMartyria(row, martyria.note, martyria.genus, martyria.ticks);
  else clearMartyria(row);
}

function applyIntervalState(row, properties) {
  const swatch = row.querySelector(".color-swatch");
  if (swatch) setSwatchColor(swatch, properties.color);
  const label = row.querySelector(".interval-label");
  if (label) label.value = properties.label;
}

/**
 * Rebuilds the whole page from a validated document.
 *
 * **Every control is set by direct value assignment, firing no events.**
 * Dispatching `change` on #interval-type runs onIntervalTypeChange() ->
 * resetScaleToDefault(), and on #scale-mode runs the mode converter — either
 * would destroy the very scale being loaded. What those handlers do usefully is
 * done by hand below, in order.
 */
function applyDocumentState(doc) {
  closeAllDropdowns();

  const editorDoc = doc.scaleEditor;

  scaleNameInput.value = doc.name;
  notationSelect.value = doc.settings.notation;
  baseNoteSelect.value = String(doc.settings.baseNote);
  intervalTypeSelect.value = editorDoc.intervalType.type;
  edoDivisionsInput.value =
    editorDoc.intervalType.divisionCount === undefined
      ? edoDivisionsInput.defaultValue
      : String(editorDoc.intervalType.divisionCount);
  scaleModeSelect.value = SCALE_MODE_NAMES[editorDoc.mode];
  styleSelect.value = CHART_STYLE_NAMES[doc.chart.style];
  orientationSelect.value = doc.chart.orientation;
  zoomSlider.value = String(doc.chart.zoom);

  const isEdo = editorDoc.intervalType.type === "edo";
  edoSettingsRow.style.display = isEdo ? "" : "none";
  if (isEdo) updateEdoCentsLabel();
  updateZoom();
  // For the editor's notation-generic / notation-byzantine class, which is all
  // CSS needs to decide which half of every note row shows.
  onNotationChange();

  const mode = scaleModeSelect.value;
  const notes = editorDoc.noteProperties;

  editor.innerHTML = "";
  for (let i = 0; i < notes.length; i++) {
    if (i > 0) {
      const value = mode === "absolute" ? "" : String(editorDoc.intervals[i - 1]);
      const intervalRow = makeIntervalRowElement(value, mode);
      applyIntervalState(intervalRow, editorDoc.intervalProperties[i - 1]);
      editor.appendChild(intervalRow);
    }
    // In absolute mode the row builder pins Note 1 to the unison itself, which
    // is what the file's first entry always is.
    const absolute = mode === "absolute" ? String(editorDoc.intervals[i]) : undefined;
    const noteRow = makeNoteRowElement(i + 1, mode, absolute);
    applyNoteState(noteRow, notes[i]);
    editor.appendChild(noteRow);
  }

  // Deliberately NOT called: propagateMartyriaLadder(), because the file's
  // martyrias are authoritative per degree and the ladder would overwrite them
  // from whichever row happened to be last; and syncIntervalColors(), likewise,
  // because the file says what each interval looks like.
  updateRemoveBtn();
  updateAllLabels();
  render();
}

// --- Open ------------------------------------------------------------------

/** Parses, and on success replaces the page. Returns whether it took. */
function loadScaleFileText(text) {
  const result = parseScaleDocument(text);
  if (!result.ok) {
    showToolbarMessage(result.error);
    return false;
  }
  applyDocumentState(result.doc);
  clearToolbarMessage();
  return true;
}

async function openScaleFile() {
  closeSaveMenu();

  if (typeof window.showOpenFilePicker === "function") {
    let text;
    try {
      const [handle] = await window.showOpenFilePicker({
        types: SCALE_FILE_PICKER_TYPES,
        multiple: false,
      });
      text = await (await handle.getFile()).text();
    } catch (error) {
      // A cancelled dialog is not an error to report.
      if (error && error.name === "AbortError") return;
      showToolbarMessage("Could not open the file.");
      return;
    }
    loadScaleFileText(text);
    return;
  }

  // The fallback, for Firefox, Safari and every file:// page. The value is
  // cleared first so picking the same file twice still fires `change`.
  openFileInput.value = "";
  openFileInput.click();
}

openBtn.addEventListener("click", openScaleFile);

openFileInput.addEventListener("change", async function () {
  const file = openFileInput.files && openFileInput.files[0];
  if (!file) return;
  loadScaleFileText(await file.text());
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/integration/file-persistence.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add persistence-ui.js test/helpers/harness.js test/integration/file-persistence.test.js
git commit -m "[#15] Open a .musp.json file and restore the app state

applyDocumentState() sets every control by direct value assignment, firing no
events: a change on #interval-type runs resetScaleToDefault() and one on
#scale-mode runs the mode converter, either of which would destroy the scale
being loaded. It then rebuilds the rows and writes each one's state through
the sanctioned writers.

It deliberately does not run the martyria ladder or the colour sync — the
file's per-degree values are authoritative.

A rejected document changes nothing and names its own problem in the toolbar
message bar; a cancelled dialog is silent.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 11: Ctrl/Cmd+O and Ctrl/Cmd+S

Design §2. The browser owns Ctrl+N, so New gets no chord.

**Files:**
- Modify: `persistence-ui.js` (append)
- Modify: `test/integration/toolbar.test.js` (append)

**Interfaces:**
- Consumes: `openScaleFile`, `saveScaleFile`.
- Produces: `handleFileShortcut(event): void`, on `document`'s `keydown`.

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/toolbar.test.js`:

```js
test("the file keyboard shortcuts", async (t) => {
  function press(h, key, init = { ctrlKey: true }) {
    const event = new h.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    h.document.dispatchEvent(event);
    return event;
  }

  await t.test("Ctrl+S saves, taking the browser's Save dialog off the page", async () => {
    const h = loadApp();
    t.after(() => h.close());

    const event = press(h, "s");
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(event.defaultPrevented, true, "the browser must not save the page instead");
    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0].download, "scale.musp.json");
  });

  await t.test("Cmd+S saves too, for the Mac", async () => {
    const h = loadApp();
    t.after(() => h.close());

    press(h, "s", { metaKey: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(h.downloads.length, 1);
  });

  await t.test("Ctrl+O opens", () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = h.document.getElementById("open-file-input");
    let clicks = 0;
    input.click = () => { clicks++; };

    const event = press(h, "o");
    assert.equal(event.defaultPrevented, true);
    assert.equal(clicks, 1);
  });

  await t.test("leaves the plain and the alt-modified keys alone", async () => {
    const h = loadApp();
    t.after(() => h.close());

    press(h, "s", {});
    press(h, "o", {});
    press(h, "s", { ctrlKey: true, altKey: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(h.downloads.length, 0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/toolbar.test.js`
Expected: FAIL — the event is not prevented and nothing is downloaded.

- [ ] **Step 3: Implement**

Append to `persistence-ui.js`:

```js
// --- keyboard shortcuts ----------------------------------------------------
//
// Ctrl/Cmd+O and Ctrl/Cmd+S. New gets no chord: the browser owns Ctrl+N and
// will not give it up.

function handleFileShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = String(event.key).toLowerCase();
  if (key === "o") {
    event.preventDefault();
    openScaleFile();
  } else if (key === "s") {
    event.preventDefault();
    saveScaleFile();
  }
}

document.addEventListener("keydown", handleFileShortcut);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/integration/toolbar.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add persistence-ui.js test/integration/toolbar.test.js
git commit -m "[#15] Add Ctrl/Cmd+O and Ctrl/Cmd+S

Both prevent the browser's own default, which would otherwise save or open the
page rather than the scale. New gets no chord: the browser owns Ctrl+N.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

### Task 12: Documentation

Design §9. Four documents, and one manual pass over the real page.

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`
- Modify: `README.md` (the `icons/` line in the file list, if it carries one)

**Interfaces:**
- Consumes: everything above. Produces no code.

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`**

- **File Structure** (line 7): add `persistence.js` after `smufl.js` and `persistence-ui.js` after `byzantine-ui.js` in the tree, add `icons/`, and change "the five scripts" to "the seven scripts" in the two prose paragraphs beneath.
- **HTML Layout** (line 45): open the section with the toolbar — a sticky `#toolbar` before `.container` at `z-index: 200`, holding New, Open, Save (a menu), a separator, Add note and Remove last note, plus a `role="alert"` message bar and the hidden file input. Note that the note buttons and `#save-png` kept their IDs, which is why the move touched no listener. Note that the Settings panel now holds only Notation and Base Note, and that Name, Interval Type, EDO Divisions and Mode are the Scale Editor's own four rows.
- **Data Model** (line 83): note that `settings.baseNote` is semitones above C, the same number the `#base-note` option carries, and that `getBaseFrequency()` wraps by `(s + 3) % 12`.
- **New section, "File Persistence"**, after **Notation**: the `.musp.json` format at version 1, its vocabulary table, the cardinality rules, the default-omission rule and the three equivalent read spellings, the whole-document validation, and `applyDocumentState`'s ordering — with the two things it deliberately does not call and why.
- **Initial state** (line 163): the page still has no *automatic* persistence; a file is opened and saved explicitly, and `initUI()` is what New runs.
- **Controls** (line 171): Add note and Remove last note are in the toolbar now.
- **Event Flow** (line 359): add Open (parse → validate → apply → render) and Save (collect → serialise → picker or download).
- **Styling** (line 381): record that `#1a1814` is written in five `.svg` files as well as in `--ink`, so a change to that token must change the icons with it.

- [ ] **Step 2: Update `docs/TESTING.md`**

- §4 layout tree: add `test/unit/scale-file-format.test.js`, `test/integration/toolbar.test.js` and `test/integration/file-persistence.test.js`, each with a one-line description.
- §5 "What is stubbed" table: add a `showSaveFilePicker` / `showOpenFilePicker` row saying they are **absent by default**, so most tests take the fallback that every browser reaches.
- §5 harness helper table: add `loadApp({ fileSystemAccess })`, `openScaleFile(h, text)` and `savedScaleFile(h)`.
- §2 and §5 prose: "the five scripts" becomes "the seven scripts" wherever it appears.

- [ ] **Step 3: Update `CLAUDE.md`**

- **Files** list: add `persistence.js` and `persistence-ui.js` with one-line descriptions, and `icons/`.
- **Architecture** section: the load order becomes the seven-script one; add a **File persistence** bullet naming the format, the toolbar and the collect/apply pair.
- **Conventions**: "five classic scripts" becomes seven, in both the no-external-libs bullet and the load-order bullet.
- **Testing — mandatory TDD**: "all five scripts" becomes "all seven scripts" in the auto-export bullet and in the `.claude/rules/testing.md` bullet's path list.

- [ ] **Step 4: Verify the docs against the code**

Run: `npm test`
Expected: PASS (documentation changes nothing, but the suite is the gate before every commit).

Then confirm no stale count survives:

```bash
grep -rn "five scripts\|five classic\|all five" CLAUDE.md docs/ README.md
```
Expected: no output.

- [ ] **Step 5: Drive the real page once**

Open `index.html` in a browser (this is *verification*, not testing — no script is committed). Check, by eye: the toolbar sticks while a long scale scrolls and stays above an open symbol picker; the five icons render and their hover states read; the Save menu opens under its button and closes on an outside click; Name, Interval Type, EDO Divisions and Mode line up as one family; Save downloads `hicaz.musp.json` and Open restores it; the phone breakpoint still stacks the editor rows.

- [ ] **Step 6: Commit**

```bash
git add docs CLAUDE.md README.md
git commit -m "[#15] Document file persistence, the toolbar and the seven scripts

ARCHITECTURE.md gains a File Persistence section covering the format, the
validation and applyDocumentState's ordering, and records that the icons bake
--ink in five .svg files as well. TESTING.md gains the three new test files
and the File System Access stubs. CLAUDE.md's file list, load order and script
count follow.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EZjfyQ7yPwdF1oEPwu5EXW"
```

---

## Spec coverage

| Design section | Tasks |
|---|---|
| §1 What is being built | all |
| §2 Decisions taken | 1 (base note), 2–3 (version, ticks), 5 (icons), 7 (control locations), 9–10 (I/O strategy), 11 (shortcuts) |
| §3 The format, version 1 | 2, 3 |
| §3.1 Vocabulary | 2 (maps), 3 (validation), 9–10 (translation at the boundary) |
| §3.2 Cardinality | 3, 9, 10 |
| §3.3 Interval item types | 2, 3, 9 |
| §3.4 Both notations per note | 2, 3, 9, 10 |
| §3.5 Interval properties | 2, 3, 9, 10 |
| §4 Code layout | 2 (`persistence.js`), 6 (`persistence-ui.js`), 4 (row builders), 6 (`closeAllDropdowns`), 7 (`resetControlsToDefaults`), 1 (`getBaseFrequency`) |
| §5.1 Base Note | 1 |
| §5.2 The toolbar | 5, 6, 7 |
| §6 Validation | 3 |
| §7 New / Save / Open / apply | 8, 9, 10 |
| §8 Testing | every task; §8's "existing tests" list is Tasks 1, 2, 6, 7 |
| §9 Documentation | 12 |
| §10 Out of scope | Global Constraints |
