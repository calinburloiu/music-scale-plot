# File persistence — design

Design for [issue #15, *Add file persistence support*](https://github.com/calinburloiu/music-scale-plot/issues/15).

Sources this design rests on, and does not restate:

- [`issues/015-file-persistence/impl-prompt.md`](impl-prompt.md) — the requirement, and the format clarifications.
- [`issues/015-file-persistence/format-sample.musp.json`](format-sample.musp.json) — the **starting proposal**, annotated. It predates the decisions in §2, so §3 supersedes it: `intervalType` has since moved into `scaleEditor`, and `formatVersion`, `name` and `martyria.ticks` have been added.
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — the DOM-as-data-model, the editor's rows, the notation switch.
- [`docs/TESTING.md`](../../docs/TESTING.md) — the mandatory TDD loop and the harness.

---

## 1. What is being built

The app gains the ability to **save its whole state to a `.musp.json` file and restore
it**. To reach that, a new sticky **toolbar** runs across the top of the page holding
New, Open, Save (a menu) and the Add/Remove note buttons relocated from the Scale
Editor. A new **Name** box names the scale, and **Interval Type** moves from Settings
into the Scale Editor next to Mode.

`musp` is *MuSP*, for Music Scale Plot, lowercased.

**Base Note** also gains the five accidentals — all twelve chromatic notes — and is
re-encoded from C, which moves the default from A to C (§5.1).

Nothing about the chart, the symbol model or the interval maths changes. This is a
serialisation layer, a toolbar, controls that move, and one widened selector.

---

## 2. Decisions taken

Recorded so the plan does not relitigate them.

| Question | Decision | Why |
|---|---|---|
| How to reach the filesystem | File System Access API first, download/`<input type=file>` fallback | The API gives a real Save-As dialog with `.musp.json` pre-selected; the fallback keeps Firefox, Safari and `file://` working, which is how the app is documented to run |
| Format version | `formatVersion: 1`, required | A future format change must be detectable, not guessable from shape |
| Martyria ticks | Persisted | `ticks` is user-visible state (`ladderNoteAt`, `byzantine.js:345`); without it a scale in the tick octave reloads an octave wrong |
| Bad file on Open | Validate everything first, reject as a whole, keep current state, report in a message bar | Never a half-loaded editor; the user never loses work to a bad file |
| Icons | Real `.svg` files in `icons/`, loaded with `<img>`, colours baked | The user wants editable SVG assets. See §5.2 for what this costs and how it is paid |
| Keyboard shortcuts | Ctrl/Cmd+O and Ctrl/Cmd+S | The browser owns Ctrl+N, so New gets no chord |
| Name box location | Scale Editor, above Mode | A name is a property of the scale; Settings is for choices that change how values are *interpreted* |
| Interval Type location | Scale Editor, above Mode, with EDO Divisions | Interval Type and Mode are the two axes that decide what an interval box means, and changing it calls `resetScaleToDefault()` — an editor operation |
| `name` in the JSON | Top level, not `scaleEditor.name` | File identity; it feeds the suggested filename and couples to nothing else |
| Code layout | Two new scripts, model/UI split | Mirrors `byzantine.js`/`byzantine-ui.js` and `smufl.js`/`symbols-ui.js` |
| Base Note | All twelve chromatic notes, encoded 0–11 above **C**, in the DOM *and* the file | One encoding, no translation to get wrong, and C=0 is the conventional pitch class. See §5.1 |
| Default base note | **C**, changed from A | The chromatic list starts at C, and the first option is the default. An audible change, recorded in §5.1 |

---

## 3. The format, version 1

```json
{
  "formatVersion": 1,
  "name": "Hicaz",
  "settings": {
    "notation": "generic",
    "baseNote": 0
  },
  "scaleEditor": {
    "mode": "relativeIntervals",
    "intervalType": { "type": "edo", "divisionCount": 72 },
    "intervals": [7, 5, 12],
    "noteProperties": [
      {
        "generic": { "accidental": "accidentalSharp", "name": "hicaz" },
        "byzantine": {
          "alteration": "diesisGeniki",
          "fthora": "diatonicPa",
          "martyria": { "note": "midPa", "genus": "alpha", "ticks": 1 }
        }
      },
      { "generic": { "name": "neva" } },
      {},
      {}
    ],
    "intervalProperties": [
      { "color": "#CCFFCC", "label": "s" },
      { "color": "#FFFFFF" },
      { "color": "#CCFFCC", "label": "s" }
    ]
  },
  "chart": {
    "style": "boxes",
    "orientation": "vertical",
    "zoom": 75
  }
}
```

`format-sample.musp.json` carries `//` comments for the reader. **Real files are plain
JSON**; the reader is `JSON.parse` and does not tolerate comments. The document above is
checked in comment-free as `issues/015-file-persistence/example.musp.json` and parsed by
a unit test, so this design's example cannot quietly drift out of validity.

### 3.1 The format's vocabulary is its own

The file is written for a human to read and hand-edit. Where the DOM's value is an
implementation detail, the file uses a word instead, translated at the boundary:

| Field | File | DOM (`index.html`) |
|---|---|---|
| `settings.notation` | `generic`, `byzantine` | same |
| `settings.baseNote` | `0`–`11`, semitones above C | same — see §5.1 |
| `scaleEditor.mode` | `relativeIntervals`, `absoluteIntervals` | `relative`, `absolute` |
| `scaleEditor.intervalType.type` | `ratio`, `edo`, `cents` | same |
| `chart.style` | `boxes`, `segments` | `boxes`, `lines` |
| `chart.orientation` | `vertical`, `horizontal` | same |

`divisionCount` is written **only** when `type` is `edo`, and is required there.

### 3.2 Cardinality

With *n* notes (*n* ≥ 2):

| Array | Length |
|---|---|
| `noteProperties` | *n* |
| `intervalProperties` | *n* − 1 — always the intervals *between successive notes* |
| `intervals`, `mode: relativeIntervals` | *n* − 1 |
| `intervals`, `mode: absoluteIntervals` | *n* |

In absolute mode the first entry is the unison the editor shows disabled on Note 1.

### 3.3 Interval item types

`intervalType.type` decides what an `intervals` entry is:

- `ratio` → a string, `"9/8"`.
- `edo` → a number of steps, `7`.
- `cents` → a number, `203.91`.

**One deliberate loosening.** An interval box may hold text that does not parse — a
half-typed scale, saved mid-thought. The writer then emits the **raw string** even where
a number is canonical, and the reader accepts a string in either position and puts it
straight back in the box. Nothing is lost and nothing is invented: the editor already
tolerates unparseable input, `readScaleData` yields `cents: NaN` for it, and the chart
skips it. A file written from a valid scale is always canonically typed.

### 3.4 Note properties carry both notations

Switching Notation hides half of every note row but discards nothing, so a file records
both halves regardless of `settings.notation`, and Open restores both.

```json
{
  "generic":   { "accidental": "<accidental id>", "name": "<string>" },
  "byzantine": {
    "alteration": "<alteration id>",
    "fthora": "<fthora id>",
    "martyria": { "note": "<byzantine note id>", "genus": "<genus id>", "ticks": 0 }
  }
}
```

The name box is shared markup but is hidden by CSS in Byzantine
(`style.css:435`), so `name` belongs under `generic`.

**The writer omits anything at its default.** Defaults are: `""` for `accidental`,
`name`, `alteration` and `fthora`; `"none"` for `martyria.genus`; `0` for
`martyria.ticks`; and no `martyria` key at all when the well is empty. An object left
with no keys is omitted in turn, so an untouched note serialises as `{}`.

**The reader accepts all three spellings equally** — omitted, `{}`, or written out
explicitly at the default value. These three are the same note:

```json
{ "byzantine": { "martyria": { "note": "midPa", "genus": "none", "ticks": 0 } } }
{ "byzantine": { "martyria": { "note": "midPa" } } }
```
```json
{ "generic": { "name": "ni" }, "byzantine": {} }
{ "generic": { "name": "ni" } }
```

`martyria.note` is the one martyria field that is not optional: no note is no martyria,
matching `writeMartyria`'s own rule (`byzantine-ui.js:56`).

### 3.5 Interval properties

```json
{ "color": "#RRGGBB", "label": "<string>" }
```

`color` accepts any `#RRGGBB`, not only palette entries, so a hand-edited file renders
what it asks for. `label` defaults to `""` and is omitted when empty; `color` is always
written, because there is no single default (it depends on the active palette, which
depends on `chart.style`).

---

## 4. Code layout

Two new classic scripts, splitting model from DOM the way the repo already does.

### `persistence.js` — the format. No DOM.

```js
const SCALE_FILE_VERSION = 1;
const SCALE_FILE_EXTENSION = ".musp.json";

// Bidirectional enum maps: SCALE_MODE_NAMES, CHART_STYLE_NAMES
// (baseNote needs none — §5.1 makes the DOM and the file agree)

function serializeScaleDocument(state)   // state object -> pretty JSON string
function parseScaleDocument(text)        // JSON string -> {ok:true, doc} | {ok:false, error}
function validateScaleDocument(raw)      // the rules of §6, returns the same shape
function suggestedFileName(name)         // "Hicaz" -> "hicaz.musp.json"; "" -> "scale.musp.json"
```

`state` is a plain object in the file's own vocabulary — the same shape the JSON has,
minus the serialisation of defaults. Both directions are pure and testable without a
page.

### `persistence-ui.js` — the DOM half.

```js
function collectDocumentState()      // reads #editor and the controls into a state object
function applyDocumentState(doc)     // rebuilds #editor and the controls from one
function newScaleFile()              // the New button
function openScaleFile()             // the Open button
function saveScaleFile()             // the "Save As Music Scale Plot file" menu item
function toggleSaveMenu(open)        // the Save button's menu
function closeSaveMenu()             // called by app.js's closeAllDropdowns()
function showToolbarMessage(text)    // the message bar
function clearToolbarMessage()
```

### Load order

```
byzantine.js → smufl.js → persistence.js → symbols-ui.js → byzantine-ui.js
             → persistence-ui.js → app.js
```

Seven scripts, still classic, still no build step. `app.js` stays last because it runs at
load time. `persistence-ui.js` goes before it and only *defines* functions and *wires*
listeners at its top level — it never calls into `app.js` before `app.js` has run, and
its handlers resolve `app.js`'s globals at click time, which is long after.

`persistence.js` sits with the other no-DOM files.

### What changes in `app.js`

Small, because **the moved buttons keep their IDs**. `add-note`, `remove-note` and
`save-png` are found with `getElementById` (`app.js:52-54`), so relocating the elements
in `index.html` leaves those lines and every listener on them untouched. The whole test
suite reaches them by ID too, never through a container, so no existing test moves.

Three edits:

1. `resetControlsToDefaults()` also clears `#scale-name`, so startup and New reset it
   along with everything else.
2. `closeAllDropdowns()` also calls `closeSaveMenu()`, alongside its existing
   `closeSymbolPickers()`. One function keeps meaning "close every transient overlay".
3. `getBaseFrequency()` re-reads its input as semitones above C, per §5.1.
4. **Refactor under a green suite:** extract `makeNoteRowElement(degree, mode, absVal)`
   and `makeIntervalRowElement(value, mode)`. `resetScaleToDefault`, `addNote` and the
   new `applyDocumentState` all build rows the same six-line way; today two of them
   repeat it verbatim. Behaviour-preserving, so no assertion changes.

---

## 5. The controls

### 5.1 Base Note — twelve chromatic notes, encoded from C

Today `#base-note` offers seven naturals, valued as **semitones above A**
(`A=0, B=2, C=3 …`), which `getBaseFrequency()` turns into Hz with
`220 × 2^(s/12)` (`app.js:94`).

It gains the five accidentals, and the whole list is re-encoded as **semitones above C**
so the DOM and the file agree and nothing needs translating at the boundary:

```html
<option value="0">C</option>       <option value="6">F♯/G♭</option>
<option value="1">C♯/D♭</option>   <option value="7">G</option>
<option value="2">D</option>       <option value="8">G♯/A♭</option>
<option value="3">D♯/E♭</option>   <option value="9">A</option>
<option value="4">E</option>       <option value="10">A♯/B♭</option>
<option value="5">F</option>       <option value="11">B</option>
```

```js
function getBaseFrequency() {
  // Semitones above C. The wrap keeps the range at A220 … G♯415, which is
  // exactly the octave the A-based encoding spanned — so every note that
  // could be chosen before still sounds at the pitch it did.
  const s = parseInt(baseNoteSelect.value, 10);
  return 220 * Math.pow(2, ((s + 3) % 12) / 12);
}
```

The wrap is what makes this behaviour-preserving: C→261.63, A→220, B→246.94, identical
to today for all seven naturals.

**One deliberate behaviour change comes with it.** The default base note is whichever
option is first, and a chromatic list starts at C — so the default moves from **A (220 Hz)
to C (261.63 Hz)**. The default scale's playback pitch changes for anyone who never
touched the control. The chart is unaffected; only audio.

Base Note stays in the Settings panel. Only its options and their encoding change.

### 5.2 The toolbar

#### Markup

A `<div id="toolbar" role="toolbar" aria-label="File and scale actions">` placed before
`.container`, holding:

```
[New] [Open] [Save ▾] │ [Add note] [Remove last note]
```

with a separator between the file group and the note group, and a message bar
(`<div id="toolbar-message" role="alert" hidden>`) below the buttons.

The Save menu is a panel under the button:

```
Save As Music Scale Plot file
────────────────────────────
Save As PNG                    ← id="save-png", moved from the Chart panel
```

Each button is `<button aria-label="Open" title="Open"><img src="icons/open.svg" alt=""></button>`.
The buttons have no text, so the `aria-label` is their only accessible name.

The Save button carries `aria-haspopup="menu"` and an `aria-expanded` that tracks the
panel.

#### Positioning

`position: sticky; top: 0; z-index: 200`, as a direct child of `<body>` before
`.container`. 200 clears the pickers' `z-index: 100`, which is what "always on top" has
to beat here — and clears it in the root stacking context, the same one the note-row
pickers escape into (`style.css:1447`).

#### Icons

Five files beside `fonts/`:

```
icons/new.svg  icons/open.svg  icons/save.svg  icons/add-note.svg  icons/remove-note.svg
```

The caret on the Save button is a CSS triangle, not a file, so it follows the button's
own colour.

**The cost of `<img>`, and how it is paid.** An SVG loaded through `<img>` renders in an
isolated document that no page CSS reaches, so `currentColor` does not resolve and each
file's colour is fixed at author time. Today `#add-note` is a filled dark button (a light
glyph on dark, `--accent` on hover) and `#remove-note` an outline one (`--ink-soft` →
`--ink` on hover) — two different ink colours, changing on hover. Baked SVG cannot do
that.

