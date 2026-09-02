# Generic accidentals — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Generic notation an accidental well and a searchable 505-entry SMuFL
accidentals picker, by generalising the Byzantine well/picker machinery into a shared,
notation-agnostic layer that the chart, the editor and both notations reuse.

**Architecture:** The app grows from three classic scripts to five. A new `smufl.js` holds a
generated catalogue of 28 accidental categories (26 SMuFL ranges + Răileanu + mixed Sagittal)
and its resolvers; a new `symbols-ui.js` holds the well and picker machinery moved out of
`byzantine-ui.js`, now driven by a `SYMBOL_WELLS` registry whose rows name a notation and a
font. The chart's existing Byzantine sign-gutter is generalised rather than duplicated: a
degree's gutter run is derived from that same registry, so the editor's well order and the
chart's draw order stay one fact.

**Tech Stack:** Vanilla ES2020 classic scripts, no build step, no runtime dependencies.
Tests: `node --test` + jsdom. Vendored `fonts/BravuraText.woff2` (SMuFL 1.4, Bravura Text
1.482) and `fonts/Neanes.woff2`.

**Spec:** [`issues/013-generic-accidentals/2026-09-02-generic-accidentals-design.md`](2026-09-02-generic-accidentals-design.md)
Supporting: [`impl-prompt.md`](impl-prompt.md) (the requirement),
[`2026-09-01-smufl-accidentals-research.md`](2026-09-01-smufl-accidentals-research.md) (the
font and the Sagittal Evo pairs), [`accidentals-demo.html`](accidentals-demo.html) (the
glyphs at real sizes), [`docs/BYZANTINE-SYMBOLS.md`](../../docs/BYZANTINE-SYMBOLS.md) (the
machinery being generalised), [`docs/TESTING.md`](../../docs/TESTING.md) (**the workflow this
plan is executed under**).

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Strict TDD, no exceptions.** Write the failing test, run it, watch it fail for the right
  reason, then implement the least code that passes. Run the **whole** suite (`npm test`)
  before every commit. Never delete, skip or loosen a test to get green.
- **No dependencies, in the app or the tests.** `index.html` loads `style.css` and its own
  scripts and nothing else. `jsdom` stays the only dev dependency.
- **Classic scripts only.** Never `<script type="module">` — a `file://` page has an opaque
  origin and modules are fetched under CORS. All five scripts share one global lexical
  environment, so **no top-level name may be declared in two of them**: that is a load-time
  `SyntaxError` before any test runs. Every rename in this plan is a *move*, not a copy.
- **Script load order, final state:** `byzantine.js`, `smufl.js`, `symbols-ui.js`,
  `byzantine-ui.js`, `app.js` — all `defer`, in document order. `app.js` runs at load time so
  it stays last.
- **Font family names are written once in JavaScript.** `BYZ_FONT_FAMILY = '"Neanes"'`
  (`byzantine.js`), `SMUFL_FONT_FAMILY = '"Bravura Text"'` (`smufl.js`). `style.css` repeats
  them because CSS cannot read a constant; every such place is listed in the docs.
- **Do not modify `fonts/BravuraText.woff2`.** It carries the Reserved Font Name "Bravura";
  subsetting and re-compression are modifications under the OFL and would force a rename.
  Its sha256 is `1f2711e9b554b7240edadc48edc2bece1a8b91118c6825fe7ff03ed1e07e1574`.
- **Commit messages are prefixed `[#13] `**, one behavioural change each, tests and
  implementation together. End each with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
  ```
- **Out of scope** (design §10): pitch (an accidental never moves a degree), accidentals in
  Byzantine notation, more than one accidental per degree, the Revo Sagittal flavour,
  subsetting the font, persistence.
- **Chart tests assert geometry**, never pixels. Compare floats with `closeTo`, never
  `assert.equal`. One fresh harness per test, closed with `t.after(() => h.close())`.

---

## Decisions this plan makes that the design left open

The design fixes the *what*; these are the *how*, settled here so no task has to guess.

| # | Decision |
|---:|---|
| 1 | `buildGroupedPicker`'s spec drops the design's vestigial `size` field — `font` carries the size, and `inkCenteringShiftEm` reports em (design §4.2). |
| 2 | Search **filters by toggling `hidden`**, it does not rebuild the list: 505 options are measured once on open. New classes `.sym-search`, `.sym-empty`; new data attributes `data-group-of` on options/headings/separators and `data-separator-after` on separators. |
| 3 | The search input's own `input` listener calls `e.stopPropagation()`, so typing does not reach `#editor`'s delegated listener and redraw the chart on every keystroke. |
| 4 | `#editor` carries **both** `notation-generic` and `notation-byzantine` as toggled classes, because §6.1 and §6.2 both key off `.notation-generic`. |
| 5 | `signRunOf(noteItem, notation)` derives the run **from `SYMBOL_WELLS`**, filtered by notation — the editor/chart order invariant becomes structural rather than a comment. |
| 6 | In Generic the sign **overhang** is sized from the gutter run alone, never from the note name: names are ordinary text the chart has always let overflow, and an accidental must not silently change that. |
| 7 | The generator reads SMuFL metadata from `issues/013-generic-accidentals/smufl-metadata/` (gitignored; `curl` commands in the script header) and, with `--write`, splices its output between two marker comments in `smufl.js`. |
| 8 | Starting sizes, to be settled by eye in the verification pass: `SMUFL_FONT_SIZE = 40`, `.accidental-well { font-size: 30px }`, `.accidental-picker .sym-glyph { font-size: 32px }`. |
| 9 | `.accidental-picker` anchors `left: 0` (not `right: 0` like the Byzantine panels), because its well is the leftmost element of the row's right-hand block. |

---

## File structure

**New**

| File | Responsibility |
|---|---|
| `smufl.js` | The accidental catalogue (generated), `smuflAccidentalById()`, `resolveAccidentalGlyphs()`, `SMUFL_FONT_FAMILY`, `SMUFL_FONT_SIZE`, `smuflFont()`. No DOM. |
| `symbols-ui.js` | `SYMBOL_WELLS`, well rendering and glyph boxing, picker open/commit/dismiss, `buildGroupedPicker`, search, `buildAccidentalPicker`. Touches the DOM. |
| `issues/013-generic-accidentals/build-accidentals.js` | Research tooling: emits the catalogue literal from SMuFL 1.4 metadata. Not part of `npm test`, no dependencies. |
| `docs/SMUFL-ACCIDENTALS.md` | Maintainer's map of the SMuFL layer. |
| `test/unit/smufl-accidentals.test.js` | The catalogue and its resolvers. |
| `test/unit/symbol-search.test.js` | `normalizeForSearch()`, `searchWords()`, `matchesQuery()`. |
| `test/integration/accidental-picker.test.js` | The accidental well, its picker and the search field. |

**Modified**

| File | What changes |
|---|---|
| `byzantine.js` | `inkCenteringShiftEm` gains a `font` parameter. Nothing else. |
| `byzantine-ui.js` | Loses everything shared; keeps only the three Byzantine picker builders, the martyria draft, and the ladder applied to the editor. |
| `app.js` | Renamed call sites; `signRunOf` generalised; gutter measurement/layout no longer gated on Byzantine; `drawSignRun`/`drawSymbol`/`spec.symbolFont`; `loadSymbolFonts`; `readScaleData` carries `accidental`; note/interval row HTML. |
| `index.html` | Two more `<script>` tags; the two static note rows gain an accidental well and reorder; the static interval row swaps swatch and label. |
| `style.css` | Bravura Text `@font-face`; `.byz-*` → `.sym-*`; accidental well, hint and picker; search field; well/gap/name-box custom properties; interval-row alignment. |
| `.claude/rules/testing.md` | `paths:` gains `smufl.js` and `symbols-ui.js`. |
| `.gitignore` | Gains `issues/013-generic-accidentals/smufl-metadata/`. |
| `test/helpers/canvas-stub.js` | A SMuFL accidental ink block and a Bravura-Text-aware `U+0020`. |
| `test/helpers/harness.js` | `pickAccidental`, `searchPicker`. |
| `test/integration/harness.test.js` | The script list. |
| `test/integration/byzantine-pickers.test.js` | `.sym-*` names; the new search field. |
| `test/integration/notation.test.js` | The accidental well; `loadSymbolFonts`/`symbolFontsReady`; two faces. |
| `test/integration/render.test.js` | Generic gutter geometry. |
| `CLAUDE.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/BYZANTINE-SYMBOLS.md` | Documentation. |

---

## Task 1: The SMuFL accidental catalogue (`smufl.js`)

Design §3. Pure data and two resolvers — no DOM, no UI, nothing else depends on it yet.

**Files:**
- Create: `smufl.js`
- Create: `issues/013-generic-accidentals/build-accidentals.js`
- Create: `test/unit/smufl-accidentals.test.js`
- Modify: `index.html:142-144` (script tags)
- Modify: `.claude/rules/testing.md` (`paths:`)
- Modify: `.gitignore`
- Test: `test/integration/harness.test.js:65-73` (the script list)

**Interfaces:**
- Consumes: `freezeTable(rows)` from `byzantine.js` (freezes each row, then the array).
- Produces:
  - `SMUFL_ACCIDENTAL_CATEGORIES` — frozen array of
    `{ id, title, accidentals: [{ id, codes: number[], label }] }`, 28 categories, 505 entries.
  - `smuflAccidentalById(id) → entry | null`
  - `resolveAccidentalGlyphs(id) → string` (`""` for an unknown id)
  - `SMUFL_FONT_FAMILY`, `SMUFL_FONT_SIZE`, `smuflFont(size) → string`

---

- [ ] **Step 1: Fetch the SMuFL metadata the generator reads**

```bash
mkdir -p issues/013-generic-accidentals/smufl-metadata
curl -sSfo issues/013-generic-accidentals/smufl-metadata/ranges.json \
  https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json
curl -sSfo issues/013-generic-accidentals/smufl-metadata/glyphnames.json \
  https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json
```

Then add the last line to `.gitignore` (it currently holds `node_modules/` and
`**/.DS_STORE`):

```
issues/013-generic-accidentals/smufl-metadata/
```

The metadata is **not** committed: it is 390 KB of input to a tool that runs by hand, and
the generator's output is what ships.

- [ ] **Step 2: Write the failing test**

Create `test/unit/smufl-accidentals.test.js`:

```js
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
  ["spartanSagittalMultiShaftAccidentals", "Spartan Sagittal multi-shaft accidentals", 38, 0xe310, 0xe335],
  ["athenianSagittalExtensionMediumPrecisionAccidentals", "Athenian Sagittal extension (medium precision) accidentals", 40, 0xe340, 0xe367],
  ["trojanSagittalExtension12EdoRelativeAccidentals", "Trojan Sagittal extension (12-EDO relative) accidentals", 24, 0xe370, 0xe387],
  ["prometheanSagittalExtensionHighPrecisionSingleShaftAccidentals", "Promethean Sagittal extension (high precision) single-shaft accidentals", 30, 0xe390, 0xe3ad],
  ["prometheanSagittalExtensionHighPrecisionMultiShaftAccidentals", "Promethean Sagittal extension (high precision) multi-shaft accidentals", 64, 0xe3b0, 0xe3ef],
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

  await t.test("holds 505 entries whose ids are unique across the whole catalogue", () => {
    const h = loadApp();
    t.after(() => h.close());

    const ids = h.app.SMUFL_ACCIDENTAL_CATEGORIES.flatMap((c) =>
      Array.from(c.accidentals, (a) => a.id)
    );
    assert.equal(ids.length, 505, "the catalogue is not the size the design fixes");
    assert.equal(new Set(ids).size, 505, "an id is used twice; a row stores an id, so they must be unique");
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

    // U+E262 is Standard's "Sharp", Răileanu's "+2/4 tone" and the top of the
    // Evo ladder. That is what lets the picker re-open on the entry the user
    // actually chose rather than on the first category that draws the glyph.
    assert.equal(h.app.smuflAccidentalById("accidentalSharp").label, "Sharp");
    assert.equal(h.app.smuflAccidentalById("raileanuPlusTwoQuarterTones").label, "+2/4 tone");
    assert.equal(h.app.smuflAccidentalById("sagittalEvoPlus6").label, "+6 (sharp)");
    for (const id of ["accidentalSharp", "raileanuPlusTwoQuarterTones", "sagittalEvoPlus6"]) {
      assert.deepEqual(Array.from(h.app.smuflAccidentalById(id).codes), [0xe262]);
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
      entries.map((e) => [e.id, e.label, e.codes[0]]),
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
      entries.map((e) => [e.id, e.label, Array.from(e.codes)]),
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
```

Also extend the script-list assertion in `test/integration/harness.test.js`. Replace the body
of the `"runs every script index.html loads, in document order"` sub-test (lines 65–73) with:

```js
  await t.test("runs every script index.html loads, in document order", () => {
    const path = require("node:path");
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      h.scriptFiles.map((f) => path.basename(f)),
      ["byzantine.js", "smufl.js", "byzantine-ui.js", "app.js"],
      "the load order is load-bearing: smufl.js must precede anything that reads its catalogue, " +
        "and app.js must run last because it wires the page up"
    );
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/unit/smufl-accidentals.test.js test/integration/harness.test.js`
Expected: FAIL — `SMUFL_ACCIDENTAL_CATEGORIES` is `undefined` (so `Array.from` throws), and
the script list is `["byzantine.js", "byzantine-ui.js", "app.js"]`.

- [ ] **Step 4: Write the generator**

Create `issues/013-generic-accidentals/build-accidentals.js`:

```js
#!/usr/bin/env node
"use strict";

/**
 * Generates the SMUFL_ACCIDENTAL_CATEGORIES literal in smufl.js.
 *
 * Research tooling, not part of the app and not part of `npm test`: it runs by
 * hand when SMuFL moves, and its *output* is what ships. It has no
 * dependencies — two JSON files and a template string.
 *
 *   mkdir -p issues/013-generic-accidentals/smufl-metadata
 *   curl -sSfo issues/013-generic-accidentals/smufl-metadata/ranges.json \
 *     https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json
 *   curl -sSfo issues/013-generic-accidentals/smufl-metadata/glyphnames.json \
 *     https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json
 *
 *   node issues/013-generic-accidentals/build-accidentals.js            # to stdout
 *   node issues/013-generic-accidentals/build-accidentals.js --write    # into smufl.js
 *
 * `--write` replaces everything between the two GENERATED markers in smufl.js.
 * The metadata directory is gitignored; the app never reads it.
 */

const fs = require("node:fs");
const path = require("node:path");

const METADATA_DIR = path.join(__dirname, "smufl-metadata");
const SMUFL_JS = path.join(__dirname, "..", "..", "smufl.js");
const BEGIN = "// >>> GENERATED by issues/013-generic-accidentals/build-accidentals.js — do not edit by hand";
const END = "// <<< GENERATED";

function readMetadata(name) {
  const file = path.join(METADATA_DIR, name);
  if (!fs.existsSync(file)) {
    console.error(
      `Missing ${file}.\nDownload the SMuFL 1.4 metadata first — see the curl commands in this file's header.`
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const ranges = readMetadata("ranges.json");
const glyphnames = readMetadata("glyphnames.json");

// --- The two categories SMuFL does not define -----------------------------

