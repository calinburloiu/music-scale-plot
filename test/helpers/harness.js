"use strict";

/**
 * Loads the real `index.html` + `app.js` into a fresh jsdom window.
 *
 * `app.js` is a classic script with no module system: it reads DOM elements at
 * the top level and wires up listeners as a side effect of loading. Rather than
 * restructuring the app to make it testable, the harness loads the file exactly
 * as the browser does and appends a generated epilogue that re-exports every
 * top-level declaration as a live getter on `window.__app`. Production code
 * therefore stays untouched, and any new top-level `function`/`const` in
 * `app.js` becomes testable automatically.
 *
 * Browser APIs jsdom does not implement are replaced with recording stubs (see
 * canvas-stub.js and audio-stub.js) so drawing, audio and PNG export can be
 * asserted as data.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const { RecordingContext2D, measureTextWidth } = require("./canvas-stub.js");
const { FakeAudioContext } = require("./audio-stub.js");

const ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(ROOT, "index.html");
const APP_PATH = path.join(ROOT, "app.js");

/** Matches a top-level (column 0) declaration in app.js. */
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
  return `\n;window.__app = { ${accessors.join(", ")} };\n`;
}

/**
 * Boots the app.
 *
 * @param {object} [options]
 * @param {number} [options.devicePixelRatio=2] value app.js reads into its DPR constant
 * @returns {object} harness
 */
function loadApp(options = {}) {
  const devicePixelRatio = options.devicePixelRatio ?? 2;

  const html = fs.readFileSync(HTML_PATH, "utf8");
  const appSource = fs.readFileSync(APP_PATH, "utf8");

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

  // --- downloads ---------------------------------------------------------
  // jsdom has no navigation, so record anchor activation instead of following it.
  const downloads = [];
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push({ download: this.download, href: this.href });
  };

  const names = topLevelNames(appSource);
  // Run through `vm` with app.js's real filename so stack traces and
  // `--experimental-test-coverage` attribute the code to the file on disk.
  vm.runInContext(appSource + buildExportEpilogue(names), dom.getInternalVMContext(), {
    filename: APP_PATH,
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
    /** Every AudioContext the app constructed (it should only ever be one). */
    audioContexts,
    /** Errors jsdom itself reported (unimplemented APIs, uncaught throws). */
    jsdomErrors,
    /** Names re-exported from app.js, for harness self-tests. */
    exportedNames: names,

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

module.exports = {
  loadApp,
  fireInput,
  fireChange,
  fireClick,
  typeInto,
  selectOption,
  noteRows,
  intervalRows,
  setNoteCount,
  buildRelativeScale,
  buildAbsoluteScale,
  pickColor,
  measureTextWidth,
  ROOT,
};
