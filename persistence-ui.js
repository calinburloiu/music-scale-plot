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
const toolbarMessageText = document.getElementById("toolbar-message-text");
const toolbarMessageDismiss = document.getElementById("toolbar-message-dismiss");
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

/**
 * Escape closes the menu and hands focus back to the button that opened it.
 * aria-haspopup="menu" sets that expectation even though the panel is a plain
 * group of buttons rather than a role="menu" — 022b1a5 dropped the roles it
 * could not back with arrow-key handling. A reader who opens the menu from the
 * keyboard still has to be able to leave it from the keyboard, and land back
 * where they started rather than at the top of the document.
 */
function handleSaveMenuKey(event) {
  if (event.key !== "Escape" || !saveMenuPanel.classList.contains("open")) return;
  toggleSaveMenu(false);
  saveMenuBtn.focus();
}

document.addEventListener("keydown", handleSaveMenuKey);

saveMenuBtn.addEventListener("click", function (event) {
  // Read the state first: closeAllDropdowns() closes this menu too, so asking
  // afterwards would always say "closed" and the button would never toggle off.
  const wasOpen = saveMenuPanel.classList.contains("open");
  event.stopPropagation();
  closeAllDropdowns();
  toggleSaveMenu(!wasOpen);
});

// --- the message bar -------------------------------------------------------
//
// Where a rejected file says why. The bar is the only place the file flows
// report anything: a bad document never reaches the editor, so there is
// nothing on screen to show what went wrong.

// The text goes in its own span rather than straight onto #toolbar-message,
// because the dismiss button is a child of the bar: writing the container's
// textContent would delete the button along with the old message, and the next
// message would have no way out. The button carries no text node of its own —
// its × is a CSS ::before and its name an aria-label — so the bar's textContent
// stays exactly the message, which is what the live region announces.

/**
 * The one message kind that takes itself down: the save guard's complaint about
 * an unreadable interval describes a state the editor is in, and stops being
 * true when that state does. Every other message — a file that would not open,
 * a dialog that failed — is a thing that happened, and only the user dismisses
 * it. showToolbarMessage() stamps the kind so markInvalidIntervals() can clear
 * this one without touching the others.
 */
const INVALID_SCALE_MESSAGE = "invalid-scale";

function showToolbarMessage(text, kind) {
  toolbarMessageText.textContent = text;
  toolbarMessage.dataset.kind = kind || "";
  toolbarMessage.hidden = false;
}

function clearToolbarMessage() {
  toolbarMessageText.textContent = "";
  toolbarMessage.dataset.kind = "";
  toolbarMessage.hidden = true;
}

function clearToolbarMessageOfKind(kind) {
  if (toolbarMessage.dataset.kind === kind) clearToolbarMessage();
}

toolbarMessageDismiss.addEventListener("click", clearToolbarMessage);

// --- New -------------------------------------------------------------------

/**
 * initUI() is already both the startup path and the pageshow handler, and it
 * is already exactly "as if you opened the page in a new private session" —
 * every control back to its markup default and the editor rebuilt. New is that,
 * plus dismissing anything the bar was still saying.
 */
function newScaleFile() {
  // As if opened in a new private session: nothing from the old scale — audio
  // included — may keep going into the fresh one.
  stopScale();
  clearToolbarMessage();
  initUI();
}

newBtn.addEventListener("click", newScaleFile);

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

  // A box the app cannot read would go to the file as the raw text it holds,
  // and the scale would come back with the same hole in it. Refuse instead,
  // and say which rows to look at.
  const problem = invalidIntervalMessage();
  if (problem) {
    showToolbarMessage(problem, INVALID_SCALE_MESSAGE);
    return;
  }

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

// --- writing the page ------------------------------------------------------

function applyNoteState(row, note) {
  const nameInput = row.querySelector(".note-name");
  if (nameInput) nameInput.value = note.generic.name;
  // Through the sanctioned writers, so a well is painted exactly as a picker
  // would have painted it — but the batch one, which sets all four attributes
  // and repaints the row once. Written sign by sign this cost four full passes
  // over every well, three of them thrown away by the next.
  writeNoteSymbols(row, {
    accidental: note.generic.accidental,
    alteration: note.byzantine.alteration,
    fthora: note.byzantine.fthora,
    martyria: note.byzantine.martyria,
  });
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
  // The classes only, not onNotationChange(): that ends in render(), and #editor
  // still holds the outgoing scale here — it would be painted under the
  // incoming mode and interval type before being thrown away. The render() at
  // the end of this function is the one paint an Open owes. closeAllDropdowns(),
  // the other thing onNotationChange() does, already ran at the top.
  applyNotationClasses();

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
  // Both Open branches (the file-picker path and the fallback input) funnel
  // through here, so one call covers both: the scale being replaced is the
  // one whose audio, if any, must not keep sounding into the new one.
  stopScale();
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
  let text;
  try {
    text = await file.text();
  } catch (error) {
    showToolbarMessage("Could not open the file.");
    return;
  }
  loadScaleFileText(text);
});

// --- keyboard shortcuts ----------------------------------------------------
//
// Ctrl/Cmd+O and Ctrl/Cmd+S. New gets no chord: the browser owns Ctrl+N and
// will not give it up.

function handleFileShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = String(event.key).toLowerCase();
  if (key !== "o" && key !== "s") return;
  // Take the chord off the page on every keydown, repeats included, or a held
  // key reaches the browser's own Save-page dialog. Act only on the first: the
  // handler opens a file dialog, and a held key would stack up a queue of them.
  event.preventDefault();
  if (event.repeat) return;
  if (key === "o") openScaleFile();
  else saveScaleFile();
}

document.addEventListener("keydown", handleFileShortcut);

// --- announcing the shortcuts ----------------------------------------------
//
// `aria-keyshortcuts` is written into index.html, because it names *both*
// chords the handler above accepts and reads the same on every machine. The
// tooltip cannot: a reader sees one keyboard, and "Ctrl+S" on a Mac is wrong.
// Only the two chords need this — Space is Space everywhere, so the transport's
// hints are static markup.

/** True on a Mac, an iPhone or an iPad, where the chord key is ⌘. */
function isApplePlatform() {
  const data = navigator.userAgentData;
  const platform = (data && data.platform) || navigator.platform || "";
  return /^(mac|iphone|ipad|ipod)/i.test(platform);
}

/** A chord as this machine's own keyboard writes it: "⌘S" or "Ctrl+S". */
function chordHint(letter) {
  return isApplePlatform() ? "⌘" + letter : "Ctrl+" + letter;
}

/**
 * Writes each chord into its control's tooltip.
 *
 * Composed from the control's own accessible name rather than appended to
 * whatever the title already says, so running it twice cannot stack two hints.
 */
function applyShortcutHints() {
  openBtn.title = openBtn.getAttribute("aria-label") + " (" + chordHint("O") + ")";
  saveScaleItem.title = saveScaleItem.textContent + " (" + chordHint("S") + ")";
}

applyShortcutHints();
