// Byzantine (psaltic) symbol model.
//
// Nothing in this file's tables names a codepoint, an octave block or an
// above/below variant. All SBMuFL knowledge lives in the resolvers further
// down. A different font encoding is a second set of these resolvers and
// touches nothing else. See docs/BYZANTINE-SYMBOLS.md.

const BYZ_OCTAVES = ["low", "mid", "high"];

const BYZ_LETTERS = [
  { key: "Zo", greek: "Ζω", latin: "Zo" },
  { key: "Ni", greek: "Νη", latin: "Ni" },
  { key: "Pa", greek: "Πα", latin: "Pa" },
  { key: "Vou", greek: "Βου", latin: "Vou" },
  { key: "Ga", greek: "Γα", latin: "Ga" },
  { key: "Di", greek: "Δι", latin: "Di" },
  { key: "Ke", greek: "Κε", latin: "Ke" },
];

// Freezes a vocabulary table: every row, then the array itself. Every table
// in this file (BYZ_NOTES, and the BYZ_GENERA / BYZ_FTHORES / BYZ_ALTERATIONS
// vocabularies that follow it) is immutable data — a shared reference no caller should be
// able to mutate out from under the others.
function freezeTable(rows) {
  rows.forEach((row) => Object.freeze(row));
  return Object.freeze(rows);
}

// 21 note letters, ascending in pitch. The array index is the note's ladder
// position (see ladderPosition) and coincides with SBMuFL codepoint order.
const BYZ_NOTES = freezeTable(
  BYZ_OCTAVES.flatMap((octave) =>
    BYZ_LETTERS.map((letter, letterIndex) => ({
      id: octave + letter.key,
      octave: octave,
      letterIndex: letterIndex,
      greek: letter.greek,
      latin: letter.latin,
    }))
  )
);

function byzNoteById(id) {
  return BYZ_NOTES.find((note) => note.id === id) || null;
}

// The sentinel for "no genus": the letter is drawn alone. This is the default.
const GENUS_NONE = "none";

// Twelve genus (ichos) signs, in SBMuFL block order — which is also the
// picker's fallback order. `index` is the offset within the block; the
// resolver adds it to the register's base codepoint.
const BYZ_GENERA = freezeTable([
  { id: "zo", index: 0, label: "Ζω (diatonic)" },
  { id: "delta", index: 1, label: "Δ tetartos" },
  { id: "alpha", index: 2, label: "Α protos" },
  { id: "legetos", index: 3, label: "Legetos" },
  { id: "nana", index: 4, label: "Nana (tritos)" },
  { id: "deltaDotted", index: 5, label: "Δ dotted" },
  { id: "alphaDotted", index: 6, label: "Α dotted" },
  { id: "hardChromaticPa", index: 7, label: "Hard chromatic Πα" },
  { id: "hardChromaticDi", index: 8, label: "Hard chromatic Δι" },
  { id: "softChromaticDi", index: 9, label: "Soft chromatic Δι" },
  { id: "softChromaticKe", index: 10, label: "Soft chromatic Κε" },
  { id: "zygos", index: 11, label: "Zygos" },
]);

// Sixteen fthores: the standalone block, which has a normal advance. The
// zero-advance Above/Secondary/Tertiary/Below variants are meant to ride a
// neume and are not used here.
//
// The diatonic and chromatic fthores are named for the degree they sit on, so
// the psaltic name is enough. Enharmonic and the three chroes are not: they
// name a flavour, and a reader coming from Ottoman makam is likelier to know
// them as Acem, Muştar, Nişabur and Hisar — so those four labels carry both.
const BYZ_FTHORES = freezeTable([
  { id: "diatonicNiLow", index: 0, label: "Diatonic Νη (low)" },
  { id: "diatonicPa", index: 1, label: "Diatonic Πα" },
  { id: "diatonicVou", index: 2, label: "Diatonic Βου" },
  { id: "diatonicGa", index: 3, label: "Diatonic Γα" },
  { id: "diatonicDi", index: 4, label: "Diatonic Δι" },
  { id: "diatonicKe", index: 5, label: "Diatonic Κε" },
  { id: "diatonicZo", index: 6, label: "Diatonic Ζω" },
  { id: "diatonicNiHigh", index: 7, label: "Diatonic Νη (high)" },
  { id: "hardChromaticPa", index: 8, label: "Hard chromatic Πα" },
  { id: "hardChromaticDi", index: 9, label: "Hard chromatic Δι" },
  { id: "softChromaticDi", index: 10, label: "Soft chromatic Δι" },
  { id: "softChromaticKe", index: 11, label: "Soft chromatic Κε" },
  { id: "enharmonic", index: 12, label: "Enharmonic (Acem)" },
  { id: "chroaZygos", index: 13, label: "Zygos (Muştar)" },
  { id: "chroaKliton", index: 14, label: "Kliton (Nişabur)" },
  { id: "chroaSpathi", index: 15, label: "Spathi (Hisar)" },
]);