// The client's accidentals for Byzantine and Near/Middle Eastern (maqam)
// music: mostly Arel-Ezgi-Uzdilek, with additions. The labels are the interval
// names and not SMuFL's descriptions, because this category *redefines* two of
// the glyphs it borrows — U+E274 is SMuFL's "Three-quarter-tones sharp" but
// Răileanu's +1/3 tone, and U+E2F5 is "Lower by one equal tempered
// quarter-tone" but Răileanu's −2/3 tone.
const RAILEANU = {
  id: "raileanuAccidentals",
  title: "Răileanu accidentals",
  accidentals: [
    ["raileanuMinusOneQuarterTone", [0xe443], "−1/4 tone"],
    ["raileanuMinusTwoQuarterTones", [0xe442], "−2/4 tone"],
    ["raileanuMinusThreeQuarterTones", [0xe440], "−3/4 tone"],
    ["raileanuMinusOneThirdTone", [0xe441], "−1/3 tone"],
    ["raileanuMinusTwoThirdsTone", [0xe2f5], "−2/3 tone"],
    ["raileanuNatural", [0xe261], "Natural"],
    ["raileanuPlusOneQuarterTone", [0xe444], "+1/4 tone"],
    ["raileanuPlusTwoQuarterTones", [0xe445], "+2/4 tone"],
    ["raileanuPlusThreeQuarterTones", [0xe446], "+3/4 tone"],
    ["raileanuPlusOneThirdTone", [0xe274], "+1/3 tone"],
    ["raileanuPlusTwoThirdsTone", [0xe283], "+2/3 tone"],
  ],
};

// The thirteen degrees of 72-EDO in the Sagittal Evo (mixed-symbol) flavour,
// from the Sagittal paper p. 4, Figure 2, last row. Evo keeps ♯ and ♭ and puts
// a single-shaft sagittal to their left; SMuFL precomposes the Revo flavour
// only, so four of the thirteen are a sequence. U+0020 is Bravura Text's ½
// staff space (100 units against a 200-unit staff space) — SMuFL sets zero side
// bearings, so without it the two glyphs abut exactly at the ink.
const SAGITTAL_EVO = {
  id: "sagittalMixedSymbolAccidentals72Edo",
  title: "Mixed-symbol Sagittal accidentals (72-EDO)",
  accidentals: [
    ["sagittalEvoMinus6", [0xe260], "−6 (flat)"],
    ["sagittalEvoMinus5", [0xe302, 0x0020, 0xe260], "−5"],
    ["sagittalEvoMinus4", [0xe304, 0x0020, 0xe260], "−4"],
    ["sagittalEvoMinus3", [0xe30b], "−3"],
    ["sagittalEvoMinus2", [0xe305], "−2"],
    ["sagittalEvoMinus1", [0xe303], "−1"],
    ["sagittalEvoZero", [0xe261], "0 (natural)"],
    ["sagittalEvoPlus1", [0xe302], "+1"],
    ["sagittalEvoPlus2", [0xe304], "+2"],
    ["sagittalEvoPlus3", [0xe30a], "+3"],
    ["sagittalEvoPlus4", [0xe305, 0x0020, 0xe262], "+4"],
    ["sagittalEvoPlus5", [0xe303, 0x0020, 0xe262], "+5"],
    ["sagittalEvoPlus6", [0xe262], "+6 (sharp)"],
  ],
};

// --- The catalogue's order ------------------------------------------------
//
// The SMuFL site's own order, with the promotions the requirement asks for.
// "Standard accidentals for chord symbols" (U+ED60–ED6F) is deliberately out:
// it is typography for chord labels, not pitch inflection.
const CATALOGUE = [
  { range: "standardAccidentals12Edo" },
  { custom: RAILEANU },
  { range: "arelEzgiUzdilekAeuAccidentals" },
  { range: "turkishFolkMusicAccidentals" },
  { range: "arabicAccidentals" },
  { range: "persianAccidentals" },
  { custom: SAGITTAL_EVO },
  { range: "spartanSagittalSingleShaftAccidentals" },
  { range: "spartanSagittalMultiShaftAccidentals" },
  { range: "athenianSagittalExtensionMediumPrecisionAccidentals" },
  { range: "trojanSagittalExtension12EdoRelativeAccidentals" },
  { range: "prometheanSagittalExtensionHighPrecisionSingleShaftAccidentals" },
  { range: "prometheanSagittalExtensionHighPrecisionMultiShaftAccidentals" },
  { range: "herculeanSagittalExtensionVeryHighPrecisionAccidentalDiacritics" },
  { range: "olympianSagittalExtensionExtremePrecisionAccidentalDiacritics" },
  { range: "magratheanSagittalExtensionInsanePrecisionAccidentalDiacritics" },
  { range: "gouldArrowQuartertoneAccidentals24Edo" },
  { range: "steinZimmermannAccidentals24Edo" },
  { range: "extendedSteinZimmermannAccidentals" },
  { range: "simsAccidentals72Edo" },
  { range: "johnstonAccidentalsJustIntonation" },
  { range: "extendedHelmholtzEllisAccidentalsJustIntonation" },
  { range: "extendedHelmholtzEllisAccidentalsJustIntonationSupplement" },
  { range: "wyschnegradskyAccidentals72Edo" },
  { range: "medievalAndRenaissanceAccidentals" },
  { range: "stockhausenAccidentals" },
  { range: "otherAccidentals" },
  { range: "otherAccidentalsSupplement" },
];

function categoryFromRange(key) {
  const range = ranges[key];
  if (!range) throw new Error(`Unknown SMuFL range: ${key}`);
  return {
    id: key,
    title: range.description,
    // A category keeps the range's own glyph order, and each entry's label is
    // the glyphnames.json description verbatim — the text the SMuFL tables
    // show, so a reader who knows them recognises the row. Codepoints inside a
    // range are not contiguous (Magrathean is 20 glyphs across 40 slots), so
    // every one is written out rather than derived from a base plus an index.
    accidentals: range.glyphs.map((name) => {
      const glyph = glyphnames[name];
      if (!glyph) throw new Error(`Unknown SMuFL glyph: ${name}`);
      return [name, [parseInt(glyph.codepoint.slice(2), 16)], glyph.description];
    }),
  };
}

const categories = CATALOGUE.map((entry) =>
  entry.custom ? entry.custom : categoryFromRange(entry.range)
);

const hex = (code) => "0x" + code.toString(16).padStart(4, "0");

let body = "const SMUFL_ACCIDENTAL_CATEGORIES = freezeTable([\n";
for (const category of categories) {
  body += "  {\n";
  body += `    id: ${JSON.stringify(category.id)},\n`;
  body += `    title: ${JSON.stringify(category.title)},\n`;
  body += "    accidentals: freezeTable([\n";
  for (const [id, codes, label] of category.accidentals) {
    body +=
      `      { id: ${JSON.stringify(id)}, codes: Object.freeze([${codes.map(hex).join(", ")}]), ` +
      `label: ${JSON.stringify(label)} },\n`;
  }
  body += "    ]),\n  },\n";
}
body += "]);\n";

const entryCount = categories.reduce((sum, c) => sum + c.accidentals.length, 0);
console.error(`${categories.length} categories, ${entryCount} entries`);

if (!process.argv.includes("--write")) {
  process.stdout.write(body);
} else {
  const source = fs.readFileSync(SMUFL_JS, "utf8");
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  if (begin < 0 || end < 0) throw new Error(`Markers not found in ${SMUFL_JS}`);
  fs.writeFileSync(
    SMUFL_JS,
    source.slice(0, begin) + BEGIN + "\n\n" + body + "\n" + source.slice(end),
    "utf8"
  );
  console.error(`Wrote ${SMUFL_JS}`);
}
```

- [ ] **Step 5: Write `smufl.js` around the markers**

Create `smufl.js` with the hand-written half and empty markers:

```js
// SMuFL accidentals: the catalogue and its resolvers.
//
// No DOM. The measuring primitives an accidental is placed with — inkBox,
// inkCenteringShift(Em), drawGlyphs, domGlyphText, scanInkBox — live in
// byzantine.js. They are font-agnostic shared machinery, not Byzantine: each
// takes its face as an argument. See docs/BYZANTINE-SYMBOLS.md §8 and §10, and
// docs/SMUFL-ACCIDENTALS.md for this layer's own map.
//
// An accidental is a *sequence* of codepoints, not one: the Sagittal Evo pairs
// need it, and Extended Helmholtz-Ellis and Johnston combine the same way.
// Single-glyph entries are a one-element array, so nothing special-cases length.
//
// Entries are per category, so the same codepoint appears as several entries
// with several labels — U+E262 is "Sharp" in Standard, "+2/4 tone" in Răileanu
// and "+6 (sharp)" in mixed Sagittal. That is what lets a picker re-open on the
// entry the user actually chose. Ids are unique across the whole catalogue: for
// the 26 SMuFL ranges the id *is* the canonical glyph name.

// The family name lives here and nowhere else in the JavaScript: every font
// string the app uses for an accidental is built by smuflFont() from this
// constant. CSS cannot read it, so style.css repeats the name; see
// docs/SMUFL-ACCIDENTALS.md for the full list of what a font swap touches.
const SMUFL_FONT_FAMILY = '"Bravura Text"';

// The chart's size, matching BYZ_FONT_SIZE. A Bravura Text accidental's ink
// spans about 0.56em where a martyria's spans far more, so the two faces do not
// look the same size at the same size; this number is settled by eye against a
// 24px note name.
const SMUFL_FONT_SIZE = 40;

function smuflFont(size) {
  return (size || SMUFL_FONT_SIZE) + "px " + SMUFL_FONT_FAMILY + ", serif";
}

// >>> GENERATED by issues/013-generic-accidentals/build-accidentals.js — do not edit by hand
// <<< GENERATED

// A flat index over every category, built once on first use. Lazy because the
// catalogue is 505 entries and a page that never opens the picker never needs it.
let smuflAccidentalIndex = null;

function smuflAccidentalById(id) {
  if (!smuflAccidentalIndex) {
    smuflAccidentalIndex = new Map();
    for (const category of SMUFL_ACCIDENTAL_CATEGORIES) {
      for (const accidental of category.accidentals) {
        smuflAccidentalIndex.set(accidental.id, accidental);
      }
    }
  }
  return smuflAccidentalIndex.get(id) || null;
}

/** The glyph string for one accidental, or "" for an id the catalogue lost. */
function resolveAccidentalGlyphs(id) {
  const accidental = smuflAccidentalById(id);
  return accidental ? String.fromCharCode(...accidental.codes) : "";
}
```

Then fill the markers:

```bash
node issues/013-generic-accidentals/build-accidentals.js --write
```

Expected on stderr: `28 categories, 505 entries`.

- [ ] **Step 6: Load `smufl.js` from the page and put it under the testing rule**

In `index.html`, insert the tag after `byzantine.js` (line 142):

```html
  <script src="byzantine.js" defer></script>
  <script src="smufl.js" defer></script>
  <script src="byzantine-ui.js" defer></script>
  <script src="app.js" defer></script>
```

In `.claude/rules/testing.md`, add to `paths:` (after `"byzantine-ui.js"`):

```yaml
  - "smufl.js"
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, whole suite. If `harness.test.js` reports a different script order, the tag
went in the wrong place.

- [ ] **Step 8: Commit**

```bash
git add smufl.js index.html .gitignore .claude/rules/testing.md \
  issues/013-generic-accidentals/build-accidentals.js \
  test/unit/smufl-accidentals.test.js test/integration/harness.test.js
git commit -m "$(cat <<'EOF'
[#13] Add the SMuFL accidental catalogue and its generator

smufl.js holds 28 categories and 505 entries: 26 SMuFL 1.4 ranges plus the
Răileanu and mixed-symbol Sagittal categories, which are not SMuFL ranges. The
481 SMuFL entries are generated by issues/013-generic-accidentals/build-accidentals.js
from ranges.json and glyphnames.json; only its output is committed, so the app
still has no build step.

An accidental is a sequence of codepoints, which is what the four Sagittal Evo
pairs need — a sagittal glyph, a U+0020 half staff space, then the apotome.

harness.test.js now pins the script list, which grows to four.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 2: Extract the shared wells and pickers (`symbols-ui.js`)

Design §2 and §4.1–4.2. The well and picker machinery, today Byzantine-only, becomes
notation-agnostic so the accidental well can be a row in a table rather than a second
implementation. **This task changes no behaviour except the class names** — the existing
suite is the safety net, and the class renames are a deliberate documented change whose
tests move in this same commit.

**Files:**
- Create: `symbols-ui.js`
- Modify: `byzantine-ui.js` (loses everything shared)
- Modify: `byzantine.js:735-745` (`inkCenteringShiftEm` gains a `font` parameter)
- Modify: `app.js:1518-1525` (`closeAllDropdowns`), `app.js:1606-1607` (the editor click listener)
- Modify: `index.html:142-145`
- Modify: `style.css` (`.byz-*` → `.sym-*`)
- Modify: `.claude/rules/testing.md`
- Test: `test/integration/harness.test.js` (five scripts)
- Test: `test/integration/byzantine-pickers.test.js` (27 lines naming `.byz-*`)

**Interfaces:**
- Consumes: `freezeTable`, `inkBox`, `inkCenteringShiftEm`, `domGlyphText`, `byzantineFont`,
  `BYZ_FONT_SIZE`, `martyriaInkRange` (all `byzantine.js`); `smuflFont` (`smufl.js`);
  `resolveAlterationGlyph`, `resolveFthoraGlyph`, `resolveMartyriaGlyphs`, `GENUS_NONE`
  (`byzantine.js`); `closeAllDropdowns`, `render`, `editor` (`app.js`, called at runtime only).
- Produces, from `symbols-ui.js`:
  - `SYMBOL_WELLS` — frozen `[{ kind, notation, title, font, build(panel,row), resolve(id) }]`,
    in the order the wells appear on a note row, left to right.
  - `MARTYRIA_WELL` — `{ kind: "martyria", notation: "byzantine", title: "Martyria", font }`
  - `SYMBOL_WELL_KINDS`, `wellSelector(suffix)`, `panelWell(panel)`
  - `wellWrapperHTML(kind, title)`, `makeSymbolWellsHTML(notation)`
  - `readNoteSymbols(row)`, `writeNoteSign(row, kind, id)`, `noteSymbolAttrs(row)`,
    `applyNoteSymbolAttrs(row, attrs)`, `NOTE_SYMBOL_ATTRS`
  - `wellMeasuringContext()`, `setGlyphBoxText(box, text, placement, mutedText, font)`,
    `glyphLayer(text, className)`, `fillWell(well, text, placement, font)`,
    `centerPickerGlyphs(panel, font)`, `glyphBoxPlacement(box)`
  - `refreshNoteRowWells(row)`, `refreshAllNoteRowWells()`
  - `makeSymbolOption(spec)`, `symbolGroupTitle(text, group)`, `symbolColumnTitle(text)`
  - `readPickerScroll`, `restorePickerScroll`, `scrollTopToReveal`, `pickerRevealTarget`,
    `revealPickerSelection`, `keepPickerInView`, `toggleWellPicker(well)`,
    `closeSymbolPickers()`, `selectSymbolOption(option)`, `handleSymbolClick(e)`
- Stays in `byzantine-ui.js`: `buildAlterationPicker`, `buildFthoraPicker`,
  `buildMartyriaPicker`, `buildNotesColumn`, `buildGenusColumn`, `writeMartyria`,
  `clearMartyria`, `writeFthora`, `writeAlteration`, `commitMartyria`, the
  `PICKER_DRAFT_ATTRS` draft functions, `noteRowDegree`, `scaleHasTicks`,
  `propagateMartyriaLadder`, `continueLadderOnNewNote`.

---

- [ ] **Step 1: Write the failing test**

Update `test/integration/harness.test.js` — the script list grows to five:

```js
    assert.deepEqual(
      h.scriptFiles.map((f) => path.basename(f)),
      ["byzantine.js", "smufl.js", "symbols-ui.js", "byzantine-ui.js", "app.js"],
      "the load order is load-bearing: smufl.js before symbols-ui.js, which names " +
        "byzantine-ui.js's picker builders, and app.js last because it wires the page up"
    );
