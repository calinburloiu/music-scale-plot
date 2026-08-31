# Fthora compatibility and signs of alteration — design

Follow-up to issue **#2**. The work here is tagged `[#2]` like the rest of the
Byzantine notation effort, even though the issue itself is closed.

Companion to
[`FTHORA-COMPATIBILITY.md`](FTHORA-COMPATIBILITY.md),
which is the research this design is built on. That document establishes *what
is true*; this one decides *what we build*. Where the two differ, the
differences are called out explicitly in §2.3 — they are deliberate.

---

## 1. What we are building

Three changes, in dependency order:

1. **`FTHORES_COMPATIBILITY`** — a per-note list of the fthores that belong on
   that note, and a fthora picker that offers them above a separator with
   everything else below it, exactly as the martyria picker's genus column
   already does. A row with no martyria note gets the flat list it has today.
2. **A third symbol well: Sign of Alteration.** A new `BYZ_ALTERATIONS` table
   (the eight numbered diesis/yfesis signs plus the two *geniki*), its own
   resolver, its own `data-alteration` attribute on the note row, its own well
   and its own picker. No compatibility list — every alteration is offered on
   every note.
3. **Chart rendering.** A degree's alteration is drawn in the fthora gutter,
   immediately to the **left** of its fthora, both ink-placed, with the gutter
   and the end-overhang sized from the pair rather than from the fthora alone.

Out of scope, stated so it is not rediscovered mid-implementation:

- **Alterations do not change pitch.** `getFrequencyForDegree()` and the cents
  model are untouched. Like the fthora, an alteration is an annotation the
  chart draws; the moria values in the research are documentation for the
  picker labels, not arithmetic the app performs.
- **No `Secondary`/`Tertiary` variants**, and no `Below` variants. They exist
  for stacking several signs on one neume; we draw one sign per well.
- **The martyria picker is unchanged.**

---

## 2. `FTHORES_COMPATIBILITY`

### 2.1 Shape

A frozen `noteId → string[]` map in `byzantine.js`, written out longhand in
exactly the shape `MARTYRIA_COMPATIBILITY` already uses, with two accessors
mirroring `compatibleGenera` / `otherGenera`:

```js
/** The fthores that belong on this note, in BYZ_FTHORES block order. */
function compatibleFthores(noteId) {
  return FTHORES_COMPATIBILITY[noteId] || [];
}

/** Every other fthora, in BYZ_FTHORES block order — the uncommon choices. */
function otherFthores(noteId) {
  const compatible = compatibleFthores(noteId);
  return BYZ_FTHORES.filter((f) => !compatible.includes(f.id)).map((f) => f.id);
}
```

The two together partition `BYZ_FTHORES` — a property worth a test, because it
is what guarantees the picker offers all sixteen signs however the table is
edited.

### 2.2 The rules the table encodes

Given a note id, with `value = BYZ_NOTES.findIndex(id) − 9` (so `midPa` = 0):

1. **Diatonic — by letter, in every register.** Ζω→`diatonicZo`,
   Πα→`diatonicPa`, Βου→`diatonicVou`, Γα→`diatonicGa`, Δι→`diatonicDi`,
   Κε→`diatonicKe`; Νη→`diatonicNiLow` for `lowNi` and `midNi`,
   `diatonicNiHigh` for `highNi`.
2. **Chromatic — by parity of `value`.** Even → `hardChromaticPa`,
   `softChromaticKe`; odd → `hardChromaticDi`, `softChromaticDi`. This is the
   same rule `getRootSign` uses in Neanes and the same one
   `MARTYRIA_COMPATIBILITY` already follows, which is the point: the two tables
   cannot drift apart on the chromatic signs without one of them being wrong.
   **Exception:** `hardChromaticDi` is not offered on Νη (see §2.3).
3. **Enharmonic (acem) — by letter:** Βου, Γα, Ζω.
4. **Chroa — by letter:** `chroaZygos` and `chroaKliton` on Δι; `chroaSpathi`
   on Γα and Κε.