// Ten signs of alteration: the four numbered diesis (sharp) and four numbered
// yfesis (flat) signs, plus the two *geniki* — the general sharp and flat that
// name no size. Two families of five, each in its own SBMuFL block, so a row
// names a family and an offset and the resolver picks the base: the same
// discipline BYZ_GENERA follows, and the reason no codepoint appears here.
//
// The numbered signs move a note by that many moria, which is what their labels
// say. The app does not act on it — an alteration is an annotation the chart
// draws, exactly as a fthora is, and the pitch model is untouched.
const BYZ_ALTERATIONS = freezeTable([
  { id: "diesis2", family: "diesis", index: 0, label: "Diesis 2 (+2 moria)" },
  { id: "diesis4", family: "diesis", index: 1, label: "Diesis 4 (+4 moria)" },
  { id: "diesis6", family: "diesis", index: 2, label: "Diesis 6 (+6 moria)" },
  { id: "diesis8", family: "diesis", index: 3, label: "Diesis 8 (+8 moria)" },
  { id: "diesisGeniki", family: "diesis", index: 4, label: "General sharp (diesis geniki)" },
  { id: "yfesis2", family: "yfesis", index: 0, label: "Yfesis 2 (−2 moria)" },
  { id: "yfesis4", family: "yfesis", index: 1, label: "Yfesis 4 (−4 moria)" },
  { id: "yfesis6", family: "yfesis", index: 2, label: "Yfesis 6 (−6 moria)" },
  { id: "yfesis8", family: "yfesis", index: 3, label: "Yfesis 8 (−8 moria)" },
  { id: "yfesisGeniki", family: "yfesis", index: 4, label: "General flat (yfesis geniki)" },
]);

// Per note, the genera the modes table pairs with it: de-duplicated, in the
// table's left-to-right column order (Modes I–VIII, varys, then the three
// transcribed makam scales). Derived by hand from
// issues/002-byzantine-symbols/modes-table.html, which is not final — see
// docs/BYZANTINE-SYMBOLS.md for how to redo this when that table changes.
const MARTYRIA_COMPATIBILITY = Object.freeze(
  Object.fromEntries(
    Object.entries({
      lowZo:   ["nana", "softChromaticDi", "hardChromaticDi"],
      lowNi:   ["delta", "softChromaticKe", "hardChromaticPa"],
      lowPa:   ["alpha", "softChromaticDi", "hardChromaticDi"],
      lowVou:  ["legetos", "softChromaticKe", "hardChromaticPa"],
      lowGa:   ["nana", "softChromaticDi", "hardChromaticDi"],
      lowDi:   ["delta", "softChromaticKe", "hardChromaticPa"],
      lowKe:   ["alpha", "softChromaticDi", "hardChromaticDi"],
      midZo:   ["zo", "softChromaticKe", "nana", "hardChromaticPa"],
      midNi:   ["delta", "softChromaticDi", "nana", "hardChromaticDi"],
      midPa:   ["alpha", "softChromaticKe", "delta", "hardChromaticPa"],
      midVou:  ["legetos", "softChromaticDi", "alpha", "hardChromaticDi"],
      midGa:   ["nana", "softChromaticKe", "hardChromaticPa", "legetos"],
      midDi:   ["deltaDotted", "softChromaticDi", "hardChromaticDi", "zygos", "hardChromaticPa"],
      midKe:   ["alphaDotted", "softChromaticKe", "hardChromaticPa"],
      highZo:  ["legetos", "softChromaticDi", "nana", "hardChromaticDi"],
      highNi:  ["nana", "softChromaticKe", "hardChromaticPa"],
      highPa:  ["alpha", "softChromaticDi", "hardChromaticDi"],
      highVou: ["legetos", "softChromaticKe", "hardChromaticPa"],
      highGa:  ["nana", "softChromaticDi", "hardChromaticDi"],
      highDi:  ["deltaDotted", "softChromaticKe", "hardChromaticPa"],
      highKe:  ["alphaDotted", "softChromaticDi", "hardChromaticDi"],
    }).map(([noteId, genera]) => [noteId, Object.freeze(genera)])
  )
);

