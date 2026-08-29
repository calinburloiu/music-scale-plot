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

function degreeCount() {
  return editor.querySelectorAll(".note-row").length;
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
  const current = readNoteSymbols(row).martyria;

  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "martyria-picker-body";
  body.appendChild(buildNotesColumn(noteRowDegree(row), degreeCount(), current, scaleHasTicks()));
  body.appendChild(buildGenusColumn(current));
  panel.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "martyria-picker-footer";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "martyria-done";
  done.textContent = "Done";
  footer.appendChild(done);
  panel.appendChild(footer);
}

function buildNotesColumn(degree, count, current, showTicks) {
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
        disabled: !isLadderPositionLegal(position, degree, count),
      });
      if (current && current.note === note.id && current.ticks === group.ticks) {
        option.classList.add("is-selected");
      }
      column.appendChild(option);
    }
  }
  return column;
}

function buildGenusColumn(current) {
  const column = document.createElement("div");
  column.className = "martyria-genus-column";
  column.appendChild(byzColumnTitle("Genus"));

  if (!current) {
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
      glyph: resolveMartyriaGlyphs(current.note, id, 0),
      label: label,
    });
    if (current.genus === id) option.classList.add("is-selected");
    return option;
  }

  column.appendChild(genusOption(GENUS_NONE, "None"));
  for (const id of compatibleGenera(current.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }

  const separator = document.createElement("div");
  separator.className = "byz-separator";
  column.appendChild(separator);

  for (const id of otherGenera(current.note)) {
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
  if (panel.classList.contains("fthora-picker")) buildFthoraPicker(panel, row);
  else buildMartyriaPicker(panel, row);
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
  } else if (option.classList.contains("martyria-note-option")) {
    if (!option.dataset.note) {
      clearMartyria(row);
    } else {
      const existing = readNoteSymbols(row).martyria;
      writeMartyria(
        row,
        option.dataset.note,
        existing ? existing.genus : GENUS_NONE,
        parseInt(option.dataset.ticks, 10) || 0
      );
    }
    // Rebuild so the genus previews recompose on the new letter. The panel
    // stays open: the user picks a note, then a genus, then presses Done.
    buildMartyriaPicker(row.querySelector(".martyria-picker"), row);
  } else if (option.classList.contains("martyria-genus-option")) {
    const existing = readNoteSymbols(row).martyria;
    if (!existing) return;
    writeMartyria(row, existing.note, option.dataset.genus, existing.ticks);
    // Same as above: stays open for Done.
    buildMartyriaPicker(row.querySelector(".martyria-picker"), row);
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

  const done = e.target.closest(".martyria-done");
  if (done) {
    e.stopPropagation();
    const row = done.closest(".note-row");
    closeAllDropdowns();
    propagateMartyriaLadder(row);
    render();
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

// ---------------------------------------------------------------------------
// The ladder, applied to the editor.
// ---------------------------------------------------------------------------

/**
 * Runs every other degree through the consecutive letters around `sourceRow`.
 * Each degree keeps whatever genus it had; a degree that had none gets the
 * sentinel. Fthores are never touched.
 */
function propagateMartyriaLadder(sourceRow) {
  if (!sourceRow) return;
  const rows = Array.from(editor.querySelectorAll(".note-row"));
  const sourceIndex = rows.indexOf(sourceRow);
  const source = readNoteSymbols(sourceRow).martyria;
  if (sourceIndex < 0 || !source) return;

  const base = ladderPosition(source.note, source.ticks);
  for (let j = 0; j < rows.length; j++) {
    if (j === sourceIndex) continue;
    const target = ladderNoteAt(base + (j - sourceIndex));
    if (!target) continue; // off the ladder — leave that well as it is
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
