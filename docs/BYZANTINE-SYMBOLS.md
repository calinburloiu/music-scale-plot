# Byzantine notation — a maintainer's map

This is the human-readable guide to the Byzantine (psaltic) notation layer:
`byzantine.js` (the symbol model — tables and SBMuFL resolvers, no DOM — plus
the shared, font-agnostic ink-measuring primitives; see §2) and
`byzantine-ui.js` (only what is Byzantine, built on top of it: the alteration,
fthora and martyria picker builders, the martyria draft, and the note ladder
applied to the editor). The well and picker machinery both notations share —
opening, committing, dismissing, the grouped-list builder, search — lives in
`symbols-ui.js`, described where it is generic in `docs/ARCHITECTURE.md`'s
**Notation** section and, for the accidental layer that also uses it, in
[`docs/SMUFL-ACCIDENTALS.md`](SMUFL-ACCIDENTALS.md). `docs/ARCHITECTURE.md`'s
**Notation** section is the one-paragraph orientation; this document is where
you come to actually change something Byzantine.

---

## 1. What the three signs are

A note row in Byzantine notation carries three independent glyphs instead of a
typed name:

- A **martyria** is the note's name — a signpost that tells the singer which
  degree of the scale they are on and which genus (diatonic, chromatic,
  enharmonic, …) it currently sits in. It is drawn from two glyphs stacked by
  the font itself: a note letter and, optionally, a genus mark riding on it.
- A **fthora** is the psaltic accidental of genus — a standalone sign that
  changes the genus of the notes that follow it, drawn as one ordinary,
  normal-advance glyph.
- A **sign of alteration** is the accidental of pitch: a *diesis* raises a note
  by so many moria, a *yfesis* lowers it, and the two *geniki* say "sharp" and
  "flat" without naming a size. It is a zero-advance combining mark whose ink
  sits entirely above the baseline.

The martyria goes in place of the note name; the other two share the gutter on
the opposite side of the separator, the alteration drawn to the left of the
fthora it qualifies (see `docs/ARCHITECTURE.md`'s Chart Rendering → Text
layout).

An alteration **does not change pitch**. Like a fthora it is an annotation the
chart draws; `getFrequencyForDegree()` and the cents model never see it, and
the moria in the picker's labels are documentation, not arithmetic.

For the typography that makes a martyria's two glyphs stack correctly — GSUB,
GPOS, mark-to-base attachment, all of it — read
[`issues/002-byzantine-symbols/MARTYRIA-COMPOSITION.md`](../issues/002-byzantine-symbols/MARTYRIA-COMPOSITION.md).
This document assumes that background and does not repeat it.

---

## 2. The six tables (`byzantine.js`)

None of them names a codepoint. Codepoints live only in the resolvers (§4).

- **`BYZ_NOTES`** — 21 letters (7 letters × low/mid/high octaves), ascending
  in pitch. The array **index is the note's ladder position** (see §5) and
  coincides with SBMuFL codepoint order, which is exactly why the resolver can
  compute a codepoint by arithmetic instead of a lookup table. Each row carries
  both spellings of its letter, `latin` and `greek`; the martyria picker labels
  a row `Pa (Πα)` — Latin first, because that is what a reader types and the
  glyph beside it is already the psaltic letter. `BYZ_FTHORES` follows the same
  rule with no gloss at all (`Diatonic Pa`, `Hard chromatic Di`). `BYZ_GENERA`
  does **not**: its labels still read `Ζω (diatonic)`, `Hard chromatic Πα` and
  so on. That is the one place the two spellings still disagree, and it is
  visible in the martyria picker, whose Genus column sits beside a Notes column
  that now leads with the Latin name.
- **`BYZ_GENERA`** — 12 genus (ichos) signs, in SBMuFL block order. Each row's
  `index` is the offset within that block; the resolver adds it to whichever
  register base applies (§4).
- **`GENUS_NONE`** — the sentinel meaning "no genus mark; the letter is drawn
  alone." It is the default for every new martyria.
- **`BYZ_FTHORES`** — 16 standalone fthores (normal advance, not the
  zero-advance Above/Secondary/Tertiary/Below variants meant to ride a neume).
  Sixteen *contiguous* glyphs, which is what lets `resolveFthoraGlyph` index
  the block by arithmetic — see the first departure in §3.
- **`BYZ_ALTERATIONS`** — 10 signs of alteration: four numbered diesis, four
  numbered yfesis, and the two geniki. Unlike every other vocabulary here it
  spans **two** blocks, so a row names a `family` (`"diesis"` or `"yfesis"`)
  as well as an `index`, and the resolver picks the base from the family. The
  "no table names a codepoint" invariant is intact — this is the same shape
  `BYZ_GENERA` already has, where the resolver picks a base from the register.
