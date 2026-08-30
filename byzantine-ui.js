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
  // No note is no martyria: never leave an empty attribute behind for
  // readNoteSymbols to step over.
  if (!noteId) {
    clearMartyria(row);
    return;
  }
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
//
// An open picker edits a *draft*, not the scale. Opening seeds the draft from
// the row; clicking an option moves the draft and rebuilds the panel around it;
// only Apply writes it back. Every other way out — Cancel, a click outside, a
// second click on the well, opening another picker — discards the draft and
// leaves the scale exactly as it was.
// ---------------------------------------------------------------------------

// The draft lives on the panel element, for the same reason a row's symbols
// live on the row: the DOM is this app's data model, and a panel that is torn
// down and rebuilt on every click needs its pending value to outlive its
// contents.
const PICKER_DRAFT_ATTRS = ["draftFthora", "draftNote", "draftGenus", "draftTicks"];

function clearPickerDraft(panel) {
  for (const key of PICKER_DRAFT_ATTRS) delete panel.dataset[key];
}

/** Starts a panel's draft from the symbols its row currently holds. */
function seedPickerDraft(panel, row) {
  clearPickerDraft(panel);
  const symbols = readNoteSymbols(row);
  if (panel.classList.contains("fthora-picker")) panel.dataset.draftFthora = symbols.fthora;
  else if (symbols.martyria) {
    writeMartyriaDraft(panel, symbols.martyria.note, symbols.martyria.genus, symbols.martyria.ticks);
  }
}

/** The drafted martyria, in the shape `readNoteSymbols` returns, or null. */
function readMartyriaDraft(panel) {
  const noteId = panel.dataset.draftNote || "";
  if (!noteId) return null;
  return {
    note: noteId,
    genus: panel.dataset.draftGenus || GENUS_NONE,
    ticks: parseInt(panel.dataset.draftTicks || "0", 10) || 0,
  };
}

function writeMartyriaDraft(panel, noteId, genusId, ticks) {
  // No note is no martyria, exactly as on a row: never leave a stray attribute
  // behind for readMartyriaDraft to step over.
  if (!noteId) {
    delete panel.dataset.draftNote;
    delete panel.dataset.draftGenus;
    delete panel.dataset.draftTicks;
    return;
  }
  panel.dataset.draftNote = noteId;
  panel.dataset.draftGenus = genusId || GENUS_NONE;
  panel.dataset.draftTicks = String(ticks || 0);
}

/** True when applying the draft would actually change the row. */
function pickerDraftIsDirty(panel, row) {
  const symbols = readNoteSymbols(row);
  if (panel.classList.contains("fthora-picker")) {
    return (panel.dataset.draftFthora || "") !== symbols.fthora;
  }
  const draft = readMartyriaDraft(panel);
  const current = symbols.martyria;
  if (!draft || !current) return Boolean(draft) !== Boolean(current);
  return (
    draft.note !== current.note || draft.genus !== current.genus || draft.ticks !== current.ticks
  );
}

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
  const draft = panel.dataset.draftFthora || "";
  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "fthora-picker-body";
  body.appendChild(
    makeByzOption({ className: "fthora-option", data: { fthora: "" }, glyph: "", label: "None" })
  );
  for (const fthora of BYZ_FTHORES) {
    const option = makeByzOption({
      className: "fthora-option",
      data: { fthora: fthora.id },
      glyph: resolveFthoraGlyph(fthora.id),
      label: fthora.label,
    });
    if (draft === fthora.id) option.classList.add("is-selected");
    body.appendChild(option);
  }
  panel.appendChild(body);
  panel.appendChild(buildPickerFooter(panel, row));
}

function noteRowDegree(row) {
  return parseInt(row.dataset.degree, 10) || 1;
}

/** True once some degree has been pushed into the tick octave. */
function scaleHasTicks() {
  for (const row of editor.querySelectorAll(".note-row")) {
    if (parseInt(row.dataset.martyriaTicks || "0", 10) > 0) return true;
  }
  return false;
}

function byzColumnTitle(text) {
  const el = document.createElement("div");
  el.className = "byz-column-title";
  el.textContent = text;
  return el;
}

function byzGroupTitle(text) {
  const el = document.createElement("div");
  el.className = "byz-group-title";
  el.textContent = text;
  return el;
}