```

Add to the same file, after `"re-exports top-level names from every script, not just app.js"`:

```js
  await t.test("re-exports the shared symbol machinery from symbols-ui.js", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The wells and pickers are shared machinery, not Byzantine, so they live
    // in a file of their own. Nothing here may still be declared in
    // byzantine-ui.js: two declarations of one name across two classic scripts
    // is a load-time SyntaxError, which is exactly what this asserts is absent.
    assert.deepEqual(h.jsdomErrors, []);
    for (const name of [
      "SYMBOL_WELLS",
      "SYMBOL_WELL_KINDS",
      "wellSelector",
      "makeSymbolOption",
      "closeSymbolPickers",
      "handleSymbolClick",
      "buildGroupedPicker",
    ]) {
      assert.ok(h.exportedNames.includes(name), `${name} is missing`);
    }
  });

  await t.test("orders the well registry by notation, so a row's wells follow it", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.SYMBOL_WELLS, (w) => [w.kind, w.notation]),
      [
        ["alteration", "byzantine"],
        ["fthora", "byzantine"],
      ],
      "the accidental joins this table in a later task; until then it holds the Byzantine two"
    );
    for (const well of h.app.SYMBOL_WELLS) {
      assert.equal(typeof well.font, "string", `${well.kind} must name the face it is boxed in`);
      assert.equal(typeof well.build, "function");
      assert.equal(typeof well.resolve, "function");
    }
  });
```

In `test/integration/byzantine-pickers.test.js`, rename every `.byz-` selector to `.sym-`.
There are 27 such lines; the mapping is one-to-one:

```bash
sed -i '' \
  -e 's/\.byz-option/.sym-option/g' \
  -e 's/\.byz-glyph/.sym-glyph/g' \
  -e 's/\.byz-label/.sym-label/g' \
  -e 's/\.byz-group-title/.sym-group-title/g' \
  -e 's/\.byz-column-title/.sym-column-title/g' \
  -e 's/\.byz-separator/.sym-separator/g' \
  test/integration/byzantine-pickers.test.js
```

Note `buildGroupedPicker` is asserted here but built in Task 3. Leave it out of the export
list for now if you prefer a green step boundary — but the design puts the grouped builder in
this file, and asserting the name early costs one line in Task 3 rather than a second edit.
**Decision: include it**, and add the stub in Step 3 below.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/integration/harness.test.js test/integration/byzantine-pickers.test.js`
Expected: FAIL — the script list is four files; `SYMBOL_WELLS` is not exported; every
`.sym-*` query returns nothing.

- [ ] **Step 3: Create `symbols-ui.js` and move the shared code into it**

Create `symbols-ui.js` with this header, then move the function bodies listed under
**Interfaces** out of `byzantine-ui.js` **verbatim**, in the order given there, applying only
the renames in Step 4. Delete each from `byzantine-ui.js` as you move it — a name declared in
both files is a load-time `SyntaxError`, so the suite will tell you immediately.

```js
// Symbol wells and pickers: the editor UI both notations share.
//
// This file declares functions only. It loads before byzantine-ui.js and
// app.js, so it must not read their top-level constants (editor, ctx, the
// picker builders) at load time — only from inside a function body, which runs
// after every script has loaded.
//
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

/** Every well of one notation, in row order; the martyria closes Byzantine's. */
function makeSymbolWellsHTML(notation) {
  return SYMBOL_WELLS.concat(MARTYRIA_WELL)
    .filter((well) => well.notation === notation)
    .map((well) => wellWrapperHTML(well.kind, well.title))
    .join("");
}
```

Add a placeholder for the grouped builder, which Task 3 fills in:

```js
/** Built in Task 3. Declared here so the file's shape is settled. */
function buildGroupedPicker(panel, spec) {
  throw new Error("buildGroupedPicker: not implemented yet");
}
```

- [ ] **Step 4: Apply the renames**

Every one is a **move**, never a copy.

| Today | Becomes |
|---|---|
| `BYZ_SIMPLE_WELLS` | `SYMBOL_WELLS` |
| `BYZ_WELL_KINDS` | `SYMBOL_WELL_KINDS` |
| `byzSelector()` | `wellSelector()` |
| `makeByzOption()` | `makeSymbolOption()` |
| `byzGroupTitle()` | `symbolGroupTitle()` |
| `byzColumnTitle()` | `symbolColumnTitle()` |
| `closeByzantinePickers()` | `closeSymbolPickers()` |
| `selectByzantineOption()` | `selectSymbolOption()` |
| `handleByzantineClick()` | `handleSymbolClick()` |
| `.byz-option` | `.sym-option` |
| `.byz-glyph` | `.sym-glyph` |
| `.byz-label` | `.sym-label` |
| `.byz-group-title` | `.sym-group-title` |
| `.byz-column-title` | `.sym-column-title` |
| `.byz-separator` | `.sym-separator` |

`.martyria-*` classes keep their names — the martyria genuinely is Byzantine.

In `app.js`: `closeByzantinePickers()` → `closeSymbolPickers()` (line 1524) and
`handleByzantineClick(e)` → `handleSymbolClick(e)` (line 1607).

In `style.css`, apply the six class renames:

```bash
sed -i '' \
  -e 's/\.byz-option/.sym-option/g' \
  -e 's/\.byz-glyph/.sym-glyph/g' \
  -e 's/\.byz-label/.sym-label/g' \
  -e 's/\.byz-group-title/.sym-group-title/g' \
  -e 's/\.byz-column-title/.sym-column-title/g' \
  -e 's/\.byz-separator/.sym-separator/g' \
  style.css
```

`makeSymbolWellsHTML()` now takes an argument, so update its one call site in `app.js`
(`makeNoteRowHTML`, two returns, lines 258 and 261): `makeSymbolWellsHTML("byzantine")`.
The generic wells and the row reordering arrive in Task 5.

- [ ] **Step 5: Load `symbols-ui.js` from the page**

`index.html`:

```html
  <script src="byzantine.js" defer></script>
  <script src="smufl.js" defer></script>
  <script src="symbols-ui.js" defer></script>
  <script src="byzantine-ui.js" defer></script>
  <script src="app.js" defer></script>
```

`.claude/rules/testing.md`, `paths:` gains:

```yaml
  - "symbols-ui.js"
```

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Anything red here is the move having dropped or duplicated a declaration —
a `SyntaxError` in `h.jsdomErrors` names the duplicate.

- [ ] **Step 7: Refactor — thread the face through the glyph-boxing machinery**

Behaviour is unchanged (both callers still pass Neanes at the same size), so the suite stays
green; this is what lets a later well name a different face.

In `byzantine.js`, `inkCenteringShiftEm`:

```js
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
```

In `symbols-ui.js`, give `setGlyphBoxText`, `fillWell` and `centerPickerGlyphs` a trailing
`font`, defaulting to Neanes so nothing else has to change yet:

```js
function setGlyphBoxText(box, text, placement, mutedText, font) {
  box.textContent = "";
  if (!text) return;

  const spec = font || byzantineFont(BYZ_FONT_SIZE);
  const ctx = wellMeasuringContext();
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

function fillWell(well, text, placement, font) {
  setGlyphBoxText(well, text, placement, undefined, font);
  well.classList.toggle("is-empty", !text);
}

function centerPickerGlyphs(panel, font) {
  for (const box of panel.querySelectorAll(".sym-glyph")) {
    setGlyphBoxText(box, box.dataset.glyph || "", glyphBoxPlacement(box), box.dataset.mutedGlyph, font);
  }
}
```

`refreshNoteRowWells` passes each well's own face:

```js
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
```

And each picker builder passes its own face to `centerPickerGlyphs` — in `byzantine-ui.js`,
`buildFthoraPicker` and `buildAlterationPicker` end with
`centerPickerGlyphs(panel, panelWell(panel).font)`, and `buildMartyriaPicker` with
`centerPickerGlyphs(panel, MARTYRIA_WELL.font)`.

Run `npm test` after this step: it must still be green, because every face passed is the one
that was hard-coded before.

- [ ] **Step 8: Commit**

```bash
git add symbols-ui.js byzantine-ui.js byzantine.js app.js index.html style.css \
  .claude/rules/testing.md test/integration/harness.test.js \
  test/integration/byzantine-pickers.test.js
git commit -m "$(cat <<'EOF'
[#13] Move the shared wells and pickers into symbols-ui.js

The well and picker machinery was Byzantine only by where it lived, not by what
it did. It moves to symbols-ui.js unchanged in behaviour, and the registry that
drives it gains two fields: `notation`, which will decide where a well is
emitted on the row and which CSS shows it, and `font`, which everything that
boxes a glyph now takes instead of reaching for Neanes.

The renames are moves, not copies: two declarations of one name across two
classic scripts is a load-time SyntaxError. The `.byz-*` picker classes become
`.sym-*`, which is a deliberate change to names byzantine-pickers.test.js
asserts on, so those assertions move in this commit.

byzantine-ui.js keeps only what is Byzantine: the three picker builders, the
martyria draft, and the ladder applied to the editor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 3: One grouped-list builder, and search

Design §4.3. One builder replaces the two hand-written single-value pickers, and gains a
search field — so the alteration and fthora pickers get search out of the box. The martyria
picker keeps its own two-column builder and gets no search field.

**Files:**
- Modify: `symbols-ui.js` (`buildGroupedPicker`, `normalizeForSearch`, `searchWords`,
  `matchesQuery`, `filterGroupedPicker`, the focus in `toggleWellPicker`)
- Modify: `byzantine-ui.js` (`buildAlterationPicker`, `buildFthoraPicker` become group specs)
- Modify: `style.css` (`.sym-search`, `.sym-empty`, the `[hidden]` rules)
- Create: `test/unit/symbol-search.test.js`
- Test: `test/integration/byzantine-pickers.test.js`

**Interfaces:**
- Produces:
  - `normalizeForSearch(text) → string` — lowercased, NFD, diacritics stripped
  - `searchWords(query) → string[]`
  - `matchesQuery(text, words) → boolean` — every word, any order, as a substring
  - `buildGroupedPicker(panel, spec)` where
    `spec = { kind, committed, font, groups, separatorAfter }` and
    `groups = [{ id, title, options: [{ id, glyph, label, mutedGlyph?, selected? }] }]`.
    `title` may be empty — then no heading is drawn (the fthora's two runs have none).
    `separatorAfter` is a group id or null.
  - `filterGroupedPicker(panel, query)` — toggles `hidden`; reads the spec back off the DOM.
- Consumes: `makeSymbolOption`, `symbolGroupTitle`, `centerPickerGlyphs`, `panelWell`.

---

- [ ] **Step 1: Write the failing unit test**

Create `test/unit/symbol-search.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

test("normalising text for search", async (t) => {
  await t.test("lowercases, so case never matters", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.normalizeForSearch("Quarter-Tone FLAT"), "quarter-tone flat");
  });

  await t.test("folds diacritics, so a Romanian or Turkish name is reachable from ASCII", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.normalizeForSearch("Răileanu"), "raileanu");
    assert.equal(h.app.normalizeForSearch("Büyük mücenneb"), "buyuk mucenneb");
    assert.equal(h.app.normalizeForSearch("Ţurkish"), "turkish");
  });
});

test("splitting a query into words", async (t) => {
  await t.test("drops the whitespace, however much of it there is", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.deepEqual(Array.from(h.app.searchWords("  quarter   FLAT ")), ["quarter", "flat"]);
  });

  await t.test("returns nothing for an empty query, which is what shows the whole list", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.deepEqual(Array.from(h.app.searchWords("   ")), []);
  });
});

test("matching a query against a label", async (t) => {
  await t.test("requires every word, in any order", () => {
    const h = loadApp();
    t.after(() => h.close());
    const label = "Three-quarter-tones flat (Grisey)";
    assert.equal(h.app.matchesQuery(label, ["quarter", "flat"]), true);
    assert.equal(h.app.matchesQuery(label, ["flat", "quarter"]), true, "word order must not matter");
    assert.equal(h.app.matchesQuery(label, ["quarter", "sharp"]), false, "every word must match");
  });

  await t.test("matches on substrings, so a partial word still narrows", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("Koma (sharp)", ["shar"]), true);
  });

  await t.test("folds the haystack too, not just the query", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("Küçük mücenneb (flat)", ["kucuk"]), true);
    assert.equal(h.app.matchesQuery("Küçük mücenneb (flat)", ["küçük"]), true);
  });

  await t.test("matches everything on an empty word list", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.matchesQuery("anything at all", []), true);
    assert.equal(h.app.matchesQuery("", []), true);
  });
});
```

- [ ] **Step 2: Write the failing integration test**

Append to `test/integration/byzantine-pickers.test.js`:

```js
test("the picker's search field", async (t) => {
  // Search lives in the shared grouped-list builder, so the alteration and the
  // fthora pickers get it for free. The martyria picker has its own two-column
  // builder and does not.
  for (const kind of ["alteration", "fthora"]) {
    await t.test(`gives the ${kind} picker a search field, focused when it opens`, () => {
      const h = loadApp();
      t.after(() => h.close());
      setNotation(h, "byzantine");

      const panel = openWell(h, noteRows(h)[0], kind);
      const search = panel.querySelector(".sym-search");

      assert.ok(search, "the picker has no search field");
      assert.equal(search.placeholder, "Search");
      assert.equal(h.document.activeElement, search, "the field must take focus when the panel opens");
    });
  }

  await t.test("gives the martyria picker no search field", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "martyria");
    assert.equal(panel.querySelector(".sym-search"), null, "two columns and a draft are not a list");
  });

  await t.test("shows the whole list for an empty query", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "alteration");
    const all = panel.querySelectorAll(".alteration-option").length;

    typeInto(h, panel.querySelector(".sym-search"), "");
    assert.equal(panel.querySelectorAll(".alteration-option:not([hidden])").length, all);
  });

  await t.test("keeps the options whose label matches, and hides the rest", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "alteration");
    typeInto(h, panel.querySelector(".sym-search"), "geniki");

    const visible = [...panel.querySelectorAll(".alteration-option:not([hidden])")].map(
      (option) => option.querySelector(".sym-label").textContent
    );
    assert.ok(visible.includes("None"), "None must always show — it is the only way to clear a well");
    for (const label of visible) {
      if (label === "None") continue;
      assert.match(label, /geniki/i);
    }
    assert.ok(visible.length > 1, "the two geniki must survive their own name");
  });

  await t.test("shows a whole group when its heading matches, options and all", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "alteration");
    const flats = panel.querySelectorAll('.alteration-option[data-group-of="flats"]').length;

    typeInto(h, panel.querySelector(".sym-search"), "flats");

    assert.equal(
      panel.querySelectorAll('.alteration-option[data-group-of="flats"]:not([hidden])').length,
      flats,
      "a heading match shows every option under it"
    );
    assert.equal(
      panel.querySelectorAll('.alteration-option[data-group-of="sharps"]:not([hidden])').length,
      0
    );
    assert.equal(panel.querySelector('.sym-group-title[data-group-of="sharps"]').hidden, true);
  });

  await t.test("says so when nothing matches", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "alteration");
    typeInto(h, panel.querySelector(".sym-search"), "zzz");

    const empty = panel.querySelector(".sym-empty");
    assert.equal(empty.hidden, false, "a list with no survivors must say so");
    assert.equal(empty.textContent, "No matches");
    assert.equal(panel.querySelectorAll('.alteration-option[data-group-of]:not([hidden])').length, 0);
  });

  await t.test("does not commit anything, however much is typed", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "alteration");
    typeInto(h, panel.querySelector(".sym-search"), "geniki");

    assert.equal(row.dataset.alteration, undefined, "typing is not a commit; clicking a row is");
    assert.ok(panel.classList.contains("open"), "typing must not close the panel either");
  });

  await t.test("does not redraw the chart on every keystroke", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    const panel = openWell(h, noteRows(h)[0], "alteration");
    h.ctx.reset();
    typeInto(h, panel.querySelector(".sym-search"), "geniki");

    assert.equal(
      h.ctx.callsOf("fillRect").length,
      0,
      "the search field must stop its input event reaching the editor's delegated listener"
    );
  });

  await t.test("keeps the fthora rule while both of its runs still have survivors", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa" });

    const panel = openWell(h, row, "fthora");
    typeInto(h, panel.querySelector(".sym-search"), "diatonic");

    const separator = panel.querySelector(".sym-separator");
    assert.equal(separator.hidden, false, "diatonic fthores survive on both sides of the rule");
  });

  await t.test("drops the fthora rule when a filter empties one of its runs", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa" });

    const panel = openWell(h, row, "fthora");
    // A fthora only the compatible run offers: nothing survives below the rule,
    // so a rule would separate a list from nothing.
    const compatible = panel.querySelector('.fthora-option[data-group-of="compatible"] .sym-label');
    typeInto(h, panel.querySelector(".sym-search"), compatible.textContent);

    assert.equal(panel.querySelector(".sym-separator").hidden, true);
  });
});
```

Add `pickMartyria` and `typeInto` to this file's `require` list if they are not already there.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/unit/symbol-search.test.js test/integration/byzantine-pickers.test.js`
Expected: FAIL — `normalizeForSearch is not a function`, and no `.sym-search` in any panel.