- **`MARTYRIA_COMPATIBILITY`** and **`FTHORES_COMPATIBILITY`** — see §3.

The tables above are the only Byzantine-specific thing in this file. What follows them —
`inkBox`, `inkCenteringShift`/`inkCenteringShiftEm`, `drawGlyphs`, `domGlyphText`,
`scanInkBox`, and `freezeTable` up at the top — is shared, **font-agnostic** machinery: every
one of them takes its face as an explicit argument, and `smufl.js` and `symbols-ui.js` call
them with `smuflFont(...)` exactly as this file's own callers pass `byzantineFont(...)`. They
were not moved into a third, font-neutral file when the accidental layer was added, because
doing so would have been a large diff unrelated to that feature. See §8 and §10 for how the
model works, and [`docs/SMUFL-ACCIDENTALS.md`](SMUFL-ACCIDENTALS.md) §7 for the same story
told from the SMuFL side.

---

## 3. The two compatibility tables

Both say "these signs belong on this note, the rest are unusual", and both are
rendered the same way — the compatible list first, a `.sym-separator`, then
everything else. They have **different provenance**, and that is the whole of
what a maintainer needs to keep straight.

### 3a. `MARTYRIA_COMPATIBILITY` is hand-maintained

This is the table in `byzantine.js` expected to be edited by hand, and the one
most likely to need it: it encodes a musicological judgement call, not
something derivable from the font or from the other tables.

It comes from
[`issues/002-byzantine-symbols/modes-table.html`](../issues/002-byzantine-symbols/modes-table.html),
which is **not final** — treat it as a snapshot, not a spec. When that table
changes, redo `MARTYRIA_COMPATIBILITY` like this:

1. Open `modes-table.html`. Its columns, left to right, are Modes I–VIII,
   varys, then the three transcribed makam scales: Müstear, Nişabur, Hisar.
2. Read one row (one degree) left to right, writing down each cell's genus id.
3. Drop repeats, keeping the **first** occurrence — so the resulting order is
   exactly the table's column order for that row.
4. That de-duplicated list is the note's array in `MARTYRIA_COMPATIBILITY`.
   Nothing else in the codebase changes: the picker (`buildGenusColumn` in
   `byzantine-ui.js`) just renders whatever list `compatibleGenera(noteId)`
   returns, in order, above a separator, with `otherGenera(noteId)` (every
   remaining genus, in `BYZ_GENERA` block order) below it.

`test/unit/byzantine-symbols.test.js` checks every note has a non-empty list
of known, non-duplicated genera, and pins one sample — `midDi`'s order — as a
worked example. **Update that pinned sample** if the table's column order
changes; it is meant to fail the moment `MARTYRIA_COMPATIBILITY` and
`modes-table.html` drift apart.

### 3b. `FTHORES_COMPATIBILITY` is derived from rules

It is written out as a literal, for the same reasons the table above is — a
literal is easier to eyeball and to diff, and it has a per-row exception a
generator would have to special-case anyway — but it is not read off a source
document. It follows four rules, given `value = BYZ_NOTES.indexOf(id) − 9`, so
that `midPa` is 0:

1. **Diatonic, by letter, in every register.** Ζω→`diatonicZo`, Πα→`diatonicPa`,
   and so on; Νη takes `diatonicNiLow` for `lowNi`/`midNi` and
   `diatonicNiHigh` for `highNi`.
2. **Chromatic, by the parity of `value`.** Even → `hardChromaticPa` and
   `softChromaticKe`; odd → `hardChromaticDi` and `softChromaticDi`. This is
   the same rule Neanes' `LayoutService` uses for its root signs and the same
   one `MARTYRIA_COMPATIBILITY` follows, which is the point: the two tables
   cannot drift apart on the chromatic signs without one of them being wrong.
3. **Enharmonic (acem), by letter:** Βου, Γα, Ζω.
4. **Chroa, by letter:** `chroaZygos` and `chroaKliton` on Δι; `chroaSpathi` on
   Γα and Κε.

Each row is in `BYZ_FTHORES` block order, so a row stays stable when it gains
an entry. A unit test pins the parity rule, so the literal cannot silently
drift from rule 2.

**Three deliberate departures** from
[`FTHORA-COMPATIBILITY.md`](../issues/002-byzantine-symbols/FTHORA-COMPATIBILITY.md),
the research this was built on. They are exactly what a future maintainer will
otherwise "correct", so each is pinned by a test of its own:

