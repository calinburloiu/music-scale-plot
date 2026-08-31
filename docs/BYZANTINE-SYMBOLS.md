# Byzantine notation — a maintainer's map

This is the human-readable guide to the Byzantine (psaltic) notation layer:
`byzantine.js` (the symbol model — tables and SBMuFL resolvers, no DOM) and
`byzantine-ui.js` (the editor UI built on top of it — wells, pickers, the note
ladder). `docs/ARCHITECTURE.md`'s **Notation** section is the one-paragraph
orientation; this document is where you come to actually change something.

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
  compute a codepoint by arithmetic instead of a lookup table.
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

---

## 3. The two compatibility tables

Both say "these signs belong on this note, the rest are unusual", and both are
rendered the same way — the compatible list first, a `.byz-separator`, then
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
`resolveGenusGlyph` returns the mark on its own (what a picker row shows), and
`martyriaMarkSide` reports which side it will stack on (what the picker lays
its rows out around). All three choose the `…Above` marks for the low register
(whose letters expose `martyriaTop`) and the `…Below` marks for the middle and
high registers (whose letters expose `martyriaBottom`). Nothing else in the
codebase — not the picker, not the ladder, not `app.js` — may encode this rule
a second time.

A picker row offers a *genus*, so it shows that genus's mark alone, via
`resolveGenusGlyph`. Letter and mark are only ever composed in two places: the
footer preview of the open picker, and the well itself. Because a lone mark has
no letter to say which way it faces, the genus column seats it against the edge
it would attach on — `martyriaMarkSide` picks the edge, `glyphBoxAlign` in
`byzantine-ui.js` applies it.

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
- **Only Apply confirms; every other way out cancels.** An open picker edits a
  *draft* held on the panel element (`draftFthora`, `draftNote`, `draftGenus`,
  `draftTicks`), seeded from the row by `seedPickerDraft` when the panel opens.
  Clicking an option moves that draft and rebuilds the panel around it:
  `selectByzantineOption` writes nothing to the row and never renders, so the
  well goes on showing the committed symbol and the chart never flickers
  through half-made states. `applyPickerDraft` is the only path that writes the
  row, propagates the ladder and renders. `closeByzantinePickers` merely closes
  and drops the draft, so Cancel, a click outside, a second click on the well
  and another picker opening are one and the same cancel. Apply is disabled
  while `pickerDraftIsDirty` is false, which makes a picker opened and closed
  unchanged a no-op in every direction.

---

## 6. Adding a second font

The whole point of splitting `byzantine.js` out this way is that a font swap
is small and localized. What changes:

- A second `@font-face` (in `style.css`) for the new font.
- A second set of resolvers — the equivalents of `resolveMartyriaGlyphs`,
  `resolveFthoraGlyph` and `resolveAlterationGlyph` — encoding that font's own
  codepoint layout, and the `BYZ_*_BASE` constants they add to. This is the
  *only* place a new codepoint is ever written.
- `BYZ_FONT_FAMILY` (`byzantine.js`) — the family name, written once. Every
  font string the JavaScript uses is built from it by `byzantineFont()`: the
  chart's drawing and measuring font, and the face `loadByzantineFont()`
  preloads (§7). Nothing else in the JavaScript names a family.
- **All three CSS rules that name the family**, because CSS cannot read a JS
  constant: `.alteration-well, .fthora-well, .martyria-well` (the three wells
  in the editor), `.byz-glyph` (the previews on every option row of every
  picker panel) and `.byz-preview` (the drafted martyria in the picker
  footer). Miss these and the chart changes font while the editor keeps
  drawing the old one.
- **The two rules that size fthores and signs of alteration** —
  `.alteration-well, .fthora-well` and `.alteration-picker .byz-glyph,
  .fthora-picker .byz-glyph`. They do not name the family, but the numbers on
  them are derived from Neanes: those two families' widest sign covers 0.84em
  where a martyria covers 1.21, so they are set larger to fill the same box.
  A face with different proportions needs the ratio re-measured, exactly as
  `BYZ_SIGN_GAP` does.

Everything else is untouched: the six tables (§2), the two compatibility
tables (§3), the ladder (§5), the pickers (`byzantine-ui.js`), `readScaleData`,
and the chart in `app.js`. In particular, the register→mark-set rule (§4) is
resolver logic, not model logic — a new font's resolvers re-derive it for
that font's own anchors; they do not inherit Neanes's answer.

