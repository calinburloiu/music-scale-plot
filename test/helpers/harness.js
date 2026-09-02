"use strict";

/**
 * Loads the real `index.html` into a fresh jsdom window, running every script
 * it references via `<script src>`, in document order.
 *
 * The app's scripts are classic scripts with no module system: they read DOM
 * elements at the top level and wire up listeners as a side effect of loading.
 * Rather than restructuring the app to make it testable, the harness loads each
 * file exactly as the browser does and runs a generated epilogue afterwards
 * that re-exports every top-level declaration, across all the scripts, as a
 * live getter on `window.__app`. Production code therefore stays untouched,
 * and any new top-level `function`/`const` in any of the app's scripts becomes
 * testable automatically.
 *
 * Browser APIs jsdom does not implement are replaced with recording stubs (see
 * canvas-stub.js and audio-stub.js) so drawing, audio and PNG export can be
 * asserted as data.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const { RecordingContext2D, measureTextWidth, measureTextInk, pngFixture } = require("./canvas-stub.js");
const { FakeAudioContext } = require("./audio-stub.js");

const ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(ROOT, "index.html");

/** Matches `<script src="...">` in index.html, in document order. */
const SCRIPT_SRC = /<script\b[^>]*\bsrc="([^"]+)"/g;

function scriptPaths(html) {
  return [...html.matchAll(SCRIPT_SRC)].map((m) => path.join(ROOT, m[1]));
}

/**
 * Matches a top-level (column 0) declaration in a script — including an
 * `async function`, so `async function saveScaleFile` and its Open-side
 * sibling `openScaleFile` are exported to tests exactly like any other
 * top-level function (docs/TESTING.md §5).
 */
