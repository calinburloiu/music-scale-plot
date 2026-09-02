# Testing Guide

This project was built without tests. That is now the main risk to its
maintenance: the app is seven classic scripts, over five thousand lines in all,
whose behaviour lives in DOM side effects, and nothing catches a regression
except a human clicking around. This document defines how the project is tested
and how new work must be done.

**The rule, in one line: no production code is written before a failing test
demands it.** The rest of this document explains what that means here.

---

## 1. Running the tests

```bash
npm install        # once — installs the only dev dependency (jsdom)
npm test           # run the whole suite
npm run test:watch # re-run on change while developing
npm run test:coverage
```

A single file, or a single test by name:

```bash
node --test test/unit/ratio-math.test.js
node --test --test-name-pattern "cumulative" "test/**/*.test.js"
```

The suite runs in a few seconds and needs no browser, no server and no build
step.

### The dependency question

`CLAUDE.md` says the app has no dependencies and no build step. That still
holds: `index.html` opens in a browser and loads nothing but `style.css` and
its own seven scripts (`byzantine.js`, `smufl.js`, `persistence.js`,
`symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `app.js`). `jsdom` is
a **dev**-only dependency used by the
test runner, and the test runner itself is the one built into Node
(`node --test`). Nothing under `node_modules/` is ever shipped or referenced
by the app.

Do not add further dependencies — not to the app, and not to the tests —
without a concrete reason that cannot be met by the standard library.

---

## 2. Test-driven development is mandatory

Every change to `app.js`, `byzantine.js`, `smufl.js`, `persistence.js`,
`symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `index.html` or
`style.css` that affects behaviour follows the red/green/refactor loop. No
exceptions for "small" changes; small changes are where regressions hide.

### RED — write a failing test first

Write the smallest test that expresses the behaviour you want, in the file
where that behaviour belongs (see §4). Then **run it and watch it fail**.

```bash
node --test test/unit/interval-conversion.test.js
```

A test you never saw fail is not a test — it is a comment that costs CPU time.
If it passes immediately, either the behaviour already exists (so there is
nothing to build) or the test does not actually exercise it. Find out which
before continuing.

The failure message must be informative. If it reads `expected true to be
false`, rewrite the assertion so the message names the actual and expected
values.

### GREEN — write the least code that passes

Implement the simplest thing that turns the test green. Do not add
configuration, generality or extra branches that no test asks for. Then run the
**whole** suite, not just your file:

```bash
npm test
```

If a test you did not intend to touch goes red, that is the safety net working.
Either you broke something (fix the code) or you deliberately changed a
documented behaviour (change that test in the same commit and say so in the
message).

### REFACTOR — clean up under a green suite

With everything passing, tidy the implementation: extract a helper, rename for
clarity, remove duplication. Re-run `npm test` after each step. Refactoring
never changes behaviour, so it never changes an assertion. If a refactor forces
you to edit a test's expectations, it was not a refactor.

### Commit discipline

- One behavioural change per commit, with its tests.
- Test and implementation land **together**. A commit that adds production code
  with no test is not acceptable; a PR that adds a feature "and tests later"
  is not acceptable.
- Bug fixes start with a test that reproduces the bug. The reproduction must
  fail before the fix and pass after it — that test is the proof the bug is
  gone and the guard against its return.

### How this is enforced

`docs/TESTING.md` is not loaded into a Claude Code session automatically —
CLAUDE.md only points at it, and a pointer is only as good as the reader's
willingness to follow it.

`.claude/rules/testing.md` closes that gap. It is a
[path-scoped rule](https://code.claude.com/docs/en/memory): its `paths:`
frontmatter lists `app.js`, `byzantine.js`, `smufl.js`, `persistence.js`,
`symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `index.html`,
`style.css` and `test/**/*.js`, and it
`@`-imports this guide. The moment Claude reads any guarded file, the rule loads
and pulls this document into context with it — no separate step that could be
skipped. Rules without `paths:` load every session; this one costs nothing until
someone actually touches the code it guards.

The import is written `@../../docs/TESTING.md`, not `@docs/TESTING.md`: relative
imports resolve against the file that contains them, and the rule lives in
`.claude/rules/`. A bad import path fails silently, which is why the rule also
tells the reader to open the guide manually if it did not resolve.

To widen the guard, add a glob to the `paths:` list. To require a different
document, add another import. Verify a rule is loading with `/context`, which
lists the memory files in the session.

None of this is a hard gate — rules are context, not enforcement. The hard gate
is CI: `npm test` runs on every PR.

### PR checklist

- [ ] Every new behaviour has a test that failed before the implementation.
- [ ] Every fixed bug has a regression test that reproduces it.
- [ ] `npm test` passes locally and in CI.
- [ ] Deliberate behaviour changes update the affected tests, and the commit
      message says what changed and why.
- [ ] No test was deleted, skipped or loosened to make the suite pass.

---

## 3. What is tested, and what is not

The suite is **unit and integration tests only**. There are no end-to-end or
UI tests, and there will not be any.

### In scope

| Area | Example |
|---|---|
| Pure logic | ratio arithmetic, cents conversion, mode conversion |
| The DOM-as-data-model | `readScaleData()`, row add/remove, degree numbering |
| Derived values shown to the user | cents labels, cumulative cents, EDO division size |
| Cross-cutting rules | colour/label synchronisation, palette remapping |
| Chart **geometry** | box heights proportional to cents, stacking order, canvas size, DPR scaling |
| Audio parameters | oscillator type and frequency, envelope ramps |
| Export | filename and that the full-resolution bitmap is exported |
| **The order of a row's controls** | the wells on a note row, the swatch and label on an interval row — see below |

### Out of scope

- **Pixels and appearance.** No screenshot comparison, no colour-contrast
  checks, no "does it look right".
- **CSS.** `style.css` is not under test. Class names are asserted only where
  the app's own logic depends on them (`.note-row`, `.interval-row`).
- **Markup shape.** Tests do not assert on generated HTML strings. They assert
  on values read back through the DOM API — an input's `value`, a swatch's
  `dataset.color`, a label's computed text. The order of a row's controls is
  the one exception, for the reason below.
- **Browser behaviour.** Real font metrics, real audio output, real downloads.
  Those are stubbed; see §5.

### Why a row's control order is the exception

It is the only place where tests compare a list of class names, so it needs
saying why it is not the markup-shape assertion it looks like.

**The note row's order is load-bearing.** `SYMBOL_WELLS` is the single source of
truth for two things at once: `makeSymbolWellsHTML()` emits the wells onto a row
in that order, and `signRunOf()` reads the same table for the order the chart
draws the gutter run. The row and the chart are therefore two ends of one
invariant, and a test that pins the row's order pins the contract the chart
depends on. That is app logic, not appearance.

**The interval row's order is the editor's half of the same contract.** The
swatch sits before the label so that it lands under the leftmost well of the
note row above it, and the two rows' clusters are built to the same total width.
Only the *DOM order* is asserted; whether the columns actually line up on screen
is CSS, stays out of scope, and is checked by eye (§3, Manual verification).

Both are asserted through the DOM API on elements the app builds — never on an
HTML string — and nowhere else does a test care what order children come in.

### Why chart geometry counts as functionality

`render()` computes numbers: this interval is 203.91 cents, so its box is
203.91 pixels tall and sits directly on top of the previous one. Those numbers
are the app's core output and they are exactly what silently breaks. The tests
assert on the **arguments passed to the canvas context** — sizes, coordinates,
draw order, which colour was active — never on the resulting image. That is
testing the computation, not the picture.

### Manual verification

Driving the real page in a browser (Playwright is a good way to do it) is
encouraged when you want to see a change work, especially for layout and
styling. Do it freely — but it is *verification*, not *testing*: it does not
count towards the TDD loop and browser-driving scripts are not committed to
this repository.

---

## 4. Layout

```
.claude/
└── rules/
    └── testing.md       path-scoped rule; imports this guide when a guarded file is read

test/
├── helpers/
│   ├── harness.js       loads index.html's scripts into jsdom; interaction helpers
│   ├── canvas-stub.js   recording 2D context + the text/ink-measurement model
│   ├── audio-stub.js    recording Web Audio stubs
│   └── assertions.js    closeTo, isNaNValue, equalArray
├── unit/                logic that can be checked without driving the editor
│   ├── ratio-math.test.js
│   ├── interval-conversion.test.js
│   ├── defaults.test.js
│   ├── mode-conversion.test.js
│   ├── pitch.test.js
│   ├── palette.test.js
│   ├── png-metadata.test.js        the print chunks the exported PNG carries
│   ├── byzantine-symbols.test.js   the tables, the resolvers, the ladder
│   ├── smufl-accidentals.test.js   the 28-category catalogue and its resolvers
│   ├── symbol-search.test.js       normalizeForSearch, matchesQuery
│   └── scale-file-format.test.js   the .musp.json format: serialize/parse/
│                                    validate, with no page — enum maps, default
│                                    omission, cardinality, every validation rule
└── integration/         behaviour that spans the editor, the model and the chart
    ├── harness.test.js
    ├── editor.test.js
    ├── scale-data.test.js
    ├── cents-labels.test.js
    ├── settings.test.js
    ├── scale-mode.test.js
    ├── color-label-sync.test.js
    ├── render.test.js              chart geometry, Generic and Byzantine alike
    ├── startup-reset.test.js       the reset to defaults after a browser
    │                               restored the form state
    ├── notation.test.js            the Notation setting and the editor's switch;
    │                               symbol state, readScaleData, font loading
    ├── byzantine-pickers.test.js   the alteration, fthora and martyria wells and
    │                               their picker panels
    ├── accidental-picker.test.js   the accidental well and its picker, including
    │                               search
    ├── toolbar.test.js             the toolbar itself: New/Open/Save wiring, the
    │                               Save menu, the message bar, the keyboard
    │                               shortcuts, and that the relocated buttons
    │                               (Add note, Remove last note, Save as PNG)
    │                               still work from their new home
    └── file-persistence.test.js    round trips through the real editor —
                                     both notations' hidden state, both I/O
                                     branches, a bad file, a cancelled picker
```

Put a test where a maintainer would look for it: by the *feature* it covers,
not by the function name. A new feature that does not fit an existing file gets
a new file named after the feature.

---

## 5. How the harness works

The app's scripts (`byzantine.js`, `smufl.js`, `persistence.js`, `symbols-ui.js`,
`byzantine-ui.js`, `persistence-ui.js`, `app.js`) are classic scripts with no exports: they read elements at the top level and wire up
listeners as a side effect of loading. Rather than restructure the app to
suit the tests, `test/helpers/harness.js` loads it the way a browser does.

```js
const { loadApp, buildRelativeScale, intervalRows } = require("../helpers/harness.js");

const h = loadApp();                       // fresh window, real index.html, every script executed
buildRelativeScale(h, ["9/8", "10/9"]);    // drive the editor through real events
h.app.readScaleData();                     // call any top-level function from any of the scripts
h.ctx.callsOf("fillRect");                 // inspect what was drawn
```

What `loadApp()` does:

1. Parses the real `index.html` in jsdom, with `runScripts: "outside-only"` so
   none of its `<script src="...">` tags are fetched.
2. Installs stubs for the browser APIs jsdom lacks (below).
3. Reads the `<script src>` tags out of `index.html`, in document order, and
   runs each file's source in the window's VM context under its own real
   filename (so stack traces and coverage point at the right file) — then
   runs one generated epilogue built from the union of every script's
   top-level names.

The epilogue re-exports every **top-level** declaration, from every script,
as a live getter on `window.__app`, which the harness returns as `h.app`:

```js
window.__app = { get intervalToCents() { return intervalToCents; }, /* … */ };
```

Two consequences worth knowing:

- **Any new top-level `function`, `async function` or `const` in *any* of the
  app's scripts is testable automatically.** Nothing needs registering. Keep
  logic in named top-level functions rather than burying it in a listener
  callback, and it stays reachable from tests — `persistence-ui.js`'s
  `async function saveScaleFile` and `async function openScaleFile` are
  exported the same way their synchronous neighbours are. Classic scripts
  share one global lexical environment, so a `const` in `byzantine.js` is
  visible to `app.js` and to the epilogue exactly as if it were declared in
  the same file — but it also means no top-level name may be declared in two
  of the scripts, or loading throws a `SyntaxError` before any test runs.
- The getters are live, so `h.app.displayZoom` reflects the current value, not
  a snapshot from load time.

### What is stubbed

| API | Stub | Why |
|---|---|---|
| `canvas.getContext("2d")` | `RecordingContext2D`, one per canvas | jsdom has no canvas. Records every draw call with the drawing state active at the time. The chart's is the one `h.ctx` exposes; a canvas the app makes to measure on gets its own, so its drawing stays out of the chart's record. |
| `ctx.measureText` | ink model: `length × fontSize × 0.6` advance, plus modelled bounding-box and font metrics, reported **from the anchor `textAlign`/`textBaseline` choose** | Deterministic stand-in for font metrics. Font-size sensitive, so the 24px UI font and 21px monospace font measure differently, as in a browser. Also models ink for Byzantine glyphs: zero-advance genus marks and signs of alteration, a mark-aware ascent/descent that grows for an `…Above` or `…Below` mark, a fthora and every sign of alteration with ink sitting *entirely above* the baseline (a negative descent), the two geniki drawn a whole em higher than the numbered signs, an asymmetric `fontBoundingBox…` strut, and the three octave blocks of note letters drawn at three different heights — the only thing that tells a low letter from its middle-octave twin. Bravura Text's SMuFL accidentals (`U+E260`–`U+EE6F`) get their own block: unlike Neanes' zero-advance signs of alteration they carry a **real advance**, and their ink sits *entirely above* the baseline like a fthora's — modelled on the research's measured `+0.680em … +0.122em`. `U+0020` is additionally cut as Bravura Text's own ½ staff space (a 0.1em advance, no ink) *for that face only*, so a composed Sagittal Evo pair measures wider than its two glyphs alone by exactly the gap. Like a real canvas it moves the bounding box with `textAlign` and `textBaseline`, so measuring without pinning them is a bug a test can catch — see the ratio table in `canvas-stub.js` and `docs/BYZANTINE-SYMBOLS.md` §10. |
| `ctx.getImageData` | a bitmap synthesised from the same ink model, honouring `clearRect` | The app finds a sign's ink in the pixels on engines whose `measureText` will not report it (`docs/BYZANTINE-SYMBOLS.md` §8b). There is no rasteriser here, so the ink model paints its own boxes opaque — no anti-aliased fringe, so a test can assert exactly. |
| `canvas.toDataURL` | records the call and returns a real minimal PNG (`pngFixture`) | Lets export tests check the exported size, and gives `savePNG()` genuine bytes to splice its `pHYs`/`sRGB` chunks into. `pngChunkTypes`/`pngChunkData`/`bytesFromDataUrl` read them back. The fixture computes its own CRCs so a bug in the app's `crc32` cannot hide behind the same bug in the stub. |
| `AudioContext` | `FakeAudioContext` | Records oscillators, gains and every scheduled parameter change. |
| `HTMLAnchorElement.click` | records `{download, href}` | jsdom cannot navigate or download. |
| `window.devicePixelRatio` | `2` by default | `loadApp({ devicePixelRatio: 3 })` to vary it. |
| `document.fonts` | `load()` and `ready` both resolve immediately | jsdom implements no `FontFaceSet`, and `app.js` waits on one before its first real paint. `loadApp({ fonts: false })` removes `document.fonts` entirely, to exercise the codepath that guards against browsers (and jsdom's own default state) with no `FontFaceSet` at all; `loadApp({ fonts: "reject" })` makes every face fail to load, as a missing or corrupt font file would; `loadApp({ fonts: { reject: ["Bravura Text"] } })` fails only the faces named, because one file can go missing without the other; `loadApp({ fonts: "ready-reject" })` lets the faces load but never lets the set become ready, which is the plainest way to the tail of the chain. |
| `window.showSaveFilePicker` / `showOpenFilePicker` | **absent by default** | Neither exists on the harness's `window` unless a test opts in with `loadApp({ fileSystemAccess: … })`. That is deliberate: Firefox, Safari and every `file://` page reach neither, so leaving them undefined by default means most tests exercise the fallback (`<a download>` for Save, the hidden file input for Open) — the path every browser reaches. Opting in installs stubs that record every picker call and either resolve with a canned handle/file or reject with an `AbortError` (a cancelled dialog) or a plain `Error` (a real failure), per the options `loadApp` documents. |

Because `measureText` is a model rather than real metrics, a test that needs an
expected canvas size or ink box computes it with the exported
`measureTextWidth()` or `measureTextInk()` helper instead of hard-coding a
number.

### Harness helpers

| Helper | Purpose |
|---|---|
| `loadApp(options)` | Fresh window. One per test — never share. `restored: { "#scale-mode": "absolute" }` writes values into the matching controls *before* the scripts run, the way Firefox restores form state across a soft reload. `inkMetrics: "union"` reports every ink box unioned with the text's advance rect and its baseline, the way WebKit does — the engine difference behind `scanInkBox`. `fileSystemAccess: true` (or an options object) installs the `showSaveFilePicker`/`showOpenFilePicker` stubs described above; pass `{ text }` for what Open hands back, `{ saveAborts }`/`{ openAborts }` for a cancelled dialog, `{ saveFails }`/`{ openFails }` for a real failure. |
| `restoreFormState(h, values)` | The other restore order: writes the values *after* load and fires `pageshow`, the way Chromium restores form state. |
| `buildRelativeScale(h, intervals, extra)` | Build a scale in relative mode; `extra` takes `names`, `labels`, `colors`. |
| `buildAbsoluteScale(h, absolutes, extra)` | Same for absolute mode. |
| `setNoteCount(h, n)` | Click add/remove until the editor holds `n` notes. |
| `typeInto(h, el, value)` | Set a value and dispatch `input`, like a user typing. |
| `selectOption(h, id, value)` | Change a `<select>` and dispatch `change`. |
| `pickColor(h, row, hex)` | Open a row's dropdown and click a swatch. |
| `noteRows(h)` / `intervalRows(h)` | The editor's rows, in order. |
| `setNotation(h, value)` | Switch `#notation` (`"generic"` or `"byzantine"`) and dispatch `change`. |
| `openWell(h, row, kind)` | Click a note row's `"accidental"`, `"alteration"`, `"fthora"` or `"martyria"` well; returns its picker panel. |
| `pickAccidental(h, row, accidentalId)` | Open the accidental picker and click one option (`""` picks None), which commits and closes it. |
| `pickAlteration(h, row, alterationId)` | Open the alteration picker and click one option (`""` picks None), which commits and closes it. |
| `pickFthora(h, row, fthoraId)` | Open the fthora picker and click one option (`""` picks None), which commits and closes it. |
| `pickMartyria(h, row, { note, genus, ticks, dismiss })` | Open the martyria picker, click a letter, then click a genus — the click that commits and propagates the ladder. `genus` defaults to None rather than being skipped, because a letter alone never reaches the row; `note: ""` clears the well and returns. `dismiss` stops after the letter and leaves by that gesture instead. |
| `searchPicker(h, row, kind, query)` | Open `kind`'s picker and type `query` into its `.sym-search` field, the way a user does; returns the panel so a test can count what survived. |
| `dismissPicker(h, row, how, kind)` | Leave a picker without picking: `"outside"` and `"well"` are the two gestures that discard, `"none"` leaves the panel open to inspect. There is no `"apply"` and no `"cancel"` — clicking a row *is* the commit, so the only way not to commit is not to click one. |
| `pickScaleFile(h, text, fileName)` | Hands the hidden `#open-file-input` a file (`text`, defaulting `fileName` to `"scale.musp.json"`) and fires `change`, the way the fallback Open dialog does; returns a promise to `await` since the handler reads the file asynchronously. Pass an `Error` as `text` to make the file's own `.text()` reject, as a real read failure would. (Named `pickScaleFile`, not `openScaleFile`, to avoid colliding with `persistence-ui.js`'s own `openScaleFile` function.) |
| `savedScaleFile(h)` | The scale document the app last handed to `<a download>`, decoded back out of the `data:` URL — `{ name, text }`. Reads the same recorded anchor click `downloads` already exposes, so no separate stub was needed for Save's fallback path. |

Everything goes through real DOM events. Do not call the app's internal
functions to *set up* state when a helper can drive the UI — a test that
bypasses the event listeners does not prove the app works.

### Cross-realm gotcha

Values created inside the jsdom window carry that window's prototypes, so
`assert.deepEqual` from `node:assert/strict` rejects them with "same structure
but not reference-equal". Use `equalArray()` from `test/helpers/assertions.js`,
or copy first with `Array.from(...)`.

---

## 6. Writing a test

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, buildRelativeScale, noteRows } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