Order within a row is **`BYZ_FTHORES` block order**, which keeps a row stable
when it gains an entry.

### 2.3 Deliberate departures from the research

Three decisions were taken against the research document's default:

| Research says | We do | Why |
|---|---|---|
| §4 puts `diesisGeniki` on Γα and `yfesisGeniki` on Κε | **Neither appears in `FTHORES_COMPATIBILITY`.** They become alteration signs (§3) | SBMuFL files them under Signs of Alteration, and keeping them out of `BYZ_FTHORES` leaves that table at sixteen contiguous glyphs — so `resolveFthoraGlyph`'s `BYZ_FTHORA_BASE + index` arithmetic survives untouched, and the "no table names a codepoint" invariant needs no exception. Research §8.2 item 3 flagged this as the cost of the other choice. |
| §6a, both readings offered | **Strict:** `lowNi`/`midNi` → `diatonicNiLow`, `highNi` → `diatonicNiHigh` | Faithful to the one-octave span in `getShift`. It costs the user nothing: the other Νη sign is still pickable, one line below the separator. |
| §6b leaves it open | **`hardChromaticDi` is not offered on Νη** — it comes out of `midNi`, the only odd Νη | Tracks Neanes' own Fthora Note dropdown (Ζω′, Δι, Βου), which is the closest thing to a published compatibility list. `MARTYRIA_COMPATIBILITY` still lists `hardChromaticDi` for `midNi`; the two tables are about different signs, and this divergence is deliberate — say so in a comment on the `midNi` row so nobody "fixes" it. |

### 2.4 The table

```js
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
      // dropdown does not offer Νη for that sign. Deliberate — see the design's
      // §2.3 before "fixing" the disagreement with MARTYRIA_COMPATIBILITY.
      midNi:   ["diatonicNiLow", "softChromaticDi"],
      midPa:   ["diatonicPa", "hardChromaticPa", "softChromaticKe"],
      midVou:  ["diatonicVou", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      midGa:   ["diatonicGa", "hardChromaticPa", "softChromaticKe", "enharmonic", "chroaSpathi"],
      midDi:   ["diatonicDi", "hardChromaticDi", "softChromaticDi", "chroaZygos", "chroaKliton"],
      midKe:   ["diatonicKe", "hardChromaticPa", "softChromaticKe", "chroaSpathi"],
      highZo:  ["diatonicZo", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      highNi:  ["diatonicNiHigh", "hardChromaticPa", "softChromaticKe"],
      highPa:  ["diatonicPa", "hardChromaticDi", "softChromaticDi"],
      highVou: ["diatonicVou", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      highGa:  ["diatonicGa", "hardChromaticDi", "softChromaticDi", "enharmonic", "chroaSpathi"],
      highDi:  ["diatonicDi", "hardChromaticPa", "softChromaticKe", "chroaZygos", "chroaKliton"],
      highKe:  ["diatonicKe", "hardChromaticDi", "softChromaticDi", "chroaSpathi"],
    }).map(([noteId, fthores]) => [noteId, Object.freeze(fthores)])
  )
);
```

Written as a literal, not generated. It is derivable from §2.2, but the
existing compatibility table is a literal, a literal is easier to eyeball and
to diff, and the `midNi` exception is a per-row override that a generator would
have to special-case anyway. A unit test pins the parity rule so the table
cannot silently drift from it.

---

## 3. The alteration table

### 3.1 `BYZ_ALTERATIONS`

Ten signs, in SBMuFL block order. Verified present in `fonts/Neanes.woff2`
(v1.0.9) — all ten are zero-advance combining marks whose ink sits entirely
above the baseline, measured directly from the font:

| id | glyph | codepoint | ink (em, above baseline) |
|---|---|---|---|
| `diesis2` | `diesis2` | `U+E1F0` | x[−0.132, 0.191] y[0.290, 0.609] |
| `diesis4` | `diesis4` | `U+E1F1` | x[−0.152, 0.177] y[0.354, 0.680] |
| `diesis6` | `diesis6` | `U+E1F2` | x[−0.182, 0.171] y[0.324, 0.676] |
| `diesis8` | `diesis8` | `U+E1F3` | x[−0.343, 0.046] y[0.203, 0.590] |
| `diesisGeniki` | `diesisGenikiAbove` | `U+E1F4` | x[−0.119, 0.119] y[0.808, 1.230] |
| `yfesis2` | `yfesis2` | `U+E200` | x[−0.212, 0.114] y[0.453, 0.776] |
| `yfesis4` | `yfesis4` | `U+E201` | x[−0.133, 0.194] y[0.429, 0.754] |
| `yfesis6` | `yfesis6` | `U+E202` | x[−0.179, 0.174] y[0.428, 0.779] |
| `yfesis8` | `yfesis8` | `U+E203` | x[−0.193, 0.195] y[0.404, 0.790] |
| `yfesisGeniki` | `yfesisGenikiAbove` | `U+E204` | x[−0.119, 0.119] y[0.640, 1.062] |

Two facts from that table drive the rest of the design:

- **Zero advance, ink straddling the origin.** Every position in this app is
  computed from measured ink (`inkBox`, `inkCenteringShift`, `drawGlyphs`), not
  from the advance, so the whole family works with the existing machinery. It
  also means the chart's run layout must measure ink width, never `adv`.
- **The ink is horizontally asymmetric, and differently so per sign.**
  `diesis8` runs x[−0.343, +0.046]; `diesis2` runs x[−0.132, +0.191]. Centre
  these on the advance box and they visibly wander. This is the specific reason
  the request asks for Playwright verification (§7).
- The `Above` variants are used for the two geniki. `yfesisGenikiBelow`'s ink
  crosses the baseline (y[−0.180, 0.242]) and would be the one member of the
  family that breaks the "ink entirely above the baseline" shape the test stub
  models.

`BYZ_ALTERATIONS` lives in `byzantine.js` beside `BYZ_FTHORES`, and like every
table there it names a **family and an offset**, never a codepoint — the same
discipline `BYZ_GENERA` follows, where the resolver picks a base from the
register:

```js
const BYZ_ALTERATIONS = freezeTable([
  { id: "diesis2",      family: "diesis", index: 0, label: "Diesis 2 (+2 moria)" },
  { id: "diesis4",      family: "diesis", index: 1, label: "Diesis 4 (+4 moria)" },
  { id: "diesis6",      family: "diesis", index: 2, label: "Diesis 6 (+6 moria)" },
  { id: "diesis8",      family: "diesis", index: 3, label: "Diesis 8 (+8 moria)" },
  { id: "diesisGeniki", family: "diesis", index: 4, label: "General sharp (diesis geniki)" },
  { id: "yfesis2",      family: "yfesis", index: 0, label: "Yfesis 2 (−2 moria)" },
  { id: "yfesis4",      family: "yfesis", index: 1, label: "Yfesis 4 (−4 moria)" },
  { id: "yfesis6",      family: "yfesis", index: 2, label: "Yfesis 6 (−6 moria)" },
  { id: "yfesis8",      family: "yfesis", index: 3, label: "Yfesis 8 (−8 moria)" },
  { id: "yfesisGeniki", family: "yfesis", index: 4, label: "General flat (yfesis geniki)" },
]);
```

### 3.2 The resolver

```js
const BYZ_DIESIS_BASE = 0xe1f0; // diesis2 … diesisGenikiAbove
const BYZ_YFESIS_BASE = 0xe200; // yfesis2 … yfesisGenikiAbove

function resolveAlterationGlyph(alterationId) { … }
```

A third resolver alongside `resolveFthoraGlyph` — which means
`docs/BYZANTINE-SYMBOLS.md` §4's claim that a font swap is "a second pair of
these two functions" needs updating to three (research §9).

---

## 4. The editor

### 4.1 Row layout

Three wells per note row, left to right, **matching the order the chart draws
them in**:

```
[alteration] [fthora] [martyria]
```

