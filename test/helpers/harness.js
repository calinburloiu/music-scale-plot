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

const { RecordingContext2D, measureTextWidth, measureTextInk } = require("./canvas-stub.js");
const { FakeAudioContext } = require("./audio-stub.js");

const ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(ROOT, "index.html");

/** Matches `<script src="...">` in index.html, in document order. */
const SCRIPT_SRC = /<script\b[^>]*\bsrc="([^"]+)"/g;

function scriptPaths(html) {
  return [...html.matchAll(SCRIPT_SRC)].map((m) => path.join(ROOT, m[1]));
}

/** Matches a top-level (column 0) declaration in a script. */
const TOP_LEVEL_DECLARATION = /^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

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
 * @param {boolean} [options.fonts=true] set to `false` to boot with no `document.fonts`
 *   at all, as in jsdom's default state and in old browsers
 * @returns {object} harness
 */
function loadApp(options = {}) {
  const devicePixelRatio = options.devicePixelRatio ?? 2;

  const html = fs.readFileSync(HTML_PATH, "utf8");

  const jsdomErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => jsdomErrors.push(error));

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
  const context = new RecordingContext2D(document.getElementById("chart"));
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return context;
  };
  const dataUrls = [];
  window.HTMLCanvasElement.prototype.toDataURL = function toDataURL(type) {
    const url = `data:${type || "image/png"};base64,STUB(${this.width}x${this.height})`;
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
    Object.defineProperty(document, "fonts", {
      value: {
        load(spec) {
          fontLoads.push(spec);
          return Promise.resolve([]);
        },
        ready: Promise.resolve(),
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
    /** Every `toDataURL()` call made on the chart canvas. */
    dataUrls,
    /** Every font spec passed to `document.fonts.load()`. */
    fontLoads,
    /** Every AudioContext the app constructed (it should only ever be one). */
    audioContexts,
    /** Errors jsdom itself reported (unimplemented APIs, uncaught throws). */
    jsdomErrors,
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

/** Clicks a well and returns its picker panel. `kind` is "fthora" or "martyria". */
function openWell(harness, noteRow, kind) {
  fireClick(harness, noteRow.querySelector(`.${kind}-well`));
  return noteRow.querySelector(`.${kind}-picker`);
}

/** Opens the fthora picker and clicks one of its rows. `""` picks None. */
function pickFthora(harness, noteRow, fthoraId) {
  const panel = openWell(harness, noteRow, "fthora");
  const option = panel.querySelector(`.fthora-option[data-fthora="${fthoraId}"]`);
  if (!option) throw new Error(`No fthora option "${fthoraId}" in the picker`);
  fireClick(harness, option);
}

/**
 * Drives the martyria picker: opens it, picks a note and/or a genus, then
 * either presses Done (which propagates the ladder) or closes the panel by
 * clicking the well again (which does not).
 */
function pickMartyria(harness, noteRow, { note, genus, ticks = 0, done = false } = {}) {
  openWell(harness, noteRow, "martyria");

  if (note !== undefined) {
    const selector = `.martyria-note-option[data-note="${note}"][data-ticks="${ticks}"]`;
    const option = noteRow.querySelector(selector);
    if (!option) throw new Error(`No note option "${note}" (ticks ${ticks}) in the picker`);
    if (option.disabled) throw new Error(`Note option "${note}" is disabled for this degree`);
    fireClick(harness, option);
  }

  if (genus !== undefined) {
    // Picking a note rebuilds the panel, so the genus option must be re-queried.
    const option = noteRow.querySelector(`.martyria-genus-option[data-genus="${genus}"]`);
    if (!option) throw new Error(`No genus option "${genus}" in the picker`);
    fireClick(harness, option);
  }

  if (done) fireClick(harness, noteRow.querySelector(".martyria-done"));
  else fireClick(harness, noteRow.querySelector(".martyria-well"));
}

module.exports = {
  loadApp,
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
  openWell,
  pickFthora,
  pickMartyria,
  measureTextWidth,
  measureTextInk,
  scriptPaths,
  ROOT,
};
