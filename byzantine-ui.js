// Byzantine notation: the editor UI.
//
// This file declares functions only. It loads before app.js, so it must not
// read app.js's top-level constants (editor, ctx, …) at load time — only from
// inside a function body, which runs after app.js has loaded.

/** The two symbol wells and their picker panels, for one note row. */
function makeSymbolWellsHTML() {
  return (
    '<div class="fthora-well-wrapper">' +
      '<button type="button" class="fthora-well is-empty" title="Fthora"></button>' +
      '<div class="fthora-picker"></div>' +
    "</div>" +
    '<div class="martyria-well-wrapper">' +
      '<button type="button" class="martyria-well is-empty" title="Martyria"></button>' +
      '<div class="martyria-picker"></div>' +
    "</div>"
  );
}

// ---------------------------------------------------------------------------
// Symbol state.
//
// The DOM is this app's data model, so a note row carries its own symbols as
// data-* attributes. Row add/remove bookkeeping then comes for free.
// ---------------------------------------------------------------------------

const NOTE_SYMBOL_ATTRS = ["fthora", "martyriaNote", "martyriaGenus", "martyriaTicks"];

function readNoteSymbols(row) {
  const noteId = row.dataset.martyriaNote || "";
  return {
    fthora: row.dataset.fthora || "",
    martyria: noteId
      ? {
          note: noteId,
          genus: row.dataset.martyriaGenus || GENUS_NONE,
          ticks: parseInt(row.dataset.martyriaTicks || "0", 10) || 0,
        }
      : null,
  };
}

function writeMartyria(row, noteId, genusId, ticks) {
  row.dataset.martyriaNote = noteId;
  row.dataset.martyriaGenus = genusId || GENUS_NONE;
  row.dataset.martyriaTicks = String(ticks || 0);
  refreshNoteRowWells(row);
}

function clearMartyria(row) {
  delete row.dataset.martyriaNote;
  delete row.dataset.martyriaGenus;
  delete row.dataset.martyriaTicks;
  refreshNoteRowWells(row);
}

function writeFthora(row, fthoraId) {
  if (fthoraId) row.dataset.fthora = fthoraId;
  else delete row.dataset.fthora;
  refreshNoteRowWells(row);
}

/** Repaints both wells of one row from its data-* attributes. */
function refreshNoteRowWells(row) {
  const symbols = readNoteSymbols(row);

  const fthoraWell = row.querySelector(".fthora-well");
  if (fthoraWell) {
    fthoraWell.textContent = symbols.fthora ? resolveFthoraGlyph(symbols.fthora) : "";
    fthoraWell.classList.toggle("is-empty", !symbols.fthora);
  }

  const martyriaWell = row.querySelector(".martyria-well");
  if (martyriaWell) {
    martyriaWell.textContent = symbols.martyria
      ? resolveMartyriaGlyphs(symbols.martyria.note, symbols.martyria.genus, symbols.martyria.ticks)
      : "";
    martyriaWell.classList.toggle("is-empty", !symbols.martyria);
  }
}

/** Snapshot of a row's symbol attributes, for carrying across a rebuild. */
function noteSymbolAttrs(row) {
  const attrs = {};
  for (const key of NOTE_SYMBOL_ATTRS) attrs[key] = row.dataset[key];
  return attrs;
}

function applyNoteSymbolAttrs(row, attrs) {
  for (const key of NOTE_SYMBOL_ATTRS) {
    if (attrs[key] === undefined) delete row.dataset[key];
    else row.dataset[key] = attrs[key];
  }
  refreshNoteRowWells(row);
}