| The research says | We do | Why |
|---|---|---|
| `diesisGeniki` and `yfesisGeniki` are fthores, on Γα and Κε | They are **alteration** signs, and appear in neither compatibility table | SBMuFL files them under Signs of Alteration, and keeping them out leaves `BYZ_FTHORES` at sixteen contiguous glyphs — so `resolveFthoraGlyph`'s `BYZ_FTHORA_BASE + index` arithmetic survives untouched |
| §6a leaves the two Νη signs open | **Strict by register:** `lowNi`/`midNi` → `diatonicNiLow`, `highNi` → `diatonicNiHigh` | Faithful to the one-octave span in Neanes' `getShift`. It costs nothing: the other Νη sign is still pickable, one line below the separator |
| §6b leaves it open | **`hardChromaticDi` is not offered on Νη**, so it comes out of `midNi` | Tracks Neanes' own Fthora Note dropdown (Ζω′, Δι, Βου). `MARTYRIA_COMPATIBILITY` still lists it for `midNi`; the two tables are about different signs, and the divergence is on purpose |

`BYZ_ALTERATIONS` has no compatibility table at all: every sign of alteration
is offered on every note.

---

## 4. The register rule lives in one function

A martyria's genus mark comes in two mark sets — `…Above` and `…Below` — and
each note letter's glyph carries only *one* of the two anchor points a mark
can attach to (`martyriaTop` or `martyriaBottom`; see
`MARTYRIA-COMPOSITION.md` §5). Pair a letter with the wrong mark set and the
font's mark-to-base lookup finds no matching anchor, so the mark lands at the
pen position instead of on the letter — a visibly broken martyria.

`byzantine.js` is the **only** place that rule is allowed to live, in three
functions that share it: `resolveMartyriaGlyphs` composes letter and mark,
`resolveGenusGlyph` returns the mark on its own, and `martyriaMarkSide` reports
which side it will stack on. All three choose the `…Above` marks for the low
register (whose letters expose `martyriaTop`) and the `…Below` marks for the
middle and high registers (whose letters expose `martyriaBottom`). Nothing else
in the codebase — not the picker, not the ladder, not `app.js` — may encode this
rule a second time.

A genus picker row is the click that commits the pair, so it previews the pair:
the drafted letter carrying that genus's mark, composed by
`resolveMartyriaGlyphs` like everything else that shows a whole martyria. The
letter is repainted over itself in grey so the mark still reads as the row's
subject (§8). `resolveGenusGlyph` and `martyriaMarkSide` therefore have no
caller in the UI any more; they stay because they are how this file *states* the
register rule, and the unit tests use them to prove a composition carries the
mark its register demands.

---

## 5. The ladder

A martyria names an *absolute* degree of the scale, so changing which note a
degree sits on has to be able to walk every other degree's martyria in
lock-step. The ladder is what makes that a single arithmetic operation instead
of per-note lookups.

- **Positions 0–27.** Positions 0–20 are the 21 `BYZ_NOTES` letters, in order.
  There is no SBMuFL block above high Κε, so the ladder is extended upward —
  never downward — by one ticked octave: positions 21–27 are the same seven
  high letters again, each drawn with a trailing `martyriaTick` glyph
  (`ladderPosition`/`ladderNoteAt`). There is no block below low Ζω either, so
  the ladder simply stops at position 0; it does not extend downward with a
  tick.
- **The two legality inequalities**, in `isLadderPositionLegal(position,
  degree, degreeCount)` — true when placing 1-based `degree` (of
  `degreeCount`) at `position` still leaves room for every other degree:
  - `position >= degree - 1` — there must be enough ladder below `position`
    for the degrees under it.
  - `position + (degreeCount - degree) <= LADDER_MAX` — there must be enough
    ladder above `position` for the degrees over it.
- **The anchor is clamped before propagation walks**, in
  `clampLadderPosition(position, degree, degreeCount)`, which slides an
  illegal anchor to the nearest end of the window the two inequalities above
  describe. The legal window depends on how long the scale is, and a scale
  grows *after* its martyries are set: letters that fitted two degrees need
  not fit nine. The picker disables the rows that break the inequalities, so a
  freshly drafted letter is always legal — but a draft that changed only the
  *genus* still carries whatever letter the row already had, which may by then
  be stranded. That is the case the clamp exists for: applying re-anchors the
  whole scale rather than leaving it with empty wells and no gesture that
  repairs them. A scale longer than the ladder (more than 28 degrees) has no
  legal window at all — it anchors at the bottom and the degrees past the top
  rung stay empty, which is the only case where propagation still skips a row.
