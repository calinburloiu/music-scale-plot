// Byzantine notation: the editor UI.
//
// This file declares functions only. It loads before app.js, so it must not
// read app.js's top-level constants (editor, ctx, …) at load time — only from
// inside a function body, which runs after app.js has loaded.

// ---------------------------------------------------------------------------
// The wells.
//
// Every well but the martyria holds a single sign chosen from one flat
// vocabulary, and they differ only in three things: the label they wear, the
// data-* attribute they read and write, and the resolver that turns an id into
// a glyph. Everything else — opening, committing, dismissing, the class names —
// is shared, so the differences are *described* here rather than branched on in
// a dozen places. A new sign family is a row in this table.
//
// The class names are derived from `kind`, not listed: a well of kind `k` is
// `.k-well` inside `.k-well-wrapper`, its panel is `.k-picker` with a
// `.k-picker-body`, and its rows are `.k-option` carrying `data-k`. The
// martyria is not in the table — it takes two clicks across two columns and
// propagates a ladder when it commits, so it genuinely is a different thing —
// but it is a well, so `BYZ_WELL_KINDS` and `byzSelector` include it.
//
// Table order is the order the wells appear on a note row, left to right.
const BYZ_SIMPLE_WELLS = freezeTable([
  {
    kind: "alteration",
    title: "Sign of alteration",
    build: function (panel, row) {
      buildAlterationPicker(panel, row);
    },
    resolve: resolveAlterationGlyph,
  },
  {
    kind: "fthora",
    title: "Fthora",
    build: function (panel, row) {
      buildFthoraPicker(panel, row);
    },
    resolve: resolveFthoraGlyph,
  },
]);

const BYZ_WELL_KINDS = Object.freeze(BYZ_SIMPLE_WELLS.map((well) => well.kind).concat("martyria"));

/** `.fthora-well, .martyria-well` and friends — one clause per well kind. */
function byzSelector(suffix) {
  return BYZ_WELL_KINDS.map((kind) => "." + kind + suffix).join(", ");
}

/** The descriptor for a panel's well, or null when the panel is a martyria's. */
function panelWell(panel) {
  return BYZ_SIMPLE_WELLS.find((well) => panel.classList.contains(well.kind + "-picker")) || null;
}

function wellWrapperHTML(kind, title) {
  return (
    '<div class="' + kind + '-well-wrapper">' +
      '<button type="button" class="' + kind + '-well is-empty" title="' + title + '"></button>' +
      '<div class="' + kind + '-picker"></div>' +
    "</div>"
  );
}

/** Every symbol well and its picker panel, for one note row. */
function makeSymbolWellsHTML() {
  return (
    BYZ_SIMPLE_WELLS.map((well) => wellWrapperHTML(well.kind, well.title)).join("") +
    wellWrapperHTML("martyria", "Martyria")
  );
}

// ---------------------------------------------------------------------------
// Symbol state.
//
// The DOM is this app's data model, so a note row carries its own symbols as
// data-* attributes. Row add/remove bookkeeping then comes for free.
// ---------------------------------------------------------------------------

const NOTE_SYMBOL_ATTRS = BYZ_SIMPLE_WELLS.map((well) => well.kind).concat([
  "martyriaNote",
  "martyriaGenus",
  "martyriaTicks",
]);

