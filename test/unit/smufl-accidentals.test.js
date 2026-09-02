"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

// The 28 categories, in the order the picker shows them: id, title, entry count,
// the first entry's first codepoint and the last entry's last codepoint. Counts
// are SMuFL 1.4's own; the two special categories are hand-written data.
const CATALOGUE = [
  ["standardAccidentals12Edo", "Standard accidentals (12-EDO)", 14, 0xe260, 0xe26d],
  ["raileanuAccidentals", "Răileanu accidentals", 11, 0xe443, 0xe283],
  ["arelEzgiUzdilekAeuAccidentals", "Arel-Ezgi-Uzdilek (AEU) accidentals", 8, 0xe440, 0xe447],
  ["turkishFolkMusicAccidentals", "Turkish folk music accidentals", 8, 0xe450, 0xe457],
  ["arabicAccidentals", "Arabic accidentals", 9, 0xed30, 0xed38],
  ["persianAccidentals", "Persian accidentals", 2, 0xe460, 0xe461],
  ["sagittalMixedSymbolAccidentals72Edo", "Mixed-symbol Sagittal accidentals (72-EDO)", 13, 0xe260, 0xe262],
  ["spartanSagittalSingleShaftAccidentals", "Spartan Sagittal single-shaft accidentals", 16, 0xe300, 0xe30f],
  ["spartanSagittalMultiShaftAccidentals", "Spartan Sagittal multi-shaft accidentals", 36, 0xe310, 0xe335],
  ["athenianSagittalExtensionMediumPrecisionAccidentals", "Athenian Sagittal extension (medium precision) accidentals", 40, 0xe340, 0xe367],
  ["trojanSagittalExtension12EdoRelativeAccidentals", "Trojan Sagittal extension (12-EDO relative) accidentals", 24, 0xe370, 0xe387],
  ["prometheanSagittalExtensionHighPrecisionSingleShaftAccidentals", "Promethean Sagittal extension (high precision) single-shaft accidentals", 30, 0xe390, 0xe3ad],
  ["prometheanSagittalExtensionHighPrecisionMultiShaftAccidentals", "Promethean Sagittal extension (high precision) multi-shaft accidentals", 62, 0xe3b0, 0xe3ef],
  ["herculeanSagittalExtensionVeryHighPrecisionAccidentalDiacritics", "Herculean Sagittal extension (very high precision) accidental diacritics", 4, 0xe3f0, 0xe3f3],
  ["olympianSagittalExtensionExtremePrecisionAccidentalDiacritics", "Olympian Sagittal extension (extreme precision) accidental diacritics", 4, 0xe3f4, 0xe3f7],
  ["magratheanSagittalExtensionInsanePrecisionAccidentalDiacritics", "Magrathean Sagittal extension (insane precision) accidental diacritics", 20, 0xe3f8, 0xe40b],
  ["gouldArrowQuartertoneAccidentals24Edo", "Gould arrow quartertone accidentals (24-EDO)", 12, 0xe270, 0xe27b],
  ["steinZimmermannAccidentals24Edo", "Stein-Zimmermann accidentals (24-EDO)", 6, 0xe280, 0xe285],
  ["extendedSteinZimmermannAccidentals", "Extended Stein-Zimmermann accidentals", 13, 0xe290, 0xe29c],
  ["simsAccidentals72Edo", "Sims accidentals (72-EDO)", 6, 0xe2a0, 0xe2a5],
  ["johnstonAccidentalsJustIntonation", "Johnston accidentals (just intonation)", 8, 0xe2b0, 0xe2b7],
  ["extendedHelmholtzEllisAccidentalsJustIntonation", "Extended Helmholtz-Ellis accidentals (just intonation)", 60, 0xe2c0, 0xe2fb],
  ["extendedHelmholtzEllisAccidentalsJustIntonationSupplement", "Extended Helmholtz-Ellis accidentals (just intonation) supplement", 10, 0xee50, 0xee59],
  ["wyschnegradskyAccidentals72Edo", "Wyschnegradsky accidentals (72-EDO)", 22, 0xe420, 0xe435],
  ["medievalAndRenaissanceAccidentals", "Medieval and Renaissance accidentals", 6, 0xe9e0, 0xe9e5],
  ["stockhausenAccidentals", "Stockhausen accidentals (24-EDO)", 15, 0xed50, 0xed5e],
  ["otherAccidentals", "Other accidentals", 32, 0xe470, 0xe48f],
  ["otherAccidentalsSupplement", "Other accidentals supplement", 10, 0xee60, 0xee69],
];

