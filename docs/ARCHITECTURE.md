# Music Scale Plot — Architecture

## Overview

Music Scale Plot is a zero-dependency, client-side web application with separate HTML, CSS, and JavaScript files. No build tools, frameworks, or external libraries are used. The app runs by opening `index.html` directly in a browser.

## File Structure

```
music-scale-plot/
├── index.html               # Page structure and markup
├── style.css                # All styles
├── byzantine.js             # Byzantine symbol model: tables + SBMuFL resolvers, no DOM
├── byzantine-ui.js          # Byzantine notation: editor UI (wells, pickers, ladder)
├── app.js                   # Everything else: editor DOM management, chart rendering,
│                             # audio, PNG export — runs at load time, so it loads last
├── docs/
│   ├── ARCHITECTURE.md       # This document
│   ├── BYZANTINE-SYMBOLS.md  # The Byzantine notation layer, for maintainers
│   └── TESTING.md            # Testing guide and the mandatory TDD workflow
├── fonts/                    # Vendored Neanes SBMuFL font (see README's NOTICE)
├── LICENSE
└── README.md
```

- `index.html` — contains the page skeleton, links to `style.css`, and loads the three
  scripts in that order (deferred).
- `style.css` — all visual styling.
- `byzantine.js`, `byzantine-ui.js`, `app.js` — all JavaScript, split into three classic
  `<script>` files loaded in load order, not modules: `<script type="module">` is fetched
  under CORS, and a page opened with `file://` has an opaque origin, so a module script
  would be blocked — breaking "open `index.html` directly in a browser". Classic scripts
  share one global scope, so `byzantine.js`'s tables and resolvers are visible to
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
carries both a name input and both symbol wells at all times (see **Scale Editor → Note
row**), and a `notation-byzantine` class on `#editor` is all that decides, in CSS, which
half is visible. Switching notation therefore discards nothing.

Every note row also carries the **fthora well** and the **martyria well**, each a small
button that shows the resolved glyph (or sits empty) and opens its own picker panel when
clicked. A picker edits a draft of its own: clicking inside it changes only what the panel
shows, **Apply** writes that draft to the row, and Cancel — or a click outside, or a second
click on the well — discards it. See **Notation** below.

A picker opens on the choice the row already holds, scrolled into view; a martyria picker
with nothing set opens on the middle octave rather than the top of a twenty-one row list.
The martyria well, the picker's note rows and the picker's footer preview all place their
glyph the same way, on one baseline shared by the whole martyria vocabulary, so a letter
lands at the height the face draws it — which is the only thing distinguishing a low-octave
letter from its middle-octave twin. See `docs/BYZANTINE-SYMBOLS.md` §8.

## Data Model

The scale is represented as a single JavaScript array of objects:

```js
// Conceptual structure — not literal code
scaleData = [
  { type: "note", degree: 1, name: "C", fthora: "", martyria: null },
  { type: "interval", ratio: "9/8", label: "major tone" },
  { type: "note", degree: 2, name: "D", fthora: "", martyria: null },
  ...
]
```

This flat list mirrors the alternating note/interval rows in the editor UI. It is rebuilt from the DOM inputs on every change, keeping the DOM as the single source of truth (no separate state syncing needed for this small app).

Each note item carries two extra fields for Byzantine notation, read off the row's `data-*`
attributes by `readNoteSymbols()` (`byzantine-ui.js`):

- `fthora` — an id from `BYZ_FTHORES`, or `""` when the well is empty.
- `martyria` — `{ note, genus, ticks }` (a `BYZ_NOTES` id, a `BYZ_GENERA` id or
  `GENUS_NONE`, and the octave-tick count), or `null` when the well is empty.

A note row itself carries the symbol state as four `data-*` attributes (`NOTE_SYMBOL_ATTRS`
in `byzantine-ui.js`): `data-fthora`, `data-martyria-note`, `data-martyria-genus` and
`data-martyria-ticks`. Row add/remove and the ladder's rebuilds copy these attributes across
along with everything else, so the DOM stays the single source of truth for Byzantine state
too.

## Scale Editor

The editor is a vertical list of rows, alternating between **note rows** and **interval rows**.

### Note row

- Static label: `Note {degree}`
- Text input: note name (optional, placeholder "name")
- The **fthora well** and the **martyria well** (see **Notation**)

