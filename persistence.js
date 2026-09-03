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

/**
 * Whether an interval value means the unison — the pitch Note 1 always carries
 * in absolute mode, where its input sits disabled. A ratio is the unison when
 * its two terms match, so "2/2" reads the same as "1/1"; edo steps and cents
 * are the unison at zero, however it is spelled. Meaning, not spelling: the
 * editor re-pins the slot to getUnisonValue() on Open, so an equivalent value
 * loses nothing, while a genuinely different one is refused by name rather
 * than silently overwritten.
 */
function isUnisonInterval(value, type) {
  const text = String(value).trim();
  if (type === "ratio") {
    const terms = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
    if (!terms) return false;
    return Number(terms[1]) !== 0 && Number(terms[1]) === Number(terms[2]);
  }
  return text !== "" && Number.isFinite(Number(text)) && Number(text) === 0;
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

  // Note 1 is the base note, so in absolute mode the first entry is the unison
  // by definition and the editor pins it there. Anything else in that slot is
  // a hand-edit that cannot be honoured, and §6's principle is that such a
  // thing is named rather than dropped without a word.
  if (mode === "absoluteIntervals" && !isUnisonInterval(intervals[0], intervalType.type)) {
    return scaleFileError(
      `scaleEditor.intervals[0] must be the unison Note 1 carries, got ${JSON.stringify(intervals[0])}.`
    );
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
  // A note that is not a note, or a half that is not a half, is named rather
  // than quietly read as blank: "unknown keys are ignored" is a promise about
  // *additions* a future version might make, not a licence to swallow a
  // garbled file. Both halves may be absent — the writer omits one with
  // nothing set — but present and wrong is an error.
  if (!isPlainObject(raw)) {
    return scaleFileError(`The properties of note ${degree} must be an object.`);
  }
  const source = raw;
  if (source.generic !== undefined && !isPlainObject(source.generic)) {
    return scaleFileError(`The generic half of note ${degree} must be an object.`);
  }
  if (source.byzantine !== undefined && !isPlainObject(source.byzantine)) {
    return scaleFileError(`The byzantine half of note ${degree} must be an object.`);
  }
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
    if (!isPlainObject(byzantine.martyria)) {
      return scaleFileError(`The martyria on note ${degree} must be an object.`);
    }
    const martyriaRaw = byzantine.martyria;
    // The one martyria field that is not optional: no note is no martyria. A
    // missing note gets its own sentence — "Unknown martyria note undefined"
    // names a value the file never contained.
    if (martyriaRaw.note === undefined) {
      return scaleFileError(`A martyria on note ${degree} needs a note.`);
    }
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
  if (!isPlainObject(raw)) {
    return scaleFileError(`scaleEditor.intervalProperties[${index}] must be an object.`);
  }
  const source = raw;
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
