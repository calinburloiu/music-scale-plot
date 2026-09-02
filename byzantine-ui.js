// Byzantine notation: the editor UI.
//
// This file declares functions only. It loads after symbols-ui.js and before
// app.js, so it must not read app.js's top-level constants (editor, ctx, …) at
// load time — only from inside a function body, which runs after app.js has
// loaded. What is left here is Byzantine-specific: the three picker builders
// symbols-ui.js's SYMBOL_WELLS table names, the martyria draft, and the ladder
// applied to the editor. The wells and pickers themselves — shared machinery —
// live in symbols-ui.js.

// ---------------------------------------------------------------------------
// Pickers.
//
// The draft lives on the panel element, for the same reason a row's symbols
// live on the row: the DOM is this app's data model, and a panel that is torn
// down and rebuilt on every click needs its pending value to outlive its
// contents.
const PICKER_DRAFT_ATTRS = ["draftNote", "draftGenus", "draftTicks"];

function clearPickerDraft(panel) {
  for (const key of PICKER_DRAFT_ATTRS) delete panel.dataset[key];
}

/** Starts a martyria panel's draft from the symbols its row currently holds. */
function seedPickerDraft(panel, row) {
  clearPickerDraft(panel);
  const martyria = readNoteSymbols(row).martyria;
  if (martyria) writeMartyriaDraft(panel, martyria.note, martyria.genus, martyria.ticks);
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
  writeNoteSign(row, "fthora", fthoraId);
}

function writeAlteration(row, alterationId) {
  writeNoteSign(row, "alteration", alterationId);
}

/**
 * None, then the fthores that belong on the row's martyria note, then a rule,
 * then everything else — the same shape the genus column already has.
 *
 * A row with no martyria has nothing to be compatible with, so it gets the flat
 * list of all sixteen and no rule, exactly as `buildGenusColumn` goes inert
 * when the draft has no note.
 *
 * The note read here is the row's committed martyria: only one picker is open
 * at a time and committing a martyria closes every panel, so the next fthora
 * open always re-reads current state. A committed fthora that is not compatible
 * still renders selected — below the rule, where it was offered.
 */
function buildFthoraPicker(panel, row) {
  const noteId = row.dataset.martyriaNote || "";
  const option = (id) => ({ id: id, glyph: resolveFthoraGlyph(id), label: byzFthoraById(id).label });
  const groups = noteId
    ? [
        { id: "compatible", title: "", options: compatibleFthores(noteId).map(option) },
        { id: "other", title: "", options: otherFthores(noteId).map(option) },
      ]
    : [{ id: "all", title: "", options: BYZ_FTHORES.map((f) => option(f.id)) }];

  buildGroupedPicker(panel, {
    kind: "fthora",
    committed: row.dataset.fthora || "",
    font: panelWell(panel).font,
    separatorAfter: noteId ? "compatible" : null,
    groups: groups,
  });
}

/**
 * None, then the ten signs of alteration under two headings.
 *
 * Flat, with no rule: every sign is offered on every note, so unlike the fthora
 * list there is nothing to be compatible with and nothing to separate. The
 * headings carry no `data-group`, so `pickerRevealTarget` finds no fallback and
 * the list opens at the top on None — which is right here, because there is no
 * register to prefer.
 */
function buildAlterationPicker(panel, row) {
  buildGroupedPicker(panel, {
    kind: "alteration",
    committed: row.dataset.alteration || "",
    font: panelWell(panel).font,
    separatorAfter: null,
    groups: [
      { id: "sharps", title: "Sharps", family: "diesis" },
      { id: "flats", title: "Flats", family: "yfesis" },
    ].map((group) => ({
      id: group.id,
      title: group.title,
      options: BYZ_ALTERATIONS.filter((a) => a.family === group.family).map((a) => ({
        id: a.id,
        glyph: resolveAlterationGlyph(a.id),
        label: a.label,
      })),
    })),
  });
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

function buildMartyriaPicker(panel, row) {
  const draft = readMartyriaDraft(panel);
  const scroll = readPickerScroll(panel);

  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "martyria-picker-body";
  body.appendChild(buildNotesColumn(noteRowDegree(row), getDegreeCount(), draft, scaleHasTicks()));
  body.appendChild(buildGenusColumn(draft));
  panel.appendChild(body);

  centerPickerGlyphs(panel, MARTYRIA_WELL.font);
  restorePickerScroll(panel, scroll);
}

function buildNotesColumn(degree, degreeCount, draft, showTicks) {
  const column = document.createElement("div");
  column.className = "martyria-notes-column";
  column.dataset.scroller = "notes";
  column.appendChild(symbolColumnTitle("Notes"));
  column.appendChild(
    makeSymbolOption({
      className: "martyria-note-option",
      data: { note: "", ticks: "0" },
      glyph: "",
      label: "None",
    })
  );

  const groups = [
    { key: "low", title: "Low", octave: "low", ticks: 0 },
    { key: "mid", title: "Middle", octave: "mid", ticks: 0 },
    { key: "high", title: "High", octave: "high", ticks: 0 },
  ];
  // The tick octave is a consequence of a pick, not an ordinary choice, so it
  // is only offered once propagation has actually reached into it.
  if (showTicks) {
    groups.push({ key: "highTick", title: "High + octave tick", octave: "high", ticks: 1 });
  }

  for (const group of groups) {
    column.appendChild(symbolGroupTitle(group.title, group.key));
    for (const note of BYZ_NOTES) {
      if (note.octave !== group.octave) continue;
      const position = ladderPosition(note.id, group.ticks);
      const option = makeSymbolOption({
        className: "martyria-note-option",
        data: { note: note.id, ticks: String(group.ticks) },
        glyph: resolveMartyriaGlyphs(note.id, GENUS_NONE, group.ticks),
        // Latin first: it is what a reader types, and the glyph beside it is
        // already the psaltic letter. The Greek spelling follows as a gloss.
        label: note.latin + " (" + note.greek + ")",
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
  column.dataset.scroller = "genus";
  column.appendChild(symbolColumnTitle("Genus"));

  if (!draft) {
    column.classList.add("is-inert");
    return column;
  }

  // A genus row is the click that commits, so it previews exactly what it would
  // commit: the drafted letter — octave tick and all — carrying this genus's
  // mark. Its subject is still the mark, so the letter is repainted over itself
  // in grey and only the mark stays black; see `setGlyphBoxText`. Every row
  // shares the martyria baseline, so the letter holds still down the list and
  // the mark is the one thing that moves.
  const letter = resolveMartyriaGlyphs(draft.note, GENUS_NONE, draft.ticks);

  function genusOption(id, label) {
    const option = makeSymbolOption({
      className: "martyria-genus-option",
      data: { genus: id },
      glyph: resolveMartyriaGlyphs(draft.note, id, draft.ticks),
      mutedGlyph: letter,
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
  separator.className = "sym-separator";
  column.appendChild(separator);

  for (const id of otherGenera(draft.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }
  return column;
}

/** Writes a martyria to its row, runs the ladder after it, and closes up. */
function commitMartyria(row, martyria) {
  if (martyria) writeMartyria(row, martyria.note, martyria.genus, martyria.ticks);
  else clearMartyria(row);
  // The letter the user confirmed anchors the ladder; the rest follows it.
  // A cleared well anchors nothing, and propagation returns on its own.
  propagateMartyriaLadder(row);
  closeAllDropdowns();
  render();
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