- **Propagation moves letters only.** `propagateMartyriaLadder` (in
  `byzantine-ui.js`) walks every other note row to `ladderNoteAt(base + Δ)`
  from whichever row's martyria the user just confirmed. It only ever changes
  a row's *note*; each row keeps whatever genus it already had (or the
  `GENUS_NONE` sentinel if it had none), and fthores are never touched by the
  ladder at all.
- **Clicking a row is the commit; every other way out cancels.** There is no
  Apply and no Cancel. `selectSymbolOption` (`symbols-ui.js`) writes the row,
  and for a martyria goes on to propagate the ladder, close every panel and
  render — all on the click that chose the row. `closeSymbolPickers` merely
  closes, so a click outside, a second click on the well and another picker
  opening are one and the same cancel, and a picker opened and closed again is
  a no-op in every direction.

  The martyria is the one picker that still holds a *draft* on its panel element
  (`draftNote`, `draftGenus`, `draftTicks`, seeded from the row by
  `seedPickerDraft`), because it commits a pair across two columns: a click in
  the Notes column only moves the draft and rebuilds the panel, so the Genus
  column can re-resolve its previews around the new letter, and it resets the
  drafted genus to `GENUS_NONE` — a genus picked for the previous letter is not
  a choice the user made for this one. The genus click is what reaches the row.
  Picking None in the Notes column is its own commit, having no genus left to
  confirm; without that, an empty well would be unreachable.

---

## 6. Adding a second font

This is no longer hypothetical. It happened once already, for a different well
rather than a swapped face: [`docs/SMUFL-ACCIDENTALS.md`](SMUFL-ACCIDENTALS.md)
is the worked example of most of what follows, and its §8 is the SMuFL-side
mirror of this checklist. The one part that example does *not* exercise is the
resolver bullet below — the SMuFL accidental catalogue is a flat id-to-codepoints
table (`docs/SMUFL-ACCIDENTALS.md` §2), not the register-based arithmetic this
section describes, because there is no register concept for a SMuFL accidental
to belong to. The checklist below is for a font that *does* have one — a second
Byzantine-style face replacing Neanes for the martyria/fthora/alteration
vocabulary. What changes:

- A second `@font-face` (in `style.css`) for the new font.
- A second set of resolvers — the equivalents of `resolveMartyriaGlyphs`,
  `resolveFthoraGlyph` and `resolveAlterationGlyph` — encoding that font's own
  codepoint layout, and the `BYZ_*_BASE` constants they add to. This is the
  *only* place a new codepoint is ever written.
- `BYZ_FONT_FAMILY` (`byzantine.js`) — the family name, written once. Every
  font string the JavaScript uses is built from it by `byzantineFont()`: the
  chart's drawing and measuring font, and one of the two faces
  `loadSymbolFonts()` preloads (§7). `SMUFL_FONT_FAMILY` (`smufl.js`) is the
  identical discipline for Bravura Text — nothing outside the two files that
  declare these two constants should ever write a family name into a font
  string by hand.
- **Both CSS rules that name the family**, because CSS cannot read a JS
  constant: `.accidental-well, .alteration-well, .fthora-well, .martyria-well`
  (the four wells in the editor — a new Byzantine face still shares this rule
  with the accidental well, which then overrides the family to
  `"Bravura Text"` on its own) and `.sym-glyph` (the previews on every option row of
  every picker panel, `.accidental-picker .sym-glyph` overriding the same
  way). Miss these and the chart changes font while the editor keeps drawing
  the old one.
- **The two rules that size fthores and signs of alteration** —
  `.alteration-well, .fthora-well` and `.alteration-picker .sym-glyph,
  .fthora-picker .sym-glyph`. They do not name the family, but the numbers on
  them are derived from Neanes: those two families' widest sign covers 0.84em
  where a martyria covers 1.21, so they are set larger to fill the same box.
  A face with different proportions needs the ratio re-measured, exactly as
  `BYZ_SIGN_GAP` does. (The accidental well and picker have their own,
  separate sizing rules, not derived from a measured ratio in the same way —
  see `docs/SMUFL-ACCIDENTALS.md` §8.)
