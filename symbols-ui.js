// Symbol wells and pickers: the editor UI both notations share.
//
// This file declares functions only. It loads before byzantine-ui.js and
// app.js, so it must not read their top-level constants (editor, ctx, the
// picker builders) at load time — only from inside a function body, which runs
// after every script has loaded.

// ---------------------------------------------------------------------------
// The wells.
//
// Every well but the martyria holds a single sign chosen from one flat
// vocabulary, and they differ only in four things: the notation they belong to,
// the label they wear, the face they are drawn in, and the resolver that turns
// an id into a glyph (the data-* attribute they read and write is their kind).
// Everything else — opening, committing, dismissing, the class names — is
// shared, so the differences are *described* here rather than branched on in a
// dozen places. A new sign family is a row in this table.
//
// The class names are derived from `kind`, not listed: a well of kind `k` is
// `.k-well` inside `.k-well-wrapper`, its panel is `.k-picker` with a
// `.k-picker-body`, and its rows are `.k-option` carrying `data-k`. The
// martyria is not in the table — it takes two clicks across two columns and
// propagates a ladder when it commits, so it genuinely is a different thing —
// but it is a well, so MARTYRIA_WELL, SYMBOL_WELL_KINDS and wellSelector
// include it.
//
// Table order is the order the wells appear on a note row, left to right, and
// it is also the order the chart draws a degree's gutter run (app.js's
// signRunOf reads this table). Reorder one and you reorder the other, which is
// the point.
//
// `build:` is a wrapper rather than the builder itself, so the name is resolved
// when a well is clicked and not when the table is built: two of the three
// builders live in byzantine-ui.js, which loads *after* this file.
const SYMBOL_WELLS = freezeTable([
  {
    kind: "accidental",
    notation: "generic",
    title: "Accidental",
    font: smuflFont(),
    build: function (panel, row) {
      buildAccidentalPicker(panel, row);
    },
    resolve: resolveAccidentalGlyphs,
  },
  {
    kind: "alteration",
    notation: "byzantine",
    title: "Sign of alteration",
    font: byzantineFont(),
    build: function (panel, row) {
      buildAlterationPicker(panel, row);
    },
    resolve: resolveAlterationGlyph,
  },
  {
    kind: "fthora",
    notation: "byzantine",
    title: "Fthora",
    font: byzantineFont(),
    build: function (panel, row) {
      buildFthoraPicker(panel, row);
    },
    resolve: resolveFthoraGlyph,
  },
]);

// ---------------------------------------------------------------------------
// Where a picker was left.
//
// A well remembers nothing — the row's data-* attribute is the whole model —
// but the *reader* is somewhere in a long list, and an empty well would send
// them back to the top of it. The last sign committed to a well of each kind
// is kept here so a picker that has no committed entry of its own can still
// open where the reader last was. It is view state, not scale data: nothing
// reads it but `pickerRevealTarget`, and a reload starts it empty.
// ---------------------------------------------------------------------------

const LAST_PICKED_SIGN = {};

/** Records a user's pick. Clearing a well is not a place to come back to. */
function rememberPickedSign(kind, id) {
  if (id) LAST_PICKED_SIGN[kind] = id;
}

function lastPickedSign(kind) {
  return LAST_PICKED_SIGN[kind] || "";
}

/**
 * None, then the whole SMuFL catalogue under 28 headings, with no rule.
 *
 * It lives here rather than in a notation's own file because it is not
 * Byzantine, and it is three lines because the grouped builder does the work:
 * a category is a group, an entry is an option, and the search comes free.
 *
 * 501 options are built and ink-measured on open — a thousand measureText calls
 * on Blink and Gecko, milliseconds; on WebKit inkBox falls back to
 * rasterise-and-scan, and 501 scans on first open may be visible. The results
 * are cached by face and text, so only the first open pays. If it is slow
 * enough to notice, render the category sections lazily as they scroll into
 * view — nothing about the data model or the search changes if it comes to that.
 */
