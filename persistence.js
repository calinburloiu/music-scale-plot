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