const TOP_LEVEL_DECLARATION = /^(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

function topLevelNames(source) {
  const names = new Set();
  for (const match of source.matchAll(TOP_LEVEL_DECLARATION)) names.add(match[1]);
  return [...names];
}

/**
 * Re-exports each name as a getter so tests observe live values (`displayZoom`
 * changes after `updateZoom()`, for instance) rather than a load-time snapshot.
 */
function buildExportEpilogue(names) {
  const accessors = names.map((name) => `get ${name}() { return ${name}; }`);
  return `window.__app = { ${accessors.join(", ")} };\n`;
}

/**
 * Boots the app.
 *
 * @param {object} [options]
 * @param {number} [options.devicePixelRatio=2] value app.js reads into its DPR constant
 * @param {boolean|string} [options.fonts=true] set to `false` to boot with no
 *   `document.fonts` at all, as in jsdom's default state and in old browsers, or to
 *   `"reject"` to have every face fail to load, as a missing or corrupt file
 *   would, to `{ reject: ["Bravura Text"] }` to fail only the faces named — one
 *   file can go missing without the other — or to `"ready-reject"` to have the
 *   faces load but the set never become ready
 * @param {Object<string,string>} [options.restored] CSS selector to value, written
 *   into every matching control *before* the scripts run — the way a browser
 *   restores form state across a soft reload
 * @param {string} [options.inkMetrics="exact"] `"union"` reports every ink box
 *   unioned with the text's advance rect and its baseline, the way WebKit does
 * @param {boolean|object} [options.fileSystemAccess] installs `showSaveFilePicker`
 *   and `showOpenFilePicker` stubs. **Absent by default**, so most tests exercise
 *   the download / file-input fallback — the path every browser reaches. Pass
 *   `{ text }` to say what the open picker hands back, `{ saveAborts: true }` or
 *   `{ openAborts: true }` to have the picker reject with an AbortError, the way
 *   a cancelled dialog does, or `{ saveFails: true }` / `{ openFails: true }` to
 *   have it reject with an ordinary Error, the way a real failure (permission
 *   denied, disk full, a broken handle) does — distinct from a cancelled dialog
 * @returns {object} harness
 */
function loadApp(options = {}) {
  const devicePixelRatio = options.devicePixelRatio ?? 2;

  const html = fs.readFileSync(HTML_PATH, "utf8");

  const jsdomErrors = [];
  const consoleWarnings = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => jsdomErrors.push(error));
  virtualConsole.on("warn", (message) => consoleWarnings.push(String(message)));

  const dom = new JSDOM(html, {
    runScripts: "outside-only", // `<script src="app.js">` is loaded manually below
    pretendToBeVisual: true,
    url: "http://localhost/",
    virtualConsole,
  });

  const { window } = dom;
  const { document } = window;

  Object.defineProperty(window, "devicePixelRatio", {
    value: devicePixelRatio,
    configurable: true,
    writable: true,
  });

  // --- canvas ------------------------------------------------------------
  // One context per canvas, as a browser gives: the chart's is the one tests
  // inspect, and a canvas the app makes for itself — to measure a well's glyph,
  // or to find a sign's ink in the pixels — gets its own, so its drawing does
  // not land in the chart's record.
  const inkMetrics = options.inkMetrics || "exact";
  const context = new RecordingContext2D(document.getElementById("chart"), { inkMetrics });
  const contexts = new WeakMap();
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    if (this === context.canvas) return context;
    if (!contexts.has(this)) contexts.set(this, new RecordingContext2D(this, { inkMetrics }));
    return contexts.get(this);
  };
  const dataUrls = [];
  window.HTMLCanvasElement.prototype.toDataURL = function toDataURL(type) {
    const png = Buffer.from(pngFixture(this.width, this.height)).toString("base64");
    const url = `data:${type || "image/png"};base64,${png}`;
    dataUrls.push({ type: type || "image/png", width: this.width, height: this.height });
    return url;
  };

  // --- audio -------------------------------------------------------------
  const audioContexts = [];
  window.AudioContext = class TrackedAudioContext extends FakeAudioContext {
    constructor() {
      super();
      audioContexts.push(this);
    }
  };

  // --- fonts ---------------------------------------------------------------
  // jsdom implements no FontFaceSet. app.js waits on one before its first real
  // paint, because PUA codepoints have no fallback glyph.
  const fontLoads = [];
  if (options.fonts !== false) {
    const rejectAll = options.fonts === "reject";
    const rejectNamed =
      options.fonts && typeof options.fonts === "object" && Array.isArray(options.fonts.reject)
        ? options.fonts.reject
        : [];
    const rejects = (spec) =>
      rejectAll || rejectNamed.some((family) => String(spec).includes(family));
    // A FontFaceSet whose `ready` rejects: the faces themselves resolve, so the
    // per-face handlers see nothing wrong and the failure only reaches the tail
    // of the chain. The no-op catch is on this promise alone, so Node does not
    // count the stub's own rejection as unhandled — what the app derives from
    // it is still the app's to handle.
    const ready =
      options.fonts === "ready-reject"
        ? Promise.reject(new Error("stub: the font set never became ready"))
        : Promise.resolve();
    ready.catch(() => {});
    Object.defineProperty(document, "fonts", {
      value: {
        load(spec) {
          fontLoads.push(spec);
          return rejects(spec)
            ? Promise.reject(new Error(`stub: ${spec} could not be loaded`))
            : Promise.resolve([]);
        },
        ready,
      },
      configurable: true,
    });
  }

  // --- downloads ---------------------------------------------------------
  // jsdom has no navigation, so record anchor activation instead of following it.
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push({ download: this.download, href: this.href });
  };

  // --- File System Access -------------------------------------------------
  // Absent unless a test asks for it: Firefox, Safari and every file:// page
  // reach the fallback, so that is the path most tests should be on.
  const writtenFiles = [];
  const filePickerCalls = [];
  if (options.fileSystemAccess) {
    const settings = options.fileSystemAccess === true ? {} : options.fileSystemAccess;
    const abort = () =>
      Promise.reject(new window.DOMException("The user aborted a request.", "AbortError"));
    const fail = (message) => Promise.reject(new Error(message));

    window.showSaveFilePicker = function showSaveFilePicker(pickerOptions) {
      filePickerCalls.push({ picker: "save", options: pickerOptions });
      if (settings.saveAborts) return abort();
      if (settings.saveFails) return fail("stub: showSaveFilePicker failed");
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
      if (settings.openFails) return fail("stub: showOpenFilePicker failed");
      const text = settings.text === undefined ? "" : settings.text;
      return Promise.resolve([{ getFile: () => Promise.resolve({ text: () => Promise.resolve(text) }) }]);
    };
  }

  // Written before any script runs — Firefox restores form state while parsing,
  // so the app can boot against controls that already carry the user's values.
  applyRestoredState(document, options.restored);

  const files = scriptPaths(html).map((file) => ({
    file,
    source: fs.readFileSync(file, "utf8"),
  }));

  const names = [];
  for (const { source } of files) {
    for (const name of topLevelNames(source)) {
      if (!names.includes(name)) names.push(name);
    }
  }

  // Each file runs under its own real filename so stack traces and
  // --experimental-test-coverage attribute the code to the file on disk.
  // Classic scripts share one global lexical environment, so a `const` in
  // byzantine.js is visible to app.js and to the epilogue below.
  for (const { file, source } of files) {
    vm.runInContext(source, dom.getInternalVMContext(), { filename: file });
  }
  vm.runInContext(buildExportEpilogue(names), dom.getInternalVMContext(), {
    filename: path.join(ROOT, "__harness_exports__.js"),
  });

  const app = window.__app;

  const harness = {
    dom,
    window,
    document,
    app,
    /** Recording 2D context shared by every `getContext("2d")` call. */
    ctx: context,
    /** `{ download, href }` for every anchor click (i.e. every PNG export). */
    downloads,
    /** `{ name, text }` for every file written through showSaveFilePicker. */
    writtenFiles,
    /** `{ picker, options }` for every File System Access picker call. */
    filePickerCalls,
    /** Every `toDataURL()` call made on the chart canvas. */
    dataUrls,
    /** Every font spec passed to `document.fonts.load()`. */
    fontLoads,
    /** Every AudioContext the app constructed (it should only ever be one). */
    audioContexts,
    /** Errors jsdom itself reported (unimplemented APIs, uncaught throws). */
    jsdomErrors,
    /** Every `console.warn()` the app made, as text. */
    consoleWarnings,
    /** Names re-exported from the app's scripts, for harness self-tests. */
    exportedNames: names,
    /** Absolute paths of the scripts index.html loaded, in document order. */
    scriptFiles: files.map((f) => f.file),

    el: (selector) => document.querySelector(selector),
    all: (selector) => [...document.querySelectorAll(selector)],
    canvas: () => document.getElementById("chart"),
    editor: () => document.getElementById("editor"),

    close: () => window.close(),
  };

  return harness;
}