- [ ] **Step 4: Implement the matcher and the builder in `symbols-ui.js`**

Replace the `buildGroupedPicker` placeholder from Task 2 with:

```js
// ---------------------------------------------------------------------------
// Search.
//
// Pure functions, so the matching rule is testable without a picker: the query
// is lowercased, diacritic-folded and split on whitespace, and *every* word
// must be found as a substring, in any order — so "quarter flat" narrows where
// "quarter" alone does not. Folding both sides means `raileanu` reaches
// "Răileanu" and `kucuk` reaches "Küçük", which is the point: nobody types a
// breve to find a flat.
// ---------------------------------------------------------------------------

function normalizeForSearch(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function searchWords(query) {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

function matchesQuery(text, words) {
  const haystack = normalizeForSearch(text);
  return words.every((word) => haystack.includes(word));
}

// ---------------------------------------------------------------------------
// The grouped list.
//
// One builder for every single-value picker. Its spec is data:
//
//   { kind, committed, font, groups, separatorAfter }
//   groups: [{ id, title, options: [{ id, glyph, label, mutedGlyph, selected }] }]
//
// `title` may be empty, and then no heading is drawn — the fthora's compatible
// and other runs are separated by a rule, not by headings. Headings carry no
// `data-group`, so `pickerRevealTarget` finds no fallback and a list opens on
// its committed row, or at the top on None.
//
// Filtering toggles `hidden` rather than rebuilding: the accidental picker is
// 505 options and every glyph in it is ink-measured once, on open. That is also
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
  // The group titles are needed again when the query changes, and a panel is
  // torn down and rebuilt on every open, so they ride on the panel — the same
  // reason a row's symbols ride on the row.
  panel.dataset.groupTitles = JSON.stringify(
    spec.groups.map((group) => [group.id, group.title || ""])
  );
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
 * A category matches when every word is found in its title; the whole category
 * then shows, heading and all. Otherwise an option matches on its own label,
 * and its heading appears because at least one option under it survived. A rule
 * only separates two things, so it goes when either side of it empties.
 */
function filterGroupedPicker(panel, query) {
  const words = searchWords(query);
  const titles = JSON.parse(panel.dataset.groupTitles || "[]");
  const survivors = new Set();

  for (const [id, title] of titles) {
    const wholeGroup = matchesQuery(title, words);
    let any = false;
    for (const option of panel.querySelectorAll('.sym-option[data-group-of="' + id + '"]')) {
      const label = option.querySelector(".sym-label");
      const show = wholeGroup || matchesQuery(label ? label.textContent : "", words);
      option.hidden = !show;
      if (show) any = true;
    }
    const heading = panel.querySelector('.sym-group-title[data-group-of="' + id + '"]');
    if (heading) heading.hidden = !any;
    if (any) survivors.add(id);
  }

  for (const separator of panel.querySelectorAll(".sym-separator[data-separator-after]")) {
    const at = titles.findIndex(([id]) => id === separator.dataset.separatorAfter);
    const above = titles.slice(0, at + 1).some(([id]) => survivors.has(id));
    const below = titles.slice(at + 1).some(([id]) => survivors.has(id));
    separator.hidden = !(above && below);
  }

  const empty = panel.querySelector(".sym-empty");
  if (empty) empty.hidden = survivors.size > 0;
}
```

`makeSymbolOption` already reads `spec.mutedGlyph` conditionally, so passing `undefined` is
safe — no change there.

In `toggleWellPicker`, focus the field once the panel is open and placed:

```js
  panel.classList.add("open");
  row.classList.add("picker-open");
  revealPickerSelection(panel);
  keepPickerInView(panel);
  // Last, so bringing the field into focus cannot fight the scroll that just
  // put the committed row in view.
  const search = panel.querySelector(".sym-search");
  if (search) search.focus();
```

- [ ] **Step 5: Rebuild the two Byzantine pickers on it**

In `byzantine-ui.js`, replace `buildAlterationPicker` and `buildFthoraPicker` with group specs.
Their vocabularies and the fthora's compatibility logic are untouched; only the rendering moves.

```js
/**
 * None, then the ten signs of alteration under two headings.
 *
 * Flat, with no rule: every sign is offered on every note, so unlike the fthora
 * list there is nothing to be compatible with and nothing to separate.
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
```

- [ ] **Step 6: Style the search field and the hidden state**

Append to the `/* --- Symbol pickers --- */` section of `style.css`:

```css
/* The field sits above the scroller rather than inside it, so it holds still
   while the list moves under it and needs no sticky positioning. */
.sym-search {
  display: block;
  width: 100%;
  margin-bottom: 6px;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  background: var(--paper-fade);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--ink);
}

.sym-search::placeholder {
  color: var(--ink-faint);
  font-style: italic;
}

.sym-search:focus {
  outline: none;
  border-color: var(--ink);
  background: #fff;
  box-shadow: 0 0 0 3px var(--focus-glow);
}

.sym-empty {
  padding: 0.5rem;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  font-style: italic;
  color: var(--ink-faint);
}

/* `hidden` is how a filter narrows the list. The rules above give these
   elements a `display`, which would otherwise win over the attribute. */
.sym-option[hidden],
.sym-group-title[hidden],
.sym-separator[hidden],
.sym-empty[hidden] { display: none; }
```

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS. Watch particularly the existing fthora and alteration picker tests — the
rendering moved, so a heading, a rule or an option order that shifted shows up there.

- [ ] **Step 8: Commit**

```bash
git add symbols-ui.js byzantine-ui.js style.css \
  test/unit/symbol-search.test.js test/integration/byzantine-pickers.test.js
git commit -m "$(cat <<'EOF'
[#13] Build every single-value picker from one grouped list, with search

buildGroupedPicker takes a spec — kind, committed id, face, groups, an optional
rule — and the alteration and fthora pickers become two such specs. Their
vocabularies and the fthora's compatibility logic are untouched; only the
rendering moves.

The builder gains a search field, so both pickers get search out of the box and
the accidental picker will not need its own. A category matches on its title and
shows entire; otherwise an option matches on its label. Every query word must
match, in any order, folded for case and diacritics, so `raileanu` reaches
"Răileanu". None always shows — it is the only way to clear a well. Filtering
toggles `hidden` rather than rebuilding, because the accidental picker will be
505 ink-measured options.

Typing never commits, and the field stops its own input event so the chart is
not redrawn on every keystroke. The martyria picker keeps its two-column builder
and gets no search field.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 4: The accidental well

Design §3.6, §4.2, §4.4, §6.1, §7. The well itself: a row in the registry, a place on the note
row, a `data-accidental` attribute, a face to draw it in, and a hint when it is empty. Its
picker follows in Task 5, so tests here commit through `writeNoteSign` — the same way
`render.test.js` already sets a martyria with `h.app.writeMartyria`.

**Files:**
- Modify: `symbols-ui.js` (the registry gains its first Generic row)
- Modify: `app.js` (`makeNoteRowHTML`, `onNotationChange`, `readScaleData`, `loadSymbolFonts`)
- Modify: `index.html` (the two static note rows)
- Modify: `style.css` (`@font-face`, the well, the hint, the notation switch)
- Modify: `test/helpers/canvas-stub.js` (a SMuFL ink block, a Bravura-cut `U+0020`)
- Test: `test/integration/notation.test.js`

**Interfaces:**
- Consumes: `smuflFont`, `SMUFL_FONT_SIZE`, `resolveAccidentalGlyphs` (`smufl.js`);
  `writeNoteSign`, `readNoteSymbols`, `makeSymbolWellsHTML`, `refreshAllNoteRowWells`
  (`symbols-ui.js`).
- Produces:
  - `SYMBOL_WELLS[0]` — `{ kind: "accidental", notation: "generic", title: "Accidental",
    font: smuflFont(), build: …, resolve: resolveAccidentalGlyphs }`
  - `loadSymbolFonts() → Promise|null`, `symbolFontsReady` (replacing `loadByzantineFont`
    and `byzFontReady`)
  - `readScaleData()`'s note items carry `accidental`
  - `buildAccidentalPicker(panel, row)` — a stub in this task, filled in Task 5

---

- [ ] **Step 1: Teach the canvas stub how Bravura Text is cut**

`test/helpers/canvas-stub.js`. Add beside the existing ink constants:

```js
// Bravura Text's accidentals. Two things set them apart from Neanes' marks: a
// *real advance* (they are not combining marks), and ink sitting entirely above
// the baseline — measured in the research at +0.680 … +0.122 em for U+E262, so
// the descent is negative here as it is for a fthora. One span covers every
// accidental range the catalogue uses (U+E260–U+EE6F); it cannot collide with
// the Neanes blocks above, which all sit below U+E210.
const SMUFL_ACCIDENTAL_FIRST = 0xe260;
const SMUFL_ACCIDENTAL_LAST = 0xee6f;
const SMUFL_ACCIDENTAL_ASCENT_RATIO = 0.68;
const SMUFL_ACCIDENTAL_DESCENT_RATIO = -0.122;

// The ½ staff space an Evo pair is composed with: 100 font units of 1000
// against Bravura Text's 200-unit staff space. Modelled only for that face —
// every other font keeps an ordinary space, so no existing measurement moves.
const SMUFL_SPACE_ADVANCE_RATIO = 0.1;

function isSmuflFont(font) {
  return String(font).includes("Bravura Text");
}

function isSmuflAccidental(code) {
  return code >= SMUFL_ACCIDENTAL_FIRST && code <= SMUFL_ACCIDENTAL_LAST;
}
```

In `measureTextInk`, take the face into account. After `const chars = [...String(text)];` add:

```js
  const smufl = isSmuflFont(font);
```

In the per-character function, immediately after the `CARRIER_CODE` early return:

```js
    if (code === 0x20 && smufl) {
      // No ink, half a staff space of advance — which is what makes a composed
      // Evo pair measure exactly one gap wider than its two glyphs alone.
      pen += size * SMUFL_SPACE_ADVANCE_RATIO;
      return;
    }
```

And in the ink chain, as a new branch before the `octave === 0` case (order matters: the
SMuFL span sits above every Neanes block, so it can go last among the explicit blocks):

```js
    } else if (smufl && isSmuflAccidental(code)) {
      charTop = -size * SMUFL_ACCIDENTAL_ASCENT_RATIO;
      charBottom = size * SMUFL_ACCIDENTAL_DESCENT_RATIO;
```

Export the four new constants and both predicates from `module.exports`.

- [ ] **Step 2: Write the failing test**

Append to `test/integration/notation.test.js`:

```js
test("the accidental well", async (t) => {
  await t.test("sits on every note row, before the note name", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const row of noteRows(h)) {
      const wrapper = row.querySelector(".accidental-well-wrapper");
      assert.ok(wrapper, "a note row with no accidental well");
      assert.ok(wrapper.querySelector(".accidental-well"), "the wrapper holds no well");
      assert.ok(wrapper.querySelector(".accidental-picker"), "the wrapper holds no panel");
      assert.equal(
        wrapper.compareDocumentPosition(row.querySelector(".note-name")) &
          h.window.Node.DOCUMENT_POSITION_FOLLOWING,
        h.window.Node.DOCUMENT_POSITION_FOLLOWING,
        "the accidental is drawn left of the name, so it is emitted before it"
      );
    }
  });

  await t.test("orders the row accidental, name, then the Byzantine three", () => {
    const h = loadApp();
    t.after(() => h.close());

    const row = noteRows(h)[0];
    const marks = [
      ...row.querySelectorAll(
        ".accidental-well-wrapper, .note-name, .alteration-well-wrapper," +
          " .fthora-well-wrapper, .martyria-well-wrapper"
      ),
    ];
    assert.deepEqual(
      marks.map((el) => el.className),
      [
        "accidental-well-wrapper",
        "note-name",
        "alteration-well-wrapper",
        "fthora-well-wrapper",
        "martyria-well-wrapper",
      ],
      "every row carries both notations' controls always; CSS decides which half shows"
    );
  });

  await t.test("gives a new note the accidental well too", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 3);

    assert.ok(noteRows(h).at(-1).querySelector(".accidental-well"));
  });

  await t.test("stores an accidental as a data attribute and reads it back", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "raileanuPlusOneQuarterTone");

    assert.equal(row.dataset.accidental, "raileanuPlusOneQuarterTone");
    assert.equal(h.app.readNoteSymbols(row).accidental, "raileanuPlusOneQuarterTone");
  });

  await t.test("clears the well without disturbing the Byzantine three", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    h.app.writeAlteration(row, "diesis2");
    h.app.writeNoteSign(row, "accidental", "");

    assert.equal(row.dataset.accidental, undefined, "a stale attribute would be read back as set");
    assert.equal(row.dataset.alteration, "diesis2", "clearing one well must not touch another");
  });

  await t.test("survives a notation switch, so nothing is discarded", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    setNotation(h, "byzantine");
    setNotation(h, "generic");

    assert.equal(row.dataset.accidental, "accidentalSharp");
  });

  await t.test("survives the rebuild a scale-mode change causes", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    selectOption(h, "scale-mode", "absolute");

    assert.equal(noteRows(h)[0].dataset.accidental, "accidentalSharp");
  });

  await t.test("draws the accidental's glyphs in the well", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "sagittalEvoPlus4");

    const well = row.querySelector(".accidental-well");
    assert.equal(
      well.querySelector(".glyph-ink").textContent,
      String.fromCharCode(0xe305, 0x0020, 0xe262),
      "a composed accidental goes into the DOM whole, spacer included"
    );
    assert.ok(!well.classList.contains("is-empty"));
  });

  await t.test("marks the well empty again when it is cleared", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    h.app.writeNoteSign(row, "accidental", "");

    assert.ok(row.querySelector(".accidental-well").classList.contains("is-empty"));
  });

  // The well measures its glyph against the face it is drawn in. On an engine
  // whose measureText unions the ink with the advance rect, inkBox falls back
  // to drawing the sign on a scratch canvas and scanning it — and that draw
  // records the font, which is the one place the descriptor's face is visible
  // from a test.
  await t.test("measures its glyph in Bravura Text, not in Neanes", () => {
    const h = loadApp({ inkMetrics: "union" });
    t.after(() => h.close());

    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    const scanned = h.app.inkScanCanvas.getContext("2d").callsOf("fillText");
    assert.ok(scanned.length > 0, "the ink was never scanned, so nothing was measured");
    assert.equal(scanned.at(-1).state.font, h.app.smuflFont());
  });

  await t.test("carries the accidental on the note item readScaleData produces", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].accidental, "accidentalSharp");
    assert.equal(notes[1].accidental, "", "an empty well reads back as the empty string");
  });
});