test("the SMuFL accidental catalogue", async (t) => {
  await t.test("holds the 28 categories in the picker's order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.SMUFL_ACCIDENTAL_CATEGORIES, (c) => c.id),
      CATALOGUE.map((row) => row[0])
    );
  });

  await t.test("titles each category and counts its entries", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const [id, title, count] of CATALOGUE) {
      const category = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find((c) => c.id === id);
      assert.equal(category.title, title, `wrong title for ${id}`);
      assert.equal(category.accidentals.length, count, `wrong entry count for ${id}`);
    }
  });

  await t.test("starts and ends each category on the codepoints of its range", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const [id, , , first, last] of CATALOGUE) {
      const entries = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find((c) => c.id === id).accidentals;
      assert.equal(entries[0].codes[0], first, `wrong first codepoint in ${id}`);
      assert.equal(entries.at(-1).codes.at(-1), last, `wrong last codepoint in ${id}`);
    }
  });

  await t.test("holds 501 entries whose ids are unique across the whole catalogue", () => {
    const h = loadApp();
    t.after(() => h.close());

    const ids = h.app.SMUFL_ACCIDENTAL_CATEGORIES.flatMap((c) =>
      Array.from(c.accidentals, (a) => a.id)
    );
    assert.equal(ids.length, 501, "the catalogue is not the size the design fixes");
    assert.equal(new Set(ids).size, 501, "an id is used twice; a row stores an id, so they must be unique");
  });

  await t.test("drops the four slots SMuFL reserves but leaves empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    // U+E31A, U+E31B, U+E3DE and U+E3DF sit inside two Sagittal ranges and
    // carry the description "Unused": no glyph is drawn for them in any font.
    // A picker row for one shows an empty box under a meaningless label.
    const placeholders = Array.from(
      h.app.SMUFL_ACCIDENTAL_CATEGORIES.flatMap((c) =>
        c.accidentals.filter((a) => /unused/i.test(a.label)).map((a) => a.id)
      )
    );

    assert.deepEqual(placeholders, [], "a reserved, glyphless slot must not reach the picker");
  });

  await t.test("draws every glyph from the private use area, bar the Evo spacer", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const category of h.app.SMUFL_ACCIDENTAL_CATEGORIES) {
      for (const entry of category.accidentals) {
        for (const code of entry.codes) {
          assert.ok(
            code === 0x0020 || (code >= 0xe000 && code <= 0xf8ff),
            `${entry.id} uses ${code.toString(16)}, which is neither PUA nor the U+0020 spacer`
          );
        }
      }
    }
  });

  await t.test("repeats a codepoint across categories, with a category's own label", () => {
    const h = loadApp();
    t.after(() => h.close());

    // U+E261 is Standard's "Natural", Răileanu's "Natural" and the zero point
    // of the Evo ladder. That is what lets the picker re-open on the entry the
    // user actually chose rather than on the first category that draws the glyph.
    assert.equal(h.app.smuflAccidentalById("accidentalNatural").label, "Natural");
    assert.equal(h.app.smuflAccidentalById("raileanuNatural").label, "Natural");
    assert.equal(h.app.smuflAccidentalById("sagittalEvoZero").label, "0 (natural)");
    for (const id of ["accidentalNatural", "raileanuNatural", "sagittalEvoZero"]) {
      assert.deepEqual(Array.from(h.app.smuflAccidentalById(id).codes), [0xe261]);
    }
  });
});

