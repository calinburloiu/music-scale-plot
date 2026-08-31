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
// a glyph. Everything else — the draft, the footer, Apply/Cancel, scroll
// restoration, the class names — is shared, so the differences are *described*
// here rather than branched on in a dozen places. A new sign family is a row in
// this table.
//
// The class names are derived from `kind`, not listed: a well of kind `k` is
// `.k-well` inside `.k-well-wrapper`, its panel is `.k-picker` with a
// `.k-picker-body`, and its rows are `.k-option` carrying `data-k`. The
// martyria is not in the table — it drafts three fields across two columns and
// propagates a ladder on apply, so it genuinely is a different thing — but it
// is a well, so `BYZ_WELL_KINDS` and `byzSelector` include it.
//
// Table order is the order the wells appear on a note row, left to right.
const BYZ_SIMPLE_WELLS = freezeTable([
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

/** Where a simple well's draft lives on its panel: `fthora` → `draftFthora`. */
function byzDraftAttr(kind) {
  return "draft" + kind.charAt(0).toUpperCase() + kind.slice(1);
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
 *   "top"      pinned against an edge of the box. What the genus list needs:
 *   "bottom"     a mark shown without its letter has to say which way it faces.
 *   "martyria" the shared martyria baseline, so a letter lands where the face
 *              draws it and a mark cannot drag it off that spot.
 *
 * The offset comes back in em, so it is right for the 22px well and the 24px
 * picker row alike and does not depend on the box being in the document — a box
 * filled during a rebuild has no computed size to measure against.
 */
function setGlyphBoxText(box, text, placement) {
  box.textContent = "";
  if (!text) return;

  const ink = document.createElement("span");
  ink.className = "glyph-ink";
  ink.textContent = text;

  const ctx = wellMeasuringContext();
  const shared =
    placement === "martyria" ? martyriaInkRange(ctx, byzantineFont(BYZ_FONT_SIZE)) : null;
  const shift = inkCenteringShiftEm(ctx, text, shared ? "center" : placement, shared);
  ink.style.setProperty("--ink-dx", shift.dx.toFixed(4) + "em");
  ink.style.setProperty("--ink-dy", shift.dy.toFixed(4) + "em");

  box.appendChild(ink);
}

function fillWell(well, text, placement) {
  setGlyphBoxText(well, text, placement);
  well.classList.toggle("is-empty", !text);
}

/**
 * Boxes and places every sign in a freshly built panel.
 *
 * Re-reading `textContent` picks the glyph back up whether the box still holds
 * a bare text node or an already-wrapped one, which keeps a rebuild idempotent.
 */
function centerPickerGlyphs(panel) {
  for (const box of panel.querySelectorAll(".byz-glyph, .byz-preview")) {
    setGlyphBoxText(box, box.textContent, glyphBoxPlacement(box));
  }
}

/**
 * Where a box should seat its sign.
 *
 * The genus list pins: a mark shown on its own has lost the letter that would
 * say which way it faces, so the box says it instead — a mark that stacks above
 * the letter rides the top of its box, one that stacks below sits at the
 * bottom.
 *
 * Anything showing a whole martyria — a note row, the footer preview, the well
 * itself — takes the shared martyria baseline, so all three agree and none of
 * them normalises the register away. A fthora has no family to sit in, so it is
 * centred on its own ink.
 */
function glyphBoxPlacement(box) {
  const column = box.closest(".martyria-genus-column");
  if (column) return column.classList.contains("genus-above") ? "top" : "bottom";
  if (box.closest(".martyria-notes-column") || box.classList.contains("byz-preview")) {
    return "martyria";
  }
  return "center";
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
const PICKER_DRAFT_ATTRS = BYZ_SIMPLE_WELLS.map((well) => byzDraftAttr(well.kind)).concat([
  "draftNote",
  "draftGenus",
  "draftTicks",
]);

function clearPickerDraft(panel) {
  for (const key of PICKER_DRAFT_ATTRS) delete panel.dataset[key];
}

/** Starts a panel's draft from the symbols its row currently holds. */
function seedPickerDraft(panel, row) {
  clearPickerDraft(panel);
  const symbols = readNoteSymbols(row);
  const well = panelWell(panel);
  if (well) panel.dataset[byzDraftAttr(well.kind)] = symbols[well.kind];
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
  const well = panelWell(panel);
  if (well) {
    return (panel.dataset[byzDraftAttr(well.kind)] || "") !== symbols[well.kind];
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
 * start reading than "None" at the top. The fthora list has no octaves and
 * offers None as its first row, so it has nothing to fall back to and stays put.
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
 * near the bottom of a long editor can still push Apply past the viewport.
 * Guarded: jsdom implements no scrollIntoView.
 */
function keepPickerInView(panel) {
  if (typeof panel.scrollIntoView !== "function") return;
  const box = panel.getBoundingClientRect();
  const viewport = window.innerHeight || document.documentElement.clientHeight || 0;
  if (box.bottom > viewport) panel.scrollIntoView({ block: "nearest" });
}

function buildFthoraPicker(panel, row) {
  const draft = panel.dataset.draftFthora || "";
  const scroll = readPickerScroll(panel);
  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "fthora-picker-body";
  body.dataset.scroller = "fthora";
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
  centerPickerGlyphs(panel);
  restorePickerScroll(panel, scroll);
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

  // The well still shows the committed martyria, so the footer is the only
  // place the draft is visible whole — and the only place its octave tick is.
  panel.appendChild(
    buildPickerFooter(panel, row, draft ? resolveMartyriaGlyphs(draft.note, draft.genus, draft.ticks) : "")
  );
  centerPickerGlyphs(panel);
  restorePickerScroll(panel, scroll);
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

  // Which side the marks in this list will stack on. The rows are then laid
  // out around the note letter rather than around each composition's own ink,
  // so the letter holds still and the mark's side reads at a glance.
  column.classList.add("genus-" + martyriaMarkSide(draft.note));

  // A row's subject is the mark, so a row shows the mark alone. Letter and mark
  // meet once, in the footer preview, which is also the only place the octave
  // tick appears — the tick marks a register, not a genus.
  function genusOption(id, label) {
    const option = makeByzOption({
      className: "martyria-genus-option",
      data: { genus: id },
      glyph: resolveGenusGlyph(draft.note, id),
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
  seedPickerDraft(panel, row);
  const descriptor = panelWell(panel);
  if (descriptor) descriptor.build(panel, row);
  else buildMartyriaPicker(panel, row);
  panel.classList.add("open");
  row.classList.add("picker-open");
  revealPickerSelection(panel);
  keepPickerInView(panel);
}

/**
 * Closes whatever picker is open and throws its draft away. Apply is the only
 * gesture that commits, so every path through here — Cancel, a click outside,
 * a second click on the well, another picker opening — leaves the scale
 * untouched, and an untouched scale has nothing to redraw.
 */
function closeByzantinePickers() {
  for (const panel of editor.querySelectorAll(byzSelector("-picker.open"))) {
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

  const well = BYZ_SIMPLE_WELLS.find((w) => option.classList.contains(w.kind + "-option"));
  if (well) {
    const panel = row.querySelector("." + well.kind + "-picker");
    panel.dataset[byzDraftAttr(well.kind)] = option.dataset[well.kind];
    well.build(panel, row);
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

  const well = panelWell(panel);
  if (well) {
    writeNoteSign(row, well.kind, panel.dataset[byzDraftAttr(well.kind)] || "");
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
  const well = e.target.closest(byzSelector("-well"));
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
      applyPickerDraft(apply.closest(byzSelector("-picker")));
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