function buildMartyriaPicker(panel, row) {
  const draft = readMartyriaDraft(panel);

  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "martyria-picker-body";
  body.appendChild(buildNotesColumn(noteRowDegree(row), getDegreeCount(), draft, scaleHasTicks()));
  body.appendChild(buildGenusColumn(draft));
  panel.appendChild(body);

  // The well still shows the committed martyria, so the footer is the only
  // place the draft is visible whole — and the only place its octave tick is.
  panel.appendChild(
    buildPickerFooter(panel, row, draft ? resolveMartyriaGlyphs(draft.note, draft.genus, draft.ticks) : "")
  );
}

/**
 * Cancel and Apply, and for the martyria picker a preview of the draft.
 * Apply is dead while the draft still matches the row: there is nothing to
 * apply, and pressing it would only re-run the ladder for no reason.
 */
function buildPickerFooter(panel, row, previewText) {
  const footer = document.createElement("div");
  footer.className = "byz-picker-footer";

  if (previewText !== undefined) {
    const preview = document.createElement("div");
    preview.className = "byz-preview";
    preview.textContent = previewText;
    footer.appendChild(preview);
  }

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "byz-cancel";
  cancel.textContent = "Cancel";
  footer.appendChild(cancel);

  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "byz-apply";
  apply.textContent = "Apply";
  apply.disabled = !pickerDraftIsDirty(panel, row);
  footer.appendChild(apply);

  return footer;
}

function buildNotesColumn(degree, degreeCount, draft, showTicks) {
  const column = document.createElement("div");
  column.className = "martyria-notes-column";
  column.appendChild(byzColumnTitle("Notes"));
  column.appendChild(
    makeByzOption({
      className: "martyria-note-option",
      data: { note: "", ticks: "0" },
      glyph: "",
      label: "None",
    })
  );

  const groups = [
    { title: "Low", octave: "low", ticks: 0 },
    { title: "Middle", octave: "mid", ticks: 0 },
    { title: "High", octave: "high", ticks: 0 },
  ];
  // The tick octave is a consequence of a pick, not an ordinary choice, so it
  // is only offered once propagation has actually reached into it.
  if (showTicks) groups.push({ title: "High + octave tick", octave: "high", ticks: 1 });

  for (const group of groups) {
    column.appendChild(byzGroupTitle(group.title));
    for (const note of BYZ_NOTES) {
      if (note.octave !== group.octave) continue;
      const position = ladderPosition(note.id, group.ticks);
      const option = makeByzOption({
        className: "martyria-note-option",
        data: { note: note.id, ticks: String(group.ticks) },
        glyph: resolveMartyriaGlyphs(note.id, GENUS_NONE, group.ticks),
        label: note.greek + " " + note.latin,
        disabled: !isLadderPositionLegal(position, degree, degreeCount),
      });
      if (draft && draft.note === note.id && draft.ticks === group.ticks) {
        option.classList.add("is-selected");
      }
      column.appendChild(option);
    }
  }
  return column;
}

function buildGenusColumn(draft) {
  const column = document.createElement("div");
  column.className = "martyria-genus-column";
  column.appendChild(byzColumnTitle("Genus"));

  if (!draft) {
    column.classList.add("is-inert");
    return column;
  }

  // Every row previews itself on the selected letter, because that is the only
  // form the user will ever see it in. The octave tick is left off: it marks a
  // register, not a genus.
  function genusOption(id, label) {
    const option = makeByzOption({
      className: "martyria-genus-option",
      data: { genus: id },
      glyph: resolveMartyriaGlyphs(draft.note, id, 0),
      label: label,
    });
    if (draft.genus === id) option.classList.add("is-selected");
    return option;
  }

  column.appendChild(genusOption(GENUS_NONE, "None"));
  for (const id of compatibleGenera(draft.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }

  const separator = document.createElement("div");
  separator.className = "byz-separator";
  column.appendChild(separator);

  for (const id of otherGenera(draft.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }
  return column;
}

function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(".fthora-picker, .martyria-picker");
  const wasOpen = panel.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;

  const row = well.closest(".note-row");
  seedPickerDraft(panel, row);
  if (panel.classList.contains("fthora-picker")) buildFthoraPicker(panel, row);
  else buildMartyriaPicker(panel, row);
  panel.classList.add("open");
  row.classList.add("picker-open");
}

/**
 * Closes whatever picker is open and throws its draft away. Apply is the only
 * gesture that commits, so every path through here — Cancel, a click outside,
 * a second click on the well, another picker opening — leaves the scale
 * untouched, and an untouched scale has nothing to redraw.
 */
function closeByzantinePickers() {
  for (const panel of editor.querySelectorAll(".fthora-picker.open, .martyria-picker.open")) {
    panel.classList.remove("open");
    clearPickerDraft(panel);
    const row = panel.closest(".note-row");
    if (row) row.classList.remove("picker-open");
  }
}

/** Moves the open panel's draft, then rebuilds the panel around it. */
function selectByzantineOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;

  if (option.classList.contains("fthora-option")) {
    const panel = row.querySelector(".fthora-picker");
    panel.dataset.draftFthora = option.dataset.fthora;
    buildFthoraPicker(panel, row);
    return;
  }

  const panel = row.querySelector(".martyria-picker");
  if (option.classList.contains("martyria-note-option")) {
    const draft = readMartyriaDraft(panel);
    writeMartyriaDraft(
      panel,
      option.dataset.note,
      draft ? draft.genus : GENUS_NONE,
      parseInt(option.dataset.ticks, 10) || 0
    );
  } else if (option.classList.contains("martyria-genus-option")) {
    const draft = readMartyriaDraft(panel);
    if (!draft) return;
    writeMartyriaDraft(panel, draft.note, option.dataset.genus, draft.ticks);
  } else {
    return;
  }
  // Rebuild so the genus previews recompose on the drafted letter and the
  // footer follows it. The panel stays open until Apply or Cancel.
  buildMartyriaPicker(panel, row);
}