function readNoteSymbols(row) {
  const noteId = row.dataset.martyriaNote || "";
  const symbols = {
    martyria: noteId
      ? {
          note: noteId,
          genus: row.dataset.martyriaGenus || GENUS_NONE,
          ticks: parseInt(row.dataset.martyriaTicks || "0", 10) || 0,
        }
      : null,
  };
  // A simple well's key here is its kind, which is also its data-* attribute.
  for (const well of BYZ_SIMPLE_WELLS) symbols[well.kind] = row.dataset[well.kind] || "";
  return symbols;
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

/** Commits one simple well's sign to its row. `id` empty clears the well. */
function writeNoteSign(row, kind, id) {
  if (id) row.dataset[kind] = id;
  else delete row.dataset[kind];
  refreshNoteRowWells(row);
}

function writeFthora(row, fthoraId) {
  writeNoteSign(row, "fthora", fthoraId);
}

function writeAlteration(row, alterationId) {
  writeNoteSign(row, "alteration", alterationId);
}

/** Repaints every well of one row from its data-* attributes. */
// The wells measure their own glyphs, and the chart's context is not theirs to
// borrow: it carries the chart's font and alignment. One offscreen context,
// made on first use because this file loads before there is a document to
// draw on.
let wellMeasuringCtx = null;

function wellMeasuringContext() {
  if (!wellMeasuringCtx) {
    wellMeasuringCtx = document.createElement("canvas").getContext("2d");
  }
  return wellMeasuringCtx;
}

/**
 * Puts `text` in `box` with its *ink* placed rather than its baseline.
 *
 * The glyph goes in a span of its own so it has something to be offset by: a
 * fthora would otherwise float in the top third of the box and a martyria's
 * genus mark would hang below the border. The offset is measured per glyph —
 * see `inkCenteringShift` for why it cannot be a constant.
 *
 * `placement` is one of:
 *
 *   "center"   the glyph's own ink, centred — a sign shown on its own.
 *   "martyria" the shared martyria baseline, so a letter lands where the face
 *              draws it and a mark cannot drag it off that spot.
 *
 * (`inkCenteringShift` also takes "top" and "bottom", which pin a glyph against
 * an edge of its line box. Nothing in the editor asks for that any more, now
 * that a genus row shows a whole composition rather than a bare mark.)
 *
 * `mutedText` is drawn a second time on top of `text`, in a layer of its own,
 * for the genus rows: they preview a whole martyria but are *about* the mark, so
 * the letter is repainted over itself in grey and the mark below it stays black.
 * A mark cannot simply be coloured on its own — it is a combining glyph the font
 * attaches to the letter's anchor, and splitting the pair across two elements
 * would leave it unattached — so the pair is drawn whole and the letter covers
 * its own copy. Both layers share the wrapper's offset, which is what keeps the
 * two copies of the letter exactly on top of each other.
 *
 * The offset comes back in em, so it is right for the 22px well and the 24px
 * picker row alike and does not depend on the box being in the document — a box
 * filled during a rebuild has no computed size to measure against.
 */
function setGlyphBoxText(box, text, placement, mutedText) {
  box.textContent = "";
  if (!text) return;

  const ink = document.createElement("span");
  ink.className = "glyph-ink";
  if (mutedText) {
    ink.appendChild(glyphLayer(text));
    ink.appendChild(glyphLayer(mutedText, "glyph-muted"));
  } else {
    ink.textContent = text;
  }

  const ctx = wellMeasuringContext();
  const shared =
    placement === "martyria" ? martyriaInkRange(ctx, byzantineFont(BYZ_FONT_SIZE)) : null;
  const shift = inkCenteringShiftEm(ctx, text, shared ? "center" : placement, shared);
  ink.style.setProperty("--ink-dx", shift.dx.toFixed(4) + "em");
  ink.style.setProperty("--ink-dy", shift.dy.toFixed(4) + "em");

  box.appendChild(ink);
}

function glyphLayer(text, className) {
  const layer = document.createElement("span");
  layer.className = className ? "glyph-layer " + className : "glyph-layer";
  layer.textContent = text;
  return layer;
}

function fillWell(well, text, placement) {
  setGlyphBoxText(well, text, placement);
  well.classList.toggle("is-empty", !text);
}

/**
 * Boxes and places every sign in a freshly built panel.
 *
 * A box carries the glyphs it was built with as data-*, not as its own text:
 * a genus row holds two — the composition and the letter that is greyed over it
 * — and reading them back off the box keeps a rebuild idempotent whatever the
 * previous pass left inside it.
 */
function centerPickerGlyphs(panel) {
  for (const box of panel.querySelectorAll(".byz-glyph")) {
    setGlyphBoxText(box, box.dataset.glyph || "", glyphBoxPlacement(box), box.dataset.mutedGlyph);
  }
}

/**
 * Where a box should seat its sign.
 *
 * Everything in the martyria picker shows a whole martyria — the Notes column
 * its letter, the Genus column that letter carrying a mark — so both columns
 * take the shared martyria baseline, which is also the well's. The letter then
 * holds still down the whole panel and across the commit, and no box normalises
 * a register away. A fthora and a sign of alteration have no family to sit in,
 * so each is centred on its own ink.
 */
function glyphBoxPlacement(box) {
  return box.closest(".martyria-picker-body") ? "martyria" : "center";
}

function refreshNoteRowWells(row) {
  const symbols = readNoteSymbols(row);

  for (const well of BYZ_SIMPLE_WELLS) {
    const el = row.querySelector("." + well.kind + "-well");
    if (el) fillWell(el, symbols[well.kind] ? well.resolve(symbols[well.kind]) : "");
  }

  const martyriaWell = row.querySelector(".martyria-well");
  if (martyriaWell) {
    // The same placement the picker's preview uses, so the well shows exactly
    // what the preview promised.
    fillWell(
      martyriaWell,
      symbols.martyria
        ? resolveMartyriaGlyphs(symbols.martyria.note, symbols.martyria.genus, symbols.martyria.ticks)
        : "",
      "martyria"
    );
  }
}

/**
 * Re-measures every well. Called once the Neanes face resolves: a well filled
 * before then was measured against fallback metrics, and the offset it stored
 * is wrong for the glyph now on screen.
 */
function refreshAllNoteRowWells() {
  for (const row of document.querySelectorAll("#editor .note-row")) refreshNoteRowWells(row);
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
// Clicking a row is the whole gesture: the sign goes on the note and the panel
// closes behind it. There is no Apply and no Cancel, and the only way not to
// commit is not to click a row — a click outside, a second click on the well, or
// opening another picker, all of which leave the scale exactly as it was.
//
// The martyria is the exception, because it commits a *pair*: the Notes column
// narrows the Genus column and nothing more, and the genus click is what
// reaches the row. That intermediate letter is the one thing a panel still has
// to remember, so the martyria picker — and only it — carries a draft. Picking
// None in the Notes column is its own commit, having no genus left to confirm.
// ---------------------------------------------------------------------------

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

/**
 * One clickable row of a picker: a glyph preview and a label.
 *
 * `spec.mutedGlyph`, when given, is drawn over `spec.glyph` in grey — see
 * `setGlyphBoxText`. Both are left on the box as data-* for `centerPickerGlyphs`
 * to place once the row is in its panel and its placement can be read off it.
 */
function makeByzOption(spec) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "byz-option " + spec.className;
  for (const key of Object.keys(spec.data)) button.dataset[key] = spec.data[key];
  if (spec.disabled) button.disabled = true;

  const glyph = document.createElement("span");
  glyph.className = "byz-glyph";
  glyph.dataset.glyph = spec.glyph;
  if (spec.mutedGlyph) glyph.dataset.mutedGlyph = spec.mutedGlyph;

  const label = document.createElement("span");
  label.className = "byz-label";
  label.textContent = spec.label;

  button.appendChild(glyph);
  button.appendChild(label);
  return button;
}

/**
 * Where each of a panel's scrollers sits. Picking rebuilds the panel — the
 * genus rows have to be re-resolved against the new letter — and a rebuild
 * that started from the top would throw away the reader's place, hiding the
 * very row they just clicked.
 */
function readPickerScroll(panel) {
  const state = {};
  for (const el of panel.querySelectorAll("[data-scroller]")) {
    state[el.dataset.scroller] = el.scrollTop;
  }
  return state;
}

function restorePickerScroll(panel, state) {
  for (const el of panel.querySelectorAll("[data-scroller]")) {
    const top = state[el.dataset.scroller];
    if (top) el.scrollTop = top;
  }
}

/**
 * Where a scroller has to sit for `option` to be in view — clamped to either
 * end of the list, and left alone when there is nothing to scroll.
 *
 * `align` is `"center"` by default, which is how a single row reads best.
 * `"start"` puts the row at the top of the view instead: a section heading
 * marks where a run of rows *begins*, so centring it would bury half that run
 * above the fold.
 *
 * Pure arithmetic on purpose: the caller reads the layout, which jsdom does
 * not have, so this is the half that can be tested.
 */
function scrollTopToReveal(optionTop, optionHeight, viewHeight, scrollHeight, align) {
  if (viewHeight <= 0 || scrollHeight <= viewHeight) return 0;
  const wanted =
    align === "start" ? optionTop : optionTop - (viewHeight - optionHeight) / 2;
  return Math.max(0, Math.min(wanted, scrollHeight - viewHeight));
}

/**
 * What one scroller should bring into view when its picker opens, as
 * `{ element, align }`, or null when the top of the list is already right.
 *
 * The committed choice, when there is one — a picker opening on row 1 of
 * twenty-one otherwise hides the very letter the row holds. When there is
 * none, the notes list falls back to its middle octave: that is the register a
 * scale is written in unless it says otherwise, and it is a far better place to
 * start reading than "None" at the top. Neither single-value list has octaves
 * and both offer None as their first row, so they have nothing to fall back to
 * and stay put.
 */
function pickerRevealTarget(scroller) {
  const selected = scroller.querySelector(".is-selected");
  if (selected) return { element: selected, align: "center" };
  const middle = scroller.querySelector('[data-group="mid"]');
  return middle ? { element: middle, align: "start" } : null;
}

/** Brings the committed choice into view when a picker first opens. */
function revealPickerSelection(panel) {
  for (const el of panel.querySelectorAll("[data-scroller]")) {
    const target = pickerRevealTarget(el);
    if (!target) continue;
    // The column's own title is sticky, so the top of the *view* is not the top
    // of the visible list: scrolling a heading to 0 parks it underneath. Start
    // the run below the title instead.
    const title = target.align === "start" ? el.querySelector(".byz-column-title") : null;
    el.scrollTop = scrollTopToReveal(
      target.element.offsetTop - (title ? title.offsetHeight : 0),
      target.element.offsetHeight,
      el.clientHeight,
      el.scrollHeight,
      target.align
    );
  }
}

/**
 * Nudges a freshly opened panel into view when it opens below the fold. The
 * panels deliberately do not flip up — the lists scroll instead — but a well
 * near the bottom of a long editor can still push the list past the viewport.
 * Guarded: jsdom implements no scrollIntoView.
 */
function keepPickerInView(panel) {
  if (typeof panel.scrollIntoView !== "function") return;
  const box = panel.getBoundingClientRect();
  const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
  if (box.bottom > viewport) panel.scrollIntoView({ block: "nearest" });
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
  const committed = row.dataset.fthora || "";
  const noteId = row.dataset.martyriaNote || "";
  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "fthora-picker-body";
  body.dataset.scroller = "fthora";
  body.appendChild(
    makeByzOption({ className: "fthora-option", data: { fthora: "" }, glyph: "", label: "None" })
  );

  function fthoraOption(id) {
    const option = makeByzOption({
      className: "fthora-option",
      data: { fthora: id },
      glyph: resolveFthoraGlyph(id),
      label: byzFthoraById(id).label,
    });
    if (committed === id) option.classList.add("is-selected");
    return option;
  }

  if (noteId) {
    for (const id of compatibleFthores(noteId)) body.appendChild(fthoraOption(id));

    const separator = document.createElement("div");
    separator.className = "byz-separator";
    body.appendChild(separator);

    for (const id of otherFthores(noteId)) body.appendChild(fthoraOption(id));
  } else {
    for (const fthora of BYZ_FTHORES) body.appendChild(fthoraOption(fthora.id));
  }

  panel.appendChild(body);
  centerPickerGlyphs(panel);
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
  const committed = row.dataset.alteration || "";
  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "alteration-picker-body";
  body.dataset.scroller = "alteration";
  body.appendChild(
    makeByzOption({
      className: "alteration-option",
      data: { alteration: "" },
      glyph: "",
      label: "None",
    })
  );

  for (const group of [
    { title: "Sharps", family: "diesis" },
    { title: "Flats", family: "yfesis" },
  ]) {
    body.appendChild(byzGroupTitle(group.title));
    for (const alteration of BYZ_ALTERATIONS) {
      if (alteration.family !== group.family) continue;
      const option = makeByzOption({
        className: "alteration-option",
        data: { alteration: alteration.id },
        glyph: resolveAlterationGlyph(alteration.id),
        label: alteration.label,
      });
      if (committed === alteration.id) option.classList.add("is-selected");
      body.appendChild(option);
    }
  }

  panel.appendChild(body);
  centerPickerGlyphs(panel);
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

/** `group` names the run of rows the heading opens, for `pickerRevealTarget`. */
function byzGroupTitle(text, group) {
  const el = document.createElement("div");
  el.className = "byz-group-title";
  if (group) el.dataset.group = group;
  el.textContent = text;
  return el;
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

  centerPickerGlyphs(panel);
  restorePickerScroll(panel, scroll);
}

function buildNotesColumn(degree, degreeCount, draft, showTicks) {
  const column = document.createElement("div");
  column.className = "martyria-notes-column";
  column.dataset.scroller = "notes";
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
    column.appendChild(byzGroupTitle(group.title, group.key));
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
  column.dataset.scroller = "genus";
  column.appendChild(byzColumnTitle("Genus"));

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
    const option = makeByzOption({
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
  separator.className = "byz-separator";
  column.appendChild(separator);

  for (const id of otherGenera(draft.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }
  return column;
}

function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(byzSelector("-picker"));
  const wasOpen = panel.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;

  const row = well.closest(".note-row");
  const descriptor = panelWell(panel);
  if (descriptor) {
    descriptor.build(panel, row);
  } else {
    seedPickerDraft(panel, row);
    buildMartyriaPicker(panel, row);
  }
  panel.classList.add("open");
  row.classList.add("picker-open");
  revealPickerSelection(panel);
  keepPickerInView(panel);
}

/**
 * Closes whatever picker is open and throws its draft away. Committing is done
 * by the click that chose a row, before this runs, so every path that reaches
 * here on its own — a click outside, a second click on the well, another picker
 * opening — leaves the scale untouched, and an untouched scale has nothing to
 * redraw.
 */
function closeByzantinePickers() {
  for (const panel of editor.querySelectorAll(byzSelector("-picker.open"))) {
    panel.classList.remove("open");
    clearPickerDraft(panel);
    const row = panel.closest(".note-row");
    if (row) row.classList.remove("picker-open");
  }
}

/**
 * Acts on a click on one picker row.
 *
 * Everything but a martyria letter commits and closes. A letter only moves the
 * draft and rebuilds the panel, because the genus list has to be re-resolved
 * around it — and the drafted genus goes back to None, since a genus chosen for
 * the previous letter is not a choice the user made for this one.
 */
function selectByzantineOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;

  const well = BYZ_SIMPLE_WELLS.find((w) => option.classList.contains(w.kind + "-option"));
  if (well) {
    writeNoteSign(row, well.kind, option.dataset[well.kind]);
    closeAllDropdowns();
    render();
    return;
  }

  const panel = row.querySelector(".martyria-picker");
  if (option.classList.contains("martyria-note-option")) {
    // None is the one letter with no genus to confirm, so it commits itself —
    // otherwise an empty well would be unreachable.
    if (!option.dataset.note) {
      commitMartyria(row, null);
      return;
    }
    writeMartyriaDraft(panel, option.dataset.note, GENUS_NONE, parseInt(option.dataset.ticks, 10) || 0);
    buildMartyriaPicker(panel, row);
    // The list below is a different list now, and its selection is back at the
    // top, so the reader's old place in it is worse than useless.
    const genus = panel.querySelector('[data-scroller="genus"]');
    if (genus) genus.scrollTop = 0;
    return;
  }

  if (option.classList.contains("martyria-genus-option")) {
    const draft = readMartyriaDraft(panel);
    if (!draft) return;
    commitMartyria(row, { note: draft.note, genus: option.dataset.genus, ticks: draft.ticks });
  }
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

/**
 * Routes a click inside the editor. Returns true when it handled the event, so
 * app.js's listener can stop.
 */
function handleByzantineClick(e) {
  const well = e.target.closest(byzSelector("-well"));
  if (well) {
    e.stopPropagation();
    toggleWellPicker(well);
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
  if (e.target.closest(byzSelector("-picker"))) {
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
