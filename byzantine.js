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