`makeSymbolWellsHTML()` gains the alteration wrapper *first*, and the two
hand-written note rows in `index.html` follow it. In `style.css`, the
`margin-left: auto` that right-aligns the well cluster moves from
`.fthora-well-wrapper` to `.alteration-well-wrapper` — it belongs to whichever
well is now first.

The empty-state hint (`.alteration-well.is-empty::before/::after`) is a faint
cross, distinct from the fthora's single diagonal stroke and the martyria's two
stacked bars, so all three empty wells stay tellable apart before the webfont
arrives.

### 4.2 Row state

`NOTE_SYMBOL_ATTRS` gains `"alteration"`, which is the whole of the
persistence story: `noteSymbolAttrs` / `applyNoteSymbolAttrs` carry it across
editor rebuilds, and mode and notation switches come for free.

- `readNoteSymbols(row)` returns `alteration: row.dataset.alteration || ""`.
- `writeAlteration(row, id)` mirrors `writeFthora`.
- `readScaleData()`'s note items gain `alteration`.
- `refreshNoteRowWells(row)` fills the third well with
  `resolveAlterationGlyph(...)`, placement `"center"` — a sign shown on its own,
  ink-centred, exactly as the fthora well already is.

### 4.3 The two pickers

**The fthora picker becomes note-aware.** `buildFthoraPicker` reads
`row.dataset.martyriaNote`:

- **With a note:** `None`, then `compatibleFthores(noteId)`, then a
  `.byz-separator`, then `otherFthores(noteId)`.
- **Without a note:** `None`, then all sixteen in block order, no separator —
  the flat list it renders today. This mirrors how `buildGenusColumn` goes
  inert when the draft has no note.

The picker reads the row's **committed** martyria, not a draft: only one picker
is open at a time, and applying a martyria closes every panel, so the next
fthora open always re-reads current state. A committed fthora that is *not*
compatible still renders selected — below the separator.

**The alteration picker** is a flat list with two group headings and no
separator, in SBMuFL block order:

```
None
— Sharps —   diesis 2, 4, 6, 8, general sharp
— Flats —    yfesis 2, 4, 6, 8, general flat
```

Headings use the existing `byzGroupTitle`. They carry no `data-group`, so
`pickerRevealTarget` finds no fallback and the list opens at the top on `None`
— which is right here, since there is no register to prefer.

### 4.4 The refactor this needs

Adding a third kind of picker to code that branches two ways is the one real
architectural risk in this work. Today, eight functions in `byzantine-ui.js`
ask `panel.classList.contains("fthora-picker")` and treat "else" as martyria:
`seedPickerDraft`, `pickerDraftIsDirty`, `applyPickerDraft`,
`selectByzantineOption`, `toggleWellPicker`, `closeByzantinePickers`,
`handleByzantineClick`, `refreshNoteRowWells`. Naively extended, each grows a
three-way branch and the CSS selectors grow a third clause by hand.

Three approaches were considered:

1. **Copy the fthora path.** Smallest diff, fastest to write. Rejected: it
   triples the branch sites and guarantees the next sign family costs the same
   again.
2. **A full picker-kind polymorphism**, martyria included. Rejected as YAGNI:
   the martyria picker is genuinely different (two columns, a draft with three
   fields, ladder propagation on apply), and forcing it into a shared interface
   would obscure both.
3. **A descriptor table for the two single-value wells, martyria left as it
   is.** Chosen.

Concretely, a small table in `byzantine-ui.js`:

```js
// The two single-value wells differ only in their vocabulary, their glyph
// resolver, and which data-* attribute they read and write. Everything else —
// the draft, the footer, Apply/Cancel, scroll restoration — is shared.
const BYZ_SIMPLE_WELLS = [
  { kind: "alteration", attr: "alteration", draftAttr: "draftAlteration", … },
  { kind: "fthora",     attr: "fthora",     draftAttr: "draftFthora",     … },
];
```