/** Writes each `selector: value` pair into every control it matches. */
function applyRestoredState(document, restored) {
  for (const [selector, value] of Object.entries(restored || {})) {
    const matches = [...document.querySelectorAll(selector)];
    if (matches.length === 0) throw new Error(`No control matches "${selector}"`);
    for (const element of matches) element.value = value;
  }
}

/**
 * Replays a Chromium-style form-state restore: the browser writes the user's
 * values into the controls *after* `load` — so every script has already run
 * against the markup's defaults — and only then fires `pageshow`.
 */
function restoreFormState(harness, restored) {
  applyRestoredState(harness.document, restored);
  harness.window.dispatchEvent(new harness.window.Event("pageshow"));
}

// --------------------------------------------------------------------------
// Interaction helpers — drive the app the way a user would, through events.
// --------------------------------------------------------------------------

function fireInput(harness, element) {
  element.dispatchEvent(new harness.window.Event("input", { bubbles: true }));
}

function fireChange(harness, element) {
  element.dispatchEvent(new harness.window.Event("change", { bubbles: true }));
}

function fireClick(harness, element) {
  element.dispatchEvent(new harness.window.MouseEvent("click", { bubbles: true }));
}

/** Types `value` into a text input and dispatches the `input` event. */
function typeInto(harness, element, value) {
  element.value = value;
  fireInput(harness, element);
}