So the toolbar gives all five buttons **one treatment**: transparent background, icons
baked at `--ink` (`#1a1814`), and every state expressed with opacity and the button's own
background rather than the icon's fill.

| State | Icon | Button |
|---|---|---|
| resting | `opacity: 0.72` | transparent |
| hover | `opacity: 1` | `--paper-deep` |
| active | `opacity: 1` | `--paper-deep`, no lift |
| disabled | `opacity: 0.3` | transparent, `cursor: not-allowed` |

`0.3`/`0.35` for disabled is already this codebase's idiom (`style.css:719`, `:1149`).

Two consequences to accept knowingly:

- **Add note loses its filled-primary emphasis.** It is one of five peers in a toolbar
  now rather than the Scale Editor's call to action. Normal for a toolbar, but a real
  change in how the page reads.
- **`#1a1814` is written in five `.svg` files as well as in `--ink`.** If that token
  changes, the icons must change with it. Noted in `docs/ARCHITECTURE.md` so the
  duplication is discoverable rather than surprising.

`<img>` was chosen over `<use href="icons.svg#id">` and `fetch`-then-inline because both
are same-origin-restricted and fail on `file://` — the same reason `CLAUDE.md` forbids ES
modules. `<img>` loads from `file://` in every target browser, as `fonts/*.woff2` already
does under the stricter font rules.

