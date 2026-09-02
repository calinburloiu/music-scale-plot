# Music Scale Plot — Architecture

## Overview

Music Scale Plot is a zero-dependency, client-side web application with separate HTML, CSS, and JavaScript files. No build tools, frameworks, or external libraries are used. The app runs by opening `index.html` directly in a browser.

## File Structure

```
music-scale-plot/
├── index.html               # Page structure and markup
├── style.css                # All styles
├── byzantine.js             # Byzantine symbol model + shared ink-measuring
│                             # primitives (font-agnostic), no DOM
├── smufl.js                 # SMuFL accidental catalogue + resolvers, no DOM
├── symbols-ui.js            # Wells and pickers shared by both notations
├── byzantine-ui.js          # Only what is Byzantine: the three picker builders,
│                             # the martyria draft, the ladder
├── app.js                   # Everything else: editor DOM management, chart rendering,
│                             # audio, PNG export — runs at load time, so it loads last
├── docs/
│   ├── ARCHITECTURE.md        # This document
│   ├── BYZANTINE-SYMBOLS.md   # The Byzantine notation layer, for maintainers
│   ├── SMUFL-ACCIDENTALS.md   # The Generic accidental layer, for maintainers
│   └── TESTING.md             # Testing guide and the mandatory TDD workflow
├── fonts/                    # Vendored Neanes and Bravura Text fonts (see README's NOTICE)
├── LICENSE
└── README.md
```

- `index.html` — contains the page skeleton, links to `style.css`, and loads the five
  scripts in that order (deferred).
- `style.css` — all visual styling.
- `byzantine.js`, `smufl.js`, `symbols-ui.js`, `byzantine-ui.js`, `app.js` — all
  JavaScript, split into five classic `<script>` files loaded in load order, not modules:
  `<script type="module">` is fetched under CORS, and a page opened with `file://` has an
  opaque origin, so a module script would be blocked — breaking "open `index.html`
  directly in a browser". Classic scripts share one global scope, so `byzantine.js`'s
  tables, resolvers and measuring primitives are visible to `smufl.js`, `symbols-ui.js`,
  `byzantine-ui.js` and `app.js` without any import.

Tests live under `test/` and are described in [TESTING.md](TESTING.md), which also
defines the mandatory TDD workflow for changes to this design.

## HTML Layout

The page is split into two side-by-side panels using CSS flexbox:

| Left panel — Scale Editor | Right panel — Chart |
|---|---|
| Form-based editor for notes and intervals | `<canvas>` element displaying the scale chart |
| Add / Remove note buttons | Save as PNG button |

The **Notation** setting (`#notation`, `generic` or `byzantine`) sits at the top of the
Settings panel, above the base-note row. It does not rebuild the editor: every note row
carries, left to right, the **accidental well**, the **name input**, and the three
Byzantine wells at all times (see **Scale Editor → Note row**), and `#editor` carries a
`notation-generic` or `notation-byzantine` class — the two are toggled together, never both
or neither — that is all CSS needs to decide which half is visible. Switching notation
therefore discards nothing.

Every note row also carries the **accidental well** (Generic), and the **alteration well**,
the **fthora well** and the **martyria well** (Byzantine), each a small button that shows the
resolved glyph (or sits empty) and opens its own picker panel when clicked. Clicking a row of
a picker is the whole gesture: it writes the choice to the note row and closes the panel.
There is no Apply and no Cancel — a click outside, a second click on the well or another
picker opening all dismiss without changing anything. Three of the four wells hold a single
value from one flat vocabulary and share one picker builder with a search field; the martyria
picker is the one that takes two clicks and has no search, because it commits a pair: its
Notes column only narrows the Genus column beside it (and resets the genus to None), and the
genus click commits. See **Notation** below.

A picker opens on the choice the row already holds, scrolled into view; a martyria picker
with nothing set opens on the middle octave rather than the top of a twenty-one row list.
The martyria well, the picker's note rows and the picker's genus rows all place their glyph
the same way, on one baseline shared by the whole martyria vocabulary, so a letter lands at
the height the face draws it — which is the only thing distinguishing a low-octave letter
from its middle-octave twin. See `docs/BYZANTINE-SYMBOLS.md` §8.

## Data Model

The scale is represented as a single JavaScript array of objects:

```js
// Conceptual structure — not literal code
scaleData = [
  { type: "note", degree: 1, name: "C", accidental: "", alteration: "", fthora: "", martyria: null },
  { type: "interval", ratio: "9/8", label: "major tone" },
  { type: "note", degree: 2, name: "D", accidental: "", alteration: "", fthora: "", martyria: null },
  ...
]
```