test("the Răileanu accidentals", async (t) => {
  // The labels are the interval names, never SMuFL's descriptions: this
  // category *redefines* two of the glyphs it borrows (U+E274 is SMuFL's
  // "Three-quarter-tones sharp" but Răileanu's +1/3 tone, U+E2F5 is "Lower by
  // one equal tempered quarter-tone" but Răileanu's −2/3 tone), so printing the
  // SMuFL text here would state a pitch the category does not mean.
  const RAILEANU = [
    ["raileanuMinusOneQuarterTone", "−1/4 tone", 0xe443],
    ["raileanuMinusTwoQuarterTones", "−2/4 tone", 0xe442],
    ["raileanuMinusThreeQuarterTones", "−3/4 tone", 0xe440],
    ["raileanuMinusOneThirdTone", "−1/3 tone", 0xe441],
    ["raileanuMinusTwoThirdsTone", "−2/3 tone", 0xe2f5],
    ["raileanuNatural", "Natural", 0xe261],
    ["raileanuPlusOneQuarterTone", "+1/4 tone", 0xe444],
    ["raileanuPlusTwoQuarterTones", "+2/4 tone", 0xe445],
    ["raileanuPlusThreeQuarterTones", "+3/4 tone", 0xe446],
    ["raileanuPlusOneThirdTone", "+1/3 tone", 0xe274],
    ["raileanuPlusTwoThirdsTone", "+2/3 tone", 0xe283],
  ];

  await t.test("lists eleven entries, with the natural at the zero point", () => {
    const h = loadApp();
    t.after(() => h.close());

    const entries = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find(
      (c) => c.id === "raileanuAccidentals"
    ).accidentals;

    assert.deepEqual(
      Array.from(entries, (e) => [e.id, e.label, e.codes[0]]),
      RAILEANU
    );
  });
});

test("the mixed-symbol Sagittal accidentals", async (t) => {
  // Thirteen degrees of 72-EDO in the Evo flavour. SMuFL precomposes Revo only,
  // so ±4 and ±5 are a sagittal glyph, a U+0020 half-staff-space, then ♯ or ♭.
  const EVO = [
    ["sagittalEvoMinus6", "−6 (flat)", [0xe260]],
    ["sagittalEvoMinus5", "−5", [0xe302, 0x0020, 0xe260]],
    ["sagittalEvoMinus4", "−4", [0xe304, 0x0020, 0xe260]],
    ["sagittalEvoMinus3", "−3", [0xe30b]],
    ["sagittalEvoMinus2", "−2", [0xe305]],
    ["sagittalEvoMinus1", "−1", [0xe303]],
    ["sagittalEvoZero", "0 (natural)", [0xe261]],
    ["sagittalEvoPlus1", "+1", [0xe302]],
    ["sagittalEvoPlus2", "+2", [0xe304]],
    ["sagittalEvoPlus3", "+3", [0xe30a]],
    ["sagittalEvoPlus4", "+4", [0xe305, 0x0020, 0xe262]],
    ["sagittalEvoPlus5", "+5", [0xe303, 0x0020, 0xe262]],
    ["sagittalEvoPlus6", "+6 (sharp)", [0xe262]],
  ];

  await t.test("lists the thirteen degrees with their exact codepoint sequences", () => {
    const h = loadApp();
    t.after(() => h.close());

    const entries = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find(
      (c) => c.id === "sagittalMixedSymbolAccidentals72Edo"
    ).accidentals;

    assert.deepEqual(
      Array.from(entries, (e) => [e.id, e.label, Array.from(e.codes)]),
      EVO
    );
  });

  await t.test("puts a U+0020 spacer inside each of the four composed pairs", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const id of ["sagittalEvoMinus5", "sagittalEvoMinus4", "sagittalEvoPlus4", "sagittalEvoPlus5"]) {
      const codes = Array.from(h.app.smuflAccidentalById(id).codes);
      assert.equal(codes.length, 3, `${id} must be sagittal, spacer, apotome`);
      assert.equal(codes[1], 0x0020, `${id} lost its half-staff-space spacer`);
    }
  });
});

test("resolving an accidental to glyphs", async (t) => {
  await t.test("returns the single glyph of a single-codepoint entry", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.resolveAccidentalGlyphs("accidentalFlat"), String.fromCharCode(0xe260));
  });

  await t.test("returns the whole sequence of a composed entry, spacer included", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(
      h.app.resolveAccidentalGlyphs("sagittalEvoPlus4"),
      String.fromCharCode(0xe305, 0x0020, 0xe262),
      "the half-staff-space spacer is part of the glyph string, not decoration"
    );
  });

  await t.test("returns the empty string for an unknown id, so a stale row draws nothing", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.resolveAccidentalGlyphs("nosuchaccidental"), "");
    assert.equal(h.app.resolveAccidentalGlyphs(""), "");
    assert.equal(h.app.smuflAccidentalById("nosuchaccidental"), null);
  });
});

test("the SMuFL face", async (t) => {
  await t.test("names the family once, and builds every font string from it", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.SMUFL_FONT_FAMILY, '"Bravura Text"');
    assert.equal(h.app.smuflFont(), h.app.SMUFL_FONT_SIZE + 'px "Bravura Text", serif');
    assert.equal(h.app.smuflFont(24), '24px "Bravura Text", serif');
  });
});