jsdom does not load images, so the harness needs no change for them.

#### What moves, and what is left behind

| Control | From | To |
|---|---|---|
| Add note | `.editor-controls` in the Scale Editor | toolbar |
| Remove last note | `.editor-controls` in the Scale Editor | toolbar |
| Save as PNG | `.chart-toolbar` in the Chart panel | Save menu item |
| Interval Type | Settings panel | Scale Editor, above Mode |
| EDO Divisions | Settings panel | Scale Editor, above Mode |
| Name | *new* | Scale Editor, first row |

`.editor-controls` and the `.chart-toolbar-row` that held `#save-png` are removed from
`index.html`. Settings is left with Notation and Base Note.

The moved rows' CSS is keyed on their own classes (`.interval-type-row`,
`.edo-settings-row` at `style.css:136-206`), not on `.settings-panel > …`, so they travel
as written. They then need reconciling into one visual family with `.scale-mode-row`
(`style.css:222-255`) and the new `.scale-name-row`, and the responsive block at
`style.css:1323-1348` follows them.

---

## 6. Validation

`parseScaleDocument` parses and then hands the result to `validateScaleDocument`, which
checks the **whole** document before anything is touched — so a rejected file leaves the
editor exactly as it was.

| Rule | Message on failure |
|---|---|
| Parses as JSON | `Not a valid JSON file.` |
| Root is an object | `Not a Music Scale Plot file.` |
| `formatVersion === 1` | missing → `Not a Music Scale Plot file: no formatVersion.`; higher → `This file was saved by a newer version of Music Scale Plot (format 2).` |
| `name` a string if present | `name must be text.` |
| `settings.notation` in the enum | `settings.notation must be "generic" or "byzantine", got "x".` |
| `settings.baseNote` an integer 0–11 | `settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12.` |
| `scaleEditor.mode` in the enum | `scaleEditor.mode must be "relativeIntervals" or "absoluteIntervals", got "x".` |
| `intervalType.type` in the enum | `scaleEditor.intervalType.type must be "ratio", "edo" or "cents", got "x".` |
| `divisionCount` an integer ≥ 1 when `edo` | `scaleEditor.intervalType.divisionCount must be a whole number of at least 1.` |
| `noteProperties` an array, length ≥ 2 | `scaleEditor.noteProperties must list at least 2 notes.` |
| `intervalProperties.length === n - 1` | `scaleEditor.intervalProperties has 2 entries, expected 3.` |
| `intervals.length` per §3.2 | `scaleEditor.intervals has 3 entries, expected 4.` |
| Each interval a string or finite number | `scaleEditor.intervals[2] must be a number or text.` |
| Every symbol id resolves | `Unknown accidental "accidentalSharpp" on note 2.` — and the same for fthora, alteration, martyria note, genus |
| `color` matches `#RRGGBB` | `scaleEditor.intervalProperties[1].color must be a hex colour like "#CCFFCC".` |
| `chart.style` / `chart.orientation` in their enums | as above |