test("the notation classes on the editor", async (t) => {
  await t.test("marks the editor Generic by default, and swaps the class on a switch", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Both classes exist because both halves of the row need one: Generic shows
    // the accidental well and the name box, Byzantine the other three.
    assert.ok(h.editor().classList.contains("notation-generic"));
    assert.ok(!h.editor().classList.contains("notation-byzantine"));

    setNotation(h, "byzantine");
    assert.ok(h.editor().classList.contains("notation-byzantine"));
    assert.ok(!h.editor().classList.contains("notation-generic"));
  });
});
```

Update the font-loading suite in the same file. `byzFontReady` → `symbolFontsReady`,
`loadByzantineFont` → `loadSymbolFonts`, and:

```js
  await t.test("preloads both faces the app draws symbols with", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      h.fontLoads.slice().sort(),
      [h.app.byzantineFont(h.app.BYZ_FONT_SIZE), h.app.smuflFont(h.app.SMUFL_FONT_SIZE)].sort(),
      "the faces preloaded must be the ones the chart draws with, or a font swap " +
        "preloads the wrong family and the first paint is blank boxes"
    );
  });

  await t.test("warns once per face that fails, naming it", async () => {
    const h = loadApp({ fonts: "reject" });
    t.after(() => h.close());

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(h.consoleWarnings.length, 2, "a silent failure leaves no way to find the cause");
    assert.ok(
      h.consoleWarnings.some((w) => /Neanes/.test(w)) &&
        h.consoleWarnings.some((w) => /Bravura Text/.test(w)),
      `each warning must name its own face, got ${h.consoleWarnings}`
    );
  });

  await t.test("redraws once, not once per face, when both have settled", async () => {
    const h = loadApp();
    t.after(() => h.close());
    const before = h.ctx.callsOf("fillRect").length;

    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(h.ctx.callsOf("fillRect").length > before, "the fallback-metrics paint was never replaced");
    assert.equal(h.app.symbolFontsReady, true);
  });
```

Replace the old `"redraws once the face has resolved"`, `"asks for the face the chart draws
with"` and `"warns when the face fails to load"` sub-tests with these; keep
`"boots without a FontFaceSet"` (asserting `h.app.loadSymbolFonts() === null`) and
`"keeps drawing when the face fails to load"` (asserting `symbolFontsReady === false`).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test test/integration/notation.test.js`
Expected: FAIL — there is no `.accidental-well-wrapper`, `notation-generic` is never set, and
`h.fontLoads` holds one spec.

- [ ] **Step 4: Add the accidental to the registry**

In `symbols-ui.js`, put it **first** in `SYMBOL_WELLS` — the table's order is the row's order,
and the accidental is drawn left of the name:

```js
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
    // …unchanged…
```

and add the builder, which Task 5 fills in:

```js
/** Built in Task 5. */
function buildAccidentalPicker(panel, row) {
  throw new Error("buildAccidentalPicker: not implemented yet");
}
```

`readNoteSymbols`, `NOTE_SYMBOL_ATTRS`, `refreshNoteRowWells`, `writeNoteSign`,
`noteSymbolAttrs` and `applyNoteSymbolAttrs` all loop the table, so they need **no change** —
that is the point of the registry.

- [ ] **Step 5: Put the well on the row, and the accidental in the data model**

`app.js`, `makeNoteRowHTML` (lines 249–262) — the generic wells, then the name, then the
Byzantine wells:

```js
function makeNoteRowHTML(degree, mode, absoluteValue) {
  const playBtn = '<button class="play-note" title="Play note">&#9654;</button>';
  const labelHtml = "<label>Note " + degree + "</label>";
  // Every row carries both notations' controls always, in the order the chart
  // draws them; CSS decides which half shows, so a switch discards nothing.
  const nameBlock =
    makeSymbolWellsHTML("generic") +
    '<input type="text" class="note-name" placeholder="name">' +
    makeSymbolWellsHTML("byzantine");
  if (mode === "absolute") {
    const isFirst = degree === 1;
    const val = isFirst ? getUnisonValue() : (absoluteValue !== undefined ? absoluteValue : "");
    const absInput = '<input type="text" class="absolute-interval" placeholder="' +
      getIntervalPlaceholder() + '" value="' + val + '"' + (isFirst ? " disabled" : "") + ">";
    return playBtn + labelHtml + absInput + '<span class="abs-cents-label"></span>' + nameBlock;
  }
  return playBtn + labelHtml + '<span class="cumulative-cents"></span>' + nameBlock;
}
```

`onNotationChange` (lines 95–98):

```js
function onNotationChange() {
  const byzantine = getNotation() === "byzantine";
  // Both classes, because both halves of a note row need one to key off: the
  // accidental well and the name box in Generic, the three wells in Byzantine.
  editor.classList.toggle("notation-byzantine", byzantine);
  editor.classList.toggle("notation-generic", !byzantine);
  render();
}
```

`readScaleData`'s note item (lines 370–376) gains one field:

```js
      items.push({
        type: "note",
        degree: degree,
        name: nameEl ? nameEl.value.trim() : "",
        accidental: symbols.accidental,
        alteration: symbols.alteration,
        fthora: symbols.fthora,
        martyria: symbols.martyria,
      });
```

`index.html` — both static note rows become (degree 1 shown; degree 2 is the same with
`Note 2`):

```html
        <div class="row note-row" data-degree="1">
          <button class="play-note" title="Play note">&#9654;</button>
          <label>Note 1</label>
          <span class="cumulative-cents"></span>
          <div class="accidental-well-wrapper">
            <button type="button" class="accidental-well is-empty" title="Accidental"></button>
            <div class="accidental-picker"></div>
          </div>
          <input type="text" class="note-name" placeholder="name">
          <div class="alteration-well-wrapper">
            <button type="button" class="alteration-well is-empty" title="Sign of alteration"></button>
            <div class="alteration-picker"></div>
          </div>
          <div class="fthora-well-wrapper">
            <button type="button" class="fthora-well is-empty" title="Fthora"></button>
            <div class="fthora-picker"></div>
          </div>
          <div class="martyria-well-wrapper">
            <button type="button" class="martyria-well is-empty" title="Martyria"></button>
            <div class="martyria-picker"></div>
          </div>
        </div>
```

- [ ] **Step 6: Load both faces**

`app.js` — `byzFontReady` (line 75) becomes `symbolFontsReady`, and `loadByzantineFont`
(lines 1351–1374) becomes:

```js
/**
 * Asks for both symbol faces and redraws once they have settled.
 *
 * PUA codepoints have no fallback glyph, so a chart drawn before a face
 * arrives shows blank boxes and measures with fallback metrics. The specs are
 * the ones the chart itself draws with — `byzantineFont()` and `smuflFont()`
 * are the only places the family names are written — so a font swap cannot
 * preload the wrong face. Guarded, because jsdom (and old browsers) have no
 * FontFaceSet.
 *
 * A face that never arrives is warned about *by name* and does not stop the
 * other: a missing or corrupt font file is otherwise invisible to anyone but
 * the person who vendored it, and one broken face must not blank the notation
 * that still works. The repaint happens once, when both have settled, not once
 * per face.
 */
function loadSymbolFonts() {
  const fonts = document.fonts;
  if (!fonts || typeof fonts.load !== "function") return null;

  const faces = [
    { name: "Neanes", spec: byzantineFont(BYZ_FONT_SIZE) },
    { name: "Bravura Text", spec: smuflFont(SMUFL_FONT_SIZE) },
  ];

  return Promise.all(
    faces.map(function (face) {
      return fonts.load(face.spec).then(
        function () {
          return true;
        },
        function (error) {
          console.warn("Symbols: the " + face.name + " face failed to load.", error);
          return false;
        }
      );
    })
  )
    .then(function (loaded) {
      return fonts.ready.then(function () {
        return loaded;
      });
    })
    .then(function (loaded) {
      symbolFontsReady = loaded.every(Boolean);
      // The wells stored an ink offset measured against fallback metrics, and
      // so did every cache behind them — a repaint that reused those would be
      // no repaint at all.
      resetInkMeasurements();
      refreshAllNoteRowWells();
      render();
    });
}
```

and the call at the foot of the file (line 1735) becomes `loadSymbolFonts();`.

- [ ] **Step 7: Style the well, the face and the notation switch**

`style.css`. Beside the Neanes `@font-face` at the top:

```css
@font-face {
  font-family: "Bravura Text";
  src: url("fonts/BravuraText.woff2") format("woff2");
  font-display: block;
}
```

The notation switch block (lines 393–412) becomes:

```css
/* Both sets of controls live on every note row; CSS decides which are visible,
   so a switch discards nothing. */
.note-row .accidental-well-wrapper,
.note-row .alteration-well-wrapper,
.note-row .fthora-well-wrapper,
.note-row .martyria-well-wrapper { display: none; }

#editor.notation-byzantine .note-row .note-name { display: none; }

#editor.notation-generic .note-row .accidental-well-wrapper,
#editor.notation-byzantine .note-row .alteration-well-wrapper,
#editor.notation-byzantine .note-row .fthora-well-wrapper,
#editor.notation-byzantine .note-row .martyria-well-wrapper {
  display: block;
  position: relative;
  flex: 0 0 auto;
}

/* .note-name used to carry the right-alignment; the leftmost *visible* element
   of the row's right-hand block takes it on, which is a different element in
   each notation. */
#editor.notation-generic .note-row .accidental-well-wrapper,
#editor.notation-byzantine .note-row .alteration-well-wrapper { margin-left: auto; }
```

Remove `margin-left: auto;` from `.note-row .note-name`.

Add `.accidental-well` to the shared well rule, the hover rule and the `.is-empty` dashed
rule, then give it its own face and size:

```css
/* The other face, and the one thing an Evo pair cannot do without: the U+0020
   spacer between a sagittal and its apotome is collapsed away by normal
   white-space handling, and the pair goes tight. (`ctx.fillText` needs nothing
   — a canvas paints the glyphs it is handed.) */
.accidental-well {
  font-family: "Bravura Text", serif;
  font-size: 30px;
  white-space: pre;
}
```

The hint — one pseudo-element, because these glyphs have real advances:

```css
.accidental-well.is-empty::before,
.alteration-well.is-empty::before,
.alteration-well.is-empty::after,
.fthora-well.is-empty::before {
  display: block;
  line-height: 1;
  color: var(--ink-faint);
}

/* accidentalFlat then accidentalSharp — the well's own vocabulary, drawn faint.
   Unlike Neanes' signs these carry real advances, so the pair is one string
   with the font's own spacing between them, and it needs no `white-space: pre`
   because there is no space in it. The transform is inkCenteringShiftEm()'s
   answer for that string in Bravura Text, read out of the app and written here
   because CSS cannot call it. Change the glyphs and you must read it out again. */
.accidental-well.is-empty::before {
  content: "\E260\E262";
  font-size: 30px;
  transform: translate(DXem, DYem);
}
```

**Read `DX` and `DY` out of the app**, do not guess them. Open `index.html` in a browser and
run in the console:

```js
const hint = String.fromCharCode(0xe260, 0xe262);   // accidentalFlat, accidentalSharp
const s = inkCenteringShiftEm(wellMeasuringContext(), hint, "center", null, smuflFont());
console.log(s.dx.toFixed(4) + "em", s.dy.toFixed(4) + "em");
```

The values are in em, so they are right at any font size; paste them into the rule.

Finally the picker panel (Task 5 fills it, but the styling belongs with the well):

```css
/* Add .accidental-picker to the panel rule, the .open rule and the body rule. */

/* The accidental well is the leftmost element of the row's right-hand block, so
   its panel opens rightward; the Byzantine wells sit at the row's right edge
   and theirs open leftward. */
.accidental-picker { left: 0; right: auto; max-width: 22rem; }

/* SMuFL descriptions run long ("5 comma up, (5C), 1° up [22 27 …] …"), so this
   one list wraps where the Byzantine lists never need to. */
.accidental-picker .sym-option { white-space: normal; }

.accidental-picker .sym-glyph {
  font-family: "Bravura Text", serif;
  font-size: 32px;
  white-space: pre;
}
```

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Verify the vendored font is still the upstream build**

```bash
shasum -a 256 fonts/BravuraText.woff2
```
Expected: `1f2711e9b554b7240edadc48edc2bece1a8b91118c6825fe7ff03ed1e07e1574`, the value in
`fonts/README.md`. A mismatch means the file was converted or subsetted, which the Reserved
Font Name forbids without a rename. This is a one-off check, not a test.

- [ ] **Step 10: Commit**

```bash
git add symbols-ui.js app.js index.html style.css \
  test/helpers/canvas-stub.js test/integration/notation.test.js