/** Writes the open panel's draft to its row, and runs the ladder after it. */
function applyPickerDraft(panel) {
  const row = panel.closest(".note-row");
  if (!row) return;

  if (panel.classList.contains("fthora-picker")) {
    writeFthora(row, panel.dataset.draftFthora || "");
  } else {
    const draft = readMartyriaDraft(panel);
    if (draft) writeMartyria(row, draft.note, draft.genus, draft.ticks);
    else clearMartyria(row);
    // The letter the user confirmed anchors the ladder; the rest follows it.
    // A cleared well anchors nothing, and propagation returns on its own.
    propagateMartyriaLadder(row);
  }
  closeAllDropdowns();
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

  const apply = e.target.closest(".byz-apply");
  if (apply) {
    e.stopPropagation();
    // A dead Apply is a dead click: it must not even dismiss the panel.
    if (!apply.disabled) {
      applyPickerDraft(apply.closest(".fthora-picker, .martyria-picker"));
    }
    return true;
  }

  const cancel = e.target.closest(".byz-cancel");
  if (cancel) {
    e.stopPropagation();
    // Cancel is the explicit spelling of every other dismissal; closing
    // discards the draft.
    closeAllDropdowns();
    return true;
  }

  const option = e.target.closest(".byz-option");
  if (option) {
    e.stopPropagation();
    if (!option.disabled) selectByzantineOption(option);
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

// ---------------------------------------------------------------------------
// The ladder, applied to the editor.
// ---------------------------------------------------------------------------

/**
 * Runs every degree through the consecutive letters around `sourceRow`.
 * Each degree keeps whatever genus it had; a degree that had none gets the
 * sentinel. Fthores are never touched.
 *
 * The anchor is clamped into `sourceRow`'s legal window first, so a scale that
 * outgrew its letters — added degrees push the top of the ladder out of reach —
 * is re-anchored rather than left with stranded, empty wells. That is also why
 * the source row itself is walked: clamping can move it too.
 */
function propagateMartyriaLadder(sourceRow) {
  if (!sourceRow) return;
  const rows = Array.from(editor.querySelectorAll(".note-row"));
  const sourceIndex = rows.indexOf(sourceRow);
  const source = readNoteSymbols(sourceRow).martyria;
  if (sourceIndex < 0 || !source) return;

  const base = clampLadderPosition(
    ladderPosition(source.note, source.ticks),
    sourceIndex + 1,
    rows.length
  );
  for (let j = 0; j < rows.length; j++) {
    const target = ladderNoteAt(base + (j - sourceIndex));
    if (!target) continue; // the scale outruns the ladder — leave that well as it is
    const existing = readNoteSymbols(rows[j]).martyria;
    writeMartyria(rows[j], target.noteId, existing ? existing.genus : GENUS_NONE, target.ticks);
  }
}

/** A new degree continues the ladder: previous position + 1, no genus. */
function continueLadderOnNewNote(prevRow, newRow) {
  if (!prevRow || !newRow) return;
  const previous = readNoteSymbols(prevRow).martyria;
  if (!previous) return;
  const next = ladderNoteAt(ladderPosition(previous.note, previous.ticks) + 1);
  if (!next) return;
  writeMartyria(newRow, next.noteId, GENUS_NONE, next.ticks);
}