Symbol ids are resolved against the real tables — `smuflAccidentalById`,
`byzFthoraById`, `byzAlterationById`, `byzNoteById`, `byzGenusById` — so a typo in a
hand-edited file is **named** rather than silently dropped into an empty well.

Two deliberate softenings:

- **Unknown keys are ignored.** A file from a future minor addition still opens.
- **`chart.zoom` is clamped to 10–100** rather than rejected. The value has one obvious
  safe reading, and the slider would clamp it anyway.

---

## 7. Flows

### New

`initUI()` — which is already both the startup path and the `pageshow` handler, and is
already exactly "as if you opened the page in a new private session" — plus clearing
`#scale-name` via the extended `resetControlsToDefaults`, and dismissing any message
left in the toolbar bar.

### Save

Always **Save As**. The menu item says so, so there is no dirty tracking, no
overwrite-in-place, and no remembered handle. Ctrl/Cmd+S prompts every time.

1. `collectDocumentState()` → `serializeScaleDocument()` → JSON, 2-space indent, trailing
   newline.
2. `suggestedFileName(name)` — lowercase, every run of characters outside `a-z0-9`
   collapsed to a single `-`, leading and trailing `-` trimmed, then `.musp.json`.
   `"Hicaz Hümayun"` → `hicaz-h-mayun.musp.json`. An empty name, or one that slugs away
   to nothing, gives `scale.musp.json`.