- **The empty-well hints** — `.accidental-well.is-empty::before`,
  `.alteration-well.is-empty::before/::after` and
  `.fthora-well.is-empty::before`. These are the one place outside the
  resolvers where a codepoint is written by hand, and they are the price of
  showing the *real* signs an empty well takes rather than an abstract mark:
  CSS `content` takes a codepoint and nothing else. Each also carries the em
  offset `inkCenteringShiftEm()` returns for its glyph string, since CSS
  cannot call it. A new face needs both re-read — its codepoints and its
  shifts. The martyria's hint is drawn from plain rectangles and is exempt.

Everything else is untouched: the six tables (§2), the two compatibility
tables (§3), the ladder (§5), `readScaleData`, and the chart in `app.js`. The
well and picker *machinery* — opening, committing, dismissing, the grouped-list
builder, search — is shared, notation-agnostic code in `symbols-ui.js`; only
the three Byzantine picker *builders* (`buildAlterationPicker`,
`buildFthoraPicker`, `buildMartyriaPicker`), the martyria draft and the ladder
stay in `byzantine-ui.js`. In particular, the register→mark-set rule (§4) is
resolver logic, not model logic — a new font's resolvers re-derive it for
that font's own anchors; they do not inherit Neanes's answer.

`inkBox`/`drawGlyphs` (`byzantine.js`) exist precisely so this swap needs no
offset tuning: they place a sign from its *measured ink*, not from an assumed
baseline position, so a face whose ink sits on the other side of the baseline
from Neanes's still lands correctly with zero changes to the drawing code.

**A new Byzantine font's proportions need no chart changes.** In Byzantine
notation, all four chart paths size the room they keep at the ends of the
stack from one quantity, `signExtent` in `render()` — the wider (horizontal)
or taller (vertical) of the **martyria and the gutter run** actually present
in the scale, a run being a degree's alteration and fthora together (§11).
Whichever a new face draws bigger, the clearance follows it, and a scale
carrying only one sign reserves room from that sign. Generic notation follows
an analogous but distinct rule — its overhang is sized from the gutter run
alone, an accidental if any, deliberately never from the note name — see
`docs/ARCHITECTURE.md`'s Chart Rendering → Sizing.

`BYZ_SIGN_GAP` in `app.js` — the space between an alteration and its fthora —
is the one number here settled by eye rather than measured. At 40px it is 8px,
against signs whose ink is about a third of an em wide. Four values were looked
at in a browser: at 2 and 4 the pair collides into a single shape, at 12 it
reads as two unrelated annotations, and 8 keeps it one unit. That is a sample,
not a measured band — a face with very different proportions should be looked
at again the same way.

---

## 7. Font loading and `symbolFontsReady`

PUA codepoints have no fallback glyph, so a chart drawn before a face has
actually loaded shows blank boxes, and its ink measurements are taken against
whatever fallback font the browser substituted. `loadSymbolFonts()` in
`app.js` asks `document.fonts` to load **both** vendored faces — Neanes and
Bravura Text — and, once every one that can resolve has, calls `render()`
again — that second `render()` is what fixes the blank-box problem, because
it is the first render that measures and draws against the real metrics. The
specs it hands `document.fonts.load()` are `byzantineFont(BYZ_FONT_SIZE)` and
`smuflFont(SMUFL_FONT_SIZE)`, the very strings the chart draws with, so a
preloaded face cannot drift from the drawn one when either font changes (§6).
A face that fails to load is warned about *by name*, on the console, and does
not stop the other from loading — one broken font file must not blank the
notation that still works — and the repaint happens once both faces have
settled, not once per face.

`app.js` also sets a module-level flag, `symbolFontsReady = loaded.every(Boolean)`,
in that same callback — `true` only when every requested face resolved,
`false` if any one of them failed. **It is a deliberate readiness observable
with no production consumer** — nothing in `app.js`, `byzantine.js`,
`smufl.js`, `symbols-ui.js` or `byzantine-ui.js` reads it. It exists so a test
(or a future debugging session) can ask "have the faces resolved yet?"
without depending on timing. Do not "clean it up" as dead code, and do not
wire it into the render path — the redraw that follows the font promises is
what does the actual work; the flag is a byproduct of it, not a guard on it.

---

## 8. Where a sign sits in a box

Three places show a whole martyria — a Notes row in the picker, a Genus row in
the picker, and the well on the note row — and they must agree, because the user
reads them against each other. `glyphBoxPlacement()` (`symbols-ui.js`) routes
all three to the same placement, so there is one mechanism and not three.

**Every martyria shares one baseline.** `martyriaInkRange()` (`byzantine.js`)
measures the vertical range the *whole vocabulary* spans in the current face —
every letter, every mark, ticked and not — and `inkCenteringShift()` centres
*that* range rather than each composition's own ink. This is not a refinement;
it is the difference between working and not:

- A low letter and its middle-octave twin are **the same outline drawn at two
  heights**. In Neanes at 24px the low Πα's ink sits at `[+3.8, +11.1]` and the
  middle one's at `[−8.9, −1.6]` — identical size, identical advance. Where it
  sits is the *only* thing that tells the registers apart, and it is how a
  reader identifies a low letter, which has no octave tick to give it away.
  Centre each on its own ink and all three registers land in the middle of their
  box, rendering identically.
- A genus mark grows the composition on one side only. Centring the composition
  drags the **letter** off the spot the reader is judging the mark's side
  against; the shared baseline holds the letter still and lets the mark move.

The genus list is on the same baseline, which is the point of it: every row
draws the *same* letter with a different mark, so the letter is the fixed point
and the mark is the only thing that moves. A fthora and a sign of alteration
belong to no such family, so each is centred on its own ink.

**A genus row's letter is drawn twice.** The row previews a whole martyria but
is about the mark, so the composition is painted first and the letter alone is
painted over it in `--ink-faint`, covering its own black copy and leaving the
mark black. The obvious alternative — colour the mark on its own — is not
available: a mark is a combining glyph the font attaches to the letter's anchor,
and two elements have no shaping between them, so a mark in a span of its own
would land at the pen position unattached. The two layers sit inside one
`.glyph-ink`, so they share its offset; the mark carries no advance, so the
letter lands exactly on itself and there is no fringe.

The range is measured once per font string and cached. It is a fact about the
face, so a second font re-derives it and nothing else changes (§6).

**Offsets are in em, never pixels.** `inkCenteringShiftEm()` measures once at
`BYZ_FONT_SIZE` and divides. The ink metrics are exactly proportional to the
font size — verified across 16–64px in Neanes; only the *strut* rounds to whole
pixels — so one measurement serves every box the editor draws, and there are
now four sizes among them: the martyria's 22px well and 24px picker row, and
the larger 31px and 34px the other two families are set at (§6).
The alternative, reading `getComputedStyle(box).fontSize`, is what the old code
did, and it reports **nothing at all** for a box that is not in the document
yet. The scale-mode switch rebuilds every note row detached and fills its wells
before appending them, so every sign was measured against a 40px fallback and
sat visibly wrong — in both modes, since the switch back rebuilds the same way.
In em there is no size to get wrong.

### 8a. Engines that will not paint a bare mark

A canvas paints the glyphs it is handed. DOM text is *shaped* first, and WebKit
paints nothing at all for a run made up of nothing but zero-advance marks —
which is every sign of alteration in this face, each one a combining mark the
font expects to find attached to a neume. The consequence in Safari was that the
chart drew the signs and the editor did not: the alteration well and every row
of the alteration picker came up blank, and so did the two geniki an empty well
shows as its hint.

`domGlyphText()` (`byzantine.js`) puts a **carrier** in front of such a run — a
no-break space, which no face draws and which, unlike an ordinary space, no
engine trims off the front of a run. That gives the run one glyph with an
advance, and the mark is painted again.

Two things keep this honest:

- **Whether a carrier is needed is measured, not assumed.** A face whose signs
  advance on their own gets none. Nothing here is a fact about Neanes.
- **The carrier is part of the string that gets measured.** `setGlyphBoxText()`
  measures the offset from what the box really holds, so whatever advance the
  face gives the carrier is already in the centring. In Neanes it is 0.007em.

The chart is untouched — it hands glyphs to a canvas, where no shaping happens.
The two empty-well hints in `style.css` carry the carrier by hand (`content:
"\A0\E204"`), because CSS `content` is written out rather than computed; §6
already lists them as a place codepoints are hand-written.

### 8b. Engines that will not report ink

`measureText` is the cheap way to a glyph's ink box, and on Blink and Gecko it
is the right one. WebKit answers a different question: it reports the ink
**unioned with the text's advance rect and its baseline**. So a box there never
rises above the baseline and never sits inside the advance:

| `` at 40px | ink (Blink) | WebKit |
|---|---|---|
| ascent | 44.12 | 44.11 |
| descent | −29.71 | **0** |
| left | −3.23 | **0** |
| right | 16.47 | **19.52** (the advance) |

Every fthora and every sign of alteration in this face has ink that clears the
baseline entirely, which is exactly the case the union destroys. Placed from
those numbers a fthora sits about a third of an em low — visibly off-centre in
its well, and out of line with the alteration beside it in the chart, which is
mis-placed by a *different* amount.

