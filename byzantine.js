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
