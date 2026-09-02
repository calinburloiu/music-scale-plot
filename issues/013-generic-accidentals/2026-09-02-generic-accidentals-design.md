# Generic accidentals — design

Design for [issue #13, *Add support for generic accidentals*](https://github.com/calinburloiu/music-scale-plot/issues/13).

Sources this design rests on, and does not restate:

- [`issues/013-generic-accidentals/impl-prompt.md`](impl-prompt.md) — the requirement.
- [`issues/013-generic-accidentals/2026-09-01-smufl-accidentals-research.md`](2026-09-01-smufl-accidentals-research.md) — why Bravura Text, why it is vendored unmodified, how SMuFL glyphs compose, what the Sagittal Evo pairs are.
- [`issues/013-generic-accidentals/accidentals-demo.html`](accidentals-demo.html) — the glyphs rendered at real sizes; §2 is the spacing question this design answers with `U+0020`.
- [`docs/BYZANTINE-SYMBOLS.md`](../../docs/BYZANTINE-SYMBOLS.md) — the symbol machinery being generalised, especially §6 (adding a second font), §8 (where a sign sits in a box) and §11 (a gutter run).

---

## 1. What is being built

In **Generic** notation each note row gains an **Accidental well** to the left of its
name box. Clicking it opens an **Accidentals picker**: 28 categories, 505 entries, drawn
from the vendored Bravura Text (SMuFL) face. An accidental set on a degree is drawn on
the chart in the sign gutter — left of the diagram when vertical, above it when
horizontal — exactly where a Byzantine fthora is drawn today.

Three things ride along, because the requirement asks for them and because they are the
same code:

1. The well and picker machinery, today Byzantine-only, becomes **notation-agnostic**, so
   the accidental well is a row in a table rather than a second implementation.
2. That shared machinery gains **search**, which the alteration and fthora pickers
   therefore also get. The martyria picker does not (it is two columns and a draft, not a
   list).
3. The interval row's **colour swatch and label swap places**, and the swatch grows to a
   well's size, so the editor's right-hand column lines up in both notations.

### Decisions taken during brainstorming

| Question | Decision |
|---|---|
| Where the shared machinery lives | A new `symbols-ui.js`; five classic scripts in all (§2) |
| Which categories | 26 SMuFL ranges + 2 special = 28. Stein-Zimmermann (24-EDO) added; chord-symbol accidentals excluded (§3.2) |
| A natural in the special categories | Yes, both, at the zero point (§3.3, §3.4) |
| What search matches | Human label and category title; case- and diacritic-insensitive; all words must match (§4.3) |
| Where the accidental draws | Its own gutter band, per the issue; the note name keeps its place (§5) |
| How an accidental is identified | Per-category catalogue entries with ids; the row stores an id (§3.1) |
| Răileanu labels | The interval names verbatim — `−1/4 tone`, `+2/3 tone`, `Natural` (§3.3) |

---

## 2. Files and load order

`index.html` grows from three classic scripts to five. They still load with `defer`, in
document order, with no build step and no modules — the `file://` constraint in
`CLAUDE.md` is unchanged.

| Script | Holds | Touches the DOM |
|---|---|---|
| `byzantine.js` | Byzantine tables, resolvers, the ladder — and the font-agnostic measuring primitives (`freezeTable`, `inkBox`, `inkCenteringShift…`, `drawGlyphs`, `domGlyphText`, `measureTextReportsInk`, `scanInkBox`) | no |
| `smufl.js` *(new)* | The accidental catalogue, `smuflAccidentalById()`, `resolveAccidentalGlyphs()`, `smuflFont()` | no |
| `symbols-ui.js` *(new)* | `SYMBOL_WELLS`, well rendering and glyph boxing, picker open/commit/dismiss, the grouped-list builder, search | yes |
| `byzantine-ui.js` | Only what is Byzantine: the alteration, fthora and martyria picker builders, the martyria draft, the ladder applied to the editor | yes |
| `app.js` | Everything else. Runs at load time, so it stays last | yes |

**The measuring primitives stay in `byzantine.js`.** They are already font-agnostic —
`inkBox(ctx, text, font)` takes its face as an argument — and moving them would be a
large diff unrelated to this feature. `docs/BYZANTINE-SYMBOLS.md` §8 and §10 already
describe them as general machinery; §2 of that document gains a note saying so, and
`smufl.js` gains a header comment saying where they are.

**`SYMBOL_WELLS` lives in `symbols-ui.js`**, not in each notation's file, because it is
the single source of truth for the **order the wells appear on a note row**, which no
per-notation file can own. It therefore names `byzantine-ui.js`'s builders even though it
loads before them. That forward reference is safe and is the deferral `BYZ_SIMPLE_WELLS`
already uses today: `build:` is a wrapper function that calls the builder, so the name is
resolved when a well is clicked, not when the table is built.

Classic scripts share one global lexical environment, so no top-level name may be
declared in two of them — a duplicate is a load-time `SyntaxError` before any test runs.
The renames in §4.1 must therefore be moves, not copies.

### Paths that must follow

- `.claude/rules/testing.md` — add `smufl.js` and `symbols-ui.js` to `paths:`, or the
  testing guide stops loading when they are read.
- `test/helpers/harness.js` reads `<script src>` out of `index.html` in document order and
  builds its export epilogue from the union of every script's top-level names, so it needs
  **no change** — but `test/integration/harness.test.js`, which asserts on the script
  list, does.

---

## 3. The accidental model (`smufl.js`)

### 3.1 Shape

```js
const SMUFL_ACCIDENTAL_CATEGORIES = freezeTable([
  {
    id: "standardAccidentals12Edo",
    title: "Standard accidentals (12-EDO)",
    accidentals: freezeTable([
      { id: "accidentalFlat",  codes: [0xe260], label: "Flat" },
      { id: "accidentalSharp", codes: [0xe262], label: "Sharp" },
      // …
    ]),
  },
  // …
]);

function smuflAccidentalById(id)      // flat Map over every category, built once, lazily
function resolveAccidentalGlyphs(id)  // "" for an unknown id, else String.fromCharCode(...codes)
```

`codes` is an **array**, not a codepoint: an accidental is a *sequence*, which is what the
Sagittal Evo pairs need and what Extended Helmholtz-Ellis and Johnston would need next
(research §3, §7.1). Single-glyph entries are a one-element array, so nothing special-cases
length.

Entries are **per category**. The same codepoint therefore appears as several entries with
several labels — `U+E261` is `accidentalNatural` "Natural" in Standard, `raileanuNatural`
"Natural" in Răileanu, and `sagittalEvoZero` "0 (natural)" in mixed Sagittal. That is what
issue #13 means by "some accidentals (even with the same code point) may appear in more
than one group", and it is what lets the picker re-open on the entry the user actually
chose.

Ids are unique across the whole catalogue. For the 26 SMuFL ranges the id **is** the SMuFL
canonical glyph name, which is globally unique and stable; the two special categories use
their own ids, prefixed `raileanu…` and `sagittalEvo…`.

A note row stores `data-accidental="<entry id>"`. `readNoteSymbols()` reads it back as
`symbols.accidental`, alongside `alteration`, `fthora` and `martyria`; `readScaleData()`
carries it on the note item as `accidental`.

Rejected alternative: storing the glyph string on the row (`data-accidental="\uE262"`).
It draws without a lookup, but the picker can then no longer tell which category's entry
is selected, and ♯ is in three of them.

### 3.2 The catalogue

28 categories, in this order — the SMuFL site's order with the promotions the requirement
asks for. Counts are from SMuFL 1.4 `ranges.json`.

| # | Category | Range | Entries |
|---:|---|---|---:|
| 1 | Standard accidentals (12-EDO) | `U+E260`–`E26F` | 14 |
| 2 | **Răileanu accidentals** | *composed* | 11 |
| 3 | Arel-Ezgi-Uzdilek (AEU) accidentals | `U+E440`–`E44F` | 8 |
| 4 | Turkish folk music accidentals | `U+E450`–`E45F` | 8 |
| 5 | Arabic accidentals | `U+ED30`–`ED3F` | 9 |
| 6 | Persian accidentals | `U+E460`–`E46F` | 2 |
| 7 | **Mixed-symbol Sagittal accidentals (72-EDO)** | *composed* | 13 |
| 8 | Spartan Sagittal single-shaft accidentals | `U+E300`–`E30F` | 16 |
| 9 | Spartan Sagittal multi-shaft accidentals | `U+E310`–`E33F` | 38 |
| 10 | Athenian Sagittal extension (medium precision) accidentals | `U+E340`–`E36F` | 40 |
| 11 | Trojan Sagittal extension (12-EDO relative) accidentals | `U+E370`–`E38F` | 24 |
| 12 | Promethean Sagittal extension (high precision) single-shaft accidentals | `U+E390`–`E3AF` | 30 |
| 13 | Promethean Sagittal extension (high precision) multi-shaft accidentals | `U+E3B0`–`E3EF` | 64 |
| 14 | Herculean Sagittal extension (very high precision) accidental diacritics | `U+E3F0`–`E3F3` | 4 |
| 15 | Olympian Sagittal extension (extreme precision) accidental diacritics | `U+E3F4`–`E3F7` | 4 |
| 16 | Magrathean Sagittal extension (insane precision) accidental diacritics | `U+E3F8`–`E41F` | 20 |
| 17 | Gould arrow quartertone accidentals (24-EDO) | `U+E270`–`E27F` | 12 |
| 18 | **Stein-Zimmermann accidentals (24-EDO)** | `U+E280`–`E28F` | 6 |
| 19 | Extended Stein-Zimmermann accidentals | `U+E290`–`E29F` | 13 |
| 20 | Sims accidentals (72-EDO) | `U+E2A0`–`E2AF` | 6 |
| 21 | Johnston accidentals (just intonation) | `U+E2B0`–`E2BF` | 8 |
| 22 | Extended Helmholtz-Ellis accidentals (just intonation) | `U+E2C0`–`E2FF` | 60 |
| 23 | Extended Helmholtz-Ellis accidentals (just intonation) supplement | `U+EE50`–`EE5F` | 10 |
| 24 | Wyschnegradsky accidentals (72-EDO) | `U+E420`–`E43F` | 22 |
| 25 | Medieval and Renaissance accidentals | `U+E9E0`–`E9EF` | 6 |
| 26 | Stockhausen accidentals (24-EDO) | `U+ED50`–`ED5F` | 15 |
| 27 | Other accidentals | `U+E470`–`E49F` | 32 |
| 28 | Other accidentals supplement | `U+EE60`–`EE6F` | 10 |

**481 SMuFL entries + 24 in the two special categories = 505.**

Two deliberate departures from the list in `impl-prompt.md`:

- **Stein-Zimmermann accidentals (24-EDO)** (row 18) is added. The prompt lists *Extended*
  Stein-Zimmermann but not the range it extends; the SMuFL site orders the base range
  immediately before it, and shipping an extension without its base is a gap, not a
  choice.
- **Standard accidentals for chord symbols** (`U+ED60`–`ED6F`, 7 glyphs) stays out. It is
  typography for chord labels, not pitch inflection, and the prompt does not list it.

A category's entries keep the SMuFL range's own glyph order, and each entry's label is the
`glyphnames.json` `description` verbatim — the same text the SMuFL tables show, so a
reader who knows the tables recognises the row.

Codepoints inside a range are **not contiguous** (Magrathean is 20 glyphs across 40 slots),
so every codepoint is written out. No entry is derived from a base plus an index.

### 3.3 Răileanu accidentals

The client's accidentals for Byzantine and Near/Middle Eastern (maqam) music: mostly
Arel-Ezgi-Uzdilek, with additions. Order and codepoints exactly as `impl-prompt.md` gives
them, with `accidentalNatural` inserted at the zero point.

| id | label | codes | Borrowed from |
|---|---|---|---|
| `raileanuMinusOneQuarterTone` | `−1/4 tone` | `U+E443` | AEU koma flat |
| `raileanuMinusTwoQuarterTones` | `−2/4 tone` | `U+E442` | AEU bakiye flat |
| `raileanuMinusThreeQuarterTones` | `−3/4 tone` | `U+E440` | AEU büyük mücenneb flat |
| `raileanuMinusOneThirdTone` | `−1/3 tone` | `U+E441` | AEU küçük mücenneb flat |
| `raileanuMinusTwoThirdsTone` | `−2/3 tone` | `U+E2F5` | Helmholtz-Ellis quarter flat |
| `raileanuNatural` | `Natural` | `U+E261` | Standard natural |
| `raileanuPlusOneQuarterTone` | `+1/4 tone` | `U+E444` | AEU koma sharp |
| `raileanuPlusTwoQuarterTones` | `+2/4 tone` | `U+E445` | AEU bakiye sharp |
| `raileanuPlusThreeQuarterTones` | `+3/4 tone` | `U+E446` | AEU küçük mücenneb sharp |
| `raileanuPlusOneThirdTone` | `+1/3 tone` | `U+E274` | Gould three-quarter-tones sharp |
| `raileanuPlusTwoThirdsTone` | `+2/3 tone` | `U+E283` | Stein one-and-a-half sharps |

**The labels are the interval names, not SMuFL's descriptions, and that is load-bearing.**
This category *redefines* the glyphs it borrows: `U+E274` is SMuFL's "Three-quarter-tones
sharp" but Răileanu's +1/3 tone, and `U+E2F5` is "Lower by one equal tempered quarter-tone"
but Răileanu's −2/3 tone. Printing the SMuFL description in this category would state a
pitch the category does not mean.

Known consequence, accepted: because the words "flat" and "sharp" never appear in these
labels, a search for `flat` does not reach this category. `răileanu`, `raileanu` (search is
diacritic-folded), `tone`, `1/4` and `natural` all do.

### 3.4 Mixed-symbol Sagittal accidentals (72-EDO)

The thirteen degrees of 72-EDO in the Sagittal *Evo* (mixed-symbol) flavour, from
[the Sagittal paper](https://www.sagittal.org/sagittal.pdf) p. 4, Figure 2, last row. Evo
keeps ♯ and ♭ and puts a single-shaft sagittal to their left to adjust the apotome;
research §3 explains why SMuFL precomposes only the *Revo* flavour, so four of the thirteen
are a two-glyph sequence.

| id | label | codes |
|---|---|---|
| `sagittalEvoMinus6` | `−6 (flat)` | `U+E260` |
| `sagittalEvoMinus5` | `−5` | `U+E302` `U+0020` `U+E260` |
| `sagittalEvoMinus4` | `−4` | `U+E304` `U+0020` `U+E260` |
| `sagittalEvoMinus3` | `−3` | `U+E30B` |
| `sagittalEvoMinus2` | `−2` | `U+E305` |
| `sagittalEvoMinus1` | `−1` | `U+E303` |
| `sagittalEvoZero` | `0 (natural)` | `U+E261` |
| `sagittalEvoPlus1` | `+1` | `U+E302` |
| `sagittalEvoPlus2` | `+2` | `U+E304` |
| `sagittalEvoPlus3` | `+3` | `U+E30A` |
| `sagittalEvoPlus4` | `+4` | `U+E305` `U+0020` `U+E262` |
| `sagittalEvoPlus5` | `+5` | `U+E303` `U+0020` `U+E262` |
| `sagittalEvoPlus6` | `+6 (sharp)` | `U+E262` |

Degrees are twelfths of a tone, so ±6 is a semitone — hence the parenthesised ♭/♯ on the
outer two and `natural` on the middle one, which are also what make the ladder's ends
reachable by an obvious search.

**`U+0020` is the ½ staff space** the requirement asks for: 100 font units against Bravura
Text's 200-unit staff space (research §1). SMuFL sets zero side bearings, so without a
spacer the two glyphs abut exactly at the ink; the space is the only thing opening the gap.

Two consequences that must not be forgotten:

- Any DOM element that shows a composed accidental needs **`white-space: pre`**, or the
  space is collapsed away and the pair goes tight. That is the well and the picker's glyph
  box. (Not the empty-well hint — §4.4, whose two glyphs carry no space between them.)
- `ctx.fillText()` needs nothing — a canvas paints the glyphs it is handed.

### 3.5 Generation

The 481 SMuFL entries are **generated, not typed**. A script
`issues/013-generic-accidentals/build-accidentals.js` reads SMuFL 1.4 `ranges.json` and
`glyphnames.json` and emits the `SMUFL_ACCIDENTAL_CATEGORIES` literal; the two special
categories are hand-written data in the script, since they are not SMuFL ranges.

- The script is **committed as research tooling**, next to the research document, so the
  table can be regenerated when SMuFL moves.
- Its **output is committed** as part of `smufl.js`, under a header naming the SMuFL
  version, the source files and the script. The app still has no build step; nothing runs
  at page load but the app's own scripts.
- The script is not part of `npm test` and adds no dependency: it reads two JSON files
  with `require`.

### 3.6 The face

```js
const SMUFL_FONT_FAMILY = '"Bravura Text"';
const SMUFL_FONT_SIZE = 40;          // chart size; tuned in the Playwright pass
function smuflFont(size) { return (size || SMUFL_FONT_SIZE) + "px " + SMUFL_FONT_FAMILY + ", serif"; }
```

The family name is written **once in JavaScript**, exactly as `BYZ_FONT_FAMILY` is, so a
font swap has one place to change. `style.css` repeats it because CSS cannot read it;
`docs/SMUFL-ACCIDENTALS.md` lists every place, as `docs/BYZANTINE-SYMBOLS.md` §6 does for
Neanes.

`SMUFL_FONT_SIZE` starts at 40 to match `BYZ_FONT_SIZE` and is **tuned by eye** in the
verification pass of §8.2: a Bravura Text accidental's ink spans about 0.56 em where a
martyria's spans far more, so the two faces do not look the same size at the same size.
The number that ships is whatever looks right beside a 24 px note name.

---

## 4. Shared wells and pickers (`symbols-ui.js`)

### 4.1 What moves, and what it is called

Moved out of `byzantine-ui.js` unchanged in behaviour: `wellWrapperHTML`,
`makeSymbolWellsHTML`, `readNoteSymbols`, `writeNoteSign`, `noteSymbolAttrs`,
`applyNoteSymbolAttrs`, `wellMeasuringContext`, `setGlyphBoxText`, `glyphLayer`,
`fillWell`, `centerPickerGlyphs`, `glyphBoxPlacement`, `refreshNoteRowWells`,
`refreshAllNoteRowWells`, `readPickerScroll`, `restorePickerScroll`, `scrollTopToReveal`,
`pickerRevealTarget`, `revealPickerSelection`, `keepPickerInView`, `toggleWellPicker`,
and the click router.

Renames, all of them moves rather than copies (two declarations of one name across two
classic scripts is a load-time `SyntaxError`):

| Today | Becomes |
|---|---|
| `BYZ_SIMPLE_WELLS` | `SYMBOL_WELLS` |
| `BYZ_WELL_KINDS` | `SYMBOL_WELL_KINDS` |
| `byzSelector()` | `wellSelector()` |
| `makeByzOption()` | `makeSymbolOption()` |
| `byzGroupTitle()` / `byzColumnTitle()` | `symbolGroupTitle()` / `symbolColumnTitle()` |
| `closeByzantinePickers()` | `closeSymbolPickers()` |
| `selectByzantineOption()` | `selectSymbolOption()` |
| `handleByzantineClick()` | `handleSymbolClick()` |
| CSS `.byz-option`, `.byz-glyph`, `.byz-label`, `.byz-group-title`, `.byz-column-title`, `.byz-separator` | `.sym-option`, `.sym-glyph`, `.sym-label`, `.sym-group-title`, `.sym-column-title`, `.sym-separator` |

`.martyria-*` classes keep their names — the martyria genuinely is Byzantine. `app.js`'s
call sites (`closeAllDropdowns`, the editor click listener, `refreshAllNoteRowWells` after
the fonts load) follow the renames.

### 4.2 The registry

```js
const SYMBOL_WELLS = freezeTable([
  { kind: "accidental", notation: "generic",   title: "Accidental",
    font: smuflFont(),     build: …, resolve: resolveAccidentalGlyphs },
  { kind: "alteration", notation: "byzantine", title: "Sign of alteration",
    font: byzantineFont(), build: …, resolve: resolveAlterationGlyph },
  { kind: "fthora",     notation: "byzantine", title: "Fthora",
    font: byzantineFont(), build: …, resolve: resolveFthoraGlyph },
]);
```

Two fields are new: `notation`, which decides where the well is emitted on the row and
which CSS shows it, and `font`, which everything that boxes a glyph now takes instead of
reaching for `byzantineFont(BYZ_FONT_SIZE)`. The martyria stays out of the table for the
reasons the current comment gives — two columns, a draft, a ladder — but stays in
`SYMBOL_WELL_KINDS`.

`font` carries no separate size, and the size in the string does not have to be the size on
screen: `setGlyphBoxText` measures at whatever size the spec names and
`inkCenteringShiftEm` returns the offset **in em**, so one measurement is correct for the
34 px well and the picker row alike. CSS still owns the displayed size, exactly as it does
today.

The class-name derivation is unchanged: a well of kind `k` is `.k-well` inside
`.k-well-wrapper`, its panel is `.k-picker` with a `.k-picker-body`, and its rows are
`.k-option` carrying `data-k`. So the accidental well needs no new naming rule.

**Row order.** `makeNoteRowHTML()` emits the generic wells, then the name input, then the
Byzantine wells:

```
play · degree · cumulative-cents · [accidental] · note-name · [alteration] [fthora] [martyria]
```

Every row carries all of them always, and CSS decides which half shows — the existing rule,
so a notation switch still discards nothing. `index.html`'s two static rows are updated to
match.

### 4.3 The grouped list builder, and search

One builder replaces the two hand-written single-value pickers:

```js
buildGroupedPicker(panel, {
  kind,               // "accidental" | "alteration" | "fthora"
  committed,          // the row's current id, "" for none
  font, size,         // the well's face
  groups,             // [{ id, title, options: [{ id, glyph, label }] }]
  separatorAfter,     // group id after which a rule is drawn, or null
  searchable,         // true for all three; the martyria never calls this
})
```

- `buildAlterationPicker` supplies two groups, `Sharps` and `Flats`.
- `buildFthoraPicker` supplies two groups — the fthores compatible with the row's martyria
  note, then the rest — with a rule between them, and one flat group when the row has no
  martyria. Its existing compatibility logic is untouched; only the rendering moves.
- `buildAccidentalPicker` (new, in `symbols-ui.js` — it is not Byzantine) supplies the 28
  catalogue categories.

Group headings carry no `data-group`, so `pickerRevealTarget` finds no fallback and a list
opens on its committed row, or at the top on None — today's behaviour.

**Search** is a text input pinned at the top of the panel, sticky above the scroller,
focused when the picker opens, with placeholder `Search`.

Matching:

- The query is lowercased, **diacritic-folded** (`normalize("NFD")`, strip
  `\p{Diacritic}`) and split on whitespace.
- **Every** query word must match, in any order, as a substring — so `quarter flat`
  narrows where `quarter` alone does not.
- A **category matches** when every word is found in its normalised title. The whole
  category then shows: heading and all its options.
- Otherwise an **option matches** when every word is found in its normalised label. It
  shows under its category's heading; the heading appears because at least one of its
  options survived.
- The **None** row always shows — it is the only way to clear a well.
- An empty query renders exactly today's full list.
- No survivors renders a quiet `No matches` line in place of the list.

Worked examples, which are also the tests:

| Query | Result |
|---|---|
| `sagittal` | the 10 categories with "Sagittal" in the title (rows 7–16 of §3.2), each entire |
| `flat` | ♭, ♭♭, ♭♭♭, quarter-tone flats, three-quarter-tone flats … each under its own category heading |
| `quarter flat` | only the quarter-tone flats |
| `ţurkish` | Turkish folk music accidentals, entire (diacritic-folded) |
| `zzz` | `No matches` |

The matcher is a **named top-level pure function** — `matchesQuery(text, words)` and
`normalizeForSearch(text)` — so it is unit-testable without a picker. Typing never commits;
clicking a row is still the only commit, and the dismissal gestures are unchanged.

The martyria picker keeps its own two-column builder and gets no search field.

### 4.4 The empty accidental well

An empty well says which sign it takes, the way the alteration and fthora wells do. The
accidental's hint is **a flat and a sharp**, `U+E260` and `U+E262`, drawn faint.

Unlike Neanes' signs these have real advances, so the pair is **one string with the font's
own spacing** — a single `::before`, like the fthora hint, not the alteration hint's two
pseudo-elements. Its transform is `inkCenteringShiftEm()`'s answer for that string, read
out of the app and written into `style.css` because CSS cannot call it; the existing
comment's rule ("change a hint's glyphs and you must read its shift out again") applies
unchanged. It also needs no `white-space: pre` — there is no space in it.

### 4.5 Known risk: picker build cost

The accidental picker builds **505 options** on open, and `centerPickerGlyphs` measures
each glyph's ink.

- On Blink and Gecko that is roughly a thousand `measureText` calls — milliseconds.
- On WebKit `inkBox` falls back to rasterise-and-scan. `measureText` there reports the ink
  unioned with the advance rect and the baseline, and a Bravura Text accidental's ink sits
  *entirely above* the baseline (research §1: `U+E262` spans +0.680 … +0.122 em), which is
  exactly the case that union destroys. So the scan path is needed, and 505 scans on first
  open may be visibly slow. Results are cached in `scannedInkBoxes` by face and text, so
  only the first open pays.

**This is measured, not designed around.** The Playwright pass of §8.2 times the first
open in a WebKit build. If it is slow enough to notice, the fallback — not built up front —
is to render category sections lazily as they scroll into view. Nothing about the data
model or the search changes if that becomes necessary.

---

## 5. The chart

The gutter machinery is **reused, not duplicated**. Issue #13 puts the accidental "at the
left of the diagram in Vertical Orientation and above in Horizontal Orientation", which is
where a fthora already goes.

- `signRunOf(noteItem)` returns `[alteration, fthora]` in Byzantine notation and
  `[accidental]` in Generic. The invariant it documents — the chart draws the gutter signs
  left to right in the order `SYMBOL_WELLS` puts the wells on a row — still holds, and now
  spans both notations.
- The gutter run's **font is per-notation**: `byzantineFont(BYZ_FONT_SIZE)` or
  `smuflFont(SMUFL_FONT_SIZE)`. A run is homogeneous — no run mixes faces — so one font
  per run is enough, and `glyphRunExtent`, `maxRunExtent` and `drawByzantineSigns` take it
  as a parameter rather than reading a constant. `drawByzantineSigns` and
  `drawByzantineMark` are renamed `drawSignRun` and `drawSymbol`, and `drawNoteLabel`'s
  `spec.byzantine` flag becomes `spec.symbolFont` — the face to draw the label in, or
  nothing for a typed name.
- `render()`'s `isByzantine` guards around gutter **measurement and layout** become "does
  any degree carry a gutter sign". A Generic scale with no accidental therefore measures
  and draws exactly as today — same canvas size, same coordinates.
- `signExtent` — the widest ink centred on an end separator — takes the run's extent into
  account in Generic too, so a first or last accidental is never clipped.
- The **note label is unchanged**: a typed name at the separator in Generic, a martyria in
  Byzantine. `byzantineNoteBandHeight` stays Byzantine-only, since a Generic note band is
  the name band it already is.
- PNG export needs no change; it re-draws the same canvas at `EXPORT_SCALE`.

`BYZ_SIGN_GAP` (the space between an alteration and its fthora) is unchanged and unused in
Generic, where a run is one sign.

---

## 6. Editor row and alignment

### 6.1 Note row

```
Generic     play · degree · cumulative-cents ·············· [♯]  [ note-name ]
Byzantine   play · degree · cumulative-cents ·············· [♯]  [φ]  [Πα]
```

`#editor.notation-generic` shows the accidental well and the name box; `.notation-byzantine`
shows the three Byzantine wells and hides both. `margin-left: auto` moves to whichever
element is leftmost in the visible right-hand block — the accidental well in Generic (it
takes the rule the name box carries today), the alteration well in Byzantine (unchanged).

### 6.2 Interval row

The colour swatch moves **before** the label and grows from 22 px to **34 px**, a well's
size, so it sits under the well above it.

```
                                     ┌ well ┬ gap ┬──── 9rem ────┐
Generic     …  cumulative-cents   │   [♯]     note-name           │
Interval    …  9/8   203.91￠      │   [■]     label               │
                                     └ 34px ┴ 10px┴──── 9rem ────┘

                                     ┌ well ┬ gap ┬ well ┬ gap ┬ well ┐
Byzantine   …  cumulative-cents   │   [♯]    [φ]    [Πα]                │
Interval    …  9/8   203.91￠      │   [■]    label                      │
                                     └ 34px ┴ 10px┴───── 78px ─────────┘
```

The two right-hand blocks are **not the same width** — Generic's is `34 + 10 + 144` px,
Byzantine's `34 + 10 + 34 + 10 + 34` — so `.interval-label-cluster` takes a
notation-dependent width, driven off the `#editor.notation-generic` /
`.notation-byzantine` class that is already on the editor. No JavaScript change: the label
is `flex: 1 1 auto` and fills whatever the cluster is.

The sizes come from CSS custom properties (`--well-size: 34px`, the row gap, the name-box
width) so the two rules cannot drift apart. The colour dropdown's anchor moves with its
swatch and needs a look in the verification pass.

---

## 7. Fonts and licensing

`fonts/BravuraText.woff2` and `fonts/Bravura-OFL.txt` are **already vendored** — upstream's
own `redist/woff/BravuraText.woff2`, byte for byte — and `fonts/README.md` already records
the provenance and the Reserved Font Name condition. Nothing there changes.

What this design must not do, and why (research §2):

- **Do not subset.** OFL FAQ 2.6 makes subsetting a modification, and Bravura declares the
  Reserved Font Name "Bravura", so a subset would have to be **renamed**. The 447 KB ships
  as it is.
- **Do not convert or re-compress.** FAQ 2.2 permits a WOFF build only if the original font
  data is unchanged; shipping upstream's own build satisfies that by construction.
- **Do not link a CDN.** The app must work from `file://` with no network, and a PUA
  codepoint has no fallback glyph — a missing face makes the symbols *disappear*, not
  degrade.

Changes:

- `style.css` gains a second `@font-face` for `"Bravura Text"` with `font-display: block`,
  alongside Neanes'.
- `loadByzantineFont()` becomes `loadSymbolFonts()`: it loads **both** faces, warns per
  face on failure with the face named, and once both settle calls `resetInkMeasurements()`,
  `refreshAllNoteRowWells()` and `render()` — once, not twice. `byzFontReady` becomes
  `symbolFontsReady`.
- The build verifies the committed `BravuraText.woff2` still matches the sha256 in
  `fonts/README.md`, as a guard against an accidental re-compression. This is a one-off
  check during implementation, not a test.
- `README.md`'s NOTICE section gains Bravura if it does not already name it.

---

## 8. Testing

`docs/TESTING.md` governs: red first, whole suite before every commit, no test deleted or
loosened, unit and integration only, chart tests assert geometry and never pixels.

### 8.1 The suite

**New**

- `test/unit/smufl-accidentals.test.js` — the catalogue: 28 categories in the specified
  order; ids unique across the whole catalogue; every SMuFL entry's codepoint inside its
  declared range; Răileanu's 11 and mixed Sagittal's 13 entries with their exact codepoint
  sequences, including the `U+0020` in the four Evo pairs; `resolveAccidentalGlyphs()` for
  a single glyph, a composed pair, and an unknown id.
- `test/unit/symbol-search.test.js` — `normalizeForSearch()` and `matchesQuery()`: case,
  diacritic folding, all-words-must-match, word order irrelevant, empty query.
- `test/integration/accidental-picker.test.js` — the well and its picker: opens, commits on
  a row click, closes, writes `data-accidental`, re-opens with that entry selected, clears
  via None, dismisses without committing on an outside click and on a second well click;
  and the search field filtering the rendered DOM per the table in §4.3, including a
  category-title match showing a whole category and `No matches`.

**Updated**

- `test/integration/byzantine-pickers.test.js` — `.sym-*` class names; the new search field
  in the alteration and fthora pickers; the fthora picker's compatible/other rule surviving
  a filter and dropping out when a section empties; the martyria picker still having no
  search field.
- `test/integration/render.test.js` — Generic gutter geometry in both orientations and both
  chart styles; a Generic scale with no accidental producing today's canvas size and
  coordinates exactly.
- `test/integration/notation.test.js` — the accidental survives a notation switch and a row
  add/remove; both faces are requested at startup; `readScaleData()` carries `accidental`.
- `test/integration/harness.test.js` — the script list is five files, in order.
- `test/helpers/canvas-stub.js` — an ink block for SMuFL accidentals: a **real advance**
  (unlike Neanes' zero-advance marks) and ink **entirely above the baseline**, modelled on
  the research's measured +0.680 … +0.122 em, keyed on the accidental codepoint ranges.
  These do not collide with the Neanes blocks the stub already models (`U+E130`–`E20F`
  against `U+E260`+). `U+0020` is modelled as Bravura Text cuts it: no ink, and an advance
  of **0.1 em** (100 units of 1000), so a composed Evo pair measures wider than the two
  glyphs alone by exactly the gap — which is what a test asserts the ½ staff space by.
- `test/helpers/harness.js` — `pickAccidental(h, row, id)` and
  `searchPicker(h, row, kind, query)`.

### 8.2 Manual verification (Playwright, not committed)

Required in addition to the suite, and it decides two numbers the suite cannot:

1. Both notations × both orientations × both chart styles, with and without accidentals.
2. **`SMUFL_FONT_SIZE`** — an accidental beside a 24 px note name and beside a Byzantine
   martyria.
3. The **Evo pairs' half-space gap** at well, picker and chart sizes; and that no DOM
   element collapses it (§3.4).
4. The **search** field: focus on open, the five queries of §4.3, and that typing does not
   commit.
5. **Alignment** (§6.2): the swatch under the leftmost well, the label under the name box
   in Generic and under the fthora + martyria pair in Byzantine, in both notations, and the
   colour dropdown still anchored correctly at 34 px.
6. The **empty-well hint** (§4.4) — its offset is read out of the app, so it can only be
   confirmed on screen.
7. **First-open time** of the accidental picker (§4.5), in a WebKit build.

Browser-driving scripts are verification, not tests, and are not committed.

---

## 9. Documentation

- **`CLAUDE.md`** — the "three classic scripts" rule becomes five, in load order, with the
  reason each exists. The Notation bullet gains the accidental well.
- **`docs/ARCHITECTURE.md`** — File Structure, HTML Layout (the note row's new shape), Data
  Model (`accidental` on a note item), Notation, Chart Rendering (the gutter is no longer
  Byzantine-only).
- **`docs/TESTING.md`** — §4 layout (the new test files), §5 stub table (the SMuFL ink
  block), and the harness-helper table.
- **`docs/BYZANTINE-SYMBOLS.md`** — §6 "Adding a second font" is no longer hypothetical;
  it points at the new document and keeps its checklist. §2 notes that the measuring
  primitives in `byzantine.js` are shared, not Byzantine.
- **`docs/SMUFL-ACCIDENTALS.md`** *(new)* — the maintainer's map: the catalogue's shape and
  its generator, the 28 categories and why two are not SMuFL ranges, why Răileanu's labels
  differ from SMuFL's descriptions, the Evo spacer and the `white-space: pre` requirement,
  the ink model and where the family name is written.

Commits carry the `[#13]` prefix, one behavioural change each, tests and implementation
together.

---

## 10. Out of scope

- **Pitch.** An accidental is an annotation the chart draws, exactly as a fthora is. It
  does not move a degree, and `getFrequencyForDegree()` is untouched.
- **Accidentals in Byzantine notation.** Issue #13 asks for them in Generic only.
- **More than one accidental per degree.** One well, one entry.
- **The Revo (pure) Sagittal flavour.** The research offers it as cheap, but the
  requirement names only the mixed flavour, and the Spartan multi-shaft category already
  carries the Revo glyphs.
- **Subsetting the font**, for the licensing reason in §7.
- **Persisting a scale.** The app still has no persistence; a reload resets to defaults.