Nothing in `TextMetrics` can recover what the union threw away: the box always
contains the baseline, whatever anchor `textAlign`/`textBaseline` report it
from. Measuring twice from two baselines does not help, for the same reason. So
on those engines the ink is found where it actually is — in the pixels.
`scanInkBox()` (`byzantine.js`) draws the sign on a scratch canvas and scans the
alpha channel for the drawn area.

- **Which engine this is, is detected, not sniffed.** `measureTextReportsInk()`
  measures a no-break space, which no face draws anything for: an engine that
  reports ink reports none, an engine that unions hands back the whole advance.
  Asked once, of a generic family, so there is no font to wait for.
- **The reported box bounds the search.** A union only ever *grows* a box, so
  what `measureText` said is a superset of the ink and the scratch canvas needs
  no more surface than that plus a margin.
- **Results are kept**, because a rasterisation per sign is not free: the
  martyria vocabulary is a few hundred of them, about 145ms in WebKit against
  3ms where `measureText` is used. `resetInkMeasurements()` drops them, and
  `loadSymbolFonts()` calls it once both faces have settled (§7) — measurements
  taken against a fallback face must not outlive it. An empty scan is never
  cached, so a sign measured before its glyph existed is simply measured
  again.
- **Accuracy is one pixel at `BYZ_FONT_SIZE`**, and the anti-aliased fringe
  grows the box symmetrically, so the *centre* — which is what every caller
  actually uses — is unaffected.

---

## 9. Why the octave tick is appended, not prepended