// Per note, the fthores that belong on it: the diatonic sign of its own letter,
// the chromatic pair its position selects, and whatever enharmonic or chroa
// sign the letter carries. De-duplicated, in BYZ_FTHORES block order, so a row
// stays stable when it gains an entry.
//
// Provenance is *not* MARTYRIA_COMPATIBILITY's. That table was read off the
// modes table; this one is derived from rules — the same parity rule Neanes'
// LayoutService uses for its root signs, checked against Neanes' own Fthora
// Note dropdown. The two therefore agree on the chromatic signs by
// construction, with one deliberate exception noted on midNi below. See
// docs/BYZANTINE-SYMBOLS.md §3.
const FTHORES_COMPATIBILITY = Object.freeze(
  Object.fromEntries(
    Object.entries({
      lowZo:   ["diatonicZo", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      lowNi:   ["diatonicNiLow", "hardChromaticPa", "softChromaticKe"],
      lowPa:   ["diatonicPa", "hardChromaticDi", "softChromaticDi"],
      lowVou:  ["diatonicVou", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      lowGa:   ["diatonicGa", "hardChromaticDi", "softChromaticDi", "enharmonic", "chroaSpathi"],
      lowDi:   ["diatonicDi", "hardChromaticPa", "softChromaticKe", "chroaZygos", "chroaKliton"],
      lowKe:   ["diatonicKe", "hardChromaticDi", "softChromaticDi", "chroaSpathi"],
      midZo:   ["diatonicZo", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      // No hardChromaticDi: parity would admit it, but Neanes' Fthora Note
      // dropdown offers that sign on Ζω′, Δι and Βου only. Deliberate — the
      // martyria table above still lists it for midNi, because the two tables
      // are about different signs. Read the design's §2.3 before "fixing" it.
      midNi:   ["diatonicNiLow", "softChromaticDi"],
      midPa:   ["diatonicPa", "hardChromaticPa", "softChromaticKe"],
      midVou:  ["diatonicVou", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      midGa:   ["diatonicGa", "hardChromaticPa", "softChromaticKe", "enharmonic", "chroaSpathi"],
      midDi:   ["diatonicDi", "hardChromaticDi", "softChromaticDi", "chroaZygos", "chroaKliton"],
      midKe:   ["diatonicKe", "hardChromaticPa", "softChromaticKe", "chroaSpathi"],
      highZo:  ["diatonicZo", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      // The two Νη fthores split strictly by register: getShift spans one
      // octave, so the low sign serves both Νη below it and the high sign the
      // one above. The other is still pickable, one line below the separator.
      highNi:  ["diatonicNiHigh", "hardChromaticPa", "softChromaticKe"],
      highPa:  ["diatonicPa", "hardChromaticDi", "softChromaticDi"],
      highVou: ["diatonicVou", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      highGa:  ["diatonicGa", "hardChromaticDi", "softChromaticDi", "enharmonic", "chroaSpathi"],
      highDi:  ["diatonicDi", "hardChromaticPa", "softChromaticKe", "chroaZygos", "chroaKliton"],
      highKe:  ["diatonicKe", "hardChromaticDi", "softChromaticDi", "chroaSpathi"],
    }).map(([noteId, fthores]) => [noteId, Object.freeze(fthores)])
  )
);

function byzGenusById(id) {
  return BYZ_GENERA.find((genus) => genus.id === id) || null;
}

function byzFthoraById(id) {
  return BYZ_FTHORES.find((fthora) => fthora.id === id) || null;
}

function byzAlterationById(id) {
  return BYZ_ALTERATIONS.find((alteration) => alteration.id === id) || null;
}

/** The genera the modes table pairs with this note, in the table's order. */
function compatibleGenera(noteId) {
  return MARTYRIA_COMPATIBILITY[noteId] || [];
}

/** Every other genus, in BYZ_GENERA order — the uncommon combinations. */
function otherGenera(noteId) {
  const compatible = compatibleGenera(noteId);
  return BYZ_GENERA.filter((genus) => !compatible.includes(genus.id)).map((genus) => genus.id);
}

/** The fthores that belong on this note, in BYZ_FTHORES block order. */
function compatibleFthores(noteId) {
  return FTHORES_COMPATIBILITY[noteId] || [];
}

/** Every other fthora, in BYZ_FTHORES block order — the uncommon choices. */
function otherFthores(noteId) {
  const compatible = compatibleFthores(noteId);
  return BYZ_FTHORES.filter((fthora) => !compatible.includes(fthora.id)).map((fthora) => fthora.id);
}

// ---------------------------------------------------------------------------
// SBMuFL resolvers — the only code that knows a codepoint.
//
// Swapping to a different encoding (the Byzantine Music Unicode block, say) is
// a second set of these functions. Nothing above this line changes.
// ---------------------------------------------------------------------------

const BYZ_NOTE_BASE = 0xe130;        // martyriaNoteZoLow; three contiguous blocks of seven
const BYZ_GENUS_BELOW_BASE = 0xe150; // marks that hang under the letter
const BYZ_GENUS_ABOVE_BASE = 0xe170; // marks that sit over the letter
const BYZ_TICK = 0xe145;             // martyriaTick — a spacing glyph, not a mark
const BYZ_FTHORA_BASE = 0xe1d0;      // fthoraDiatonicNiLow
const BYZ_DIESIS_BASE = 0xe1f0;      // diesis2 … diesisGenikiAbove
const BYZ_YFESIS_BASE = 0xe200;      // yfesis2 … yfesisGenikiAbove

/**
 * The glyph string for one martyria: letter, then genus mark, then ticks.
 *
 * The register decides which mark set is used, because each letter carries
 * only one anchor — martyriaTop for the low register, martyriaBottom for the
 * middle and high ones. Pair a middle letter with an …Above mark and the
 * font's mark-to-base lookup cannot attach it. See MARTYRIA-COMPOSITION.md §5.
 */
function resolveMartyriaGlyphs(noteId, genusId, ticks) {
  const note = byzNoteById(noteId);
  if (!note) return "";

  let out = String.fromCharCode(
    BYZ_NOTE_BASE + BYZ_OCTAVES.indexOf(note.octave) * BYZ_LETTERS.length + note.letterIndex
  );

  const genus = genusId && genusId !== GENUS_NONE ? byzGenusById(genusId) : null;
  if (genus) {
    const base = note.octave === "low" ? BYZ_GENUS_ABOVE_BASE : BYZ_GENUS_BELOW_BASE;
    out += String.fromCharCode(base + genus.index);
  }

  for (let i = 0; i < (ticks || 0); i++) out += String.fromCharCode(BYZ_TICK);
  return out;
}

/**
 * A genus mark on its own, with no letter under it — what a picker row offers,
 * since a row's subject is the mark and not the composition.
 *
 * The register still decides which of the two mark sets it comes from, so this
 * takes the note it would be stacked on rather than a bare side: the glyph a
 * row shows is then, by construction, the glyph the martyria will carry.
 */
function resolveGenusGlyph(noteId, genusId) {
  const note = byzNoteById(noteId);
  const genus = genusId && genusId !== GENUS_NONE ? byzGenusById(genusId) : null;
  if (!note || !genus) return "";
  const base = note.octave === "low" ? BYZ_GENUS_ABOVE_BASE : BYZ_GENUS_BELOW_BASE;
  return String.fromCharCode(base + genus.index);
}

/**
 * Which side of the note letter a genus mark stacks on.
 *
 * The same register rule `resolveMartyriaGlyphs` applies when it chooses a
 * mark set: a low-octave letter carries its mark on the `martyriaTop` anchor,
 * every other letter on `martyriaBottom`. Named here so the UI can lay a
 * picker out around it without restating the rule — and so a second font that
 * anchors differently changes it in one place.
 */
function martyriaMarkSide(noteId) {
  const note = byzNoteById(noteId);
  return note && note.octave === "low" ? "above" : "below";
}

function resolveFthoraGlyph(fthoraId) {
  const fthora = byzFthoraById(fthoraId);
  return fthora ? String.fromCharCode(BYZ_FTHORA_BASE + fthora.index) : "";
}

/**
 * A sign of alteration on its own — a zero-advance mark whose ink clears the
 * baseline outright, like a fthora's, so everything that places it does so from
 * measured ink.
 *
 * Each family has its own block, hence two bases rather than one. The fifth
 * member of each is the *Above* variant of the geniki: the Below variant's ink
 * crosses the baseline, where every other sign of the family sits clear of it,
 * so taking Above keeps the whole family one shape.
 */
function resolveAlterationGlyph(alterationId) {
  const alteration = byzAlterationById(alterationId);
  if (!alteration) return "";
  const base = alteration.family === "yfesis" ? BYZ_YFESIS_BASE : BYZ_DIESIS_BASE;
  return String.fromCharCode(base + alteration.index);
}

// ---------------------------------------------------------------------------
// The note ladder.
//
// Positions 0–20 are the 21 letters. Above high Κε there is no higher SBMuFL
// block, so a trailing martyriaTick marks one extra octave: positions 21–27
// are the high letters again, ticked. Below low Ζω there is no equivalent, so
// the ladder simply stops.
// ---------------------------------------------------------------------------

const LADDER_MAX = 27;

function ladderPosition(noteId, ticks) {
  const index = BYZ_NOTES.findIndex((note) => note.id === noteId);
  if (index < 0) return -1;
  return index + BYZ_LETTERS.length * (ticks || 0);
}

function ladderNoteAt(position) {
  if (!Number.isInteger(position) || position < 0 || position > LADDER_MAX) return null;
  const ticks = position < BYZ_NOTES.length ? 0 : 1;
  const index = position - BYZ_LETTERS.length * ticks;
  return { noteId: BYZ_NOTES[index].id, ticks: ticks };
}

/**
 * True when putting `degree` (1-based, of `degreeCount`) at `position` leaves
 * room on the ladder for every other degree of the scale.
 */
function isLadderPositionLegal(position, degree, degreeCount) {
  if (!Number.isInteger(position) || position < 0 || position > LADDER_MAX) return false;
  if (position < degree - 1) return false;
  return position + (degreeCount - degree) <= LADDER_MAX;
}

/**
 * Slides `position` to the nearest one that is legal for `degree` (1-based, of
 * `degreeCount`).
 *
 * A degree's legal window depends on how long the scale is, and the scale can
 * grow after its martyries are set — the anchor that fitted two degrees need
 * not fit nine. Propagation therefore clamps before it walks, which is what
 * guarantees it never strands a degree off the end of the ladder.
 *
 * A scale longer than the ladder has no legal window at all; it anchors at the
 * bottom, filling as far up as the rungs reach.
 */
function clampLadderPosition(position, degree, degreeCount) {
  const lowest = degree - 1;
  const highest = LADDER_MAX - (degreeCount - degree);
  if (highest < lowest) return lowest;
  return Math.min(Math.max(position, lowest), highest);
}

// ---------------------------------------------------------------------------
// Ink-anchored text.
//
// A martyria's ink sits well above the baseline in Neanes and below it in
// other SBMuFL faces, and a fthora sits around -0.65 … -1.1 em because the
// font expects it over a neume. A constant offset would break on a font swap,
// so both signs are placed from measured ink, on both axes, always.
// ---------------------------------------------------------------------------

const BYZ_FONT_SIZE = 40;

// The family name lives here and nowhere else in the JavaScript: every font
// string the app uses — the chart's, and one of the two faces `loadSymbolFonts`
// preloads — is built by `byzantineFont()` from this constant. CSS cannot read
// it, so `style.css` repeats the name; see docs/BYZANTINE-SYMBOLS.md §6 for the
// full list of what a font swap touches.
const BYZ_FONT_FAMILY = '"Neanes"';

function byzantineFont(size) {
  return (size || BYZ_FONT_SIZE) + "px " + BYZ_FONT_FAMILY + ", serif";
}

/**
 * The ink's extent relative to the pen origin, with y growing downward — so
 * `top` is normally negative. `adv` is the advance width, which for a martyria
 * is narrower than the ink because the genus mark has no advance.
 */
// ---------------------------------------------------------------------------
// Getting a sign into the DOM.
//
// A canvas paints the glyphs it is handed. DOM text is shaped first, and that
// is where the two engines disagree — see `domGlyphText`.

/**
 * The glyph a sign rides on when it goes into the DOM. A no-break space: the
 * face draws nothing for it and gives it 0.007em of advance, and — unlike an
 * ordinary space — no engine trims it off the front of a run.
 */
const BYZ_DOM_GLYPH_CARRIER = " ";

/**
 * `text` as DOM text has to be written to be painted.
 *
 * A canvas paints the glyphs it is handed. DOM text is shaped first, and WebKit
 * paints nothing at all for a run made up of nothing but zero-advance marks —
 * which is every sign of alteration in this face, each one a combining mark the
 * font expects to see attached to a neume. Blink and Gecko paint them, so the
 * signs are in the chart and in the wells everywhere but Safari, where the wells
 * and the pickers come up blank.
 *
 * A carrier in front of the mark gives the run one glyph that advances, and the
 * mark is painted again. Whether one is needed is *measured* — a face whose
 * signs advance on their own needs none — and the carrier is then part of the
 * string that gets measured for centring, so its advance, whatever the face
 * makes of it, is already in the offset.
 */
function domGlyphText(ctx, text, font) {
  if (!text) return text;
  return inkBox(ctx, text, font).adv > 0 ? text : BYZ_DOM_GLYPH_CARRIER + text;
}

// ---------------------------------------------------------------------------
// Finding the ink.
//
// `measureText` is the cheap way to a glyph's ink box, and on Blink and Gecko
// it is the right one. WebKit answers a different question: it reports the ink
// *unioned with the text's advance rect and its baseline*, so a box never
// reaches above the baseline or inside the advance. Every fthora and every sign
// of alteration in this face has ink that clears the baseline entirely, which
// is precisely the case that union destroys — the descent comes back as 0 and
// the sign is placed a third of an em out, in the chart and in the wells alike.
//
// Nothing in `TextMetrics` can recover what the union threw away: the box
// always contains the baseline, whatever anchor it is reported from. So on
// those engines the ink is found where it actually is — in the pixels. The sign
// is drawn on a scratch canvas and the drawn area is scanned for. It costs a
// rasterisation per sign per face, once, which is why the results are kept.
//
// Which engine this is, is *detected*, not sniffed: see `measureTextReportsInk`.

const INK_SCAN_PADDING_EM = 0.5;

let inkScanCanvas = null;
let inkMetricsAreExact = null;
const scannedInkBoxes = new Map();

/**
 * A surface to measure on, sized for one sign.
 *
 * Measurement needs somewhere to draw, and this file has no document of its
 * own — hence `OffscreenCanvas` first, which is nothing but a raster surface.
 * The element is the fallback for engines without it. Null means neither is
 * available, and the caller keeps whatever `measureText` said.
 */
function inkScanContext(width, height) {
  if (!inkScanCanvas) {
    if (typeof OffscreenCanvas === "function") inkScanCanvas = new OffscreenCanvas(width, height);
    else if (typeof document !== "undefined") inkScanCanvas = document.createElement("canvas");
    else return null;
  }
  inkScanCanvas.width = width;
  inkScanCanvas.height = height;
  const ctx = inkScanCanvas.getContext("2d");
  if (!ctx || typeof ctx.getImageData !== "function") return null;
  return ctx;
}

/**
 * Whether this engine's `measureText` reports ink, or ink unioned with the
 * advance rect.
 *
 * Asked of a no-break space, which no face draws anything for: an engine that
 * reports ink reports none, and one that unions hands back the whole advance.
 * A fact about the engine rather than the face, so it is asked once, of a
 * generic family, with no font to wait for.
 */
function measureTextReportsInk() {
  if (inkMetricsAreExact !== null) return inkMetricsAreExact;

  const ctx = inkScanContext(1, 1);
  if (!ctx) {
    inkMetricsAreExact = true;
    return inkMetricsAreExact;
  }
  ctx.font = "100px serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(BYZ_DOM_GLYPH_CARRIER);
  inkMetricsAreExact = !(
    metrics.width > 0 && metrics.actualBoundingBoxRight >= metrics.width
  );
  return inkMetricsAreExact;
}

/**
 * The ink box of `text`, read off the pixels it covers.
 *
 * `reported` is what `measureText` said. It is a *superset* of the ink — the
 * union only ever grows the box — so it bounds where the ink can be, and the
 * scan needs no more surface than that plus a margin against an engine whose
 * union is not exactly the one described above.
 *
 * Returns null when there is nowhere to draw, or when nothing was drawn: a face
 * that has not arrived yet paints no glyph, and an empty box must not be
 * mistaken for a measurement or kept.
 */
function scanInkBox(text, font, reported) {
  const size = parseFloat(font) || BYZ_FONT_SIZE;
  const pad = Math.ceil(size * INK_SCAN_PADDING_EM);
  const minX = Math.floor(Math.min(reported.left, 0)) - pad;
  const maxX = Math.ceil(Math.max(reported.right, reported.adv)) + pad;
  const minY = Math.floor(Math.min(reported.top, 0)) - pad;
  const maxY = Math.ceil(Math.max(reported.bottom, 0)) + pad;
  const width = maxX - minX;
  const height = maxY - minY;

  const ctx = inkScanContext(width, height);
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  ctx.fillText(text, -minX, -minY);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, width, height);
  } catch (error) {
    // A tainted or unsupported surface. Nothing to do but keep what was said.
    return null;
  }

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  const data = pixels.data;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      if (data[(row * width + col) * 4 + 3] === 0) continue;
      if (col < left) left = col;
      if (col > right) right = col;
      if (row < top) top = row;
      if (row > bottom) bottom = row;
    }
  }
  if (right < 0) return null;

  // A pixel at column c covers [c, c + 1), so the far edges are one past the
  // last lit pixel.
  return {
    adv: reported.adv,
    left: minX + left,
    right: minX + right + 1,
    top: minY + top,
    bottom: minY + bottom + 1,
    fontAscent: reported.fontAscent,
    fontDescent: reported.fontDescent,
  };
}

/** Drops every measurement made against a face that has since changed. */
function resetInkMeasurements() {
  scannedInkBoxes.clear();
  martyriaInkRangeCache.clear();
}

function inkBox(ctx, text, font) {
  const previousFont = ctx.font;
  const previousAlign = ctx.textAlign;
  const previousBaseline = ctx.textBaseline;
  if (font) ctx.font = font;
  // actualBoundingBox* is reported from the anchor textAlign and textBaseline
  // choose, so both are pinned here. Leave them to the caller's leftovers and
  // the box shifts by a whole advance, or by half an em — silently, and only
  // for whichever sign happened to be drawn after right-aligned text.
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const effectiveFont = font || previousFont;
  ctx.font = previousFont;
  ctx.textAlign = previousAlign;
  ctx.textBaseline = previousBaseline;

  const reported = {
    adv: metrics.width,
    left: -(metrics.actualBoundingBoxLeft || 0),
    right: metrics.actualBoundingBoxRight === undefined ? metrics.width : metrics.actualBoundingBoxRight,
    top: -(metrics.actualBoundingBoxAscent || 0),
    bottom: metrics.actualBoundingBoxDescent || 0,
    // The face's own ascent and descent — the strut, not this text's ink. They
    // decide where a line box seats its baseline, which is what ink-centring in
    // the DOM has to undo.
    fontAscent: metrics.fontBoundingBoxAscent || 0,
    fontDescent: metrics.fontBoundingBoxDescent || 0,
  };

  if (!text || measureTextReportsInk()) return reported;

  const key = effectiveFont + "\n" + text;
  if (scannedInkBoxes.has(key)) return scannedInkBoxes.get(key);
  const scanned = scanInkBox(text, effectiveFont, reported);
  if (scanned) scannedInkBoxes.set(key, scanned);
  return scanned || reported;
}

/**
 * How far to move `text` so that its *ink* sits in the middle of the box a
 * browser centres it in — what a symbol well needs, and what neither
 * `align-items: center` nor `justify-content: center` gives on its own.
 *
 * Both of those centre the glyph's line box and its advance box. The ink sits
 * in the middle of neither: a fthora's ink clears the baseline entirely
 * because the face expects it over a neume, a martyria's straddles it, and a
 * genus mark carries ink but no advance. So both offsets are *measured*. A
 * constant would be a fact about Neanes, and would be wrong for the next face.
 *
 * `vAlign` says where in the line box the ink should land: `"center"` (the
 * default), or `"top"` / `"bottom"` to pin it against an edge. Pinning is what
 * a list of genus marks needs — every mark grows the composition on one side
 * only, so anchoring the far edge holds the *note letter* still down the whole
 * list, which is the fixed point a reader judges the mark's position against.
 * It assumes the glyph's line box is one font size tall (`line-height: 1`).
 *
 * `range` replaces the ink box the *vertical* centring is computed from, while
 * the glyph is still drawn as itself. Pass one family's whole range and every
 * member of it lands on a single shared baseline, which is the only way a
 * reader can see that one sign is drawn higher than another — centre each on
 * its own ink and that difference is exactly what is normalised away. See
 * `martyriaInkRange`.
 *
 * Positive `dy` moves the glyph down, positive `dx` moves it right.
 */
function inkCenteringShift(ctx, text, font, vAlign, range) {
  if (!text) return { dx: 0, dy: 0 };

  const box = inkBox(ctx, text, font);
  // Horizontal centring is always this glyph's own business: a shared range
  // says where the family sits vertically, not how wide any member of it is.
  const anchor = range || box;

  // A line box seats its baseline (ascent - descent) / 2 below its own middle,
  // whatever its line-height; the ink then sits (top + bottom) / 2 from that
  // baseline. Undo both.
  const dx = box.adv / 2 - (box.left + box.right) / 2;
  if (vAlign !== "top" && vAlign !== "bottom") {
    return {
      dx: dx,
      dy: -((box.fontAscent - box.fontDescent) / 2 + (anchor.top + anchor.bottom) / 2),
    };
  }

  // Pinned instead: measure from the line box's own edge. The caller has told
  // CSS to seat the box against that edge, so this is the last hop.
  const lineHeight = parseFloat(font || ctx.font) || 0;
  const baselineFromTop = lineHeight / 2 + (box.fontAscent - box.fontDescent) / 2;
  return {
    dx: dx,
    dy: vAlign === "top" ? -(baselineFromTop + box.top) : lineHeight - (baselineFromTop + box.bottom),
  };
}

// The vertical range every martyria in the vocabulary occupies, per font. A
// letter's register is carried by *where it is drawn*: the three octave blocks
// share their outlines and differ by the height they sit at, so a box that
// centres each letter on its own ink shows the same picture for all three. One
// range, shared by every composition, keeps that difference on screen — and
// keeps the letter still when a genus mark grows the composition beneath it.
//
// Measured, never assumed: the range is a fact about the face, so a second font
// re-derives it here and nothing else changes. One pass over the vocabulary is
// a few hundred measurements, so it is done once per font and cached.
const martyriaInkRangeCache = new Map();

function martyriaInkRange(ctx, font) {
  const cached = martyriaInkRangeCache.get(font);
  if (cached) return cached;

  let top = Infinity;
  let bottom = -Infinity;
  for (const note of BYZ_NOTES) {
    // Only the high letters are ever ticked, and only by one octave.
    const maxTicks = note.octave === "high" ? 1 : 0;
    for (let ticks = 0; ticks <= maxTicks; ticks++) {
      for (const genus of [GENUS_NONE].concat(BYZ_GENERA.map((g) => g.id))) {
        const box = inkBox(ctx, resolveMartyriaGlyphs(note.id, genus, ticks), font);
        top = Math.min(top, box.top);
        bottom = Math.max(bottom, box.bottom);
      }
    }
  }

  const range = Object.freeze({ top: top, bottom: bottom });
  martyriaInkRangeCache.set(font, range);
  return range;
}

/**
 * The same offset as `inkCenteringShift`, as a fraction of the em.
 *
 * A box's offset used to be measured in pixels at whatever size
 * `getComputedStyle` reported for that box — which is nothing at all for a box
 * that is not in the document yet, so the sign was measured against the wrong
 * font and sat visibly wrong. The ink metrics are exactly proportional to the
 * font size, so measuring once at a nominal size and reporting em removes the
 * question: CSS resolves em against the size the box really renders at, whether
 * that is the well's 34px or a picker row's 24px, attached or not — and it is
 * also why one measurement serves two faces, so long as `font` names the one
 * the box is actually drawn in.
 */
function inkCenteringShiftEm(ctx, text, vAlign, range, font) {
  const spec = font || byzantineFont(BYZ_FONT_SIZE);
  const size = parseFloat(spec) || BYZ_FONT_SIZE;
  const shift = inkCenteringShift(ctx, text, spec, vAlign, range);
  return { dx: shift.dx / size, dy: shift.dy / size };
}

/**
 * Draws `text` so that its *ink* lands on (x, y) as asked, rather than its
 * baseline and pen origin. Uses ctx.font as the caller set it.
 */
function drawGlyphs(ctx, text, x, y, options) {
  if (!text) return;
  const align = (options && options.align) || "left";
  const vAlign = (options && options.vAlign) || "middle";
  const box = inkBox(ctx, text, ctx.font);

  let penX = x - box.left;
  if (align === "right") penX = x - box.right;
  else if (align === "center") penX = x - (box.left + box.right) / 2;

  let penY = y - (box.top + box.bottom) / 2;
  if (vAlign === "top") penY = y - box.top;
  else if (vAlign === "bottom") penY = y - box.bottom;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, penX, penY);
}