Each entry carries its well class, panel class, option class, well `title`
(`"Sign of alteration"`, matching the existing `"Fthora"` and `"Martyria"`),
resolver and picker builder. `byzWellKind(panel)` returns `"alteration"`, `"fthora"` or
`"martyria"`, and the shared selectors (`.fthora-well, .alteration-well,
.martyria-well` and friends) are built from the table rather than written out
three times. `seedPickerDraft`, `pickerDraftIsDirty` and `applyPickerDraft`
each collapse to "look the kind up; if it is a simple well, read/write one
attribute; otherwise take the martyria path."

Two selector sites are easy to miss and must come from the table, not from a
hand-edited string — a miss in either leaves a picker that opens and will not
close:

- `closeByzantinePickers()` queries `.fthora-picker.open, .martyria-picker.open`
  and must also reach `.alteration-picker.open`. It is what `closeAllDropdowns()`
  in `app.js` calls, so this is the path every dismissal takes.
- `handleByzantineClick()` matches `.fthora-well, .martyria-well` to open a
  panel and `.fthora-picker, .martyria-picker` to swallow clicks on a panel's
  own chrome. Both need the third clause, or a click inside the alteration
  panel reaches the document listener and closes it.

Each gets a regression test in §6.1 ("an outside click discards the draft",
"opening one well closes the other two").

This refactor lands **first**, as its own commit, under the existing green
suite and with no behaviour change — then the alteration well is added on top
of it. That ordering is what makes the second commit small enough to review.

---

## 5. The chart

### 5.1 What is drawn

A degree's gutter content becomes a **run** of glyph strings in reading order:

```js
[alterationText, fthoraText].filter(Boolean)
```

The alteration comes first because it qualifies the fthora, which is how a
psaltic accidental is written. A degree with only an alteration draws that
alteration alone, in the fthora's place: a well the user filled must never
draw nothing.

`render()`'s per-interval record replaces `fthoraBelow`/`fthoraAbove` with
`signsBelow`/`signsAbove` (arrays). These are internal to `render()`, so no
test asserts on them directly.

### 5.2 Run layout

Two new helpers in `app.js`, beside `maxInkExtent` and `drawByzantineMark`:

```js
const BYZ_SIGN_GAP = 8; // between an alteration and the fthora it qualifies

/** Ink extent of a run of glyph strings laid out left to right. */
function glyphRunExtent(parts, font) { … }   // { width, height }

/** The widest and tallest run among `runs`. */
function maxRunExtent(runs, font) { … }      // { width, height }

/** Draws a run, anchoring the run horizontally and each part vertically. */
function drawByzantineSigns(parts, x, y, align, vAlign) { … }
```

`glyphRunExtent` sums the parts' **ink** widths (never `adv` — it is 0 for
every alteration) plus `BYZ_SIGN_GAP` between them; its height is the tallest
part's ink height.

`drawByzantineSigns` anchors the **run as a whole** horizontally, using the
summed width for `left`/`center`/`right`, and then anchors **each part
independently** vertically at the same `y` with the given `vAlign`. That single
rule produces the right result in both orientations:

- **Horizontal charts** anchor `vAlign: "bottom"` at `byz.anchor`, so the pair's
  ink bottoms sit on one line at the gutter's inner edge.
- **Vertical charts** anchor `align: "right"` at `byz.anchor` and
  `vAlign: "middle"` at the separator's `y`, so the fthora keeps the position it
  has today and the alteration appears to its left, each vertically centred on
  the separator.

`BYZ_SIGN_GAP = 8` at `BYZ_FONT_SIZE = 40` is roughly 0.2 em, against signs
whose ink is about 0.33 em wide. It is a starting value to be settled visually
in §7, not a derived constant.

### 5.3 Sizing

`render()` currently measures fthores with `maxInkExtent` and derives two
numbers. Both are re-derived from runs:

| Quantity | Today | Becomes |
|---|---|---|
| `fthoraGutter` (horizontal) | `maxFthoraHeight + TEXT_MARGIN` | `maxRunHeight + TEXT_MARGIN` |
| `fthoraGutter` (vertical) | `maxFthoraWidth + TEXT_MARGIN` | `maxRunWidth + TEXT_MARGIN` |
| `signExtent` (horizontal) | `max(maxNoteWidth, maxFthoraWidth)` | `max(maxNoteWidth, maxRunWidth)` |
| `signExtent` (vertical) | `max(maxNoteHeight, maxFthoraHeight)` | `max(maxNoteHeight, maxRunHeight)` |