git commit -m "$(cat <<'EOF'
[#13] Give every note row an accidental well

The accidental is the registry's first Generic row, so the machinery that
already reads, writes, repaints and carries a well's sign across a rebuild picks
it up with no new branches: readNoteSymbols, NOTE_SYMBOL_ATTRS,
refreshNoteRowWells and applyNoteSymbolAttrs all loop the table.

The row now emits the Generic wells, then the name box, then the Byzantine
wells, and #editor carries notation-generic as well as notation-byzantine so
each half has a class to key off. readScaleData carries `accidental` on the note
item.

loadByzantineFont becomes loadSymbolFonts: it asks for both faces, warns per
face by name when one fails, and repaints once — not once per face — when both
have settled.

The canvas stub gains Bravura Text's shape: accidentals with a real advance and
ink entirely above the baseline, and a U+0020 cut as half a staff space, so a
composed Evo pair measures exactly one gap wider than its two glyphs alone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 5: The accidentals picker

Design §4.3, §4.5. `buildAccidentalPicker` supplies the 28 catalogue categories to the grouped
builder from Task 3 — that is the whole implementation. The work here is the test that 505
options behave.

**Files:**
- Modify: `symbols-ui.js` (`buildAccidentalPicker`)
- Modify: `test/helpers/harness.js` (`pickAccidental`, `searchPicker`)
- Create: `test/integration/accidental-picker.test.js`

**Interfaces:**
- Consumes: `buildGroupedPicker`, `panelWell` (`symbols-ui.js`);
  `SMUFL_ACCIDENTAL_CATEGORIES`, `resolveAccidentalGlyphs` (`smufl.js`).
- Produces (harness): `pickAccidental(h, row, id)`, `searchPicker(h, row, kind, query)`.

---

- [ ] **Step 1: Add the harness helpers**

`test/helpers/harness.js`. `pickSimpleSign` already builds the selector from the kind, so:

```js
function pickAccidental(harness, noteRow, accidentalId) {
  pickSimpleSign(harness, noteRow, "accidental", accidentalId);
}

/**
 * Opens a picker and types `query` into its search field, the way a user does.
 * Returns the panel, so a test can go straight to counting what survived.
 */
function searchPicker(harness, noteRow, kind, query) {
  const panel = openWell(harness, noteRow, kind);
  typeInto(harness, panel.querySelector(".sym-search"), query);
  return panel;
}
```

Export both.

- [ ] **Step 2: Write the failing test**

Create `test/integration/accidental-picker.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  noteRows,
  openWell,
  pickAccidental,
  searchPicker,
  dismissPicker,
  fireClick,
  setNotation,
} = require("../helpers/harness.js");

/** Every option that a filter has left visible, excluding the always-on None. */
function visibleOptions(panel) {
  return [...panel.querySelectorAll(".accidental-option[data-group-of]:not([hidden])")];
}

function visibleCategories(panel) {
  return [
    ...new Set(visibleOptions(panel).map((option) => option.dataset.groupOf)),
  ];
}

test("the accidentals picker", async (t) => {
  await t.test("opens when the well is clicked and closes when it is clicked again", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "accidental");
    assert.ok(panel.classList.contains("open"));

    fireClick(h, row.querySelector(".accidental-well"));
    assert.ok(!panel.classList.contains("open"));
  });

  await t.test("lists None first, then all 505 entries under 28 headings", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = openWell(h, noteRows(h)[0], "accidental");
    const options = [...panel.querySelectorAll(".accidental-option")];

    assert.equal(options[0].dataset.accidental, "", "None must be the first row");
    assert.equal(options.length, 506, "None plus the whole catalogue");
    assert.deepEqual(
      [...panel.querySelectorAll(".sym-group-title")].map((el) => el.textContent),
      Array.from(h.app.SMUFL_ACCIDENTAL_CATEGORIES, (c) => c.title),
      "every category gets a heading, in the catalogue's order"
    );
  });

  await t.test("shows each accidental's glyphs and its category's own label", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = openWell(h, noteRows(h)[0], "accidental");
    const option = panel.querySelector('.accidental-option[data-accidental="sagittalEvoPlus4"]');

    assert.equal(
      option.querySelector(".sym-glyph .glyph-ink").textContent,
      String.fromCharCode(0xe305, 0x0020, 0xe262),
      "a composed accidental previews whole, spacer included"
    );
    assert.equal(option.querySelector(".sym-label").textContent, "+4");

    // The same codepoint, a different category, a different label.
    assert.equal(
      panel.querySelector('.accidental-option[data-accidental="accidentalSharp"] .sym-label')
        .textContent,
      "Sharp"
    );
  });

  await t.test("writes the pick to the row and closes the panel in one click", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    pickAccidental(h, row, "raileanuMinusTwoThirdsTone");

    assert.equal(row.dataset.accidental, "raileanuMinusTwoThirdsTone");
    assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
  });

  await t.test("redraws the chart when an accidental is picked", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    pickAccidental(h, noteRows(h)[0], "accidentalSharp");

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("re-opens on the entry that was chosen, not on the first that draws it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    // U+E262 is an entry in three categories. Storing the entry id rather than
    // the glyph is what lets the picker know which one the user meant.
    pickAccidental(h, row, "sagittalEvoPlus6");
    const panel = openWell(h, row, "accidental");

    const selected = [...panel.querySelectorAll(".accidental-option.is-selected")];
    assert.deepEqual(
      selected.map((option) => option.dataset.accidental),
      ["sagittalEvoPlus6"]
    );
  });

  await t.test("clears the well when None is picked", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    pickAccidental(h, row, "accidentalSharp");
    pickAccidental(h, row, "");

    assert.equal(row.dataset.accidental, undefined);
    assert.ok(row.querySelector(".accidental-well").classList.contains("is-empty"));
  });

  for (const how of ["outside", "well"]) {
    await t.test(`commits nothing when the panel is dismissed by an ${how} click`, () => {
      const h = loadApp();
      t.after(() => h.close());
      const row = noteRows(h)[0];

      pickAccidental(h, row, "accidentalSharp");
      openWell(h, row, "accidental");
      dismissPicker(h, row, how, "accidental");

      assert.equal(row.dataset.accidental, "accidentalSharp", "a dismissal must change nothing");
      assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
    });
  }

  await t.test("keeps only one picker open at a time, across both notations", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    openWell(h, row, "accidental");
    setNotation(h, "byzantine");
    openWell(h, row, "fthora");

    assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
    assert.ok(row.querySelector(".fthora-picker").classList.contains("open"));
  });
});

test("searching the accidentals picker", async (t) => {
  await t.test("shows the ten Sagittal categories entire for `sagittal`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "sagittal");
    const categories = visibleCategories(panel);

    assert.equal(categories.length, 10, `expected the ten Sagittal categories, got ${categories}`);
    for (const id of categories) {
      const declared = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find((c) => c.id === id);
      assert.match(declared.title, /Sagittal/, `${id} has no Sagittal in its title`);
      assert.equal(
        panel.querySelectorAll(`.accidental-option[data-group-of="${id}"]:not([hidden])`).length,
        declared.accidentals.length,
        `a title match must show all of ${id}, not just some`
      );
    }
  });

  await t.test("shows the flats of every category that has one for `flat`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "flat");
    const visible = visibleOptions(panel);

    assert.equal(visible.length, 156, "every option whose label says flat, and no other");
    assert.equal(visibleCategories(panel).length, 18, "each under its own category heading");
    for (const option of visible) {
      assert.match(option.querySelector(".sym-label").textContent, /flat/i);
    }
    // The known, accepted consequence of labelling Răileanu by interval rather
    // than by SMuFL's description: the word "flat" never appears there.
    assert.equal(
      panel.querySelectorAll('.accidental-option[data-group-of="raileanuAccidentals"]:not([hidden])')
        .length,
      0
    );
  });

  await t.test("narrows to the quarter-tone flats for `quarter flat`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "quarter flat");
    const visible = visibleOptions(panel);

    assert.equal(visible.length, 21, "both words must match, so this is a strict subset of `flat`");
    for (const option of visible) {
      const label = option.querySelector(".sym-label").textContent.toLowerCase();
      assert.ok(label.includes("quarter") && label.includes("flat"), label);
    }
  });

  await t.test("folds diacritics, so `ţurkish` reaches the Turkish category", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "ţurkish");

    assert.deepEqual(visibleCategories(panel), ["turkishFolkMusicAccidentals"]);
    assert.equal(visibleOptions(panel).length, 8, "a title match shows the category entire");
  });

  await t.test("finds Răileanu from ASCII, and by an interval name", () => {
    const h = loadApp();
    t.after(() => h.close());

    const byName = searchPicker(h, noteRows(h)[0], "accidental", "raileanu");
    assert.deepEqual(visibleCategories(byName), ["raileanuAccidentals"]);
    assert.equal(visibleOptions(byName).length, 11);

    // The interval names are the only labels Răileanu has, so this is the only
    // way into that category — and the same words reach three other categories
    // that happen to say the same thing in their own vocabulary, which is the
    // point of matching labels rather than ids.
    const byInterval = searchPicker(h, noteRows(h)[1], "accidental", "2/3 tone");
    assert.deepEqual(
      visibleOptions(byInterval)
        .filter((option) => option.dataset.groupOf === "raileanuAccidentals")
        .map((option) => option.dataset.accidental),
      ["raileanuMinusTwoThirdsTone", "raileanuPlusTwoThirdsTone"]
    );
    assert.equal(visibleOptions(byInterval).length, 6);
    assert.deepEqual(visibleCategories(byInterval).sort(), [
      "raileanuAccidentals",
      "spartanSagittalMultiShaftAccidentals",
      "wyschnegradskyAccidentals72Edo",
    ].sort());
  });

  await t.test("says No matches when nothing survives", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "zzz");

    assert.equal(visibleOptions(panel).length, 0);
    assert.equal(panel.querySelector(".sym-empty").hidden, false);
    assert.equal(
      panel.querySelectorAll('.accidental-option[data-accidental=""]:not([hidden])').length,
      1,
      "None survives every filter — it is the only way to clear the well"
    );
  });

  await t.test("shows the whole catalogue again when the query is cleared", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "sagittal");
    typeInto(h, panel.querySelector(".sym-search"), "");

    assert.equal(visibleOptions(panel).length, 505);
    assert.equal(panel.querySelector(".sym-empty").hidden, true);
  });

  await t.test("commits the row that is clicked after a filter, not the one above it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    const panel = searchPicker(h, row, "accidental", "koron");
    const option = visibleOptions(panel)[0];
    fireClick(h, option);

    assert.equal(row.dataset.accidental, "accidentalKoron");
  });
});
```

Add `typeInto` to the `require` list.

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/integration/accidental-picker.test.js`
Expected: FAIL — `buildAccidentalPicker: not implemented yet`.

- [ ] **Step 4: Implement the builder**

In `symbols-ui.js`, replace the Task 4 stub:

```js
/**
 * None, then the whole SMuFL catalogue under 28 headings, with no rule.
 *
 * It lives here rather than in a notation's own file because it is not
 * Byzantine, and it is three lines because the grouped builder does the work:
 * a category is a group, an entry is an option, and the search comes free.
 *
 * 505 options are built and ink-measured on open — a thousand measureText calls
 * on Blink and Gecko, milliseconds; on WebKit inkBox falls back to
 * rasterise-and-scan, and 505 scans on first open may be visible. The results
 * are cached by face and text, so only the first open pays. If it is slow
 * enough to notice, render the category sections lazily as they scroll into
 * view — nothing about the data model or the search changes if it comes to that.
 */
function buildAccidentalPicker(panel, row) {
  buildGroupedPicker(panel, {
    kind: "accidental",
    committed: row.dataset.accidental || "",
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
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. If the `flat` or `quarter flat` counts differ, the catalogue changed — check
Task 1's counts before touching the matcher.

- [ ] **Step 6: Commit**

```bash
git add symbols-ui.js test/helpers/harness.js test/integration/accidental-picker.test.js
git commit -m "$(cat <<'EOF'
[#13] Add the accidentals picker

buildAccidentalPicker hands the 28 catalogue categories to the grouped builder,
so the well, the commit gesture, the dismissals and the search are the ones the
Byzantine pickers already use. That is the DRY the requirement asks for: one
list implementation, three vocabularies.

Because a row stores an entry id and not a glyph, the picker re-opens on the
entry the user actually chose — U+E262 is Standard's Sharp, Răileanu's +2/4 tone
and the top of the Evo ladder, and those are three different rows.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 6: Draw the accidental in the chart's sign gutter

Design §5. The gutter machinery is reused, not duplicated: an accidental goes exactly where a
fthora already goes — left of the diagram when vertical, above it when horizontal.

**Files:**
- Modify: `app.js:478-614` (`signRunOf`, `drawSignRun`, `drawSymbol`, `drawNoteLabel`) and
  `app.js:616-1073` (`drawLinesHorizontal`, `drawLinesVertical`, `render`)
- Test: `test/integration/render.test.js`

**Interfaces:**
- Produces:
  - `signRunOf(noteItem, notation) → string[]` — the degree's gutter signs, in reading order,
    derived from `SYMBOL_WELLS`
  - `symbolFontFor(notation) → string`
  - `drawSignRun(parts, x, y, align, vAlign, font)` (was `drawByzantineSigns`)
  - `drawSymbol(text, x, y, align, vAlign, font)` (was `drawByzantineMark`)
  - `drawNoteLabel(text, x, y, spec)` — `spec.symbolFont` replaces `spec.byzantine`: the face
    to draw the label in, or nothing for a typed name.

---

- [ ] **Step 1: Generalise the render tests' ink helpers**

`test/integration/render.test.js` already has `signInkBoxes(h)` and
`assertSignsFitTheCanvas(h)` (around lines 512–544), but both hard-wire the Neanes face when
they pick the sign draws out of the record. Give each the face as an argument, defaulting to
what they use today, so the Byzantine tests are untouched and a Generic chart can be checked
the same way:

```js
function signInkBoxes(h, font = byzFontOf(h)) {
  return h.ctx
    .callsOf("fillText")
    .filter((c) => c.state.font === font)
    // …the rest of the body is unchanged, with `font` in place of the local const…
}

function assertSignsFitTheCanvas(h, font = byzFontOf(h)) {
  const width = parseFloat(h.canvas().style.width);
  const height = parseFloat(h.canvas().style.height);
  const signs = signInkBoxes(h, font);
  // …unchanged…
  assert.ok(signs.length > 0, `no sign was drawn at all in ${font}`);
  // …unchanged…
}
```

Delete the now-shadowed `const font = byzFontOf(h);` line at the top of `signInkBoxes`.

- [ ] **Step 2: Write the failing test**

Append to `test/integration/render.test.js`. `drawnCall` matches on the drawn text alone and
needs no change.

```js
test("Generic notation with an accidental", async (t) => {
  const SHARP = "accidentalSharp";

  function genericChart(t, accidentals, options = {}) {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    if (options.orientation) selectOption(h, "orientation", options.orientation);
    if (options.style) selectOption(h, "chart-style", options.style);
    noteRows(h).forEach((row, i) => {
      if (accidentals[i]) h.app.writeNoteSign(row, "accidental", accidentals[i]);
    });
    h.ctx.reset();
    h.app.render();
    return h;
  }

  const smuflFontOf = (h) => h.app.smuflFont(h.app.SMUFL_FONT_SIZE);
  const glyphOf = (h, id) => h.app.resolveAccidentalGlyphs(id);

  await t.test("draws the accidental in Bravura Text at the SMuFL size", () => {
    const h = genericChart(t, [SHARP, null]);

    const call = drawnCall(h, glyphOf(h, SHARP));
    assert.equal(call.state.font, smuflFontOf(h), "the gutter run takes the notation's own face");
  });

  await t.test("draws no Byzantine glyph, whatever the Byzantine wells hold", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    h.app.writeNoteSign(noteRows(h)[0], "accidental", SHARP);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.ctx.reset();
    h.app.render();

    const byzFont = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    assert.equal(
      h.ctx.callsOf("fillText").filter((c) => c.state.font === byzFont).length,
      0,
      "a fthora set while Generic is selected belongs to the other notation"
    );
  });

  await t.test("keeps the typed note name, which the accidental does not replace", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"], { names: ["Pa", "Vou"] });
    h.app.writeNoteSign(noteRows(h)[0], "accidental", SHARP);
    h.ctx.reset();
    h.app.render();

    assert.ok(h.ctx.drawnText().includes("Pa"), "the name band is unchanged in Generic");
    assert.ok(h.ctx.drawnText().includes(glyphOf(h, SHARP)));
  });

  await t.test("puts the gutter on the left when vertical, one margin clear of the boxes", () => {
    const h = genericChart(t, [SHARP, null]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = glyphOf(h, SHARP);
    const box = h.app.inkBox(h.ctx, text, smuflFontOf(h));
    const call = drawnCall(h, text);

    // signAnchor = CANVAS_PADDING + gutter - TEXT_MARGIN, and the gutter is the
    // run's width plus one TEXT_MARGIN, so the anchor lands one run width in.
    closeTo(
      call.args[1] + box.right,
      CANVAS_PADDING + (box.right - box.left),
      1e-6,
      "the run is right-aligned at the gutter's inner edge"
    );
  });

  await t.test("grows the canvas by the gutter, exactly as Byzantine does", () => {
    const withSign = genericChart(t, [SHARP, null]);
    const plain = genericChart(t, [null, null]);

    const runWidth = (() => {
      const box = withSign.app.inkBox(withSign.ctx, glyphOf(withSign, SHARP), smuflFontOf(withSign));
      return box.right - box.left;
    })();

    closeTo(
      parseFloat(withSign.canvas().style.width) - parseFloat(plain.canvas().style.width),
      runWidth + withSign.app.TEXT_MARGIN,
      1e-6,
      "the gutter is the widest run plus one text margin"
    );
  });

  await t.test("draws exactly as today when no degree carries an accidental", () => {
    const withWells = genericChart(t, [null, null]);

    const plain = loadApp();
    t.after(() => plain.close());
    buildRelativeScale(plain, ["9/8"]);

    assert.equal(withWells.canvas().style.width, plain.canvas().style.width);
    assert.equal(
      withWells.canvas().style.height,
      plain.canvas().style.height,
      "a Generic chart must not reserve a gutter for signs it never draws"
    );
  });

  await t.test("keeps the first and last accidental whole in every chart", () => {
    for (const orientation of ["vertical", "horizontal"]) {
      for (const style of ["boxes", "lines"]) {
        const h = genericChart(t, [SHARP, SHARP], { orientation, style });
        assertSignsFitTheCanvas(h, smuflFontOf(h));
      }
    }
  });

  await t.test("puts the gutter above the chart when horizontal", () => {
    const h = genericChart(t, [SHARP, null], { orientation: "horizontal" });
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = glyphOf(h, SHARP);
    const box = h.app.inkBox(h.ctx, text, smuflFontOf(h));
    const call = drawnCall(h, text);

    closeTo(
      call.args[2] + box.bottom,
      CANVAS_PADDING + (box.bottom - box.top),
      1e-6,
      "the run is bottom-aligned at the gutter's inner edge"
    );
  });

  await t.test("measures a composed accidental wider than its two glyphs alone", () => {
    const pair = genericChart(t, ["sagittalEvoPlus4", null]);

    const composed = pair.app.inkBox(pair.ctx, glyphOf(pair, "sagittalEvoPlus4"), smuflFontOf(pair));
    const bare = pair.app.inkBox(
      pair.ctx,
      String.fromCharCode(0xe305, 0xe262),
      smuflFontOf(pair)
    );

    closeTo(
      composed.right - composed.left - (bare.right - bare.left),
      pair.app.SMUFL_FONT_SIZE * 0.1,
      1e-6,
      "the U+0020 spacer is half a staff space of real advance, and it must reach the canvas"
    );
  });
});

test("the gutter run's order across both notations", async (t) => {
  await t.test("is the order the wells appear on a note row", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The invariant is structural: signRunOf reads SYMBOL_WELLS, so the chart
    // cannot drift from the editor.
    const note = { accidental: "accidentalSharp", alteration: "diesis2", fthora: "diatonicPa" };

    assert.deepEqual(h.app.signRunOf(note, "generic"), [
      h.app.resolveAccidentalGlyphs("accidentalSharp"),
    ]);
    assert.deepEqual(h.app.signRunOf(note, "byzantine"), [
      h.app.resolveAlterationGlyph("diesis2"),
      h.app.resolveFthoraGlyph("diatonicPa"),
    ]);
  });

  await t.test("drops the wells a degree left empty", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(h.app.signRunOf({ accidental: "", alteration: "", fthora: "" }, "generic"), []);
    assert.deepEqual(
      h.app.signRunOf({ alteration: "", fthora: "diatonicPa" }, "byzantine"),
      [h.app.resolveFthoraGlyph("diatonicPa")],
      "a well the user left empty must not open a hole in the run"
    );
  });
});
```

Add `selectOption` to this file's `require` list if it is not already there.

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/integration/render.test.js`
Expected: FAIL — `signRunOf` takes one argument and always returns the Byzantine pair; nothing
in the Generic path draws a gutter.

- [ ] **Step 4: Generalise the sign run**

`app.js`. Replace `alterationTextOf`, `fthoraTextOf` and `signRunOf` (lines 470–492) with:

```js
/**
 * The signs a degree shows in the gutter, in reading order.
 *
 * Derived from `SYMBOL_WELLS`, filtered by notation, so the invariant is
 * structural rather than a comment: the chart draws a degree's signs left to
 * right in the order the editor puts the wells on its row. Reorder that table
 * and both follow.
 *
 * In Byzantine notation the run is the alteration and then the fthora — the
 * alteration first because it qualifies the fthora, which is how a psaltic
 * accidental is written. In Generic it is the one accidental. A degree carrying
 * only some of its wells draws those, in the same places: a well the user filled
 * must never draw nothing, and one left empty must never open a hole.
 */
function signRunOf(noteItem, notation) {
  return SYMBOL_WELLS
    .filter(function (well) {
      return well.notation === notation;
    })
    .map(function (well) {
      return noteItem[well.kind] ? well.resolve(noteItem[well.kind]) : "";
    })
    .filter(Boolean);
}

/** The face a notation draws its symbols in — the gutter's and the label's. */
function symbolFontFor(notation) {
  return notation === "byzantine" ? byzantineFont(BYZ_FONT_SIZE) : smuflFont(SMUFL_FONT_SIZE);
}
```

`martyriaTextOf` stays as it is.

Rename the two drawing functions (lines 576–597), which now take their face rather than
reaching for a constant — a run is homogeneous, so one font per run is enough:

```js
function drawSignRun(parts, x, y, align, vAlign, font) {
  const run = parts.filter(Boolean);
  if (run.length === 0) return;

  let penX = x;
  if (align === "center") penX = x - glyphRunExtent(run, font).width / 2;
  else if (align === "right") penX = x - glyphRunExtent(run, font).width;

  for (const text of run) {
    drawSymbol(text, penX, y, "left", vAlign, font);
    const box = inkBox(ctx, text, font);
    penX += box.right - box.left + BYZ_SIGN_GAP;
  }
}

function drawSymbol(text, x, y, align, vAlign, font) {
  if (!text) return;
  ctx.font = font;
  ctx.fillStyle = "#000";
  drawGlyphs(ctx, text, x, y, { align: align, vAlign: vAlign });
}

/**
 * Draws a note's label: a typed name in Generic notation, a martyria in
 * Byzantine. `spec` carries both anchorings so each chart path states its own;
 * `spec.symbolFont` is the face to draw a symbol label in, and nothing at all
 * for a typed name.
 */
function drawNoteLabel(text, x, y, spec) {
  if (!text) return;
  if (spec.symbolFont) {
    drawSymbol(text, x, y, spec.align, spec.vAlign, spec.symbolFont);
    return;
  }
  ctx.font = spec.font;
  ctx.fillStyle = "#000";
  ctx.textAlign = spec.textAlign;
  ctx.textBaseline = spec.textBaseline;
  ctx.fillText(text, x, y);
}
```

- [ ] **Step 5: Ungate the gutter in `render()`**

In `render()` (lines 771–930), replace the notation block. Every `byz.on` gate on a *draw* goes
away: `drawSignRun` returns early on an empty run, and `signRunOf` gives an empty run when a
notation has nothing in the gutter.

```js
  const notation = getNotation();
  const isByzantine = notation === "byzantine";
  const symbolFont = symbolFontFor(notation);
```

The interval loop's two sign fields lose their `isByzantine` guard:

```js
        signsBelow: signRunOf(note, notation),
        signsAbove: nextNote ? signRunOf(nextNote, notation) : [],
```

and `noteBelow`/`noteAbove` keep theirs — the martyria substitutes for a name only in
Byzantine.

The measurement block: the martyria measurement stays Byzantine-only, the **run measurement
moves out of the branch**, because a Generic scale can now carry one.

```js
  if (isByzantine) {
    // Measured every render: no measurement taken before the Neanes face
    // resolves is ever cached.
    const notes = maxInkExtent(
      intervals.flatMap((iv) => [iv.noteBelow, iv.noteAbove]),
      symbolFont
    );
    maxNoteWidth = notes.width;
    maxNoteHeight = notes.height;
  } else {
    ctx.font = font;
    for (const iv of intervals) {
      if (iv.noteBelow) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteBelow).width);
      if (iv.noteAbove) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteAbove).width);
    }
  }

  // Both notations put a run in the gutter, so this is measured for both. It is
  // 0×0 when no degree carries a sign, which is what keeps a scale with empty
  // wells drawing exactly as it did before there were any.
  const runs = maxRunExtent(
    intervals.flatMap((iv) => [iv.signsBelow, iv.signsAbove]),
    symbolFont
  );
  const maxRunWidth = runs.width;
  const maxRunHeight = runs.height;
```

(Delete the `let maxRunWidth = 0; let maxRunHeight = 0;` declarations above, and keep
`maxNoteWidth`/`maxNoteHeight` as `let`.)

The gutter, the anchor, the extent and the overhang:

```js
  const signGutter = isHorizontal
    ? (maxRunHeight > 0 ? maxRunHeight + TEXT_MARGIN : 0)
    : (maxRunWidth > 0 ? maxRunWidth + TEXT_MARGIN : 0);
  // The gutter is a band of its own along the left (vertical) or top
  // (horizontal) edge of the canvas. A degree's run is right- or
  // bottom-aligned at the band's far edge, one text margin clear of whatever
  // the chart lays out after it — the boxes, or the line chart's interval text.
  const signAnchor = CANVAS_PADDING + signGutter - TEXT_MARGIN;
  // The widest ink that any chart centres on an end separator: a martyria, a
  // gutter run, or — in Generic notation — a note name. The stack runs along x
  // when horizontal, so there it is the ink's width that matters, and its
  // height when vertical.
  const signExtent = isHorizontal
    ? Math.max(maxNoteWidth, maxRunWidth)
    : Math.max(maxNoteHeight, maxRunHeight);
  // What the end clearance actually protects. In Byzantine both the martyria
  // and the run are ink placed from measurement and centred on a separator. In
  // Generic the note name is ordinary text the chart has always let overflow
  // into the text area beside it, and an accidental must not silently change
  // that — so only the run is protected there.
  const overhangExtent = isByzantine
    ? signExtent
    : (isHorizontal ? maxRunWidth : maxRunHeight);
  // Three of the four charts start their stack one CANVAS_PADDING from the
  // edge, so they reserve only whatever ink overflows that padding, at both
  // ends, and the first and last sign are never clipped. (The horizontal line
  // chart instead starts half a sign *past* the padding — see drawLinesHorizontal.)
  const signOverhang = Math.max(0, overhangExtent / 2 - CANVAS_PADDING);
  const noteBandH = isByzantine ? byzantineNoteBandHeight(maxNoteHeight) : NOTE_TEXT_HEIGHT;
  const gutter = {
    size: signGutter,
    anchor: signAnchor,
    overhang: signOverhang,
    font: symbolFont,
  };
```

Rename the local `byz` object to `gutter` throughout, and `byz.gutter` to `gutter.size`. Every
`noteSpec` gains `symbolFont: isByzantine ? symbolFont : null` in place of
`byzantine: isByzantine`, and every call site becomes:

```js
      drawSignRun(iv.signsBelow, x, gutter.anchor, "center", "bottom", gutter.font);
```

(vertical charts: `drawSignRun(iv.signsAbove, gutter.anchor, segTopY, "right", "middle", gutter.font)`)

with the `if (isByzantine)` / `if (byz.on)` guards removed — there are eight such call sites,
two in each of the four chart paths. `drawLinesHorizontal` and `drawLinesVertical` take
`gutter` in place of `byz` and read `gutter.size`, `gutter.anchor`, `gutter.overhang` and
`gutter.font`.

`BYZ_SIGN_GAP` is unchanged and unused in Generic, where a run is one sign.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS — including every existing Byzantine geometry test, which is the point: the
gutter numbers for a Byzantine chart must not have moved by a pixel.

- [ ] **Step 7: Commit**

```bash
git add app.js test/integration/render.test.js
git commit -m "$(cat <<'EOF'
[#13] Draw a Generic accidental in the chart's sign gutter

Issue #13 puts the accidental left of the diagram when vertical and above it
when horizontal, which is exactly where a fthora already goes — so the gutter is
reused rather than duplicated. signRunOf now derives a degree's run from
SYMBOL_WELLS filtered by notation, which makes the editor/chart order invariant
structural instead of a comment, and the run's face is a parameter rather than a
constant: drawByzantineSigns and drawByzantineMark become drawSignRun and
drawSymbol, and drawNoteLabel's `byzantine` flag becomes `symbolFont`.

render()'s gutter measurement and layout now ask "does any degree carry a sign"
rather than "is this Byzantine". A Generic scale with no accidental therefore
measures and draws exactly as before — same canvas size, same coordinates —
which render.test.js asserts directly. The end clearance in Generic is sized
from the run alone: a note name is ordinary text the chart has always let
overflow, and an accidental must not change that.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 7: Line up the interval row under the note row

Design §6.2. The colour swatch moves before the label and grows to a well's size, so the
editor's right-hand column lines up in both notations.

**Files:**
- Modify: `app.js:265-281` (`makeIntervalRowHTML`)
- Modify: `index.html` (the static interval row)
- Modify: `style.css` (`:root` custom properties, the swatch, the cluster, the breakpoint)
- Test: `test/integration/editor.test.js`

---

- [ ] **Step 1: Write the failing test**

Append to `test/integration/editor.test.js`:

```js
test("the interval row's right-hand cluster", async (t) => {
  await t.test("puts the colour swatch before the label, under the well above it", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const row of intervalRows(h)) {
      const cluster = row.querySelector(".interval-label-cluster");
      assert.deepEqual(
        [...cluster.children].map((el) => el.className),
        ["color-picker-wrapper", "interval-label"],
        "the swatch sits under the leftmost well of the note row above it"
      );
    }
  });

  await t.test("keeps that order on a row the editor builds itself", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 3);

    const cluster = intervalRows(h).at(-1).querySelector(".interval-label-cluster");
    assert.deepEqual(
      [...cluster.children].map((el) => el.className),
      ["color-picker-wrapper", "interval-label"]
    );
  });

  await t.test("keeps that order after a scale-mode rebuild", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");

    const cluster = intervalRows(h)[0].querySelector(".interval-label-cluster");
    assert.deepEqual(
      [...cluster.children].map((el) => el.className),
      ["color-picker-wrapper", "interval-label"]
    );
  });

  await t.test("still opens the colour dropdown from its new place", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = intervalRows(h)[0];

    pickColor(h, row, h.app.getActivePalette()[3]);

    assert.equal(row.querySelector(".color-swatch").dataset.color, h.app.getActivePalette()[3]);
  });
});
```

`editor.test.js` already imports `pickColor`, `setNoteCount` and `selectOption`; nothing to add.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/integration/editor.test.js`
Expected: FAIL — the cluster's children are `["interval-label", "color-picker-wrapper"]`.