/** Picks `value` in a `<select>` and dispatches the `change` event. */
function selectOption(harness, selectId, value) {
  const select = harness.document.getElementById(selectId);
  select.value = value;
  fireChange(harness, select);
  return select;
}

/** Switches the Notation setting and dispatches the `change` event. */
function setNotation(harness, value) {
  return selectOption(harness, "notation", value);
}

function noteRows(harness) {
  return harness.all("#editor .note-row");
}

function intervalRows(harness) {
  return harness.all("#editor .interval-row");
}

/** Adds/removes note rows until the editor holds exactly `count` notes. */
function setNoteCount(harness, count) {
  const addBtn = harness.document.getElementById("add-note");
  const removeBtn = harness.document.getElementById("remove-note");
  while (noteRows(harness).length < count) fireClick(harness, addBtn);
  while (noteRows(harness).length > count) fireClick(harness, removeBtn);
}

/**
 * Builds a scale in relative mode from a list of interval strings, driving the
 * editor through the same events a user would produce.
 */
function buildRelativeScale(harness, intervals, extra = {}) {
  setNoteCount(harness, intervals.length + 1);
  intervalRows(harness).forEach((row, i) => {
    typeInto(harness, row.querySelector(".interval"), intervals[i]);
  });
  applyExtras(harness, extra);
}

/** Same, but for absolute mode: one absolute value per note row. */
function buildAbsoluteScale(harness, absolutes, extra = {}) {
  setNoteCount(harness, absolutes.length);
  noteRows(harness).forEach((row, i) => {
    const input = row.querySelector(".absolute-interval");
    if (!input || input.disabled) return; // note 1 is pinned to the unison
    typeInto(harness, input, absolutes[i]);
  });
  applyExtras(harness, extra);
}

function applyExtras(harness, { names, labels, colors } = {}) {
  if (names) {
    noteRows(harness).forEach((row, i) => {
      if (names[i] === undefined) return;
      typeInto(harness, row.querySelector(".note-name"), names[i]);
    });
  }
  if (labels) {
    intervalRows(harness).forEach((row, i) => {
      if (labels[i] === undefined) return;
      typeInto(harness, row.querySelector(".interval-label"), labels[i]);
    });
  }
  if (colors) {
    intervalRows(harness).forEach((row, i) => {
      if (colors[i] === undefined) return;
      pickColor(harness, row, colors[i]);
    });
  }
}

/**
 * Opens a row's colour dropdown and clicks the swatch for `hex`, exercising the
 * real picker rather than writing `dataset.color` directly.
 */
function pickColor(harness, intervalRow, hex) {
  const swatch = intervalRow.querySelector(".color-swatch");
  fireClick(harness, swatch);
  const option = intervalRow.querySelector(`.color-option[data-color="${hex}"]`);
  if (!option) throw new Error(`No colour option ${hex} in the active palette`);
  fireClick(harness, option);
  return option;
}

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

/**
 * Clicks a well and returns its picker panel. `kind` is `"alteration"`,
 * `"fthora"` or `"martyria"`.
 */
function openWell(harness, noteRow, kind) {
  fireClick(harness, noteRow.querySelector(`.${kind}-well`));
  return noteRow.querySelector(`.${kind}-picker`);
}