`maxRunWidth` is the maximum over **degrees** of that degree's run width — not
`max(alterationWidth) + gap + max(fthoraWidth)`, which would over-reserve the
gutter for a scale where no single degree carries both signs.

A scale with no fthora and no alteration still yields a zero gutter, so the
canvas does not grow for signs it never draws. That existing guarantee is
preserved and is worth its own test.

The eight `drawByzantineMark(iv.fthoraBelow|fthoraAbove, …)` call sites — two
each in `drawLinesHorizontal`, `drawLinesVertical`, and the two box branches of
`render()` — become `drawByzantineSigns(iv.signsBelow|signsAbove, …)` with the
same anchors. `drawByzantineMark` stays as it is: `drawNoteLabel` calls it to
draw a martyria, which is a single sign and not a run. `drawByzantineSigns`
is built on top of it.

---

## 6. Testing

TDD as `docs/TESTING.md` mandates: every item below is a failing test first.
Suggested commit sequence, each a red→green→refactor cycle with `npm test`
green before it lands:

1. `[#2] Extract a well-kind descriptor for the two single-value pickers` —
   pure refactor, no new tests, existing suite green throughout.
2. `[#2] Add FTHORES_COMPATIBILITY` — model only.
3. `[#2] Offer compatible fthores first in the fthora picker`.
4. `[#2] Add the Sign of Alteration table and resolver` — model only.
5. `[#2] Add the alteration well and picker`.
6. `[#2] Draw alterations beside fthores on the chart`.
7. `[#2] Update the Byzantine notation docs`.

### 6.1 New and changed tests

**`test/unit/byzantine-symbols.test.js`**

- Every ladder note has a non-empty `FTHORES_COMPATIBILITY` entry of known,
  non-duplicated fthora ids.
- `compatibleFthores` and `otherFthores` partition `BYZ_FTHORES` exactly, for
  every note — no sign lost, none offered twice.
- The parity rule: for every note, the chromatic fthores offered are the pair
  its `value` parity selects — with `midNi` pinned separately as the one
  documented exception. This is the test that fails if someone "restores"
  `hardChromaticDi` to `midNi` without reading §2.3.
- Worked samples pinned by hand, as `midDi` already is for the genus table:
  `midDi`, `midNi`, `midGa`, `highNi`.
- `BYZ_ALTERATIONS` has ten known ids and two families of five.
- `resolveAlterationGlyph` returns the right codepoint for a member of each
  family and `""` for an unknown id.

**`test/integration/byzantine-pickers.test.js`**

- With a martyria note set, the fthora picker lists `None`, that note's
  compatible fthores in order, a separator, then the rest — asserted through
  the DOM, on option order and `dataset.fthora`.
- With no martyria note, the picker lists all sixteen and renders **no**
  separator.
- A committed fthora that is not compatible still renders `.is-selected`,
  below the separator.
- Changing the row's martyria and reopening the fthora picker re-partitions the
  list.
- The alteration well: opens its own panel; `None` plus ten options under two
  headings; Apply commits to `data-alteration` and repaints the well; Cancel,
  an outside click and a second well click all discard the draft; Apply is dead
  while the draft matches the row. These mirror the fthora picker's existing
  cases — the descriptor refactor of §4.4 is what makes them cheap.
- Opening one well closes the other two.

**`test/integration/notation.test.js`**

- `readScaleData()` carries `alteration` on note items.
- An alteration survives an editor rebuild, a scale-mode switch and a notation
  switch, exactly as the fthora does.

**`test/integration/render.test.js`**

- In all four chart shapes: a degree with both signs draws two `fillText`
  calls in the gutter, alteration first, at the expected coordinates computed
  from `measureTextInk` — never hard-coded.
