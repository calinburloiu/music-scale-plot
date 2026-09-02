# SMuFL accidentals — a maintainer's map

This is the human-readable guide to the Generic notation's accidental layer:
`smufl.js` (the catalogue and its resolvers — no DOM) and the parts of
`symbols-ui.js` that are specific to the accidental well and its picker.
`docs/ARCHITECTURE.md`'s **Notation** section is the one-paragraph orientation;
`docs/BYZANTINE-SYMBOLS.md` is this document's sibling for the Byzantine signs
and, more importantly, the home of the well/picker machinery both layers
share — this document does not repeat what is described there, only what is
specific to SMuFL accidentals.

---

## 1. What an accidental is here

An accidental is an **annotation the chart draws**, exactly as a Byzantine
fthora is (`docs/BYZANTINE-SYMBOLS.md` §1). It is drawn in the sign gutter —
left of the diagram when vertical, above it when horizontal — at the same
place a fthora goes, because `signRunOf()` (`app.js`) derives a degree's
gutter run from `SYMBOL_WELLS` filtered by notation, and the accidental well
is one row of that table. `docs/ARCHITECTURE.md`'s Notation section and
`docs/BYZANTINE-SYMBOLS.md` §11 describe that table and the gutter it feeds;
this document does not repeat them.

**It never moves a degree.** `getFrequencyForDegree()` does not know an
accidental well exists, and neither does the cents model: a scale's pitches
come entirely from its intervals and its base note. Setting or clearing an
accidental changes nothing about how the chart's rectangles are sized or how
loud or how long a note plays — only what is drawn beside it. This is the same
relationship a Byzantine sign of alteration has to pitch
(`docs/BYZANTINE-SYMBOLS.md` §1), and it is deliberate: pitch, more than one
accidental per degree, and accidentals in Byzantine notation are all named as
out of scope for this layer.

Generic notation carries **at most one** accidental per degree — one well, one
entry, cleared by picking None. There is no analogue of the Byzantine
alteration-plus-fthora pair; a degree's Generic gutter run is `[accidental]`,
zero or one sign, where Byzantine's is `[alteration, fthora]`, zero, one or
two.

---

## 2. The catalogue's shape

```js
const SMUFL_ACCIDENTAL_CATEGORIES = freezeTable([
  {
    id: "standardAccidentals12Edo",
    title: "Standard accidentals (12-EDO)",
    accidentals: freezeTable([
      { id: "accidentalFlat", codes: Object.freeze([0xe260]), label: "Flat" },
      { id: "accidentalSharp", codes: Object.freeze([0xe262]), label: "Sharp" },
      // …
    ]),
  },
  // … 27 more categories
]);

function smuflAccidentalById(id)      // flat Map over every category, built once, lazily
function resolveAccidentalGlyphs(id)  // "" for an unknown id, else String.fromCharCode(...codes)
```

`freezeTable()` — `Object.freeze` on the array and on every element of it — is
the same helper four of `byzantine.js`'s six tables use — `BYZ_NOTES`,
`BYZ_GENERA`, `BYZ_FTHORES` and `BYZ_ALTERATIONS` (`docs/BYZANTINE-SYMBOLS.md`
§2) — so a category and an entry are frozen the same way a note or a fthora
row is. The other two, `MARTYRIA_COMPATIBILITY` and `FTHORES_COMPATIBILITY`,
are not arrays of rows but maps from a note id to an array, so they are
frozen a different way instead: `Object.freeze(Object.fromEntries(...))` on
the outer map, with `Object.freeze` on each inner array — the row-freezing
helper does not fit a shape that has no rows.

**`codes` is an array, not a single codepoint.** An accidental is a
*sequence*: the four Sagittal Evo pairs need two glyphs and a spacer between
them (§6), and it is the same shape Extended Helmholtz-Ellis and Johnston
would need if this catalogue ever combined their diacritics. A single-glyph
entry is a one-element array, so nothing in the resolver or the picker
special-cases length.