This flat list mirrors the alternating note/interval rows in the editor UI. It is rebuilt from the DOM inputs on every change, keeping the DOM as the single source of truth (no separate state syncing needed for this small app).

Each note item carries four extra fields for the symbol wells, read off the row's `data-*`
attributes by `readNoteSymbols()` (`symbols-ui.js`):

- `accidental` — an id from one of `SMUFL_ACCIDENTAL_CATEGORIES`' entries, or `""` when the
  well is empty. Generic only; see `docs/SMUFL-ACCIDENTALS.md`.
- `alteration` — an id from `BYZ_ALTERATIONS`, or `""` when the well is empty.
- `fthora` — an id from `BYZ_FTHORES`, or `""` when the well is empty.
- `martyria` — `{ note, genus, ticks }` (a `BYZ_NOTES` id, a `BYZ_GENERA` id or
  `GENUS_NONE`, and the octave-tick count), or `null` when the well is empty.

A note row itself carries the symbol state as six `data-*` attributes (`NOTE_SYMBOL_ATTRS`
in `symbols-ui.js`, derived from the `SYMBOL_WELLS` registry plus the martyria's own three
fields): `data-accidental`, `data-alteration`, `data-fthora`, `data-martyria-note`,
`data-martyria-genus` and `data-martyria-ticks`. Row add/remove and the ladder's rebuilds
copy these attributes across along with everything else, so the DOM stays the single source
of truth for symbol state too.

## Scale Editor

The editor is a vertical list of rows, alternating between **note rows** and **interval rows**.

### Note row

- Static label: `Note {degree}`
- The **accidental well** (see **Notation**)
- Text input: note name (optional, placeholder "name")
- The **alteration well**, the **fthora well** and the **martyria well**, in that order (see
  **Notation**)

All six of these are always present on every row, in both notations — a notation switch
never adds or removes DOM. CSS shows the accidental well and the name input in Generic
notation and the three Byzantine wells in Byzantine notation; the underlying values are
untouched either way, so switching back and forth loses nothing.

### Interval row

- Text input: ratio in `p/q` format (placeholder "ratio", e.g. `9/8`). Defaults to `9/8` when a new interval is added.
- The **colour swatch**, then the interval label text input (optional, initially empty,
  placeholder "label") — together `.interval-label-cluster`.

The swatch comes **before** the label and is sized like a well (34px, `--well-size`), so it
sits under whichever well is leftmost on the note row above it: the accidental well in
Generic notation, the alteration well in Byzantine. Clicking it opens a palette dropdown (see
**Color sync** in `CLAUDE.md`). The cluster's own width is notation-dependent —
`--well-size + --row-gap + --name-box-width` in Generic (one well, a gap, the name box),
`--well-size × 3 + --row-gap × 2` in Byzantine (three wells) — driven by the same
`--well-size`/`--row-gap`/`--name-box-width` custom properties the note row's own layout
uses, via the `#editor.notation-generic`/`.notation-byzantine` class, so the interval row's
width formula and the note row's actual layout stay one fact at every breakpoint.

### Initial state

The editor starts with Note 1, one interval (ratio defaulting to `9/8`, label empty), and Note 2. Both note name fields are initially empty. The user fills in only what they need — names and labels are optional and omitted from the chart when left blank.

The page has no persistence: every load starts from this state and from the settings' markup defaults. `initUI()` enforces that, because the browser does not. A browser restores form-control state across a soft reload — the selects, the number and range inputs and every text box in the editor come back holding the values the user left them at — while `#editor`'s *structure* comes back as the markup's own two rows and the app has no state of its own to restore alongside it. Left alone, the page would boot with the controls saying one thing and the DOM-as-data-model another: `#scale-mode` on "absolute" over rows that hold relative inputs, an EDO interval type with the EDO settings row hidden, a stale cents label beside an emptied interval box.

`initUI()` therefore puts every control back to the value its markup declares (`resetControlsToDefaults()` reads the defaults off `index.html`, so a default is written down in exactly one place), then rebuilds the editor and redraws. It runs **twice**, because browsers disagree on when the restore lands: Firefox writes it while parsing, so the deferred scripts already see it, whereas Chromium writes it *after* `load`, once every top-level statement has run against the markup's defaults. `pageshow` is the first event that fires after the restore is complete in either browser — and it covers a bfcache restore as well — so `initUI()` runs once at load time, which keeps the first paint correct, and again on `pageshow`.