- [ ] **Step 3: Swap the two in the markup**

`app.js`, `makeIntervalRowHTML`:

```js
function makeIntervalRowHTML(value, mode) {
  const defaultColor = getActivePalette()[0];
  // Swatch first: it sits under the leftmost well of the note row above — the
  // accidental well in Generic, the alteration well in Byzantine — and the
  // label then fills the rest, lining up with the name box or with the fthora
  // and martyria pair. See docs/ARCHITECTURE.md, Scale Editor.
  const labelCluster =
    '<div class="interval-label-cluster">' +
      '<div class="color-picker-wrapper">' +
        '<button type="button" class="color-swatch" data-color="' + defaultColor + '" style="background:' + defaultColor + ';"></button>' +
        '<div class="color-dropdown"></div>' +
      '</div>' +
      '<input type="text" class="interval-label" placeholder="label">' +
    "</div>";
  if (mode === "absolute") {
    return '<span class="relative-cents-display"></span>' + labelCluster;
  }
  return '<input type="text" class="interval" placeholder="' +
    getIntervalPlaceholder() + '" value="' + value + '">' +
    '<span class="cents-label"></span>' +
    labelCluster;
}
```

`index.html`, the static interval row:

```html
        <div class="row interval-row">
          <input type="text" class="interval" placeholder="ratio" value="9/8">
          <span class="cents-label"></span>
          <div class="interval-label-cluster">
            <div class="color-picker-wrapper">
              <button type="button" class="color-swatch" data-color="#FFFFFF" style="background:#FFFFFF;"></button>
              <div class="color-dropdown"></div>
            </div>
            <input type="text" class="interval-label" placeholder="label">
          </div>
        </div>
```