test("cumulative cents on note rows", async (t) => {
  await t.test("accumulate the intervals below each note", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9"]);

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".cumulative-cents").textContent),
      ["0.00￠", "203.91￠", "386.31￠"]
    );
  });
});
```

Conventions:

- **One behaviour per test.** The name is a sentence about behaviour
  ("skips an unparseable interval"), not about implementation
  ("calls readScaleData twice").
- **Fresh harness per test**, closed with `t.after(() => h.close())`. Tests
  must not depend on order.
- **Compare floats with `closeTo`**, never `assert.equal`. Cents are
  irrational numbers.
- **Assert the value, not the mechanism.** Check that the box is 203.91px
  tall, not that some internal function was called.
- **Add a message to non-obvious assertions.** The message is what a
  maintainer reads at 2am when CI is red.
- Cover the boundaries: empty input, unparseable input, the smallest legal
  scale (two notes), a descending interval, a zero-width interval.

---

## 7. Adding a feature to this app

1. Read `docs/ARCHITECTURE.md` — it is the source of truth for intended behaviour —
   and update it if the feature changes the design.
2. Decide where the behaviour is observable: a pure function, the editor's DOM
   model, or the chart's geometry. That tells you which test file to open.
3. **Write the failing test.** Run it. Watch it fail for the right reason.
4. Implement the minimum that makes it pass, as a **named top-level function**
   in whichever of the seven scripts it belongs to (top-level functions are
   auto-exported to tests; logic buried inside an event listener is not).
5. Run `npm test`. Fix anything you broke.
6. Refactor under a green suite.
7. Optionally drive the page in a real browser to sanity-check the look.

---

## 8. Known limitations

- **The "label without an interval value" branches in `render()` are
  unreachable** through the UI: whenever an interval's cents parse, its display
  string is non-empty. They are defensive code and are the only uncovered lines
  in `app.js`. Leave them, or remove them under a test — do not add a test that
  fakes an unreachable state to chase a coverage number.
- **Text measurement is modelled, not real.** Layout maths is verified against
  the model; the absolute pixel width of a chart in a real browser is not.
- **`style.css` is untested** by design.
- **Coverage percentages are a signal, not a target.** A green suite with
  meaningful assertions beats 100% coverage of lines nobody asserted anything
  about.