### Controls

- **Add note** button: appends one interval row (ratio defaulting to `9/8`, label empty) + one note row (name empty) at the bottom. The new note's degree increments automatically.
- **Remove last note** button: removes the last note row and its preceding interval row. Disabled when only two notes remain (minimum viable scale = one interval).

All inputs fire an `input` event listener that triggers a chart re-render, giving real-time feedback.

## Notation

`#notation` has two values: `generic` (typed note names plus an optional accidental, the
default) and `byzantine` (psaltic signs from the vendored Neanes SBMuFL font). Full detail for
the Byzantine signs — the tables, the resolvers, the ladder, and how to add a second font —
lives in [BYZANTINE-SYMBOLS.md](BYZANTINE-SYMBOLS.md); for the Generic accidental catalogue,
in [SMUFL-ACCIDENTALS.md](SMUFL-ACCIDENTALS.md). This section only orients where both fit
into the app's design.

**The wells, per notation.** `SYMBOL_WELLS` (`symbols-ui.js`) is a table of rows
`{ kind, notation, title, font, build, resolve }` — the single source of truth for which
wells a notation gets, in which order. A note row's well order, left to right, is that
table's row order, and it is the same order `signRunOf()` (`app.js`) draws a degree's gutter
run in, so reordering the table reorders both at once (see **Chart Rendering** below and
`docs/BYZANTINE-SYMBOLS.md` §11). Generic notation gets one row: the **accidental well**
(`docs/SMUFL-ACCIDENTALS.md`). Byzantine gets two — a **sign of alteration** (the accidental
of pitch — diesis, yfesis, or one of the two geniki) and a **fthora** (the accidental of
genus) — plus the **martyria well** (the note's name), which is not a row of `SYMBOL_WELLS`:
it commits a pair across two columns and propagates the ladder, so it does not fit the
table's one-flat-vocabulary shape, but it is still a well and still appears in
`SYMBOL_WELL_KINDS`. Each well's choice is a `data-*` attribute on the row, so the DOM stays
the data model and row add/remove bookkeeping comes free. None of the Byzantine signs of
alteration or genus, nor a Generic accidental, changes pitch: all are annotations the chart
draws, and `readScaleData` carries them alongside the note's name.

**Logical model vs. resolvers.** `byzantine.js` splits the two concerns a font-facing feature
always has. The logical model — which 21 notes exist, which 12 genera, which 16 fthores,
which 10 signs of alteration, and which of those belong on which note
(`MARTYRIA_COMPATIBILITY`, `FTHORES_COMPATIBILITY`) — never mentions a codepoint. The
resolvers (`resolveMartyriaGlyphs`, `resolveFthoraGlyph`, `resolveAlterationGlyph`) are the
only code that does; they turn a logical choice into the glyph string the font needs. Nothing
outside `byzantine.js` should ever construct a codepoint by hand. `smufl.js`'s
`resolveAccidentalGlyphs` is the Generic equivalent, simpler because the catalogue is a flat
id-to-codepoints table rather than a register-based arithmetic — see
`docs/SMUFL-ACCIDENTALS.md` §2.

**The pickers.** Three of the four wells — the accidental, the alteration and the fthora —
hold a single value from one flat vocabulary and differ only in their notation, their
vocabulary, their resolver and the face they draw in; they are rows in `SYMBOL_WELLS`
(`symbols-ui.js`) rather than parallel code paths, and the class names and selectors are
derived from that table. All three are built by the same `buildGroupedPicker(panel, spec)`,
which also gives all three a search field: a text input that narrows the list to categories
whose title, or options whose label, match every word of the query, case- and
diacritic-insensitive (`matchesQuery`/`normalizeForSearch`, `symbols-ui.js`). A click on one
of their rows commits and closes. The martyria's picker stays bespoke and has **no**
search — two columns, a three-field draft that the Notes column moves and the Genus column
commits, genus rows that preview the whole composition, and ladder propagation on the commit.

**The note ladder.** A martyria names an absolute degree, so raising or lowering a scale's
base note must be able to walk every other degree's martyria up or down in lock-step. The
ladder is a flat integer line of positions (`ladderPosition` / `ladderNoteAt`) that the 21
letters plus one ticked octave populate; `propagateMartyriaLadder` walks it from whichever
well the user just confirmed. Its two boundary rules: the ladder runs out below low Ζω (no
SBMuFL block exists under it, so the ladder simply stops there) and is extended above high Κε
by a tick rather than a new block (there is no block above it either). See
BYZANTINE-SYMBOLS.md §5 for the exact inequalities.

## Chart Rendering (Canvas)

### Geometry

The chart is a vertical stack of rectangles drawn on an HTML5 `<canvas>`. The stack grows **upward** from a baseline so that Note 1 is at the bottom and the highest note is at the top — matching the musical intuition of pitch rising upward.

### Sizing

1. Parse each interval ratio string `"p/q"` into a numeric value `p / q`.
2. Convert to cents: `cents = 1200 * Math.log2(ratio)`.
3. Choose a pixels-per-cent scale factor so the chart fits the available canvas height. A fixed factor (e.g. 3 px/cent) works well for typical scales; the canvas height is set dynamically to accommodate the total cents.
4. Each rectangle's height = `cents * pxPerCent`.
5. All rectangles share the same fixed width.

In **either** notation the canvas can grow by two more bands, both measured from ink
(`inkBox`/`maxInkExtent`/`maxRunExtent`), never assumed from a constant offset — this used to
be Byzantine-only, but a Generic accidental is ink too, and `signRunOf(noteItem, notation)`
derives a degree's gutter run from `SYMBOL_WELLS` filtered by the current notation, so the
same sizing code serves both:

- **The sign gutter** (`signGutter`) — a band of its own along the leading edge (left when
  vertical, top when horizontal), sized to the tallest/widest **run** plus one `TEXT_MARGIN`,
  and `0` when no degree carries a sign. A run is a degree's alteration and then its fthora in
  Byzantine notation, its one accidental in Generic (see Text layout below), so the maximum is
  taken over degrees: a Byzantine scale where one degree carries an alteration and another a
  fthora reserves one sign's width, not a pair's. A Generic scale with no accidental anywhere
  reserves no gutter at all — same canvas size as before this feature existed. On the
  horizontal line chart this
  gutter also pushes the interval text and axis down by the same amount, so it is real clear
  space, not just reserved margin.
- **The sign overhang** (`signOverhang`) — extra clearance at *both* ends of the stack, in
  both orientations, `0` when nothing occupies the gutter. A martyria or a gutter run is
  ink-centred on the separator it names, and the outermost separators sit only
  `CANVAS_PADDING` from the canvas edge; whatever ink extends past that padding is reserved as
  overhang so the first and last sign are never clipped. What the clearance protects differs
  by notation: in Byzantine it is sized from `signExtent` — the wider (horizontal) or taller
  (vertical) of the **martyria and the gutter run**, so neither can be clipped by the other one
  being narrower. In Generic it is sized from the **gutter run alone** — an accidental, if any
  — never from the note name: a typed name has always been ordinary text the chart lets
  overflow into the text area beside it, and an accidental must not silently change that. The
  horizontal *line* chart spends `signExtent` differently: it starts its axis half a sign
  *past* the padding (`halfSign`), which clears the extreme ink outright and so needs no
  overhang on top. All four chart paths derive their end clearance from these quantities.

The horizontal **note band** (`byzantineNoteBandHeight`) is `0` when no note in the scale
carries a martyria, and `max(tallest martyria ink, NOTE_TEXT_HEIGHT)` once at least one does —
so a scale with no Byzantine signs draws exactly as before, and one with a tall martyria gets
a band tall enough to hold it.

### Drawing

For each interval (bottom to top):

1. Draw a white-filled rectangle with a black border. The border thickness is stored in a named constant (`BORDER_WIDTH`, default 3 px) at the top of `app.js` so it can be easily adjusted.
2. Draw the **interval label** (if present) vertically centered inside the rectangle, to the right of the stack.
3. Draw the **note name** (if present) of the note below aligned with the bottom edge, and the note name above aligned with the top edge, to the right of the stack.

### Text layout

- Note names are placed at the horizontal line boundaries, to the right of the stack.
- Interval labels are placed at the vertical midpoint of each rectangle, to the right of the stack.
- In Byzantine notation, the **martyria substitutes for the note name** at every position a
  name would otherwise go (`drawNoteLabel` draws through `drawSymbol` whenever `spec.symbolFont`
  is set — the face to draw the label in, `null` for a typed Generic name); the degree's other
  signs are drawn on the **opposite side** from the note text in each orientation — above the
  note band on the horizontal charts, on the far side of the sign gutter on the vertical ones.
- What the gutter holds is a **run**: the degree's signs for the current notation, drawn in
  `SYMBOL_WELLS`' order (see **Notation** above) — a Byzantine run is the alteration and then
  the fthora, one `BYZ_SIGN_GAP` apart, the alteration first because it qualifies the fthora; a
  Generic run is the one accidental, so no gap ever applies to it. A Byzantine degree carrying
  only one of the two draws it in the same place a pair would. `drawSignRun` anchors the run
  as a whole horizontally and each part independently vertically, which is what makes one rule
  serve both orientations, both notations, and runs of either one or two parts — see
  BYZANTINE-SYMBOLS.md §11.
- Every sign is positioned from measured ink (`drawGlyphs`/`inkBox`) on both axes, not from
  the font's baseline/pen origin, because a martyria's ink sits well above the baseline in
  Neanes while a fthora's, an alteration's and a Bravura Text accidental's all clear it
  entirely, and a constant offset would break the moment a font changes.

### Canvas resolution

The canvas `width` and `height` attributes are the CSS display size times
`renderScale`, and the context is scaled to match. On screen `renderScale` is
the display's `devicePixelRatio` (read once at load, `DPR`); during a PNG export
it is the fixed `EXPORT_SCALE`.

`scaleWithinCanvasLimit()` reduces whichever scale is in effect until the bitmap
fits under `MAX_CANVAS_AREA` (16.7M pixels) — the ceiling above which Safari,
iOS Safari in particular, returns a blank canvas rather than allocating one. It
binds only on charts spanning several octaves.

## PNG Export

A **Save as PNG** button calls `canvas.toDataURL("image/png")`, creates a temporary `<a>` element with the `download` attribute set to `scale.png`, and programmatically clicks it. This triggers a file download with no server involvement.

The export is **independent of the display**: `savePNG()` re-renders at
`EXPORT_SCALE` (4), takes the bitmap, then re-renders at `DPR` to put the screen
back. Tying the export to `devicePixelRatio` instead would mean the same chart
left one machine at twice the resolution it left another, with nothing in the
file to tell the two apart — which matters because these charts are exported
for print, where 4× puts a chart placed at book size around 700ppi, well above
the 300ppi floor. `displayZoom` never enters into it: zoom is a CSS transform on
the canvas element and does not touch the backing store.

`withPrintMetadata()` then splices two ancillary chunks into the encoded file,
which a canvas emits without either:

- **`pHYs`** — the resolution, at `EXPORT_PPI` (720). Without it a layout app
  falls back to 72ppi and places an octave chart nearly two feet tall; with it,
  placed at 100%, the chart is 6.9in tall with 9.6pt note names. The declared
  resolution is `CSS_PX_PER_INCH x EXPORT_SCALE`, so the printed *size* is a
  property of the chart and the export scale only changes its sharpness.
- **`sRGB`** — what the RGB numbers mean, with the relative-colorimetric intent
  that suits flat chosen colours rather than the perceptual intent for
  photographs. Untagged, a print workflow guesses the source space before
  separating, and the palette shifts if it guesses wrong.

Neither chunk says anything about black generation: `#000` still separates to a
four-plate rich black under a normal CMYK profile, because a raster cannot tell
the converter which pixels are text. Only vector output, or a grayscale
interior, gets black text on one plate.

## Event Flow

```
User types in editor  ──►  `input` event on container
                               │
                               ▼
                        Read all inputs from DOM
                        Parse into scaleData[]
                               │
                               ▼
                        Validate ratios (skip
                        rendering on invalid input)
                               │
                               ▼
                        Clear canvas, compute
                        geometry, draw chart
```

Add/Remove note buttons modify the DOM (insert or remove rows) and then trigger the same render path.

At load time, and again on `pageshow`, `initUI()` resets the settings and the editor to their defaults and renders — see [Initial state](#initial-state).

## Styling

- Clean, minimal design with a light background.
- Editor inputs are styled for comfortable editing.
- The two panels are responsive: on narrow viewports they stack vertically instead of side-by-side.
- The canvas panel uses `position: sticky` so the chart stays visible while scrolling a long editor list.

## Summary

| Concern | Approach |
|---|---|
| State management | DOM is the source of truth; read inputs on each change |
| Rendering | HTML5 Canvas 2D API |
| Reactivity | Single `input` event listener on the editor container (event delegation) |
| Export | `canvas.toDataURL()` + programmatic download |
| Dependencies | None |
| Build step | None — open `index.html` in a browser |
| Code organisation | Separate `index.html`, `style.css` files and five classic scripts (`byzantine.js`, `smufl.js`, `symbols-ui.js`, `byzantine-ui.js`, `app.js`) — no modules |