**Entries are per category.** The same codepoint therefore shows up as
several entries with several labels — `U+E261` is `accidentalNatural`
"Natural" in Standard accidentals, `raileanuNatural` "Natural" in Răileanu,
and `sagittalEvoZero` "0 divisions natural" in mixed Sagittal. That is exactly what
lets the picker re-open on the entry the user actually chose (§8), rather
than on whichever category happens to list the glyph first.

**Ids are unique across the whole catalogue.** For the 26 categories that are
SMuFL ranges, an entry's id **is** the canonical SMuFL glyph name — the same
key `glyphnames.json` uses, globally unique and stable across SMuFL versions.
The two categories that are not SMuFL ranges (§4) use their own ids, prefixed
`raileanu…` and `sagittalEvo…`.

**A note row stores the id, not the glyph:** `data-accidental="<entry id>"`.
`readNoteSymbols()` (`symbols-ui.js`) reads it back as `symbols.accidental`,
alongside `alteration`, `fthora` and `martyria`; `readScaleData()` (`app.js`)
carries it on the note item as `accidental`, `""` when the well is empty. This
is what lets the well and the picker resolve a glyph on demand
(`resolveAccidentalGlyphs(id)`) instead of caching one in the DOM, and it is
what lets the picker re-open scrolled to, and highlighting, the exact entry
the row holds — storing the glyph string instead would leave the picker
unable to tell which of `accidentalSharp`, `raileanuPlusTwoQuarterTones` or
`sagittalEvoPlus6` a bare "♯" was supposed to mean.

**An empty well opens where the reader last was.** `LAST_PICKED_SIGN`
(`symbols-ui.js`) records the id every well kind was last *clicked* to — at the
click, not in `writeNoteSign`, so a sign the martyria ladder propagates is not
mistaken for a choice, and never `""`, because clearing a well is not a place
to come back to. `buildAccidentalPicker` passes it as the spec's `recent`, the
grouped builder marks that row `is-recent` (only ever on a panel with nothing
committed, so it can never be mistaken for `is-selected`), and
`pickerRevealTarget` prefers `is-selected`, then `is-recent`. Without it, a
reader giving eight notes a Wyschnegradsky accidental would scroll past
twenty-three categories eight times. It is view state and nothing else reads
it: not in the DOM, not in `readScaleData()`, and empty again after a reload.
The alteration and fthora pickers pass no `recent` — their lists are short
enough that the top of one is never far away.

`smuflAccidentalById(id)` is a flat `Map` over every category's entries,
built lazily on first call — the catalogue is 501 entries, and a page that
never opens the accidental picker never needs the index.
`resolveAccidentalGlyphs(id)` returns `""` for an id the catalogue does not
recognise (a stale id from a schema change would otherwise draw nothing
rather than throwing), and `String.fromCharCode(...codes)` for a known one —
this is also where the sequence in `codes` becomes the one string every other
part of the layer measures and draws.

---

## 3. The generator