3. If `window.showSaveFilePicker` exists: call it with

   ```js
   { suggestedName, types: [{ description: "Music Scale Plot file",
                              accept: { "application/json": [".musp.json"] } }] }
   ```

   then `createWritable()`, write, close.
4. Otherwise: `<a download=suggestedName href="data:application/json;charset=utf-8,…">`
   and click it.

The `data:` URL is the same mechanism `savePNG` already uses (`app.js:1544`). That is
deliberate: it needs no `URL.createObjectURL` shim in jsdom, the existing anchor stub
records `{download, href}` unchanged, and a test can read the saved JSON straight back
out of `href`. A scale document is a few KB, far inside what `<a download>` accepts.

### Open

1. If `window.showOpenFilePicker` exists: call it with the same `types`, then
   `getFile()`, then `.text()`.
2. Otherwise: a hidden `<input type="file" accept=".musp.json,application/json">`,
   `.click()`, and read `files[0]` on `change`.
3. `parseScaleDocument(text)`. On `ok`, `applyDocumentState(doc)` and clear any message.
   On failure, `showToolbarMessage(...)` and change nothing.

A cancelled picker rejects with `AbortError`. That is **swallowed silently** — the user
chose not to open a file; it is not an error to report.

### `applyDocumentState(doc)`

Order matters, and the reason is worth stating: **every control is set by direct value
assignment, firing no events.** Dispatching `change` on `#interval-type` runs
`onIntervalTypeChange` → `resetScaleToDefault()`, and on `#scale-mode` runs the mode
converter — either would destroy the scale being loaded.

