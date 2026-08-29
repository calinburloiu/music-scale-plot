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

// ---------------------------------------------------------------------------
// Pickers.
//
// Only one picker is open at a time. Opening one goes through app.js's
// closeAllDropdowns(), which is the same machinery the colour picker uses, so
// the two can never be open together.
// ---------------------------------------------------------------------------

/** One clickable row of a picker: a glyph preview and a label. */
function makeByzOption(spec) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "byz-option " + spec.className;
  for (const key of Object.keys(spec.data)) button.dataset[key] = spec.data[key];
  if (spec.disabled) button.disabled = true;

  const glyph = document.createElement("span");
  glyph.className = "byz-glyph";
  glyph.textContent = spec.glyph;

  const label = document.createElement("span");
  label.className = "byz-label";
  label.textContent = spec.label;

  button.appendChild(glyph);
  button.appendChild(label);
  return button;
}

/** One flat list: None, then the sixteen fthores in block order. */
function buildFthoraPicker(panel, row) {
  const current = readNoteSymbols(row).fthora;
  panel.innerHTML = "";
  panel.appendChild(
    makeByzOption({ className: "fthora-option", data: { fthora: "" }, glyph: "", label: "None" })
  );
  for (const fthora of BYZ_FTHORES) {
    const option = makeByzOption({
      className: "fthora-option",
      data: { fthora: fthora.id },
      glyph: resolveFthoraGlyph(fthora.id),
      label: fthora.label,
    });
    if (current === fthora.id) option.classList.add("is-selected");
    panel.appendChild(option);
  }
}

function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(".fthora-picker, .martyria-picker");
  const wasOpen = panel.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;

  const row = well.closest(".note-row");
  buildFthoraPicker(panel, row);
  panel.classList.add("open");
  row.classList.add("picker-open");
}

function closeByzantinePickers() {
  for (const panel of editor.querySelectorAll(".fthora-picker.open, .martyria-picker.open")) {
    panel.classList.remove("open");
    const row = panel.closest(".note-row");
    if (row) row.classList.remove("picker-open");
  }
}

function applyByzantineOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;
  if (option.classList.contains("fthora-option")) {
    writeFthora(row, option.dataset.fthora);
    closeAllDropdowns();
  }
  render();
}

/**
 * Routes a click inside the editor. Returns true when it handled the event, so
 * app.js's listener can stop.
 */
function handleByzantineClick(e) {
  const well = e.target.closest(".fthora-well, .martyria-well");
  if (well) {
    e.stopPropagation();
    toggleWellPicker(well);
    return true;
  }

  const option = e.target.closest(".byz-option");
  if (option) {
    e.stopPropagation();
    if (!option.disabled) applyByzantineOption(option);
    return true;
  }

  // A click on the panel's own chrome must not reach the document listener,
  // which would close it.
  if (e.target.closest(".fthora-picker, .martyria-picker")) {
    e.stopPropagation();
    return true;
  }
  return false;
}