The 477 SMuFL entries (501 minus the two composed categories' 24) are
**generated, not typed by hand.**
[`issues/013-generic-accidentals/build-accidentals.js`](../issues/013-generic-accidentals/build-accidentals.js)
reads two SMuFL 1.4 metadata files and emits the
`SMUFL_ACCIDENTAL_CATEGORIES` literal:

```
mkdir -p issues/013-generic-accidentals/smufl-metadata
curl -sSfo issues/013-generic-accidentals/smufl-metadata/ranges.json \
  https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/ranges.json
curl -sSfo issues/013-generic-accidentals/smufl-metadata/glyphnames.json \
  https://raw.githubusercontent.com/w3c/smufl/gh-pages/metadata/glyphnames.json

node issues/013-generic-accidentals/build-accidentals.js            # to stdout
node issues/013-generic-accidentals/build-accidentals.js --write    # into smufl.js
```

`issues/013-generic-accidentals/smufl-metadata/` is **gitignored** — the app
never reads it, and it exists only on a machine that is regenerating the
table. `--write` replaces everything between the two marker comments in
`smufl.js`:

```js
// >>> GENERATED by issues/013-generic-accidentals/build-accidentals.js — do not edit by hand
…
// <<< GENERATED
```

Only the generator's **output** ships, spliced into `smufl.js` alongside the
hand-written resolvers around it (§2). The app still has no build step:
nothing runs at page load but the app's own seven scripts, and
`build-accidentals.js` is research tooling next to the research document, not
part of `npm test` — it is not `require`d by anything under `test/`, and it
adds no dependency of its own (`node:fs` and `node:path` only, `require`d
against the two downloaded JSON files).

For each SMuFL range, the generator keeps the range's own glyph order and
takes each entry's label verbatim from `glyphnames.json`'s `description` — the
same text the SMuFL tables show, so a reader who knows those tables recognises
the row. Codepoints inside a range are **not contiguous** (Magrathean is 20
glyphs scattered across a 40-slot range), so the generator writes every
codepoint out rather than deriving one from a base plus an index — unlike, for
instance, `resolveFthoraGlyph`'s arithmetic in `byzantine.js`.

**One kind of glyph is filtered out:** a slot whose `description` is exactly
`"Unused"`. SMuFL reserves four of them inside two Sagittal ranges — `U+E31A`
and `U+E31B` in Spartan multi-shaft, `U+E3DE` and `U+E3DF` in Promethean
high-precision multi-shaft — and no font draws anything for them, so a picker
row for one is an empty glyph box under a meaningless label. The generator
drops them by their description rather than by codepoint, so a slot SMuFL
reserves in some future range goes the same way with no code change. That is
why rows 9 and 13 of the table below hold 36 and 62 entries where their ranges
list 38 and 64.

The two categories that are not SMuFL ranges (§4) are hand-written data
inside `build-accidentals.js` itself, spliced into the same catalogue
alongside the 26 generated ones — see the `CATALOGUE` array in that file for
the exact interleaving.

---

## 4. The 28 categories

The SMuFL site's own order, with two categories promoted to the front and one
substituted for a listed-but-not-shipped range. Counts are entry counts, as
they ship in `smufl.js` — 501 in all.

| # | Category | Source | Entries |
|---:|---|---|---:|
| 1 | Standard accidentals (12-EDO) | `U+E260`–`E26F` | 14 |
| 2 | **Răileanu accidentals** | composed (§5) | 11 |
| 3 | **Turkish Arel-Ezgi-Uzdilek (AEU) accidentals** | `U+E440`–`E44F` | 8 |
| 4 | Turkish folk music accidentals | `U+E450`–`E45F` | 8 |
| 5 | Arabic accidentals | `U+ED30`–`ED3F` | 9 |
| 6 | Persian accidentals | `U+E460`–`E46F` | 2 |
| 7 | **Mixed-symbol Sagittal accidentals (72-EDO)** | composed (§6) | 13 |
| 8 | Spartan Sagittal single-shaft accidentals | `U+E300`–`E30F` | 16 |
| 9 | Spartan Sagittal multi-shaft accidentals | `U+E310`–`E33F` | 36 |
| 10 | Athenian Sagittal extension (medium precision) accidentals | `U+E340`–`E36F` | 40 |
| 11 | Trojan Sagittal extension (12-EDO relative) accidentals | `U+E370`–`E38F` | 24 |
| 12 | Promethean Sagittal extension (high precision) single-shaft accidentals | `U+E390`–`E3AF` | 30 |
| 13 | Promethean Sagittal extension (high precision) multi-shaft accidentals | `U+E3B0`–`E3EF` | 62 |
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

**477 entries drawn from 26 SMuFL ranges, plus 24 in the two composed
categories, is 501** — the number the picker's doc comment
(`buildAccidentalPicker` in `symbols-ui.js`) and its own tests both pin.

Two of the 28 are not SMuFL ranges at all:

- **Răileanu accidentals** is the client's own vocabulary for Byzantine and
  Near/Middle Eastern (maqam) music — not a page on the SMuFL site (§5).
- **Mixed-symbol Sagittal accidentals (72-EDO)** is Figure 2 (last row) of
  [the Sagittal paper](https://www.sagittal.org/sagittal.pdf) p. 4 — SMuFL
  only precomposes the *Revo* (pure-Sagittal) flavour as single glyphs; the
  *Evo* (mixed-symbol) flavour this category holds keeps the ordinary ♯/♭ and
  reuses single-shaft Sagittal glyphs (`U+E302`–`U+E30B`) that row 8, Spartan
  Sagittal single-shaft accidentals, already carries (§6).

Two deliberate departures from the category list in
[`impl-prompt.md`](../issues/013-generic-accidentals/impl-prompt.md), the
requirement this catalogue was built from:

- **Stein-Zimmermann accidentals (24-EDO)** (row 18) was **added**. The prompt
  names *Extended* Stein-Zimmermann but not the base range it extends; SMuFL's
  own site orders the base range immediately before the extension
  (`U+E280`–`E28F` then `U+E290`–`E29F`), and shipping the extension without
  its base was judged a gap in the requirement, not a deliberate exclusion.
- **Standard accidentals for chord symbols** (`U+ED60`–`ED6F`, 7 glyphs —
  `csymAccidentalFlat`, `csymAccidentalNatural`, … ) stays **out**. It is
  typography for chord-symbol labels, not pitch inflection, and the prompt
  does not list it among the categories to include.

---

## 5. Why Răileanu's labels are interval names

`raileanuAccidentals`' eleven entries mostly borrow Arel-Ezgi-Uzdilek
codepoints, plus a natural and two glyphs borrowed from elsewhere:

| id | label | codes |
|---|---|---|
| `raileanuMinusOneQuarterTone` | `−1/4 tone flat` | `U+E443` |
| `raileanuMinusTwoQuarterTones` | `−2/4 tone flat` | `U+E442` |
| `raileanuMinusThreeQuarterTones` | `−3/4 tone flat` | `U+E440` |
| `raileanuMinusOneThirdTone` | `−1/3 tone flat` | `U+E441` |
| `raileanuMinusTwoThirdsTone` | `−2/3 tone flat` | `U+E2F5` |
| `raileanuNatural` | `Natural` | `U+E261` |
| `raileanuPlusOneQuarterTone` | `+1/4 tone sharp` | `U+E444` |
| `raileanuPlusTwoQuarterTones` | `+2/4 tone sharp` | `U+E445` |
| `raileanuPlusThreeQuarterTones` | `+3/4 tone sharp` | `U+E446` |
| `raileanuPlusOneThirdTone` | `+1/3 tone sharp` | `U+E274` |
| `raileanuPlusTwoThirdsTone` | `+2/3 tone sharp` | `U+E283` |

The natural is not in the client's original list — it was inserted at the
zero point during design, the same decision that gave the mixed-Sagittal
category its own natural (§6).

**The labels are the interval names, not SMuFL's own descriptions, and that
is load-bearing, not a style choice.** This category *redefines* two of the
glyphs it borrows: `U+E274` is SMuFL's "Three-quarter-tones sharp" but
Răileanu's `+1/3 tone`, and `U+E2F5` is SMuFL's "Lower by one equal tempered
quarter-tone" but Răileanu's `−2/3 tone`. Printing the SMuFL description in
this category would state a pitch the category does not mean — the entry's
`label` describes what *this catalogue entry* means, which for the SMuFL
ranges happens to be the SMuFL description and for Răileanu is not.

**The direction word is there for the search.** The interval name says how far
a sign moves a pitch but never which way, and `flat`/`sharp` are what a reader
types into a picker of 501 entries. `matchesQuery`/`normalizeForSearch`
(`symbols-ui.js`, shared by every grouped picker) match an option's own label
or its category's title, so without the word this category was unreachable by
the most obvious query there is. With it, `flat` reaches exactly the five
lowering entries and `sharp` exactly the five raising ones — the natural
matches neither, which is right. `răileanu`, `raileanu` (search is
diacritic-folded), `tone`, `1/4`, `-1/4` (it is dash-folded too, so the
hyphen key reaches the U+2212 these labels are written with) and `natural`
all still reach it.

---

## 6. The Evo spacer

`sagittalMixedSymbolAccidentals72Edo` holds the thirteen degrees of 72-EDO in
Sagittal's *Evo* (mixed-symbol) flavour — degrees are twelfths of a tone, so
±6 is a semitone. A label names the unit the number counts and ends in its
direction, for the same reason Răileanu's do (§5): a bare `−3` says neither
what it counts nor which way it moves, and matches no query a reader would
think to type. `division` reaches all thirteen, `flat` the six below the
natural and `sharp` the six above:

| id | label | codes |
|---|---|---|
| `sagittalEvoMinus6` | `−6 divisions flat` | `U+E260` |
| `sagittalEvoMinus5` | `−5 divisions flat` | `U+E302` `U+0020` `U+E260` |
| `sagittalEvoMinus4` | `−4 divisions flat` | `U+E304` `U+0020` `U+E260` |
| `sagittalEvoMinus3` | `−3 divisions flat` | `U+E30B` |
| `sagittalEvoMinus2` | `−2 divisions flat` | `U+E305` |
| `sagittalEvoMinus1` | `−1 division flat` | `U+E303` |
| `sagittalEvoZero` | `0 divisions natural` | `U+E261` |
| `sagittalEvoPlus1` | `+1 division sharp` | `U+E302` |
| `sagittalEvoPlus2` | `+2 divisions sharp` | `U+E304` |
| `sagittalEvoPlus3` | `+3 divisions sharp` | `U+E30A` |
| `sagittalEvoPlus4` | `+4 divisions sharp` | `U+E305` `U+0020` `U+E262` |
| `sagittalEvoPlus5` | `+5 divisions sharp` | `U+E303` `U+0020` `U+E262` |
| `sagittalEvoPlus6` | `+6 divisions sharp` | `U+E262` |

Four of the thirteen are a two-glyph sequence — a single-shaft Sagittal
symbol, then `U+0020`, then the ordinary ♭ or ♯ it adjusts. **`U+0020` is
Bravura Text's ½ staff space**: 100 of its font units against a 200-unit
staff space in that face (Bravura Text scales its staff space to text cap
height rather than the 250-unit staff space plain Bravura uses — see
`fonts/README.md`'s "Why the *Text* face and not plain Bravura"). SMuFL sets
**zero side bearings** on every glyph, so without a spacer the sagittal and
the ♭/♯ would abut exactly at the ink; `U+0020` is the only thing that opens
the gap the mixed-symbol notation actually uses.

Two consequences that follow directly, and that a maintainer touching this
category has to keep:

- **Any DOM element that shows a composed accidental needs
  `white-space: pre`**, or the browser collapses the space away and the pair
  goes tight — a space is ordinary whitespace to CSS whatever codepoint range
  the rest of the string is drawn from. `style.css`'s `.accidental-well` and
  `.accidental-picker .sym-glyph` rules both carry it for exactly this
  reason.
- **`ctx.fillText()` needs nothing.** A canvas paints the glyphs it is
  handed, with no shaping and no whitespace collapsing, so the chart's own
  drawing code (`drawSymbol`/`drawSignRun` in `app.js`) needs no equivalent
  rule — this is one of the few places DOM and canvas genuinely differ, and
  it is the opposite direction from `domGlyphText`'s carrier problem in §7.

---

## 7. The ink model

A Bravura Text accidental has a **real advance** — unlike every Neanes sign
of alteration, which is a zero-advance combining mark
(`docs/BYZANTINE-SYMBOLS.md` §1, §8a) — and its ink sits **entirely above the
baseline**, like a Neanes fthora's but unlike a Neanes martyria's, which
straddles it. `accidentalSharp` (`U+E262`) measures roughly `+0.680em …
+0.122em`, both above the baseline, at Bravura Text's own metrics.

Both facts matter, and they pull in different directions for the two
font-agnostic problems `docs/BYZANTINE-SYMBOLS.md` §8a and §8b describe:

- **`domGlyphText()` (`byzantine.js`) adds no carrier for an accidental.**
  WebKit's refusal to paint a bare run of zero-advance marks is exactly what
  the carrier works around, and an accidental is never zero-advance — its
  `inkBox(...).adv` is positive, so `domGlyphText` takes the "the text has an
  advance of its own" branch and returns it unchanged. This is measured, not
  assumed about the face: the function is the same one Neanes' signs go
  through, and it makes the right call for both faces from the same rule.
- **`scanInkBox()` is still needed on WebKit.** `measureText` there reports
  ink **unioned with the advance rect and the baseline**
  (`docs/BYZANTINE-SYMBOLS.md` §8b), and an accidental's ink sitting entirely
  above the baseline is exactly the shape that union destroys — the same
  failure mode a Neanes fthora has, for the same underlying reason. So the
  rasterise-and-scan fallback applies to Bravura Text exactly as it does to
  Neanes, and it is cached the same way: the ink-box cache
  `resetInkMeasurements()` clears lives in `byzantine.js` and is keyed by
  face and text, so Neanes and Bravura Text results sit in it side by side
  without colliding.

**The measuring primitives are shared, font-agnostic machinery, not
Byzantine.** `inkBox`, `inkCenteringShift`/`inkCenteringShiftEm`,
`drawGlyphs`, `domGlyphText` and `scanInkBox` all live in `byzantine.js` and
all take their face as an explicit argument — `smufl.js` and `symbols-ui.js`
call them with `smuflFont(...)` exactly as `byzantine.js`'s own callers pass
`byzantineFont(...)`. They were not moved into a third, font-neutral file
when this layer was added, because doing so would have been a large diff with
no feature behind it — `docs/BYZANTINE-SYMBOLS.md` §2 says the same thing
from the Byzantine side. Read `docs/BYZANTINE-SYMBOLS.md` §7, §8 and §10 for
how the model itself works and how it is exercised in the test suite; nothing
about it is re-explained here.

---

## 8. Where the family name is written

`SMUFL_FONT_FAMILY` (`smufl.js`) is the family name, written **once** in the
JavaScript:

```js
const SMUFL_FONT_FAMILY = '"Bravura Text"';
const SMUFL_FONT_SIZE = 40;
function smuflFont(size) {
  return (size || SMUFL_FONT_SIZE) + "px " + SMUFL_FONT_FAMILY + ", serif";
}
```

Every font string the app builds for an accidental — the chart's, the
accidental well's, the picker's — goes through `smuflFont()`. This is exactly
the discipline `BYZ_FONT_FAMILY`/`byzantineFont()` already keep in
`byzantine.js` (`docs/BYZANTINE-SYMBOLS.md` §6); nothing outside `smufl.js`
should ever write `"Bravura Text"` into a font string by hand.

CSS cannot read a JavaScript constant, so `style.css` repeats the name in
**three** places — miss one and the editor and the chart disagree about which
face an accidental is drawn in:

- The `@font-face` declaring the face, alongside Neanes' own.
- `.accidental-well` — overrides the `font-family: "Neanes"` the shared well
  rule (`.accidental-well, .alteration-well, .fthora-well, .martyria-well`)
  sets for all four wells, setting it to `"Bravura Text"` for this one, and
  adds `white-space: pre` for the Evo pairs (§6).
- `.accidental-picker .sym-glyph` — the same override for a picker row's
  glyph box, which the shared `.sym-glyph` rule would otherwise leave at
  `"Neanes"`.

Two more numbers follow from the face, though neither is a JS constant:

- **`SMUFL_FONT_SIZE`** (40, matching `BYZ_FONT_SIZE`) is the chart's drawing
  and measuring size. A Bravura Text accidental's ink spans about 0.56em
  where a martyria's spans far more, so the two faces do not read as the same
  size at the same nominal size; like `BYZ_SIGN_GAP`
  (`docs/BYZANTINE-SYMBOLS.md` §6), this number is settled by eye rather than
  computed — beside a 24px note name, in the project's Playwright
  verification pass.
- **The well and picker font sizes** — `.accidental-well` at 30px,
  `.accidental-picker .sym-glyph` at 32px. The 31px alteration/fthora rule
  they parallel is derived from a measured ink ratio against Neanes
  (`docs/BYZANTINE-SYMBOLS.md` §6); these two numbers carry no such
  derivation comment in `style.css` — they are starting points, to be tuned
  by eye in the same verification pass, against the 34px well box and the
  38px picker glyph box.

**The empty-well hint** — `.accidental-well.is-empty::before` — is, as with
the other three wells, the one place outside `resolveAccidentalGlyphs`
itself where a codepoint is written by hand:

```css
.accidental-well.is-empty::before {
  content: "\E260\20\E262";
  font-size: 30px;
  transform: translate(0, 0.0365em);
}
```

`U+E260`, `U+0020`, `U+E262` — a flat, a space, then a sharp, from the well's
own vocabulary, drawn faint (`color: var(--ink-faint)`), the same rule
`docs/BYZANTINE-SYMBOLS.md` §6 states for the alteration and fthora hints:
CSS `content` takes a literal codepoint and nothing else, so it cannot call
`resolveAccidentalGlyphs`. Unlike the alteration hint's two geniki — each a
zero-advance mark needing its own pseudo-element and its own nudge — a flat
and a sharp both have real advances, so the pair is **one string**, a single
`::before` exactly like the fthora hint's shape. The spacer is not optional:
SMuFL sets zero side bearings (§6), so without it the two abut exactly at the
ink and the hint reads as one mark rather than two signs. It is the same
`U+0020` an Evo pair uses, and it survives here for the same reason — because
`.accidental-well` sets `white-space: pre`. The `transform` is
`inkCenteringShiftEm()`'s answer for that exact string in Bravura Text, read
out of the running app and written here because CSS cannot compute it; adding
the spacer did not move it, because a space carries no ink and each glyph's
ink spans its whole advance. Change the hint's glyphs and this offset has to
be read out again.

---

## 9. Licensing

`fonts/BravuraText.woff2` is upstream's own `redist/woff/BravuraText.woff2`
build, byte for byte, and it declares the Reserved Font Name **"Bravura"**
under the SIL Open Font License 1.1. Three rules follow, and none of them are
this layer's to relax:

- **Do not subset it.** OFL FAQ 2.6 treats subsetting as a modification, and
  a Modified Version of a font that declares a Reserved Font Name must be
  renamed — so a subset could not keep calling itself "Bravura Text" in
  `@font-face`, and every place in this document that names the family would
  go stale. The 447KB file ships whole.
- **Do not convert or re-compress it.** FAQ 2.2 permits a WOFF build only
  when the underlying font data is unchanged; shipping upstream's own woff2
  build satisfies that by construction, and a local re-encode would not.
- **Do not link it from a CDN.** The app has to keep working from `file://`
  with no network (`CLAUDE.md`), and a Private Use Area codepoint has no
  fallback glyph — a face that fails to load makes every accidental
  **disappear**, not degrade to a substitute glyph.

The file's sha256 is
`1f2711e9b554b7240edadc48edc2bece1a8b91118c6825fe7ff03ed1e07e1574`, recorded
in [`fonts/README.md`](../fonts/README.md)'s Bravura Text table as the guard
against an accidental re-compression landing unnoticed. Full provenance,
terms and the "why the *Text* face and not plain Bravura" reasoning live
there and in [`fonts/Bravura-OFL.txt`](../fonts/Bravura-OFL.txt) — this
section only lists which rules a change to this layer must not cross.
`README.md`'s own NOTICE section covers both vendored faces, Neanes and
Bravura Text, for the same reason.