- [ ] **Step 4: Make the two rows measure the same**

`style.css`. Add to `:root`, beside the colour tokens, the three sizes both rows are built
from — so the note row and the interval row cannot drift apart:

```css
  /* The editor's right-hand column. A note row lays out
     [well] gap [name box] in Generic and [well] gap [well] gap [well] in
     Byzantine; the interval row's cluster is [swatch] gap [label] and takes the
     same total width in each. */
  --well-size: 34px;
  --row-gap: 0.625rem;
  --name-box-width: 9rem;
```

Point the existing declarations at them: `.row { gap: var(--row-gap); }`,
`.note-row .note-name { width: var(--name-box-width); }`, and the shared well rule's
`width`/`height` become `var(--well-size)`.

Then the swatch and the cluster:

```css
.color-swatch {
  width: var(--well-size);
  height: var(--well-size);
  /* …the rest of the rule is unchanged… */
}

/* The cluster takes the width of the block above it, which is not the same in
   the two notations: Generic's is a well, a gap and the name box; Byzantine's
   is three wells and two gaps. The label is `flex: 1 1 auto`, so it fills
   whatever is left in each — no JavaScript decides this. */
.interval-row .interval-label-cluster {
  flex: 0 0 auto;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--row-gap);
  width: calc(var(--well-size) + var(--row-gap) + var(--name-box-width));
}

#editor.notation-byzantine .interval-row .interval-label-cluster {
  width: calc(var(--well-size) * 3 + var(--row-gap) * 2);
}
```

The cluster's `gap` was `0.4rem` and is now the row's own gap, so the swatch sits exactly
under the well above it.

In the narrow breakpoint (around line 1186), the cluster override becomes a smaller
`--name-box-width` rather than a hard-coded cluster width, so the two rows stay tied:

```css
  #editor {
    --name-box-width: 5.5rem;
    --well-size: 28px;
  }
```

and delete the `.interval-row .interval-label-cluster { width: 5.5rem; gap: 0.3rem; }` rule
that hard-coded it.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. `color-label-sync.test.js` and `palette.test.js` both drive the swatch through
`pickColor`, so they are the ones that would catch a broken dropdown anchor.

- [ ] **Step 6: Commit**

```bash
git add app.js index.html style.css test/integration/editor.test.js
git commit -m "$(cat <<'EOF'
[#13] Line the interval row up under the note row

The colour swatch moves before the label and grows from 22px to a well's 34px,
so it sits under the leftmost well of the note row above — the accidental well
in Generic, the alteration well in Byzantine — and the label lines up with the
name box or with the fthora and martyria pair.

The two blocks are not the same width in the two notations, so the cluster takes
a notation-dependent one off the class already on #editor. Both rows are now
built from the same three custom properties (--well-size, --row-gap,
--name-box-width), which is what stops them drifting apart. No JavaScript
decides any of it: the label is flex: 1 1 auto and fills whatever is left.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Task 8: Documentation

Design §9. No behaviour changes, so no test changes — this is the one task in the plan with no
red step.

**Files:**
- Create: `docs/SMUFL-ACCIDENTALS.md`
- Modify: `CLAUDE.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`,
  `docs/BYZANTINE-SYMBOLS.md`

---

- [ ] **Step 1: Write `docs/SMUFL-ACCIDENTALS.md`**

The maintainer's map of this layer, modelled on `docs/BYZANTINE-SYMBOLS.md`. Cover, in this
order:

1. **What an accidental is here** — an annotation the chart draws in the sign gutter. It never
   moves a degree; `getFrequencyForDegree()` does not know it exists.
2. **The catalogue's shape** — `{ id, title, accidentals: [{ id, codes, label }] }`, `codes`
   an array because an accidental is a *sequence*, and entries per category because one
   codepoint belongs to several with several labels. Ids unique across the whole catalogue;
   for the 26 SMuFL ranges the id *is* the canonical glyph name. A row stores the id, not the
   glyph, which is what lets the picker re-open on the entry the user chose.
3. **The generator** — `issues/013-generic-accidentals/build-accidentals.js`, the two metadata
   files and where to get them, `--write` and the markers, and that only its output ships.
4. **The 28 categories** — the table from design §3.2, and why two are not SMuFL ranges:
   Răileanu is the client's vocabulary, mixed Sagittal is Figure 2 of the Sagittal paper.
   Why Stein-Zimmermann (24-EDO) was added and chord-symbol accidentals left out.
5. **Why Răileanu's labels are interval names** — the category redefines two glyphs it
   borrows (U+E274, U+E2F5), so a SMuFL description there would state a pitch the category
   does not mean. And the accepted consequence: a search for `flat` does not reach it.
6. **The Evo spacer** — `U+0020` is Bravura Text's ½ staff space (100 units of a 200-unit
   staff space); SMuFL sets zero side bearings, so it is the only thing opening the gap. Any
   DOM element showing a composed accidental needs `white-space: pre`; `ctx.fillText` needs
   nothing.
7. **The ink model** — accidentals have real advances (unlike Neanes' combining marks) and
   ink entirely above the baseline, so `scanInkBox` is still needed on WebKit but
   `domGlyphText` adds no carrier. The measuring primitives live in `byzantine.js` and are
   shared, not Byzantine.
8. **Where the family name is written** — `SMUFL_FONT_FAMILY` in `smufl.js`, and the CSS rules
   that repeat it because CSS cannot read a constant: the `@font-face`, `.accidental-well`,
   `.accidental-picker .sym-glyph`. Plus the two numbers derived from the face:
   `SMUFL_FONT_SIZE` and the well/picker font sizes, and the empty-well hint's codepoints and
   its `inkCenteringShiftEm` offset — the one place outside the resolver where a codepoint is
   written by hand.
9. **Licensing** — do not subset, do not convert, do not link a CDN. The sha256 and where it
   is recorded.

- [ ] **Step 2: Update `CLAUDE.md`**

- The **Files** list: five scripts, in load order, with the reason each exists — `byzantine.js`
  (symbol model + the shared measuring primitives, no DOM), `smufl.js` (the accidental
  catalogue and its resolvers, no DOM), `symbols-ui.js` (wells and pickers, both notations),
  `byzantine-ui.js` (only what is Byzantine), `app.js` (everything else, last).
- Add `docs/SMUFL-ACCIDENTALS.md` to the same list.
- **Conventions**: "three classic scripts" becomes five, in that order, with the `file://`
  reason unchanged.
- **Architecture → Notation**: the Generic half now carries an accidental well; every note row
  carries a name input, an accidental well and the three Byzantine wells, and CSS decides
  which half shows.

- [ ] **Step 3: Update `docs/ARCHITECTURE.md`**

- **File Structure**: the two new scripts and the new doc, with one line each.
- **HTML Layout**: the note row's new shape — accidental well, name input, then the three
  Byzantine wells — and that `#editor` carries `notation-generic` or `notation-byzantine`.
- **Data Model**: `accidental` on a note item (an id from `SMUFL_ACCIDENTAL_CATEGORIES`, or
  `""`), and `data-accidental` in the list of the row's symbol attributes.
- **Scale Editor → Note row / Interval row**: the accidental well; the swatch before the label
  at a well's size, and the cluster's notation-dependent width.
- **Notation**: the section stops being Byzantine-only. The wells are rows in `SYMBOL_WELLS`
  (`symbols-ui.js`) that name a notation and a face; every single-value picker is built by
  `buildGroupedPicker` and has search; the martyria's stays bespoke and has none.
- **Chart Rendering → Sizing / Text layout**: the gutter and the overhang are no longer
  Byzantine-only — they are sized from whatever run the notation puts in them, `0` when no
  degree carries a sign. The note band stays Byzantine-only. In Generic the end clearance is
  sized from the run alone, not from the note name.

- [ ] **Step 4: Update `docs/TESTING.md`**

- **§4 Layout**: the three new test files, one line each.
- **§5 What is stubbed**: the `measureText` row gains Bravura Text's block — accidentals with
  a real advance and ink entirely above the baseline, and a `U+0020` cut as ½ staff space for
  that face only.
- **§5 Harness helpers**: `pickAccidental(h, row, id)` and `searchPicker(h, row, kind, query)`.
- The enforcement paragraph: `.claude/rules/testing.md`'s `paths:` now lists five scripts.

- [ ] **Step 5: Update `docs/BYZANTINE-SYMBOLS.md`**

- **§2**: a note that the measuring primitives that follow the tables — `inkBox`,
  `inkCenteringShift(Em)`, `drawGlyphs`, `domGlyphText`, `scanInkBox`, `freezeTable` — are
  shared, font-agnostic machinery that `smufl.js` and `symbols-ui.js` also use. They stay in
  this file because moving them would be a large diff unrelated to any feature.
- **§6 "Adding a second font"**: no longer hypothetical — point at
  `docs/SMUFL-ACCIDENTALS.md` as the worked example and keep the checklist. Update the CSS
  class names (`.byz-*` → `.sym-*`) and the well selector lists, which now include
  `.accidental-well`.
- **§11 "A gutter run"**: the run is no longer Byzantine — it is whatever `SYMBOL_WELLS` puts
  in the gutter for the current notation, one sign in Generic and up to two in Byzantine, and
  `drawByzantineSigns`/`drawByzantineMark` are now `drawSignRun`/`drawSymbol` and take a face.

- [ ] **Step 6: Update `README.md`**

- **Usage**: the page loads `style.css` and, in order, `byzantine.js`, `smufl.js`,
  `symbols-ui.js`, `byzantine-ui.js` and `app.js`.
- **Third-party assets**: add Bravura Text beside Neanes — Copyright © 2026 Steinberg Media
  Technologies GmbH, SIL Open Font License 1.1 **with Reserved Font Name "Bravura"**, linking
  `fonts/Bravura-OFL.txt` and `fonts/README.md`, and saying plainly that it must not be
  modified, subsetted or re-converted while keeping the name.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS — documentation only, so nothing may have moved.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md README.md docs/
git commit -m "$(cat <<'EOF'
[#13] Document the SMuFL accidentals layer

docs/SMUFL-ACCIDENTALS.md is the maintainer's map: the catalogue's shape and its
generator, the 28 categories and why two are not SMuFL ranges, why Răileanu's
labels differ from SMuFL's descriptions, the Evo spacer and the white-space: pre
it needs, the ink model, and every place the family name is written.

CLAUDE.md and README.md now say five scripts, in load order. ARCHITECTURE.md
carries the note row's new shape, `accidental` on the note item, and a gutter
that is no longer Byzantine-only. TESTING.md gains the new test files, the
Bravura Text ink block and the two harness helpers. BYZANTINE-SYMBOLS.md §6 is
no longer hypothetical and §2 says plainly that the measuring primitives are
shared machinery rather than Byzantine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_019zgH5SWegQXBMAktSCP4jr
EOF
)"
```

---

## Manual verification (Playwright, not committed)

Design §8.2. Required **in addition** to the suite, once every task is committed. It decides
numbers the suite cannot, because the test harness models font metrics rather than measuring
them. Browser-driving scripts are verification, not tests, and are not committed.

- [ ] Both notations × both orientations × both chart styles, with and without accidentals.
- [ ] **`SMUFL_FONT_SIZE`** (starts at 40) — an accidental beside a 24px note name and beside a
      Byzantine martyria. Adjust in `smufl.js` and say so in the commit.
- [ ] **The well and picker sizes** (start at 30px and 32px) — an accidental should clear its
      34px box by about 3px a side, the margin a martyria already has.
- [ ] **The Evo pairs' half-space gap** at well, picker and chart sizes, and that no DOM
      element collapses it. `sagittalEvoPlus4` is the one to look at.
- [ ] **The search field**: focus on open; the five queries of design §4.3 (`sagittal`, `flat`,
      `quarter flat`, `ţurkish`, `zzz`); and that typing commits nothing.
- [ ] **Alignment**: the swatch under the leftmost well, the label under the name box in
      Generic and under the fthora + martyria pair in Byzantine, and the colour dropdown still
      anchored correctly at 34px.
- [ ] **The empty-well hint** — its offset is read out of the app, so it can only be confirmed
      on screen.
- [ ] **The accidental picker's panel**: it opens rightward from the leftmost well, its 505
      rows scroll, and its width holds the longest SMuFL description without a horizontal
      scrollbar.
- [ ] **First-open time** of the accidental picker in a **WebKit** build (design §4.5). On
      WebKit `inkBox` falls back to rasterise-and-scan, and 505 scans on first open may be
      visible. Results are cached by face and text, so only the first open pays. If it is slow
      enough to notice, render the category sections lazily as they scroll into view — nothing
      about the data model or the search changes if that becomes necessary. Record the number
      either way.

---

## Self-review

**Spec coverage.** Design §2 → Tasks 1, 2 (files and load order, the rules path, the harness
script list). §3 → Task 1 (shape, catalogue, both special categories, generation, the face).
§4.1 → Task 2 (the moves and every rename). §4.2 → Tasks 2 and 4 (the registry, `notation`,
`font`, row order, class-name derivation). §4.3 → Tasks 3 and 5 (the grouped builder, search,
the three builders; the martyria keeps its own). §4.4 → Task 4 (the empty-well hint, one
pseudo-element, the offset read out of the app). §4.5 → Task 5 and the verification list (the
build cost, measured not designed around). §5 → Task 6 (the whole chart section). §6.1 → Task 4
(the note row and `margin-left: auto`). §6.2 → Task 7 (the interval row). §7 → Task 4 (the
`@font-face`, `loadSymbolFonts`, the sha256 check) and Task 8 (the README NOTICE). §8.1 → the
test file in every task. §8.2 → the verification list. §9 → Task 8. §10 → the Global
Constraints.

**Type consistency.** `signRunOf(noteItem, notation)` takes two arguments everywhere it is
defined, called and tested. `drawSignRun(parts, x, y, align, vAlign, font)` and
`drawSymbol(text, x, y, align, vAlign, font)` keep the argument order their predecessors had,
with the face appended. `setGlyphBoxText(box, text, placement, mutedText, font)`,
`fillWell(well, text, placement, font)` and `centerPickerGlyphs(panel, font)` all take the face
last, and `inkCenteringShiftEm(ctx, text, vAlign, range, font)` matches. `SYMBOL_WELLS` rows
carry exactly `{ kind, notation, title, font, build, resolve }` in Tasks 2, 4, 5 and 6.
`buildGroupedPicker`'s spec is `{ kind, committed, font, groups, separatorAfter }` in Task 3
and in both callers, and its group shape `{ id, title, options: [{ id, glyph, label,
mutedGlyph? }] }` in all three builders. `symbolFontsReady` and `loadSymbolFonts` replace
`byzFontReady` and `loadByzantineFont` in Task 4 and nowhere else names the old pair.

**Ordering.** Every task's dependencies land before it: `smufl.js` before the registry row that
calls `smuflFont()` at table-build time (Task 1 → 4); `symbols-ui.js` before the builder that
lives in it (2 → 3, 5); `buildGroupedPicker` before `buildAccidentalPicker` (3 → 5); the
registry row before the chart reads it (4 → 6); the canvas stub's SMuFL block before anything
measures a SMuFL glyph (4, used again in 6). Tasks 7 and 8 depend on everything before them
and on nothing after.