All four of these are always present on every row, in both notations — a notation switch
never adds or removes DOM. CSS shows the name input in Generic notation and the two wells in
Byzantine notation; the underlying values are untouched either way, so switching back and
forth loses nothing.

### Interval row

- Text input: ratio in `p/q` format (placeholder "ratio", e.g. `9/8`). Defaults to `9/8` when a new interval is added.
- Text input: interval label (optional, initially empty, placeholder "label")

### Initial state

The editor starts with Note 1, one interval (ratio defaulting to `9/8`, label empty), and Note 2. Both note name fields are initially empty. The user fills in only what they need — names and labels are optional and omitted from the chart when left blank.

### Controls

- **Add note** button: appends one interval row (ratio defaulting to `9/8`, label empty) + one note row (name empty) at the bottom. The new note's degree increments automatically.
- **Remove last note** button: removes the last note row and its preceding interval row. Disabled when only two notes remain (minimum viable scale = one interval).

All inputs fire an `input` event listener that triggers a chart re-render, giving real-time feedback.

## Notation

`#notation` has two values: `generic` (typed note names, the default and unchanged) and
`byzantine` (psaltic signs from the vendored Neanes SBMuFL font). Full detail — the tables,
the resolvers, the ladder, and how to add a second font — lives in
[BYZANTINE-SYMBOLS.md](BYZANTINE-SYMBOLS.md); this section only orients where it fits into
the app's design.

**Logical model vs. resolvers.** `byzantine.js` splits the two concerns a font-facing feature
always has. The logical model — which 21 notes exist, which 12 genera, which 16 fthores, and
which genera the modes table pairs with which note (`MARTYRIA_COMPATIBILITY`) — never
mentions a codepoint. The resolvers (`resolveMartyriaGlyphs`, `resolveFthoraGlyph`) are the
only code that does; they turn a logical choice into the glyph string the font needs. Nothing
outside `byzantine.js` should ever construct a codepoint by hand.

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

In Byzantine notation the canvas grows by two more bands, both measured from ink
(`inkBox`/`maxInkExtent`), never assumed from a constant offset:

- **The fthora gutter** (`fthoraGutter`) — a band of its own along the leading edge (left
  when vertical, top when horizontal), sized to the tallest/widest fthora ink plus one
  `TEXT_MARGIN`, and `0` when no degree carries a fthora. On the horizontal line chart this
  gutter also pushes the interval text and axis down by the same amount, so it is real clear
  space, not just reserved margin.
- **The sign overhang** (`signOverhang`) — extra clearance at *both* ends of the stack, in
  both orientations. A martyria or fthora is ink-centred on the separator it names, and the
  outermost separators sit only `CANVAS_PADDING` from the canvas edge; whatever ink extends
  past that padding is reserved as overhang so the first and last sign are never clipped.
  Zero in Generic notation. The clearance is sized from `signExtent` — the wider (horizontal)
  or taller (vertical) of the **martyria and the fthora** ink, so neither sign can be clipped
  by the other one being narrower. The horizontal *line* chart spends the same `signExtent`
  differently: it starts its axis half a sign *past* the padding (`halfSign`), which clears
  the extreme ink outright and so needs no overhang on top. All four chart paths therefore
  derive their end clearance from the one quantity.

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
  name would otherwise go (`drawNoteLabel` dispatches to `drawByzantineMark` when the chart is
  in Byzantine notation); the **fthora is drawn on the opposite side** from the note text in
  each orientation — above the note band on the horizontal charts, on the far side of the
  fthora gutter on the vertical ones. Both signs are positioned from measured ink
  (`drawGlyphs`/`inkBox`) on both axes, not from the font's baseline/pen origin, because a
  martyria's ink sits well above the baseline in Neanes and a fthora's sits well below it, and
  a constant offset would break the moment the font changes.

### Canvas resolution

The canvas `width` and `height` attributes are set to `2×` the CSS display size (device-pixel-ratio aware), and the context is scaled by 2, producing crisp output for both screen display and PNG export.

## PNG Export

A **Save as PNG** button calls `canvas.toDataURL("image/png")`, creates a temporary `<a>` element with the `download` attribute set to `scale.png`, and programmatically clicks it. This triggers a file download with no server involvement.

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
| Code organisation | Separate `index.html`, `style.css` files and three classic scripts (`byzantine.js`, `byzantine-ui.js`, `app.js`) — no modules |