/**
 * Leaves the picker open in `noteRow` without picking anything: `"outside"` and
 * `"well"` are the two gestures that discard, `"none"` leaves the panel open
 * for the test to inspect.
 *
 * There is no `"apply"` and no `"cancel"` — clicking a row *is* the commit, so
 * the only way not to commit is not to click one.
 */
function dismissPicker(harness, noteRow, how, kind) {
  if (how === "none") return;
  if (how === "outside") fireClick(harness, harness.document.body);
  else if (how === "well") fireClick(harness, noteRow.querySelector(`.${kind}-well`));
  else throw new Error(`Unknown dismissal "${how}"`);
}

/**
 * Opens a single-value picker and clicks one of its rows (`""` picks None),
 * which writes the sign to the row and closes the panel in one gesture.
 */
function pickSimpleSign(harness, noteRow, kind, id) {
  const panel = openWell(harness, noteRow, kind);
  const option = panel.querySelector(`.${kind}-option[data-${kind}="${id}"]`);
  if (!option) throw new Error(`No ${kind} option "${id}" in the picker`);
  fireClick(harness, option);
}

function pickFthora(harness, noteRow, fthoraId) {
  pickSimpleSign(harness, noteRow, "fthora", fthoraId);
}

function pickAlteration(harness, noteRow, alterationId) {
  pickSimpleSign(harness, noteRow, "alteration", alterationId);
}

function pickAccidental(harness, noteRow, accidentalId) {
  pickSimpleSign(harness, noteRow, "accidental", accidentalId);
}

/**
 * Opens a picker and types `query` into its search field, the way a user does.
 * Returns the panel, so a test can go straight to counting what survived.
 */
function searchPicker(harness, noteRow, kind, query) {
  const panel = openWell(harness, noteRow, kind);
  typeInto(harness, panel.querySelector(".sym-search"), query);
  return panel;
}

/**
 * Drives the martyria picker the way the UI is used: open it, click a letter in
 * the Notes column, then click a genus — the second click is what commits the
 * pair and runs the ladder.
 *
 * `genus` therefore defaults to None rather than being skipped: a letter alone
 * never reaches the row. `note: ""` is the exception — it clears the well and
 * closes the panel on its own, because there is no genus left to confirm.
 *
 * `dismiss` stops after the letter and leaves by that gesture instead, which is
 * how a test drafts something and throws it away.
 */
function pickMartyria(harness, noteRow, { note, genus, ticks = 0, dismiss } = {}) {
  openWell(harness, noteRow, "martyria");

  if (note !== undefined) {
    const selector = `.martyria-note-option[data-note="${note}"][data-ticks="${ticks}"]`;
    const option = noteRow.querySelector(selector);
    if (!option) throw new Error(`No note option "${note}" (ticks ${ticks}) in the picker`);
    if (option.disabled) throw new Error(`Note option "${note}" is disabled for this degree`);
    fireClick(harness, option);
    if (note === "") return;
  }

  if (dismiss !== undefined) {
    dismissPicker(harness, noteRow, dismiss, "martyria");
    return;
  }

  // Picking a letter rebuilds the panel, so the genus option must be re-queried.
  const genusId = genus === undefined ? harness.app.GENUS_NONE : genus;
  const option = noteRow.querySelector(`.martyria-genus-option[data-genus="${genusId}"]`);
  if (!option) throw new Error(`No genus option "${genusId}" in the picker`);
  fireClick(harness, option);
}

module.exports = {
  loadApp,
  restoreFormState,
  fireInput,
  fireChange,
  fireClick,
  typeInto,
  selectOption,
  setNotation,
  noteRows,
  intervalRows,
  setNoteCount,
  buildRelativeScale,
  buildAbsoluteScale,
  pickColor,
  savedScaleFile,
  openScaleFile,
  openWell,
  pickAlteration,
  pickAccidental,
  pickFthora,
  pickMartyria,
  searchPicker,
  dismissPicker,
  measureTextWidth,
  measureTextInk,
  scriptPaths,
  ROOT,
};