`inkBox`/`drawGlyphs` (`byzantine.js`) exist precisely so this swap needs no
offset tuning: they place a sign from its *measured ink*, not from an assumed
baseline position, so a face whose ink sits on the other side of the baseline
from Neanes's still lands correctly with zero changes to the drawing code.

**A new font's proportions need no chart changes.** All four chart paths size
the room they keep at the ends of the stack from one quantity, `signExtent` in
`render()` — the wider (horizontal) or taller (vertical) of the **martyria and
the gutter run** actually present in the scale, a run being a degree's
alteration and fthora together (§11). Whichever a new face draws bigger, the
clearance follows it, and a scale carrying only one sign reserves room from
that sign.

`BYZ_SIGN_GAP` in `app.js` — the space between an alteration and its fthora —
is the one number here settled by eye rather than measured. At 40px it is 8px,
against signs whose ink is about a third of an em wide; below about 6 the pair
collides into a single shape and above about 12 it reads as two unrelated
annotations. A face with very different proportions should be looked at.

---

## 7. Font loading and `byzFontReady`

PUA codepoints have no fallback glyph, so a chart drawn before the Neanes face
has actually loaded shows blank boxes, and its ink measurements are taken
against whatever fallback font the browser substituted. `loadByzantineFont()`
in `app.js` asks `document.fonts` to load the face and, once it resolves,
calls `render()` again — that second `render()` is what fixes the blank-box
problem, because it is the first render that measures and draws against the
real Neanes metrics. The spec it hands `document.fonts.load()` is
`byzantineFont(BYZ_FONT_SIZE)`, the very string the chart draws with, so the
preloaded face cannot drift from the drawn one when the font changes (§6).

`app.js` also sets a module-level flag, `byzFontReady = true`, in that same
callback. **It is a deliberate readiness observable with no production
consumer** — nothing in `app.js`, `byzantine.js` or `byzantine-ui.js` reads
it. It exists so a test (or a future debugging session) can ask "has the face
resolved yet?" without depending on timing. Do not "clean it up" as dead code,
and do not wire it into the render path — the redraw that follows the font
promise is what does the actual work; the flag is a byproduct of it, not a
guard on it.

---

## 8. Where a sign sits in a box

Three places show a whole martyria — a note row in the picker, the picker's
footer preview, and the well on the note row — and they must agree, because the
user reads them against each other. `glyphBoxPlacement()` (`byzantine-ui.js`)
routes all three to the same placement, so there is one mechanism and not three.

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

The genus list is the exception, and deliberately so: a mark shown *without* its
letter has lost the thing that says which way it faces, so those boxes pin the
mark to an edge (`"top"` for the low register's `…Above` marks, `"bottom"`
otherwise) — see `martyriaMarkSide()` in §4. A fthora belongs to no such family
and is centred on its own ink.

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

The gutter beside the separators holds a **run** of signs, not one sign: a
degree's alteration and then its fthora, `[alterationText, fthoraText]` with
the empties dropped. The alteration comes first because it qualifies the
fthora, which is how a psaltic accidental is written. A degree carrying only
one of the two draws that one in the same place — a well the user filled must
never draw nothing.

Three helpers in `app.js` own the layout:

- `glyphRunExtent(parts, font)` — the run's ink width (parts plus one
  `BYZ_SIGN_GAP` between each) and its height (the tallest part's). It
  measures **ink, never the advance**, which is 0 for every alteration.
- `maxRunExtent(runs, font)` — the widest and tallest run. The maximum is over
  *whole runs*, i.e. over degrees, not per sign: a scale where one degree
  carries an alteration and another a fthora needs a gutter one sign wide, not
  one sized for a pair that never occurs.
- `drawByzantineSigns(parts, x, y, align, vAlign)` — anchors the **run as a
  whole** horizontally and **each part independently** vertically at the same
  `y`. That single rule is what serves both orientations: a horizontal chart
  anchors `"bottom"` at the gutter's inner edge, so the pair's ink bottoms sit
  on one line; a vertical chart anchors `"right"` there, so the fthora keeps
  exactly the position it had before there was anything to its left.

`drawByzantineMark` is still the single-sign primitive underneath, and is what
`drawNoteLabel` uses to draw a martyria — a martyria is one sign, not a run.