1. `closeAllDropdowns()`.
2. Set `#scale-name`, `#notation`, `#base-note`, `#interval-type`, `#edo-divisions`,
   `#scale-mode`, `#chart-style`, `#orientation`, `#zoom` — values only.
3. Show or hide `#edo-settings`; `updateEdoCentsLabel()` when the type is `edo`.
4. `updateZoom()`.
5. `onNotationChange()` — for the editor's `notation-generic`/`notation-byzantine` class.
6. `editor.innerHTML = ""`, then append *n* note rows and *n*−1 interval rows built with
   the extracted `makeNoteRowElement` / `makeIntervalRowElement`, in the file's mode.
7. Per row, write the state through the sanctioned writers: `writeNoteSign(row, kind, id)`
   for accidental, alteration and fthora; `writeMartyria(row, note, genus, ticks)` or
   `clearMartyria(row)`; `setSwatchColor(swatch, hex)`; and the plain `.value` for names,
   labels and interval inputs.
8. `updateRemoveBtn()`, `updateAllLabels()`, `render()`.

Two things it deliberately does **not** call:

- **`propagateMartyriaLadder`** — the file's martyrias are authoritative, per degree. Running
  the ladder would overwrite them from whichever row happened to be last.
- **`syncIntervalColors`** — likewise for colours and labels. The file says what each
  interval looks like.

---

## 8. Testing

TDD throughout: the failing test first, watched failing, for every behaviour below.

### `test/unit/scale-file-format.test.js` — new

The whole of §3 and §6, without a page:

- Every enum mapping, both directions, including `baseNote` ↔ semitone and
  `segments` ↔ `lines`.
- `divisionCount` written only for `edo`.
- Default omission on write: empty accidental, empty name, `genus: "none"`, `ticks: 0`, an
  emptied `generic`/`byzantine` object, an untouched note as `{}`.