function buildAccidentalPicker(panel, row) {
  buildGroupedPicker(panel, {
    kind: "accidental",
    committed: row.dataset.accidental || "",
    // 501 entries is far too many to scroll from the top every time; a reader
    // adding accidentals to a scale works out of one category. The alteration
    // and fthora pickers ask for none — their lists are short enough that the
    // top of them is never far away.
    recent: lastPickedSign("accidental"),
    font: panelWell(panel).font,
    separatorAfter: null,
    groups: SMUFL_ACCIDENTAL_CATEGORIES.map((category) => ({
      id: category.id,
      title: category.title,
      options: category.accidentals.map((accidental) => ({
        id: accidental.id,
        glyph: resolveAccidentalGlyphs(accidental.id),
        label: accidental.label,
      })),
    })),
  });
}

// Not a row of the table above (it has no single vocabulary and no single
// click), but it is a well and it has a place in the row's order.
const MARTYRIA_WELL = Object.freeze({
  kind: "martyria",
  notation: "byzantine",
  title: "Martyria",
  font: byzantineFont(),
});

const SYMBOL_WELL_KINDS = Object.freeze(
  SYMBOL_WELLS.map((well) => well.kind).concat(MARTYRIA_WELL.kind)
);

/** `.fthora-well, .martyria-well` and friends — one clause per well kind. */
function wellSelector(suffix) {
  return SYMBOL_WELL_KINDS.map((kind) => "." + kind + suffix).join(", ");
}

/** The descriptor for a panel's well, or null when the panel is a martyria's. */
function panelWell(panel) {
  return SYMBOL_WELLS.find((well) => panel.classList.contains(well.kind + "-picker")) || null;
}

function wellWrapperHTML(kind, title) {
  return (
    '<div class="' + kind + '-well-wrapper">' +
      '<button type="button" class="' + kind + '-well is-empty" title="' + title + '"></button>' +
      '<div class="' + kind + '-picker"></div>' +
    "</div>"
  );
}

/** Every well of one notation, in row order; the martyria closes Byzantine's. */
function makeSymbolWellsHTML(notation) {
  return SYMBOL_WELLS.concat(MARTYRIA_WELL)
    .filter((well) => well.notation === notation)
    .map((well) => wellWrapperHTML(well.kind, well.title))
    .join("");
}

// ---------------------------------------------------------------------------
// Search.
//
// Pure functions, so the matching rule is testable without a picker: the query
// is lowercased, diacritic-folded and split on whitespace, and *every* word
// must be found as a substring, in any order — so "quarter flat" narrows where
// "quarter" alone does not. Folding both sides means `raileanu` reaches
// "Răileanu", `kucuk` reaches "Küçük" and `-1/4` reaches "−1/4", which is the
// point: nobody types a breve to find a flat, or a minus sign to find a comma.
// ---------------------------------------------------------------------------

function normalizeForSearch(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // The Răileanu and mixed-Sagittal labels are written with U+2212 MINUS
    // SIGN, and no keyboard has one. Folding the dashes on both sides is the
    // same move as folding the diacritics: what the reader can type must reach
    // what the catalogue is printed with.
    // U+2010…U+2015 are the hyphens and dashes, U+2212 the minus sign.
    .replace(/[\u2010-\u2015\u2212]/g, "-");
}

