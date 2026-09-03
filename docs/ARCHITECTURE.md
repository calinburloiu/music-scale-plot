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
├── persistence.js           # The .musp.json format: serialise/parse/validate, no DOM
├── audio.js                 # The audio model: frequencies, the playback plan,
│                             # the node graph and the WAV encoder, no DOM
├── symbols-ui.js            # Wells and pickers shared by both notations
├── byzantine-ui.js          # Only what is Byzantine: the three picker builders,
│                             # the martyria draft, the ladder
├── persistence-ui.js        # The toolbar and the file flows: New/Open/Save,
│                             # collectDocumentState/applyDocumentState
├── audio-ui.js              # The transport, the sounding-note highlight, the
│                             # keyboard and the WAV export; also the per-note
│                             # play buttons
├── app.js                   # Everything else: editor DOM management, chart rendering,
│                             # PNG export — runs at load time, so it loads last
├── docs/
│   ├── ARCHITECTURE.md        # This document
│   ├── BYZANTINE-SYMBOLS.md   # The Byzantine notation layer, for maintainers
│   ├── SMUFL-ACCIDENTALS.md   # The Generic accidental layer, for maintainers
│   └── TESTING.md             # Testing guide and the mandatory TDD workflow
├── fonts/                    # Vendored Neanes and Bravura Text fonts (see README's NOTICE)
├── icons/                    # Toolbar SVG icons, --ink baked in (see Styling below)
├── LICENSE
└── README.md
```

- `index.html` — contains the page skeleton, links to `style.css`, and loads the nine
  scripts in that order (deferred).
- `style.css` — all visual styling.
- `byzantine.js`, `smufl.js`, `persistence.js`, `audio.js`, `symbols-ui.js`,
  `byzantine-ui.js`, `persistence-ui.js`, `audio-ui.js`, `app.js` — all JavaScript, split
  into nine classic `<script>` files loaded in load order, not modules:
  `<script type="module">` is fetched under CORS, and a page opened with `file://` has an
  opaque origin, so a module script would be blocked — breaking "open `index.html`
  directly in a browser". Classic scripts share one global scope, so `byzantine.js`'s
  tables, resolvers and measuring primitives are visible to `smufl.js`, `persistence.js`,
  `audio.js`, `symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `audio-ui.js` and
  `app.js` without any import.

Tests live under `test/` and are described in [TESTING.md](TESTING.md), which also
defines the mandatory TDD workflow for changes to this design.

## HTML Layout

A sticky `#toolbar` sits before `.container`, `position: sticky; top: 0; z-index: 200` —
200 clears the symbol pickers' own `z-index: 100`, both living in the root stacking
context a picker escapes the editor panel into, so 200 is the number "always on top"
actually has to beat. It holds, in order: **New**, **Open**, **Save** (a button that opens
a menu with "Save As Music Scale Plot file" and, below a separator, "Save Chart As PNG"
and "Save Audio As WAV"), a `.toolbar-separator`, then **Add note** and **Remove last
note**, a second `.toolbar-separator`, then **Play** and **Stop**; a `role="alert"`
message bar (`#toolbar-message`, hidden until a file operation has something to say) and
the hidden `<input type="file" id="open-file-input">` used by the Open fallback complete
it.

The message bar holds two children: `#toolbar-message-text`, which is what
`showToolbarMessage()`/`clearToolbarMessage()` write, and `#toolbar-message-dismiss`, the
button that closes it. The text has its own element because the button is a sibling
inside the bar — writing the container's `textContent` would delete the button along with
the old message, leaving the next message with no way out. The button carries no text
node: its × is a CSS `::before` and its accessible name an `aria-label`, so the live
region announces the message and nothing else.
Each button is icon-only (`<img src="icons/*.svg" alt="">`) with its accessible name given
entirely by `aria-label`/`title`. **Add note**, **Remove last note** and **Save as PNG**
kept their element ids (`add-note`, `remove-note`, `save-png`) across the move from the
Scale Editor and the Chart panel respectively — `app.js` finds them by id, so relocating
the markup touched no listener in it.

The page is then split into two side-by-side panels using CSS flexbox:

| Left panel — Scale Editor | Right panel — Chart |
|---|---|
| Form-based editor for notes and intervals | `<canvas>` element displaying the scale chart |

The Settings panel holds only **Notation** and **Base Note** now; **Name**, **Interval
Type**, **EDO Divisions** and **Mode** are the Scale Editor's own first four rows, above
`#editor`, in that order — Name new, the other three moved out of Settings. See
[File Persistence](#file-persistence) below for why: the file format's `settings` and
`scaleEditor` objects are the two objects those controls now mirror.

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

A picker opens on the choice the row already holds, scrolled into view. On a well that holds
nothing the fallback differs by picker: the accidentals picker opens on the entry an
accidental well was last given, so a reader working through one of 28 categories is not sent
back to the top of 501 rows for every note, and a martyria picker opens on the middle octave
rather than the top of a twenty-one row list.
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

`#base-note`'s value (`settings.baseNote`) is **semitones above C** — `0` is C, `11` is B
— the same number a `.musp.json` file stores under `settings.baseNote`, so nothing needs
translating at that boundary (see [File Persistence](#file-persistence)). `getBaseFrequency()`
reads it and wraps by `(s + 3) % 12` before turning it into Hz: the wrap keeps the audible
octave at A220…G♯415 regardless of which semitone is chosen, which is the octave the
option list's five accidentals plus seven naturals span. The default option is C
(`baseNote = 0`), so the default scale now plays at 261.63 Hz rather than the old
A-based encoding's 220 Hz.

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

`--well-size` is the **height** of every control on those two rows as well as the side of a
well: the wells, the swatch, the name box and the label are all given it outright. A text box
left to size itself from its font is a different height from the square beside it — DM Sans'
1.25em line box puts the name box at 40px against a 34px well — and would be a different
height again under a fallback face, so the height is stated rather than inherited from
whichever font loaded. Their vertical padding is 0 for the same reason; a browser centres a
single-line input's text in the content box on its own. The two well wrappers
(`.<kind>-well-wrapper`, `.color-picker-wrapper`) are flex containers rather than blocks,
because a block wrapper puts its inline-flex button on a line box, and the line box's own
strut and baseline made the wrapper taller than the button and left the button sitting at its
top — which is what tilted the three Byzantine wells against each other, an empty martyria
worst of all, its hint being absolutely positioned and so leaving the button no in-flow
baseline at all.

### Invalid intervals

An interval box holds something the app can read, or it is marked. `isValidIntervalItem()`
in `persistence.js` is the rule, and it reads the whole value rather than as much of it as
parses: a ratio is two whole numbers above zero (`RATIO_PATTERN`), an `edo` value is a
whole number of steps judged by value rather than spelling (so `0.0` counts), and a
`cents` value is any finite number. An empty box names no interval and is invalid too. So
"9.5/8" no longer reads as 9/8, "7x" no longer reads as 7 steps, and "203.91c" no longer
reads as 203.91 cents. A descending interval is still legal, written `8/9` or as a
negative step or cents count.

That strictness makes **"parses" and "is a usable interval" the same question**, which is
what `isValidIntervalValue()` asks and what the chart already answered by drawing nothing
for a `NaN`. The editor can therefore never paint a box red that the chart has drawn — and
because the file format asks the same `isValidIntervalItem()`, it can never open one into
a box it would paint red either.

`markInvalidIntervals()` toggles `.is-invalid` on every interval box, and is called from
`updateAllLabels()` — already the funnel for every editor input, add and remove note, mode
or type switch, and the end of an Open — so a value is marked however it arrived. An empty
box counts as invalid: it names no interval. Note 1's absolute box is skipped, being
disabled and pinned to `getUnisonValue()`.

Neither **Save As Music Scale Plot file** nor **Save As PNG** will run while a box is
marked, and no file carrying such a value will open; see
[File Persistence](#file-persistence).

### Initial state

The editor starts with Note 1, one interval (ratio defaulting to `9/8`, label empty), and Note 2. Both note name fields are initially empty. The user fills in only what they need — names and labels are optional and omitted from the chart when left blank.

The page still has no *automatic* persistence: every load starts from this state and from
the settings' markup defaults, and a scale reaches or leaves disk only when the user opens
or saves a `.musp.json` file through the toolbar (see [File Persistence](#file-persistence)).
`initUI()` enforces the load-time reset, because the browser does not. A browser restores
form-control state across a soft reload — the selects, the number and range inputs and every text box in the editor come back holding the values the user left them at — while `#editor`'s *structure* comes back as the markup's own two rows and the app has no state of its own to restore alongside it. Left alone, the page would boot with the controls saying one thing and the DOM-as-data-model another: `#scale-mode` on "absolute" over rows that hold relative inputs, an EDO interval type with the EDO settings row hidden, a stale cents label beside an emptied interval box.

`initUI()` therefore puts every control back to the value its markup declares (`resetControlsToDefaults()` reads the defaults off `index.html`, so a default is written down in exactly one place), then rebuilds the editor and redraws. It runs **twice**, because browsers disagree on when the restore lands: Firefox writes it while parsing, so the deferred scripts already see it, whereas Chromium writes it *after* `load`, once every top-level statement has run against the markup's defaults. `pageshow` is the first event that fires after the restore is complete in either browser — and it covers a bfcache restore as well — so `initUI()` runs once at load time, which keeps the first paint correct, and again on `pageshow`. **New**, in the toolbar, calls this same `initUI()` (plus clearing the toolbar message bar) — it is exactly "as if you opened the page in a new private session".

### Controls

Add note and Remove last note live in the toolbar now, not in the Scale Editor panel.

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
whose title, or options whose label, match every word of the query, case-,
diacritic- and dash-insensitive (`matchesQuery`/`normalizeForSearch`,
`symbols-ui.js` — the dashes because the catalogue is printed with U+2212 and
no keyboard has one). A click on one
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

## File Persistence

`persistence.js` (no DOM) defines the `.musp.json` format and its own read/write pair;
`persistence-ui.js` is the DOM half — the toolbar's handlers, `collectDocumentState()` and
`applyDocumentState()`. A scale is saved and opened **explicitly** through the toolbar;
there is no autosave and no file the page reopens on its own.

### The format, version 1

A `.musp.json` file is one JSON object: `formatVersion` (currently `1`), an optional
`name`, `settings`, `scaleEditor` and `chart`. The file is written for a person to read
and hand-edit, so where the DOM's own value is an implementation detail the format uses a
different word for it, translated at the boundary by the bidirectional maps in
`persistence.js` (`fileWordFor()` writes, the maps read):

| Field | File word | DOM value |
|---|---|---|
| `settings.notation` | `generic` / `byzantine` | same |
| `settings.baseNote` | `0`–`11`, semitones above C | same — no translation needed |
| `scaleEditor.mode` | `relativeIntervals` / `absoluteIntervals` | `relative` / `absolute` |
| `scaleEditor.intervalType.type` | `ratio` / `edo` / `cents` | same |
| `chart.style` | `boxes` / `segments` | `boxes` / `lines` |
| `chart.orientation` | `vertical` / `horizontal` | same |

`intervalType.divisionCount` is written only when `type` is `edo`, and is required there.

**Cardinality**, for *n* notes (*n* ≥ 2): `noteProperties` has *n* entries; `intervalProperties`
always has *n* − 1, one per interval *between* successive notes; `intervals` has *n* − 1 in
relative mode and *n* in absolute mode, where the first entry is the unison the editor
shows disabled on Note 1. That first entry is **required to be a unison**: Note 1 is the
base note, so no other value there has a meaning the editor could show.
`isUnisonInterval()` judges it by meaning rather than spelling — a ratio whose two terms
match (`1/1`, but `2/2` too), or zero however written for `edo` and `cents` — and
`validateScaleDocument` refuses anything else by name, the way it refuses any other
unusable field. An equivalent spelling *is* accepted and then normalised, because
`makeNoteRowHTML` pins degree 1 to `getUnisonValue()` in absolute mode and never reads its
`absoluteValue` argument: `2/2` opens showing `1/1`, which is the same pitch, so nothing a
reader would notice is lost. The app itself never writes anything but the unison there, so
none of this is reachable from a file it produced.

**The writer omits anything at its default**, so an untouched note serialises as `{}` and
a half with nothing set (`generic` or `byzantine`) disappears entirely. Defaults are `""`
for `accidental`, `name`, `alteration` and `fthora`; `GENUS_NONE` ("none") for
`martyria.genus`; `0` for `martyria.ticks`; and no `martyria` key when the well holds no
note. The reader accepts all three spellings of an unset field equally — omitted, `{}`, or
written out explicitly at the default — so these describe the same note:

```json
{ "byzantine": { "martyria": { "note": "midPa", "genus": "none", "ticks": 0 } } }
{ "byzantine": { "martyria": { "note": "midPa" } } }
```

`martyria.note` is the one martyria field that is *not* optional — no note is no
martyria, the same rule `writeMartyria()` keeps. An interval item is typed by
`intervalType.type` (a string for `ratio`, a number for `edo` or `cents`), except for one
deliberate loosening: an interval slot may carry the number as a string, so `"203.91"`
opens the same as `203.91`. What it may **not** carry is a value that is not an interval
at all.

**Both ends refuse one.** Save will not write a scale holding a box the app cannot read
(see [Invalid intervals](#invalid-intervals)), and `validateScaleDocument` will not read
one back: `isValidIntervalItem()` checks every entry in `intervals` and names the first
that fails. A file carrying such a value was therefore hand-edited or crafted, and
opening it would put a value in the editor the app cannot plot, cannot play, and would
refuse to save again — so it is turned away at the boundary and the editor keeps the
scale it had.

`isValidIntervalItem(value, type)` is the **single** rule. `intervalToCents()` defers to
it rather than restating it, and the editor's invalid marking asks it through
`isValidIntervalValue()`. So "the chart can plot it", "the editor leaves it unmarked" and
"a file may carry it" are one question with one answer, and a file can never be accepted
into a box the editor would then paint red.

### Validation

`parseScaleDocument(text)` parses the JSON and hands the result to
`validateScaleDocument(raw)`, which checks the **whole** document — every field, every
array length, every symbol id — before anything is touched, so a rejected file leaves the
editor exactly as it was; there is never a half-loaded scale. Symbol ids are resolved
against the real tables (`smuflAccidentalById`, `byzFthoraById`, `byzAlterationById`,
`byzNoteById`, `byzGenusById`), so a typo in a hand-edited file is *named* in the error
rather than silently dropped into an empty well. A container that is *present but not an
object* — a `noteProperties` entry, either of its `generic`/`byzantine` halves, a
`martyria`, an `intervalProperties` entry — is named for the same reason: "unknown keys are
ignored" is a promise about *additions* a later version might make, not a licence to read a
garbled file as blank. A `martyria` with no `note` at all gets its own sentence rather than
being reported as an unknown note whose value the file never contained. Two deliberate
softenings: unknown keys are ignored, so a file from a future minor addition still opens,
and `chart.zoom` is
clamped to 10–100 rather than rejected, because the value has one obvious safe reading and
the zoom slider would clamp it anyway. The one value normalised rather than either honoured
or refused is a non-canonical spelling of the unison in `intervals[0]` (above), and only
because every accepted spelling names the identical pitch. On success, `{ ok: true, doc }` carries a document
with every default filled back in; on failure, `{ ok: false, error }` carries one message
naming the field and, where useful, the offending value.

### Applying a document

`applyDocumentState(doc)` rebuilds the whole page from a validated document. Every control
is set by **direct value assignment, firing no events** — dispatching `change` on
`#interval-type` or `#scale-mode` would run their own handlers
(`onIntervalTypeChange` → `resetScaleToDefault()`, and the mode converter), either of which
would destroy the very scale being loaded. In order: close every dropdown
(`closeAllDropdowns()`); write the settings and scale-editor controls' values; show or hide
the EDO row and update its cents label; `updateZoom()`; `onNotationChange()` for the
editor's `notation-generic`/`notation-byzantine` class; clear and rebuild `#editor` with
`makeNoteRowElement`/`makeIntervalRowElement`, writing each row's symbol, colour and label
state through the same sanctioned writers a picker or the palette dropdown would use
(`writeNoteSign`, `writeMartyria`/`clearMartyria`, `setSwatchColor`); then
`updateRemoveBtn()`, `updateAllLabels()`, `render()`.

Two functions it deliberately does **not** call: `propagateMartyriaLadder()`, because the
file's martyrias are authoritative per degree and the ladder would overwrite them from
whichever row happened to be last, and `syncIntervalColors()`, likewise, because the file
says what each interval looks like rather than deriving it from matching values.

## Audio

One `AudioContext`, one sounding voice, and two ways to reach it: a note row's
play button, which sounds that degree for as long as it is held, and the
toolbar's **Play**, which sounds the whole scale. Both live in `audio-ui.js` so
that one file owns the oscillator; the numbers behind them live in `audio.js`,
which touches no DOM.

### The sequence and the envelope

For a scale of N degrees the melody is degrees `1, 2, … N, N−1, … 1` — **2N−1
notes**, the top note sounding once, the way a scale is practised. Every note is
a quarter at 90 BPM (`QUARTER_SECONDS = 60 / 90`), so an eight-degree scale runs
ten seconds.

`scalePlaybackPlan()` produces that schedule **as data**: one entry per sounded
note, each with a start time relative to zero and the degree it belongs to — so
the sounding-note highlight needs no second mapping from time back to a row.

Each note reuses the timbre the per-note button already produces, so a played
scale sounds like the notes the reader has been auditioning by hand: a triangle
oscillator, a 20 ms attack to gain 0.3, a sustain, and a 50 ms release landing
exactly on the note boundary. The automation has **four** events, and the third
is load-bearing:

```js
gain.setValueAtTime(0, start)
gain.linearRampToValueAtTime(0.3, start + 0.02)
gain.setValueAtTime(0.3, end - 0.05)   // anchors the sustain
gain.linearRampToValueAtTime(0, end)
```

Without that third event the automation would ramp from the end of the attack
all the way to the end of the note — a slow decay, not a sustain with a release.
The release is also what articulates the melody: each note reaches silence
exactly where the next one's attack begins, so the scale is detached rather than
smeared.

### Nothing is driven by a timer

**Every note is scheduled up front against the audio clock**, in a single
synchronous pass. No `setTimeout` or `setInterval` takes any part in producing
sound, so playback cannot drift, cannot be delayed by a busy main thread and
cannot block the UI. `playScale()` schedules from `currentTime + 0.05` rather
than from `currentTime`: the lead absorbs the cost of building the graph, so the
first note is not clipped by its own scheduling.

`requestAnimationFrame` only *paints*. `updateSoundingNote()` reads the audio
clock and moves a `.sounding` class to the play button of whichever degree is
currently sounding — the pressed look, reusing an affordance the reader already
knows rather than inventing a second highlight. If the frame loop were throttled
to a stop the audio would still be correct.

The authoritative end of a scale is **`onended` on the last oscillator**, not the
frame loop, because `requestAnimationFrame` is throttled in a background tab and
the buttons must return to idle whether or not anyone is looking. `stopScale()`
clears that handler *before* stopping the nodes, so a deliberate stop does not
also run the natural-end path.

Three interaction rules follow from there being one voice: pressing a per-note
button stops a playing scale first, **Play** stops a note being held, and
**Stop** stops whichever of the two is sounding. Editing the scale during
playback deliberately does *not* interrupt it — the plan was scheduled in full
when Play was pressed, stopping on every keystroke would make the editor
unusable while listening, and re-scheduling mid-melody has no musical meaning.

### The keyboard

Both ways to reach the voice have a key: **Space** toggles Play/Stop, and
**1…9** sound their degree for as long as they are held, wearing the same
`.sounding` pressed look the transport moves along a playing scale. A mouse
press gets that look from `:active` on the button it is held over; a key never
touches the button, so `audio-ui.js` puts it on and takes it off by hand.

Both listen on the `document`, so both have to decide whether a keystroke was
meant for them or for whatever has focus — and they give **different answers**,
because the two keys conflict with different things:

| Focused | Space | 1…9 |
|---|---|---|
| Nothing (`<body>`) | toggles | plays |
| `<input>`, `<textarea>`, `<select>`, `contenteditable` | ignored | ignored |
| `<button>`, `<a href>`, `<summary>` | ignored | plays |

A **disabled** button is not in the Space column: there is no click to stand
aside for, and standing aside anyway costs the whole shortcut. Both transport
buttons disable themselves on click, and Firefox leaves the focus sitting on
them when they do — Chromium and WebKit move it to `<body>` — so without the
exclusion, clicking **Stop** with the mouse would take Space away from the
transport in Firefox, and the shortcut would look broken exactly after the
gesture a reader is most likely to make.

Of the rows above, today's `index.html` only actually contains `<input>`,
`<select>` and `<button>`. The rest are named because the cost is a word and
the failure would be silent — a page that later grows a comment field or a
`<details>` would otherwise play a scale into it.

A digit is only ever eaten by something you can type into — which is the point:
typing `3/2` into an interval box must not play degrees 3 and 2. Space is eaten
by those *and* by a focused button, because the browser is already turning it
into a click there; handling it as well would run New **and** start the scale
from one keystroke. A `<select>` blocks both, since a digit is option typeahead
and Space opens the list. Every chord (Ctrl/Cmd/Alt/Shift) is left alone —
Shift+Space is "scroll up" in every browser, and swallowing it would cost the
reader a scroll gesture to buy nothing. Shift costs the digits nothing either:
Shift+1 arrives as `!`, which `numberKeyDegree()` already reads as no degree.

**Escape lets go of the control that has focus**, which is what makes the two keys
above reachable without the mouse: a reader who has just typed an interval would
otherwise have to click somewhere neutral before Space or a digit did anything. It
blurs only what actually swallows those keys — the same `isTextEntryElement()` set, so
an `<input>`, `<textarea>`, `<select>` or contenteditable — and is checked *before* the
guard it exists to undo. A focused **button** keeps focus, for two reasons: Space there
is already its own click, and `persistence-ui.js`'s own Escape deliberately closes the
Save menu and puts focus back on the button that opened it. That handler is registered
first, on the same `document`, so this one runs second and must not undo it. Escape
does not disturb the value: no engine reverts a field on Escape, and nothing here
prevents the default.

Space is taken off the page on every keydown, repeats included, or a held Space
scrolls it — but only the first acts, since toggling on every repeat would make
the transport unusable. A repeated digit is likewise one press, not a tremolo.

**A digit past the end of the scale sounds nothing.** `getFrequencyForDegree()`
falls back to the base frequency for a degree that does not exist, which is
right for a button that can only be clicked where it exists; from the keyboard
it would be a note with no button to show where it came from.

The held degree is remembered in `keyboardDegree`, and that is what makes
rolling one finger onto the next key work: the keyup for a key released *after*
another took the voice names a degree that is no longer held, so it is ignored
rather than cutting the note that is actually sounding. `stopTone()` clears it
before its own early return, so the look and the voice it belongs to always end
together no matter who ended them — a mouse press, Play, Stop, or the key
itself. A `blur` on the window releases a held note too: focus can leave
mid-hold, and then the keyup never arrives at all.

### Announcing the shortcuts

Every control that has a keyboard shortcut says so, in both halves: a `title`
for the reader who can see the tooltip, and `aria-keyshortcuts` for the one
whose screen reader announces it. A control with no shortcut claims none — the
browser owns Ctrl+N, so **New** has nothing to say.

| Control | `title` | `aria-keyshortcuts` |
|---|---|---|
| Open | Open (⌘O / Ctrl+O) | `Control+O Meta+O` |
| Save As Music Scale Plot file | … (⌘S / Ctrl+S) | `Control+S Meta+S` |
| Play scale | Play scale (Space) | `Space` *while enabled* |
| Stop playing | Stop playing (Space) | `Space` *while enabled* |
| A note row's play button, degrees 1–9 | Play note 3 (key 3) | `3` |

The transport is the one place the declaration **moves**. Space is a toggle, so
at any instant it activates exactly one of the two buttons, and
`updateTransportButtons()` puts `aria-keyshortcuts` on that one and takes it off
the other: a disabled button that still claimed the shortcut would be promising
an activation it will not perform. The titles do not move with it — a tooltip
naming the transport's key stays true of a button that is merely waiting its
turn, and a disabled button rarely shows one anyway.

`aria-keyshortcuts` lives in the markup, because it names **both** chords the
handler accepts and reads the same on every machine. The tooltip cannot: a
reader sees one keyboard, and "Ctrl+S" on a Mac is wrong. So
`persistence-ui.js`'s `applyShortcutHints()` writes those two titles at load
time in the platform's own notation, preferring `navigator.userAgentData` over
the deprecated `navigator.platform` where a browser offers it. It composes each
title from the control's accessible name rather than appending to whatever the
title already says, so running it twice cannot stack two hints. Only the chords
need this — Space is Space everywhere, so the transport's *titles* are static
markup; only its `aria-keyshortcuts` moves, and for the reason above.

A note row's play button carries all three of `aria-label`, `title` and
`aria-keyshortcuts`, built by `makePlayButtonHTML()`. The `aria-label` is not
decoration: the button's whole text content is ▶ (U+25B6), which a screen
reader reads out as the character rather than as what pressing it does. Past
`NUMBER_KEY_DEGREE_LIMIT` a degree claims no key, because none reaches it —
announcing one would be announcing a shortcut that does nothing. That constant
lives in `audio-ui.js` beside `numberKeyDegree()`, which is what enforces it, so
the two cannot drift.

### WAV export

**Save Audio As WAV** renders the same melody through an `OfflineAudioContext`
and writes a mono, 16-bit, 44.1 kHz WAV. `scheduleScale()` is shared by live
playback and the render, the only difference being which context and destination
it is handed — so the exported file is what the reader heard by construction,
not because two implementations happen to agree. There is no scheduling lead
offline: nothing can be late in a render that is not realtime. The constructor is
resolved as `OfflineAudioContext || webkitOfflineAudioContext`, the same fallback
`getAudioContext()` makes for the online one: the two lost their prefix in the
same Safari release, so a browser needing one needs the other.

**The sample rate is fixed at 44100, not taken from the device's
`AudioContext`** — the same principle `savePNG()` follows in re-rendering at
`EXPORT_SCALE` rather than at `devicePixelRatio`. The same scale exported from a
Mac running its output at 48 kHz and from a machine at 44.1 kHz must produce the
same file, with nothing in it to tell the two apart.

`encodeWavMono16()` writes a canonical 44-byte RIFF/WAVE header and
little-endian PCM. Samples are clamped to [−1, 1] and scaled asymmetrically —
`s < 0 ? s * 0x8000 : s * 0x7fff` — which is the conversion that maps −1.0 and
+1.0 onto the full signed range without wrapping. Clipping should never occur in
practice (one voice at a time, peak gain 0.3, no overlap); the clamp is there
because an encoder that trusts its input produces a file that clicks.

The download uses a `Blob` and `URL.createObjectURL`, **not** the `data:` URL the
scale-file and PNG saves use: an eight-degree scale is 882 KB, which base64
inflates to about 1.18 MB, and a sixteen-degree one reaches 2.43 MB — past the
point where `data:` downloads are reliable. The object URL is revoked on the next
macrotask, after the click has been dispatched; revoking synchronously can cancel
the download. The file is named after the scale through `suggestedFileName()`, so
it shares its slug rule and diacritic folding with the `.musp.json` save.

### Why WAV, and not a compressed format

The project's own rule — no libraries, no build step — leaves only what a browser
can encode natively, and there the two requirements pull apart. Every current
browser can record WebM/Opus through `MediaRecorder`, but a `.webm` audio file
opens in neither QuickTime nor iOS; `.m4a` opens everywhere, but AAC encoding is
absent from Firefox on every platform, so the app would hand different browsers
different formats and the menu label would have to change per browser.

Compression also costs the non-blocking property. `MediaRecorder` has no offline
mode: it captures a stream in wall-clock time, so an eight-degree scale would
take the full ten seconds to export and would need progress and cancel UI.
`OfflineAudioContext` renders the same scale in milliseconds.

Against that, a mono 16-bit 44.1 kHz WAV of an eight-degree scale is 882 KB, and
705 kbps clears the ">128 kbps" the issue asked for by a wide margin. FLAC is the
one option that satisfies every stated requirement at once — compressed,
lossless, offline-renderable, natively playable everywhere — but it costs roughly
200 lines of fixed-predictor and Rice-coding bit packing that this app would then
own and test forever. Recorded here so a future reader knows the ground was
covered, not missed.

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

**Enter** does the same thing as the Add note button, from wherever the user already
is. `handleEditorEnter()` is delegated on `#editor` and fires for the four text boxes a
row carries — the interval value, the absolute value, the note name and the interval
label — so a scale is typed value, Enter, value, Enter without reaching for the mouse.
It then calls `focusNewestIntervalInput()`, which puts the cursor in the box the next
value goes in: the new interval row's in relative mode, the new note row's own in
absolute. `#scale-name` and `#edo-divisions` describe the whole scale rather than one
note, and they sit outside `#editor`, so the delegated listener never sees them.

At load time, and again on `pageshow`, `initUI()` resets the settings and the editor to their defaults and renders — see [Initial state](#initial-state).

**Open**:

```
User picks a file (File System Access picker, or the hidden <input type=file>)
                               │
                               ▼
                    parseScaleDocument(text)
                               │
                 ┌─────────────┴─────────────┐
                 ▼                            ▼
            ok: false                     ok: true
                 │                            │
                 ▼                            ▼
      showToolbarMessage(error)      applyDocumentState(doc)
      (editor left untouched)                 │
                                               ▼
                                     clearToolbarMessage(), render()
```

**Save** (always Save As — no dirty tracking, no remembered handle):

```
collectDocumentState()  ──►  serializeScaleDocument()  ──►  JSON text
                                                                │
                                                                ▼
                          window.showSaveFilePicker exists?
                                 │                    │
                                yes                   no
                                 │                    │
                                 ▼                    ▼
                      picker → createWritable   downloadScaleFile()
                      → write → close           (<a download> + data: URL,
                                                 the same mechanism savePNG() uses)
```

## Styling

- Clean, minimal design with a light background.
- Editor inputs are styled for comfortable editing.
- The two panels are responsive: on narrow viewports they stack vertically instead of side-by-side.
- The canvas panel uses `position: sticky` so the chart stays visible while scrolling a long editor list.
- **The left column is a fixed width** (`35rem`) rather than sized to its content, so switching
  Notation or Mode cannot resize the Settings and Scale Editor panels or move the Chart beside
  them. The four combinations want four different widths — a note row's right-hand block is a
  well and a name box in Generic but three wells in Byzantine, and the widest line is the note
  row in Absolute mode where it is the interval row in Relative — and `35rem` clears the widest
  of them. The surplus falls into the gap in the middle of a row, since every right-hand block
  is `margin-left: auto`. Both breakpoints override it with `width: 100%`.
- Nothing in the page may push it sideways: the chart panel carries `min-width: 0` and
  `overflow-x: auto` so a wide canvas scrolls inside its own panel rather than widening the
  container, and the interval row's label cluster is `flex: 0 1 auto` so that it can give way
  on a narrow phone, as the note-name box above it already does.
- **`#1a1814` is written in seven `.svg` files as well as in `--ink`.** An SVG loaded
  through `<img>` (the toolbar's seven icons) renders in an isolated document that no page
  CSS reaches, so `currentColor` never resolves — each icon's ink is baked at author time
  instead. A change to the `--ink` custom property must change `icons/new.svg`,
  `icons/open.svg`, `icons/save.svg`, `icons/add-note.svg`, `icons/remove-note.svg`,
  `icons/play.svg` and `icons/stop.svg` with it, or the toolbar and the rest of the page
  drift apart.

## Summary

| Concern | Approach |
|---|---|
| State management | DOM is the source of truth; read inputs on each change |
| Rendering | HTML5 Canvas 2D API |
| Reactivity | Single `input` event listener on the editor container (event delegation) |
| Export | `canvas.toDataURL()` + programmatic download for the chart; `OfflineAudioContext` + a hand-written WAV encoder for the audio |
| Dependencies | None |
| Build step | None — open `index.html` in a browser |
| Code organisation | Separate `index.html`, `style.css` files and nine classic scripts (`byzantine.js`, `smufl.js`, `persistence.js`, `audio.js`, `symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `audio-ui.js`, `app.js`) — no modules |