- All three read spellings of §3.4 producing identical state.
- `parseScaleDocument(serializeScaleDocument(x))` ≡ `x`, for a state exercising every field.
- Interval item typing per §3.3, including the unparseable-string loosening.
- `example.musp.json` — the §3 document, checked in comment-free — parses clean.
- One rejection test per rule in §6, asserting the **message**, not just that it failed.
- `zoom` clamped, unknown keys ignored.

### `test/integration/file-persistence.test.js` — new

- **Round trip through the real editor.** Build a scale with EDO intervals, absolute
  mode, names, accidentals, martyrias including ticks, fthores, alterations, colours,
  labels and a scale name; Save; New; Open; assert every control and every row came back.
- **Both notations' hidden state survives** — the issue's explicit requirement. Set a
  generic name and accidental, switch to Byzantine, set a martyria, Save, New, Open, and
  assert both halves are there whatever `settings.notation` says.
- **New** resets the controls, the editor and the name.
- **A bad file leaves the editor untouched** and shows the message.
- **A cancelled picker** changes nothing and shows no message.
- **Both I/O branches**: the FS Access path when the stubs are installed, the
  `<a download>` path when they are not.
- **The suggested filename** derives from the scale name, and falls back.
- **Add note, Remove last note and Save as PNG still work from their new home** — the
  guard on the ID-preservation trick of §4.

### Harness additions (`test/helpers/harness.js`)

- `loadApp({ fileSystemAccess: … })` installs `showSaveFilePicker` / `showOpenFilePicker`
  stubs that record what was written and hand back a canned file. **Absent by default**,
  so most tests exercise the fallback — the path every browser reaches.
- `openScaleFile(h, text)` defines `files` on the hidden input and fires `change`.
- `savedScaleFile(h)` reads the JSON back out of the recorded anchor `href`.

Nothing new is stubbed for Save: the `data:` URL rides the existing
`HTMLAnchorElement.click` recorder.

### Existing tests

**The relocated buttons move no tests.** `settings.test.js:27`, `editor.test.js:19-22`,
`byzantine-pickers.test.js:1119-1161` and `harness.js:303-304` all reach them by ID.
`startup-reset.test.js` gains an assertion for `#scale-name`.

**The base note re-encoding does move tests**, and they change in the same commit with
the reason in the message, as `docs/TESTING.md` §2 requires:

- `defaults.test.js:99-113` — "A is 220 Hz" selects `"0"`, which is now C; A is `"9"`.
  The table `{2:"B", 3:"C", 5:"D", 7:"E", 8:"F", 10:"G"}` is re-encoded from C, and its
  expectation gains the `% 12` wrap. The *frequencies asserted do not change* — only the
  values that select them.
- `pitch.test.js:30` — `"3"` (C under the old encoding) becomes `"0"`, and the comment
  with it.
- `startup-reset.test.js:60` — asserts the default is `"0"`. Still `"0"`, but it now
  means C rather than A, so the assertion gains the note that says which.

New coverage for §5.1: every one of the twelve options resolves to the pitch it names,
the five accidentals included, and the default is C at 261.63 Hz.

---

## 9. Documentation to update

- **`docs/ARCHITECTURE.md`** — File Structure (two scripts, `icons/`), HTML Layout (the
  toolbar, the moved controls), Data Model, a new **File Persistence** section covering
  the format and the apply order, Event Flow, and the note that the icons bake `--ink`.
- **`CLAUDE.md`** — five scripts become seven, in the Files list, the Architecture
  section and the Conventions paragraph on load order. Plus the new `issues/NNN-slug/`
  convention.
- **`docs/TESTING.md`** — the layout tree, the harness helper table, the stub table.
- **`.claude/rules/testing.md`** — `persistence.js` and `persistence-ui.js` added to
  `paths:`, so the guide loads when either is read.

---

## 10. Out of scope

Named so the plan does not drift into them:

- Overwrite-in-place, a dirty flag, an unsaved-changes prompt. Save is Save-As.
- Recent files, autosave, `localStorage`, drag-and-drop to open.
- Rendering the scale name on the chart.
- Any `formatVersion` migration machinery. Version 1 is the only version; the check
  exists so version 2 has somewhere to stand.