function searchWords(query) {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

function matchesQuery(text, words) {
  const haystack = normalizeForSearch(text);
  // `words` is normally already folded by `searchWords`, but this function is
  // tested directly, so it folds a word again rather than trust the caller —
  // folding an already-folded word is a no-op.
  return words.every((word) => haystack.includes(normalizeForSearch(word)));
}

// ---------------------------------------------------------------------------
// The grouped list.
//
// One builder for every single-value picker. Its spec is data:
//
//   { kind, committed, recent, font, groups, separatorAfter }
//   groups: [{ id, title, options: [{ id, glyph, label, mutedGlyph, selected }] }]
//
// `title` may be empty, and then no heading is drawn — the fthora's compatible
// and other runs are separated by a rule, not by headings. Headings carry no
// `data-group`, so `pickerRevealTarget` finds no fallback and a list opens on
// its committed row, or at the top on None.
//
// Filtering toggles `hidden` rather than rebuilding: the accidental picker is
// 501 options and every glyph in it is ink-measured once, on open. That is also
// why the search field sits *outside* the scroller — it stays put while the
// list moves under it, with no sticky positioning to get wrong.
// ---------------------------------------------------------------------------

function buildGroupedPicker(panel, spec) {
  panel.innerHTML = "";

  const search = document.createElement("input");
  search.type = "text";
  search.className = "sym-search";
  search.placeholder = "Search";
  // The editor listens for `input` on itself and redraws the chart. Typing here
  // changes no scale, so the event stops at the field.
  search.addEventListener("input", function (e) {
    e.stopPropagation();
    filterGroupedPicker(panel, search.value);
  });
  panel.appendChild(search);

  const body = document.createElement("div");
  body.className = spec.kind + "-picker-body";
  body.dataset.scroller = spec.kind;

  // None first, outside every group, so no filter can hide it: it is the only
  // way to clear a well.
  body.appendChild(
    makeSymbolOption({
      className: spec.kind + "-option",
      data: makeWellData(spec.kind, ""),
      glyph: "",
      label: "None",
    })
  );

  for (const group of spec.groups) {
    if (group.title) {
      const heading = symbolGroupTitle(group.title);
      heading.dataset.groupOf = group.id;
      body.appendChild(heading);
    }
    for (const option of group.options) {
      const element = makeSymbolOption({
        className: spec.kind + "-option",
        data: makeWellData(spec.kind, option.id),
        glyph: option.glyph,
        mutedGlyph: option.mutedGlyph,
        label: option.label,
      });
      element.dataset.groupOf = group.id;
      if (spec.committed === option.id) element.classList.add("is-selected");
      // Only ever on a panel with nothing committed, so the two classes never
      // land on the same list: `is-selected` says what the well holds,
      // `is-recent` only says where to open.
      else if (!spec.committed && spec.recent === option.id) element.classList.add("is-recent");
      body.appendChild(element);
    }
    if (spec.separatorAfter === group.id) {
      const separator = document.createElement("div");
      separator.className = "sym-separator";
      separator.dataset.separatorAfter = group.id;
      body.appendChild(separator);
    }
  }

  const empty = document.createElement("div");
  empty.className = "sym-empty";
  empty.textContent = "No matches";
  empty.hidden = true;
  body.appendChild(empty);

  panel.appendChild(body);
  centerPickerGlyphs(panel, spec.font);
}

/** `{ alteration: id }` — a well's data-* key is its kind. */
function makeWellData(kind, id) {
  const data = {};
  data[kind] = id;
  return data;
}

/**
 * Narrows a built list to `query`, by hiding rather than rebuilding.
 *
 * A category matches when every word is found in its title; the whole
 * category then shows, heading and all. Otherwise an option matches on its
 * own label, and its heading appears because at least one option under it
 * survived. A rule only separates two things, so it goes when either side of
 * it empties.
 *
 * A committed entry can open the panel scrolled deep into a 501-entry list; a
 * query that actually narrows the results must not leave the reader at that
 * old offset in a much shorter one, so a filter that changes the list snaps
 * every scroller back to the top. Two keystrokes do not: one that leaves the
 * same options standing — a trailing space, a word the matcher folds away —
 * because the reader has since found their place in them, and clearing the
 * query back to empty, which puts the untouched catalogue back rather than
 * narrowing anything.
 */
function filterGroupedPicker(panel, query) {
  const words = searchWords(query);
  const body = panel.querySelector("[data-scroller]");
  if (!body) return;


  // One walk of the list in document order. A heading precedes its own options,
  // so the group it opens is settled when the next heading, the next group's
  // options, a rule or the end of the list closes it — which is also what makes
  // the titles readable off the headings themselves rather than out of a copy
  // serialised onto the panel.
  let heading = null;
  let groupId = null;
  let wholeGroup = false;
  let anyInGroup = false;
  let groupsSurviving = 0;
  let optionsSurviving = 0;
  const separators = [];
  let empty = null;

  function closeGroup() {
    if (heading) heading.hidden = !anyInGroup;
    if (anyInGroup) groupsSurviving++;
    heading = null;
    groupId = null;
    wholeGroup = false;
    anyInGroup = false;
  }

  for (const el of body.children) {
    if (el.classList.contains("sym-group-title")) {
      closeGroup();
      heading = el;
      groupId = el.dataset.groupOf;
      wholeGroup = matchesQuery(el.textContent, words);
    } else if (el.classList.contains("sym-separator")) {
      // A rule only separates two things. What is above it is settled; what is
      // below it is not, so it is decided once the walk is done.
      closeGroup();
      separators.push({ element: el, above: groupsSurviving });
    } else if (el.classList.contains("sym-empty")) {
      empty = el;
    } else {
      const of = el.dataset.groupOf;
      // None sits outside every group, so no filter can hide it: it is the only
      // way to clear a well.
      if (of === undefined) {
        el.hidden = false;
        continue;
      }
      // An untitled group — the fthora's compatible and other runs — has no
      // heading to open it, so its first option does.
      if (of !== groupId) closeGroup();
      groupId = of;
      const label = el.querySelector(".sym-label");
      const show = wholeGroup || matchesQuery(label ? label.textContent : "", words);
      el.hidden = !show;
      if (show) {
        anyInGroup = true;
        optionsSurviving++;
      }
    }
  }
  closeGroup();

  for (const separator of separators) {
    separator.element.hidden = !(separator.above > 0 && groupsSurviving > separator.above);
  }

  if (empty) empty.hidden = groupsSurviving > 0;

  // Snap back to the top only when the list under the reader actually changed.
  // A keystroke that survives the same options — a trailing space, a word the
  // matcher folds away — must leave them where they were reading; clearing the
  // query back to empty is not a narrowing filter either, and keeps its place
  // by the same rule the doc comment gives.
  const previous = panel.dataset.visibleOptions;
  if (words.length > 0 && String(optionsSurviving) !== previous) {
    for (const el of panel.querySelectorAll("[data-scroller]")) {
      el.scrollTop = 0;
    }
  }
  panel.dataset.visibleOptions = String(optionsSurviving);
}

// ---------------------------------------------------------------------------
// Symbol state.
//
// The DOM is this app's data model, so a note row carries its own symbols as
// data-* attributes. Row add/remove bookkeeping then comes for free.
// ---------------------------------------------------------------------------

const NOTE_SYMBOL_ATTRS = SYMBOL_WELLS.map((well) => well.kind).concat([
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
  for (const well of SYMBOL_WELLS) symbols[well.kind] = row.dataset[well.kind] || "";
  return symbols;
}

/** Sets one simple well's data-* attribute. No repaint — see writeNoteSign. */
function setNoteSignData(row, kind, id) {
  if (id) row.dataset[kind] = id;
  else delete row.dataset[kind];
}

/**
 * Sets the martyria's three data-* attributes. No repaint, and no note clears
 * all three: never leave an empty attribute behind for readNoteSymbols to step
 * over. This file owns the martyria's attribute vocabulary because
 * readNoteSymbols above reads it; byzantine-ui.js's writers wrap this.
 */
function setMartyriaData(row, noteId, genusId, ticks) {
  if (!noteId) {
    delete row.dataset.martyriaNote;
    delete row.dataset.martyriaGenus;
    delete row.dataset.martyriaTicks;
    return;
  }
  row.dataset.martyriaNote = noteId;
  row.dataset.martyriaGenus = genusId || GENUS_NONE;
  row.dataset.martyriaTicks = String(ticks || 0);
}

/** Commits one simple well's sign to its row. `id` empty clears the well. */
function writeNoteSign(row, kind, id) {
  setNoteSignData(row, kind, id);
  refreshNoteRowWells(row);
}

/**
 * readNoteSymbols' inverse: commits a row's whole symbol set in one pass.
 *
 * The single-sign writers each end in refreshNoteRowWells(), which repaints
 * *every* well on the row — it is not told which attribute changed. That is the
 * right trade for a picker, where one gesture changes one sign. Setting a whole
 * row through them instead costs one full pass per sign, all but the last
 * immediately overwritten, and each pass re-measures every non-empty well's
 * glyph on canvas to place its ink. Open sets four at once, so it takes this
 * door: same attributes, same final paint, one pass.
 */
function writeNoteSymbols(row, symbols) {
  for (const well of SYMBOL_WELLS) setNoteSignData(row, well.kind, symbols[well.kind] || "");
  const martyria = symbols.martyria;
  setMartyriaData(row, martyria ? martyria.note : "", martyria && martyria.genus, martyria && martyria.ticks);
  refreshNoteRowWells(row);
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
function setGlyphBoxText(box, text, placement, mutedText, font) {
  box.textContent = "";
  if (!text) return;

  const spec = font || byzantineFont(BYZ_FONT_SIZE);
  const ctx = wellMeasuringContext();
  // What the box shows is not always what the caller named: a sign that carries
  // no advance of its own rides into the DOM on a carrier, or WebKit paints
  // nothing. Both layers take the same one, so the letter still lands exactly
  // on its own copy, and the offset below is measured from what is really
  // there rather than from the bare sign.
  const domText = domGlyphText(ctx, text, spec);
  const carrier = domText.slice(0, domText.length - text.length);

  const ink = document.createElement("span");
  ink.className = "glyph-ink";
  if (mutedText) {
    ink.appendChild(glyphLayer(domText));
    ink.appendChild(glyphLayer(carrier + mutedText, "glyph-muted"));
  } else {
    ink.textContent = domText;
  }

  const shared = placement === "martyria" ? martyriaInkRange(ctx, spec) : null;
  const shift = inkCenteringShiftEm(ctx, domText, shared ? "center" : placement, shared, spec);
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

function fillWell(well, text, placement, font) {
  setGlyphBoxText(well, text, placement, undefined, font);
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
function centerPickerGlyphs(panel, font) {
  for (const box of panel.querySelectorAll(".sym-glyph")) {
    setGlyphBoxText(box, box.dataset.glyph || "", glyphBoxPlacement(box), box.dataset.mutedGlyph, font);
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

  for (const well of SYMBOL_WELLS) {
    const el = row.querySelector("." + well.kind + "-well");
    if (el) fillWell(el, symbols[well.kind] ? well.resolve(symbols[well.kind]) : "", undefined, well.font);
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
      "martyria",
      MARTYRIA_WELL.font
    );
  }
}

/**
 * Re-measures every well. Called once the symbol faces resolve: a well filled
 * before then was measured against fallback metrics, and the offset it stored
 * is wrong for the glyph now on screen.
 *
 * Goes through `editor` rather than a fresh `document.querySelectorAll`, the
 * way `closeSymbolPickers` already does: `editor` is a stable reference
 * captured at load time, so this still finds the rows if it runs after the
 * document itself has gone — the settle side of a font promise can fire long
 * after the page that asked for it has been torn down.
 */
function refreshAllNoteRowWells() {
  for (const row of editor.querySelectorAll(".note-row")) refreshNoteRowWells(row);
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

/**
 * One clickable row of a picker: a glyph preview and a label.
 *
 * `spec.mutedGlyph`, when given, is drawn over `spec.glyph` in grey — see
 * `setGlyphBoxText`. Both are left on the box as data-* for `centerPickerGlyphs`
 * to place once the row is in its panel and its placement can be read off it.
 */
function makeSymbolOption(spec) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sym-option " + spec.className;
  for (const key of Object.keys(spec.data)) button.dataset[key] = spec.data[key];
  if (spec.disabled) button.disabled = true;

  const glyph = document.createElement("span");
  glyph.className = "sym-glyph";
  glyph.dataset.glyph = spec.glyph;
  if (spec.mutedGlyph) glyph.dataset.mutedGlyph = spec.mutedGlyph;

  const label = document.createElement("span");
  label.className = "sym-label";
  label.textContent = spec.label;

  button.appendChild(glyph);
  button.appendChild(label);
  return button;
}

function symbolColumnTitle(text) {
  const el = document.createElement("div");
  el.className = "sym-column-title";
  el.textContent = text;
  return el;
}

/** `group` names the run of rows the heading opens, for `pickerRevealTarget`. */
function symbolGroupTitle(text, group) {
  const el = document.createElement("div");
  el.className = "sym-group-title";
  if (group) el.dataset.group = group;
  el.textContent = text;
  return el;
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
 * twenty-one otherwise hides the very letter the row holds. Failing that, the
 * entry the same kind of well was last given (`is-recent`, only ever set on a
 * panel with nothing committed), which is what keeps a reader adding
 * accidentals inside one category of 501 entries. Failing both, the notes list
 * falls back to its middle octave: that is the register a scale is written in
 * unless it says otherwise, and it is a far better place to start reading than
 * "None" at the top. A list with none of the three — a fthora picker on an
 * empty well — stays put, and None at its top is already the right answer.
 */
function pickerRevealTarget(scroller) {
  const selected = scroller.querySelector(".is-selected");
  if (selected) return { element: selected, align: "center" };
  const recent = scroller.querySelector(".is-recent");
  if (recent) return { element: recent, align: "center" };
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
    const title = target.align === "start" ? el.querySelector(".sym-column-title") : null;
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

function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(wellSelector("-picker"));
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
  // Last, so bringing the field into focus cannot fight the scroll that just
  // put the committed row in view.
  const search = panel.querySelector(".sym-search");
  if (search) search.focus();
}

/**
 * Closes whatever picker is open and throws its draft away. Committing is done
 * by the click that chose a row, before this runs, so every path that reaches
 * here on its own — a click outside, a second click on the well, another picker
 * opening — leaves the scale untouched, and an untouched scale has nothing to
 * redraw.
 */
function closeSymbolPickers() {
  for (const panel of editor.querySelectorAll(wellSelector("-picker.open"))) {
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
function selectSymbolOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;

  const well = SYMBOL_WELLS.find((w) => option.classList.contains(w.kind + "-option"));
  if (well) {
    writeNoteSign(row, well.kind, option.dataset[well.kind]);
    // Here rather than in `writeNoteSign`, which the martyria ladder also
    // calls: what a ladder propagates is not a place the reader chose.
    rememberPickedSign(well.kind, option.dataset[well.kind]);
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

/**
 * Routes a click inside the editor. Returns true when it handled the event, so
 * app.js's listener can stop.
 */
function handleSymbolClick(e) {
  const well = e.target.closest(wellSelector("-well"));
  if (well) {
    e.stopPropagation();
    toggleWellPicker(well);
    return true;
  }

  const option = e.target.closest(".sym-option");
  if (option) {
    e.stopPropagation();
    if (!option.disabled) selectSymbolOption(option);
    return true;
  }

  // A click on the panel's own chrome must not reach the document listener,
  // which would close it.
  if (e.target.closest(wellSelector("-picker"))) {
    e.stopPropagation();
    return true;
  }
  return false;
}
