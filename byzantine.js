// Byzantine (psaltic) symbol model.
//
// Nothing in this file's tables names a codepoint, an octave block or an
// above/below variant. All SBMuFL knowledge lives in the resolvers further
// down. A different font encoding is a second pair of resolvers and touches
// nothing else. See docs/BYZANTINE-SYMBOLS.md.

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
// in this file (BYZ_NOTES, and BYZ_GENERA / BYZ_FTHORES / MARTYRIA_COMPATIBILITY
// that follow it) is immutable data — a shared reference no caller should be
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
  { id: "enharmonic", index: 12, label: "Enharmonic" },
  { id: "chroaZygos", index: 13, label: "Zygos" },
  { id: "chroaKliton", index: 14, label: "Kliton" },
  { id: "chroaSpathi", index: 15, label: "Spathi" },
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

function byzGenusById(id) {
  return BYZ_GENERA.find((genus) => genus.id === id) || null;
}

function byzFthoraById(id) {
  return BYZ_FTHORES.find((fthora) => fthora.id === id) || null;
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

// ---------------------------------------------------------------------------
// SBMuFL resolvers — the only code that knows a codepoint.
//
// Swapping to a different encoding (the Byzantine Music Unicode block, say) is
// a second pair of these two functions. Nothing above this line changes.
// ---------------------------------------------------------------------------

const BYZ_NOTE_BASE = 0xe130;        // martyriaNoteZoLow; three contiguous blocks of seven
const BYZ_GENUS_BELOW_BASE = 0xe150; // marks that hang under the letter
const BYZ_GENUS_ABOVE_BASE = 0xe170; // marks that sit over the letter
const BYZ_TICK = 0xe145;             // martyriaTick — a spacing glyph, not a mark
const BYZ_FTHORA_BASE = 0xe1d0;      // fthoraDiatonicNiLow

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

function resolveFthoraGlyph(fthoraId) {
  const fthora = byzFthoraById(fthoraId);
  return fthora ? String.fromCharCode(BYZ_FTHORA_BASE + fthora.index) : "";
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
// string the app uses — the chart's, and the one `loadByzantineFont` preloads
// — is built by `byzantineFont()` from this constant. CSS cannot read it, so
// `style.css` repeats the name; see docs/BYZANTINE-SYMBOLS.md §6 for the full
// list of what a font swap touches.
const BYZ_FONT_FAMILY = '"Neanes"';

function byzantineFont(size) {
  return (size || BYZ_FONT_SIZE) + "px " + BYZ_FONT_FAMILY + ", serif";
}

/**
 * The ink's extent relative to the pen origin, with y growing downward — so
 * `top` is normally negative. `adv` is the advance width, which for a martyria
 * is narrower than the ink because the genus mark has no advance.
 */
function inkBox(ctx, text, font) {
  const previousFont = ctx.font;
  if (font) ctx.font = font;
  const metrics = ctx.measureText(text);
  ctx.font = previousFont;

  return {
    adv: metrics.width,
    left: -(metrics.actualBoundingBoxLeft || 0),
    right: metrics.actualBoundingBoxRight === undefined ? metrics.width : metrics.actualBoundingBoxRight,
    top: -(metrics.actualBoundingBoxAscent || 0),
    bottom: metrics.actualBoundingBoxDescent || 0,
  };
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