- A degree with only an alteration draws it at the fthora's position.
- Gutter and canvas size grow to the widest **run**, and a scale where no one
  degree carries both signs does not reserve a gutter for a pair that never
  occurs.
- A scale with neither sign still reserves no gutter.

### 6.2 Harness and stub changes

**`test/helpers/canvas-stub.js`** — the ink model gains the alteration ranges,
without which every measurement above falls through to the plain-text advance
model and the tests would assert on fiction:

- `U+E1F0`–`U+E20F` is zero-advance: extend `isZeroAdvance`.
- The eight numbered signs get ink above the baseline — ascent ≈ 0.68 em,
  descent ≈ **−0.20 em** (negative, like a fthora).
- The two geniki sit higher, ascent ≈ 1.23 em, descent ≈ −0.64 em. They are
  *interleaved* with the numbered signs (`U+E1F4`, `U+E204`), not contiguous,
  so the stub needs explicit membership rather than a range test.
- New ratio constants exported alongside `FTHORA_ASCENT_RATIO` and friends.

**`test/helpers/harness.js`** — `openWell` and `dismissPicker` take
`"alteration"` as a third kind; a new `pickAlteration(h, row, id, { dismiss })`
mirrors `pickFthora`.

---

## 7. Manual verification (Playwright)

Explicitly requested, and genuinely needed: the horizontal asymmetry in §3.1 is
invisible to the test suite, whose `measureText` model is symmetric by
construction. `docs/TESTING.md` §3 is clear that this is *verification*, not
testing — the driving scripts stay in the scratchpad and are not committed.

Check, at minimum:

1. Each of the ten signs in an alteration **well** — optically centred, no
   clipping against the 34×34 border, and the two geniki (whose ink sits a
   whole em higher) not riding the top edge.
2. The alteration **picker** rows — every sign centred in its 38×38 `.byz-glyph`
   box, the column of signs reading as a straight vertical line down the list.
   `diesis8` versus `diesis2` is the pair that exposes a bad centring.
3. The **chart**, in all four shapes, with a scale carrying alteration+fthora on
   some degrees, one of each alone on others, and neither on the rest:
   the pair reads as one unit, `BYZ_SIGN_GAP` looks right, nothing collides with
   the boxes or the interval text, and nothing is clipped at either end of the
   stack.
4. The three empty wells side by side — their CSS hints still tell them apart.

Settle `BYZ_SIGN_GAP` here.

---

## 8. Documentation to update

Per research §9, plus what this design adds:

- **`docs/BYZANTINE-SYMBOLS.md` §1** — a note row carries *three* independent
  glyphs, not two.
- **§2** — "The four tables" becomes six: `FTHORES_COMPATIBILITY` and
  `BYZ_ALTERATIONS` join it. Note that the alteration table names a family and
  an offset, keeping the "no table names a codepoint" invariant intact.
- **§3** — it is no longer the sole hand-maintained table. Record
  `FTHORES_COMPATIBILITY`'s different provenance: derived from rules (§2.2
  here) against Neanes' `LayoutService` and Fthora Note dropdown, not read off
  `modes-table.html` — and record the three departures in §2.3, because they
  are exactly what a future maintainer will otherwise "correct".
- **§4** — a font swap is now a second *trio* of resolvers.
- **§10** — the stubbed `measureText` table gains the alteration ranges.
- **`docs/ARCHITECTURE.md`** — the Notation section (three wells) and Chart
  Rendering → Text layout (the gutter holds a run, not a single sign).
- **`docs/TESTING.md` §5** — the `measureText` stub row, and the three new
  harness helpers.
- **`CLAUDE.md`** — the `byzantine.js` / `byzantine-ui.js` one-liners still
  describe the layer correctly; check rather than assume.

---

## 9. Open question for review

**`BYZ_SIGN_GAP`.** Specified as 8px at a 40px font size, to be settled in §7.
If the pair reads better as a single tight cluster, the alternative is to drop
the gap to ~4px; if it reads as two separate annotations, `TEXT_MARGIN` (12px)
is the house constant to reach for. Nothing else in the design depends on which
is chosen.
