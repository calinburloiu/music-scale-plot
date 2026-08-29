# Byzantine symbols — design

Design spec for issue [#2](https://github.com/calinburloiu/music-scale-plot/issues/2),
"Byzantine symbols support". Written 2026-08-29.

Inputs this spec consolidates:

- the issue itself;
- `design/design_handoff_byzantine_symbols/` — the Claude Design proposal (a sketch; the app
  keeps its current look, see *Decisions*);
- `FONTS.md`, `SBMUFL-FONTS.md`, `MARTYRIA-COMPOSITION.md` — the font research;
- `modes-table.html` — the martyria table, the source of the note↔genus mapping;
- `impl-prompt.md` — the client's amendments to the design.

---

## 1. What is being built

A second **notation** for the app. Today every note is labelled with free text. Byzantine
notation replaces that text with two psaltic signs per note:

- a **fthora** on the left of the note's separator (the psaltic equivalent of an accidental);
- a **martyria** on the right — a note letter with an optional genus sign stacked on it, which
  is what a psaltic reader uses as the note's name.

Both are drawn from the vendored **Neanes** font (`fonts/Neanes.woff2`, SBMuFL Private Use
Area), in the editor and in the chart.

### In scope

- A `Notation` setting with two values, `generic` (today's app, unchanged) and `byzantine`.
- Fthora and martyria wells on every note row, each with its own picker.
- A logical, font-independent symbol model plus one SBMuFL resolver.
- Automatic note-letter sequencing across degrees.
- Chart rendering of both signs in all four orientation × style combinations.
- Tests for all of it, and the harness changes they need.

### Out of scope

- **Maqam notation.** The design proposes a third mode; it is not built and the `#notation`
  control offers only two values.
- **The font picker.** Only Neanes ships. `Almouzios` support is a follow-up; the resolver
  layer is what makes it a small one.
- **Anything in the design unrelated to this issue** — the cumulative-cents gutter in the
  chart, the leader rule joining a fthora to its separator, the Modernist restyle of the whole
  app, the segmented controls. The app keeps its current look and its `<select>`-based
  controls.
- Diesis/yfesis accidentals (`E1F0`–`E1F5`, `E200`–`E205`) and `martyriaTick` as a *leading*
  ornament. The tick is used here only as an octave extension (§4).

---

## 2. Decisions taken during design

| # | Decision | Why |
|---|---|---|
| 1 | **One `fillText` per martyria.** The base letter and the genus mark are concatenated and the font's GPOS mark-to-base lookup stacks them. | Verified by the client in `modes-table.html` and `martyria-demo.html`. The design handoff's contrary measurement (`U+E139` + `U+E177`) paired a *middle*-octave letter with an *Above* mark — the mismatch case that `MARTYRIA-COMPOSITION.md` §5 says cannot attach by construction. Matched pairs attach. |
| 2 | **Symbol state lives in the DOM**, as `data-*` attributes on the note row. | The project's architecture is "the DOM is the data model". A parallel array would need its own add/remove bookkeeping that the DOM already does. |
| 3 | **`MARTYRIA_COMPATIBILITY` is sparse** — one de-duplicated genus list per note, in the table's column order — rather than a dense 12 × 21 grid. | 71 entries instead of 252, and it is exactly the projection the picker needs. Mode identity per column is not used by any feature in scope. |
| 4 | **Notation lives in Settings**, at the top of the panel. | Settings is where the chart declares what kind of system it is (Base Note, Interval Type). Scale Editor's `Mode` is there because relative/absolute changes only how intervals are *typed* — the chart is identical either way. Notation changes what the chart *draws*. The deferred font picker is a Settings-shaped sibling. |
| 5 | **Split `app.js` into three classic scripts**, not ES modules. | `<script type="module">` is fetched under CORS and a `file://` page has an opaque origin, so modules break "open `index.html` in a browser". Several plain `<script>` tags work from `file://` and from github.io, share one global scope exactly as one file does today, and need no build step. |
| 6 | **Upward range extension by `martyriaTick`; downward range restricted.** | Client decision. Above high Κε there is no higher SBMuFL block, so a trailing `U+E145` marks the extra octave (`E144 E159 E145`). Below low Ζω there is no equivalent, so a pick that would push a predecessor below low Ζω is simply not offered. |
| 7 | **Pickers scroll; they do not flip up.** | The design's flip-up exists because its panels are tall. A 21-row Notes list needs scrolling regardless, and a scrolling panel cannot escape the editor. |
| 8 | **Preserving state across a notation switch is free**, so it is done. | The name input and both wells coexist on every note row; CSS decides which are visible. No rebuild, no carry-over code. Elsewhere preservation is best-effort: `resetScaleToDefault()` (triggered by an interval-type change) rebuilds rows and drops symbols, as it already drops names. |

---

## 3. The logical model

Four tables and two resolvers, in `byzantine.js`. **Nothing in the tables names a codepoint,
an octave block, or an above/below.** All SBMuFL knowledge is in the resolvers.

### 3.1 `BYZ_NOTES` — 21 note letters

Ascending pitch, three registers of seven. Array index is the note's **ladder position** and
coincides with SBMuFL codepoint order.

```js
{ id: "lowZo", octave: "low", letterIndex: 0, greek: "Ζω", latin: "Zo" }
```

| `octave` | ids | `letterIndex` order |
|---|---|---|
| `low` | `lowZo … lowKe` | Ζω Zo, Νη Ni, Πα Pa, Βου Vou, Γα Ga, Δι Di, Κε Ke |
| `mid` | `midZo … midKe` | same seven |
| `high` | `highZo … highKe` | same seven |

### 3.2 `BYZ_GENERA` — 12 genus signs

Order is the SBMuFL block order, which is also the picker's fallback order.

| `index` | `id` | label |
|---|---|---|
| 0 | `zo` | Ζω (diatonic) |
| 1 | `delta` | Δ tetartos |
| 2 | `alpha` | Α protos |
| 3 | `legetos` | Legetos |
| 4 | `nana` | Nana (tritos) |
| 5 | `deltaDotted` | Δ dotted |
| 6 | `alphaDotted` | Α dotted |
| 7 | `hardChromaticPa` | Hard chromatic Πα |
| 8 | `hardChromaticDi` | Hard chromatic Δι |
| 9 | `softChromaticDi` | Soft chromatic Δι |
| 10 | `softChromaticKe` | Soft chromatic Κε |
| 11 | `zygos` | Zygos |

Plus the sentinel **`GENUS_NONE = "none"`**, which is the default: the letter is drawn alone.

### 3.3 `BYZ_FTHORES` — 16 fthores

`E1D0`–`E1DF`, the standalone block with a normal advance (not the zero-advance `Above` /
`Secondary` / `Tertiary` / `Below` variants meant to ride a neume).

`diatonicNiLow`, `diatonicPa`, `diatonicVou`, `diatonicGa`, `diatonicDi`, `diatonicKe`,
`diatonicZo`, `diatonicNiHigh`, `hardChromaticPa`, `hardChromaticDi`, `softChromaticDi`,
`softChromaticKe`, `enharmonic`, `chroaZygos`, `chroaKliton`, `chroaSpathi` — in that order,
each `{ id, index, label }`.

### 3.4 `MARTYRIA_COMPATIBILITY` — the modes table

Per note id, the genus ids that the table pairs with it, **de-duplicated, in the table's
left-to-right column order** (Modes I–VIII, varys, then the three transcribed makam scales).

```js
const MARTYRIA_COMPATIBILITY = {
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
};
```

`modes-table.html` is **not final**. This table is the one thing in the model expected to be
edited by hand; §9 says where that is documented.

### 3.5 The resolvers

```js
resolveMartyriaGlyphs(noteId, genusId, ticks) -> string
resolveFthoraGlyph(fthoraId)                  -> string
```

`resolveMartyriaGlyphs`:

1. letter = `0xE130 + octaveIndex × 7 + letterIndex` (`low` 0, `mid` 1, `high` 2);
2. genus, unless `none` = `0xE170 + genusIndex` when `octave === "low"`, else
   `0xE150 + genusIndex` — the register decides the mark set, because each letter carries only
   one anchor (`martyriaTop` for low, `martyriaBottom` for middle and high);
3. append `ticks` copies of `U+E145` (`martyriaTick`).

`resolveFthoraGlyph` is `0xE1D0 + index`.

Both return a plain string that a single `ctx.fillText` or a single text node renders. A
different font encoding later — the Byzantine Music Unicode block, say — is a second pair of
these two functions and touches nothing else.

---

## 4. The note ladder

A martyria's note letter is not chosen per degree independently: setting one degree sets them
all, because a scale runs through consecutive letters.

**Position.** `position = noteIndex + 7 × ticks`, with `ticks > 0` legal only for
high-octave letters. `ticks` is capped at 1, so positions run **0 (`lowZo`) … 27
(`highKe` + one tick)**. Helpers: `ladderPosition(noteId, ticks)` and
`ladderNoteAt(position) -> { noteId, ticks } | null`.

**Propagation.** Setting degree *i* (1-based, of *n*) to position *p* sets every degree *j* to
`p + (j − i)`. Each degree keeps its existing genus; a degree that had none gets
`GENUS_NONE`. Fthores are never touched.

**Legality.** A position *p* is offered for degree *i* only when the whole scale fits:

```
p ≥ i − 1            (no predecessor below lowZo)
p + (n − i) ≤ 27     (no successor above highKe + tick)
```

Illegal rows are rendered disabled in the picker rather than hidden, so the range is visible.

**Tick rows.** Positions 21–27 are listed in the picker only when some degree of the current
scale already has `ticks > 0` — i.e. only once propagation has actually reached into that
octave. They are a consequence of a pick, not an ordinary choice.

**Adding a note.** In Byzantine notation the new degree continues the ladder: previous
position + 1, genus `none`. If the previous degree has no martyria, or the ladder is exhausted,
the new well is empty.

**Clearing.** The Notes column's first row is `None`, which clears that one well and does not
propagate.

---

## 5. Editor

### 5.1 The setting

```html
<div class="notation-row">
  <label for="notation">Notation</label>
  <select id="notation">
    <option value="generic">Generic</option>
    <option value="byzantine">Byzantine</option>
  </select>
</div>
```

Top of the Settings panel, above Base Note. Default `generic`, so nothing changes until the
user opts in. Changing it toggles `#editor.notation-byzantine` and re-renders.

### 5.2 The note row

Every note row carries all three controls at all times:

```html
<button class="play-note">▶</button>
<label>Note 1</label>
<span class="cumulative-cents"></span>
<input type="text" class="note-name" placeholder="name">
<div class="fthora-well-wrapper">…<button class="fthora-well"></button><div class="fthora-picker"></div></div>
<div class="martyria-well-wrapper">…<button class="martyria-well"></button><div class="martyria-picker"></div></div>
```

CSS shows `.note-name` under `generic` and the two wells under `notation-byzantine`. Nothing is
rebuilt and nothing is discarded on a switch.

State on the row:

| attribute | value |
|---|---|
| `data-fthora` | a `BYZ_FTHORES` id, or absent |
| `data-martyria-note` | a `BYZ_NOTES` id, or absent |
| `data-martyria-genus` | a `BYZ_GENERA` id or `none`; absent when there is no martyria |
| `data-martyria-ticks` | `"0"` or `"1"`; absent when there is no martyria |

Fthora is on the left of martyria, mirroring the chart.

### 5.3 The wells

34 × 34 buttons. Filled: the resolved glyph in Neanes, ink-centred, solid border. Empty:
dashed border and a pure-CSS mark that says which sign the slot takes — a slashed stroke for
fthora, two unequal tiers for martyria. The marks are CSS boxes, so an empty well is legible
before the webfont arrives.

Clicking a well toggles its picker; clicking it again, or clicking outside, closes it. Only one
picker is open at a time — this reuses the existing `closeAllDropdowns()` machinery that the
colour picker uses.

### 5.4 Fthora picker

One flat list in a panel anchored under the well: `None` first, then the sixteen fthores, each
row showing the glyph and its label. Picking writes the slot, closes the panel, and re-renders.

### 5.5 Martyria picker

Two columns over a shared footer.

**Notes** (left) — `None`, then the 21 letters in three labelled octave groups, plus the
tick-extended rows when §4 says to show them. Each row shows the bare letter and its name
(`Ζω Zo`). Rows illegal for this degree are disabled.

**Genus** (right) — `None`, then the compatible genera for the selected note in
`MARTYRIA_COMPATIBILITY` order, then a horizontal rule, then the remaining genera in
`BYZ_GENERA` order. Every row previews itself **composed on the currently selected letter**,
because that is the only form the user will ever see it in. Until a note is selected the column
is inert.

**Footer** — a **Done** button. Picking a note or a genus writes this well and re-renders
immediately; **Done** closes the panel and runs the ladder propagation of §4 across the other
degrees.

Both columns get a `max-height` and scroll.

---

## 6. Chart

The rule is a substitution: **wherever the chart draws a note name today, Byzantine notation
draws the martyria instead**, and the fthora gets a new gutter on the other side of the boxes.
This applies to all four combinations of `#orientation` and `#chart-style`.

- **Vertical** (boxes and lines) — martyria at the existing `textX`, ink left-aligned there,
  ink-centred vertically on the separator's `y`. Fthora in a new left gutter, ink right-aligned
  `TEXT_MARGIN` clear of the box edge, ink-centred on the same `y`. `baseX` shifts right by the
  gutter width; `displayWidth` grows by it.
- **Horizontal** (boxes and lines) — martyria where the note name is drawn today, below the
  boxes, ink-centred horizontally on the separator's `x`. Fthora in a new top gutter above the
  boxes; `baseY` shifts down and `displayHeight` grows.
- **Measurement.** `render()`'s max-width pass becomes notation-aware: in Byzantine notation it
  measures resolved glyph strings at `BYZ_FONT_SIZE` (40px, as in `modes-table.html`) in
  Neanes, and measures fthora ink to size the new gutter.
- **Ink-centring, both axes, always measured.** A martyria's ink sits well above the baseline
  in Neanes and below it in other SBMuFL faces, and a fthora sits around −0.65 … −1.1 em
  because the font expects it over a neume. A constant offset would break on a font swap. One
  helper does it:

  ```js
  inkBox(ctx, text, font)                       // {adv, left, right, top, bottom}
  drawGlyphs(ctx, text, x, y, { align, vAlign }) // ink-anchored fillText
  ```

- **Font loading.** `@font-face` for Neanes in `style.css`; at startup
  `document.fonts.load(BYZ_FONT_SIZE + 'px "Neanes"')` then `document.fonts.ready`, then
  discard any cached measurement and re-render — otherwise the first paint, and an early
  *Save as PNG*, get fallback metrics and blank PUA boxes. Guarded, because jsdom has no
  `document.fonts`. **No measurement taken before the face resolves is ever cached.**
- Empty wells draw nothing, exactly as an empty name does today.
- Unchanged: box geometry, cents scaling, colours, interval labels, PNG export. Fonts never
  taint a canvas, so the export is unaffected.

---

## 7. File layout

`index.html` loads three classic scripts, in order:

| file | contents | DOM? |
|---|---|---|
| `byzantine.js` | `BYZ_NOTES`, `BYZ_GENERA`, `BYZ_FTHORES`, `MARTYRIA_COMPATIBILITY`, the two resolvers, the ladder helpers, `inkBox` / `drawGlyphs` | no |
| `byzantine-ui.js` | wells, both pickers, propagation, the notation switch | yes |
| `app.js` | everything it holds today, plus the chart's Byzantine branch | yes |

`app.js` goes last because it is the file that executes at load time (element lookups,
listeners). Cross-file references resolve because top-level `function`/`var` become globals and
top-level `const`/`let` share the global lexical environment across classic scripts — the same
scope one file has today.

No `type="module"`, no build step, no dependency. `index.html` still loads nothing but
`style.css` and these three scripts.

---

## 8. Testing

Mandatory TDD per `docs/TESTING.md`: every behaviour below gets a test that fails first.

### Harness changes

- **`harness.js` follows `index.html`.** Instead of reading `app.js` by name it reads the
  `<script src>` tags in order, runs each under its own filename (so stack traces and coverage
  still attribute correctly), and builds the export epilogue from the union of their top-level
  names. Every new top-level declaration in any of the three files stays auto-exported.
- **`harness.js` stubs `document.fonts`** — `load()` and `ready` resolving immediately.
- **`canvas-stub.js` grows an ink model.** `measureText` keeps
  `width = len × size × 0.6` and adds `actualBoundingBox{Left,Right,Ascent,Descent}`. Marks in
  `E150`–`E17B` get a **zero advance**, an `…Above` mark raises the modelled ascent and a
  `…Below` mark deepens the descent — so the stub has the same *shape* as the real font and a
  test can catch "forgot the mark does not advance the pen". Like the existing 0.6 ratio this
  is a documented model, not real metrics; tests compute expected values from it rather than
  hard-coding numbers.
- New helpers: `setNotation`, `openWell`, `pickMartyria`, `pickFthora`.

### Test files

| file | covers |
|---|---|
| `test/unit/byzantine-symbols.test.js` | vocabulary shape, resolver output for each register and for `none`, tick appending, compatibility lists, ladder arithmetic and both boundaries |
| `test/integration/notation.test.js` | the setting, the DOM switch, symbols surviving a switch, `readScaleData` |
| `test/integration/byzantine-pickers.test.js` | picker contents and ordering, the separator between compatible and other genera, disabled rows, live write, Done, propagation, add/remove note |
| `test/integration/render.test.js` (extended) | martyria and fthora geometry in all four orientation × style combinations, gutter sizing, canvas growth, ink-centring |

### Order of work

Tables → resolvers → ladder → notation setting and DOM switch → `readScaleData` →
wells → pickers → propagation → chart geometry → font loading.

The whole suite runs before every commit, not just the touched file.

---

## 9. Documentation to update

- **`docs/PLAN-01.md`** — the source of truth for intended behaviour: the notation concept, the
  new data model fields, the chart's two new columns, the file split.
- **`docs/BYZANTINE-SYMBOLS.md`** (new) — the human's map: what each table means, that
  `MARTYRIA_COMPATIBILITY` is derived from `modes-table.html`'s column order and how to redo it
  when that table changes, that the register→mark-set rule lives only in
  `resolveMartyriaGlyphs`, and what adding a second font would touch.
- **`CLAUDE.md`** — the "three root files, don't split into modules" rule becomes "these files,
  classic scripts only, no build step", with the `file://`/CORS reason recorded so the next
  reader does not 'improve' it into ES modules.
- **`README.md`** — already carries the font NOTICE; no change needed.

---

## 10. Commit discipline

Every commit prefixed `[#2]`, one behavioural change per commit, tests and implementation
together.