SBMuFL describes `U+E145 martyriaTick` as the vertical tick set *before* a
martyria. That is a **different use** from this app's, and the leading ornament
is explicitly out of scope (see the design doc's §1). Here the tick is the
ladder's octave extension above high Κε (§5), and the two placements do not
render the same thing:

| | rendered | reads as |
|---|---|---|
| `E144 E145` (append) | `χ″` | the second stroke of a double prime — the octave above the high octave |
| `E145 E144` (prepend) | `′ χ′` | a separate ornament, then a martyria |

A high letter already carries its own octave stroke, so a tick after it lands
beside that stroke and compounds it. Before the letter it cannot: the high
letters have a wide left side bearing (0.38 em in Neanes), which opens a visible
gap the tick sits on the far side of. No Unicode control character closes that
gap — it is font geometry, and only negative letter-spacing would move it, which
does not survive a `fillText` and would be a fact about Neanes besides.

Both orders are equally well-formed as text: `martyriaTick` is an ordinary
spacing glyph (a positive advance of 0.148 em, not the zero advance the
comparison table in `SBMUFL-FONTS.md` claims), the genus marks are the only
GPOS marks in play, and in both orders the mark still immediately follows the
letter it attaches to — which is the one ordering constraint that would break
silently. `E146`–`E14F` are unassigned in Neanes, so there is no dedicated
octave glyph to use instead.

`test/unit/byzantine-symbols.test.js` pins both facts, so this does not get
"corrected" back.

---

## 10. The ink model in the tests

`test/helpers/canvas-stub.js` models font metrics deterministically instead of
using a real font — see `docs/TESTING.md` §5 for the general
`measureText`/`measureTextInk` contract. The ratios that shape the model
(`INK_LEFT_BEARING_RATIO`, `INK_WIDTH_RATIO`, `ASCENT_RATIO`, `DESCENT_RATIO`,
`MARK_ABOVE_ASCENT_RATIO`, `MARK_BELOW_DESCENT_RATIO`, `FTHORA_ASCENT_RATIO`,
`FTHORA_DESCENT_RATIO`, `ALTERATION_ASCENT_RATIO`, `ALTERATION_DESCENT_RATIO`,
`GENIKI_ASCENT_RATIO`, `GENIKI_DESCENT_RATIO`, `FONT_ASCENT_RATIO`,
`FONT_DESCENT_RATIO`, `LOW_REGISTER_DROP_RATIO`, `HIGH_REGISTER_RISE_RATIO`)
and the
codepoint ranges it treats as zero-advance marks live at the top of that file.
It is a **documented model of the shape of a real SBMuFL font's metrics — not a
measurement of Neanes itself.** Tests that need an expected ink box compute it
with the exported `measureTextInk()` helper rather than hard-coding numbers,
the same way non-Byzantine tests use `measureTextWidth()`.

Some properties of that shape exist because ink placement depends on them, and
a simpler model would hide the bugs it is there to catch:

- **A fthora's ink never crosses the baseline.** `E1D0`–`E1DF` are modelled with
  a *negative* descent, because the face cuts them to ride above a neume. A
  glyph centred by its line box therefore floats near the top of its box, which
  is what `inkCenteringShift()` corrects. Every other glyph in the model
  straddles the baseline, so a fthora is the only case that proves the
  correction is measured rather than guessed.
- **A sign of alteration has ink but no advance.** `E1F0`–`E20F` are modelled
  zero-advance, with a negative descent like a fthora's. Both matter: measure
  the advance instead of the ink and a run of these signs comes out zero wide,
  collapsing the gutter it is supposed to size. The two geniki (`E1F4` and
  `E204`) are drawn a whole em higher than the eight numbered signs and are
  *interleaved* with them in the encoding rather than contiguous, so the stub
  lists them explicitly instead of testing a range.
- **The three octave blocks sit at three heights.** A low letter is modelled as
  the middle one pushed down by `LOW_REGISTER_DROP_RATIO`, a high one as the
  middle one reaching up by `HIGH_REGISTER_RISE_RATIO` for its octave stroke —
  both taken from Neanes. The middle register keeps the model's base ratios, so
  every measurement that is not about registers is unchanged. Without this the
  three registers would be indistinguishable in the model and §8's shared
  baseline could not be tested at all.
- **The strut is asymmetric.** `fontBoundingBoxAscent` and
  `fontBoundingBoxDescent` are reported (0.775 em and 0.25 em), so the baseline
  does *not* sit in the middle of the line box. A model with a symmetric strut
  would make the vertical half of `inkCenteringShift()` look unnecessary.
- **The box moves with the anchor.** `ctx.measureText` reports
  `actualBoundingBox…` from the point `textAlign` and `textBaseline` select, as
  a real canvas does — align right and the box shifts by a whole advance. A
  stub that ignored them would report the same box however the context was left,
  which is exactly the state that hides a caller measuring without pinning them.
  `inkBox` pins both; if you write another measurement helper, pin them there
  too.

---

## 11. A gutter run

The gutter beside the separators holds a **run** of signs, not one sign — and
the run is **no longer Byzantine-only**. `signRunOf(noteItem, notation)`
(`app.js`) derives it from `SYMBOL_WELLS` filtered by the current notation
(`docs/ARCHITECTURE.md`'s Notation section), so what the run holds and the
order it holds it in is one fact, read off the same table the editor builds
its wells from — not a rule restated in the chart. In Byzantine notation a run
is up to two parts, `[alterationText, fthoraText]` with the empties dropped,
the alteration first because it qualifies the fthora, which is how a psaltic
accidental is written. In Generic it is at most one part, the accidental —
see [`docs/SMUFL-ACCIDENTALS.md`](SMUFL-ACCIDENTALS.md). A degree carrying
only some of its wells draws those, in the same place a full run would — a
well the user filled must never draw nothing, and a run of one is not a
special case anywhere below.

Three helpers in `app.js` own the layout, and none of them mention Byzantine
by name — a run's face is passed in, from `symbolFontFor(notation)`:

- `glyphRunExtent(parts, font)` — the run's ink width (parts plus one
  `BYZ_SIGN_GAP` between each) and its height (the tallest part's). It
  measures **ink, never the advance**, which is 0 for every Byzantine sign of
  alteration and irrelevant for a Generic run, which never has a second part
  to gap against.
- `maxRunExtent(runs, font)` — the widest and tallest run. The maximum is over
  *whole runs*, i.e. over degrees, not per sign: a Byzantine scale where one
  degree carries an alteration and another a fthora needs a gutter one sign
  wide, not one sized for a pair that never occurs.
- `drawSignRun(parts, x, y, align, vAlign, font)` — anchors the **run as a
  whole** horizontally and **each part independently** vertically at the same
  `y`. That single rule is what serves both orientations, both notations, and
  runs of one part or two alike: a horizontal chart anchors `"bottom"` at the
  gutter's inner edge, so a run's ink bottoms sit on one line; a vertical
  chart anchors `"right"` there, so the second part (when there is one) keeps
  exactly the position it had before there was a first part to its left.

`drawSymbol(text, x, y, align, vAlign, font)` — renamed from
`drawByzantineMark`, for the same reason `drawSignRun` was — is still the
single-sign primitive underneath, and is what `drawNoteLabel` uses to draw a
martyria: a martyria is one sign, not a run, and it is never Generic (a typed
note name draws through `ctx.fillText`, not through this function — see
`docs/ARCHITECTURE.md`'s Chart Rendering → Text layout).
