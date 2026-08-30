# Testing Guide

This project was built without tests. That is now the main risk to its
maintenance: the app is three classic scripts, over two thousand lines in all,
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
its own three scripts (`byzantine.js`, `byzantine-ui.js`, `app.js`). `jsdom` is
a **dev**-only dependency used by the test runner, and the test runner itself is
the one built into Node (`node --test`). Nothing under `node_modules/` is ever
shipped or referenced by the app.

Do not add further dependencies — not to the app, and not to the tests —
without a concrete reason that cannot be met by the standard library.

---

## 2. Test-driven development is mandatory

Every change to `app.js`, `byzantine.js`, `byzantine-ui.js`, `index.html` or
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
frontmatter lists `app.js`, `byzantine.js`, `byzantine-ui.js`, `index.html`, `style.css` and `test/**/*.js`, and it
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

### Out of scope

- **Pixels and appearance.** No screenshot comparison, no colour-contrast
  checks, no "does it look right".
- **CSS.** `style.css` is not under test. Class names are asserted only where
  the app's own logic depends on them (`.note-row`, `.interval-row`).
- **Markup shape.** Tests do not assert on generated HTML strings. They assert
  on values read back through the DOM API — an input's `value`, a swatch's
  `dataset.color`, a label's computed text.
- **Browser behaviour.** Real font metrics, real audio output, real downloads.
  Those are stubbed; see §5.

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
│   └── byzantine-symbols.test.js   the tables, the resolvers, the ladder
└── integration/         behaviour that spans the editor, the model and the chart
    ├── harness.test.js
    ├── editor.test.js
    ├── scale-data.test.js
    ├── cents-labels.test.js
    ├── settings.test.js
    ├── scale-mode.test.js
    ├── color-label-sync.test.js
    ├── render.test.js              chart geometry, Generic and Byzantine alike
    ├── notation.test.js            the Notation setting and the editor's switch;
    │                               symbol state, readScaleData, font loading
    └── byzantine-pickers.test.js   the fthora/martyria wells and their picker panels
```

Put a test where a maintainer would look for it: by the *feature* it covers,
not by the function name. A new feature that does not fit an existing file gets
a new file named after the feature.

---

## 5. How the harness works

The app's scripts (`byzantine.js`, `byzantine-ui.js`, `app.js`) are classic
scripts with no exports: they read elements at the top level and wire up
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

- **Any new top-level `function` or `const` in *any* of the app's scripts is
  testable automatically.** Nothing needs registering. Keep logic in named
  top-level functions rather than burying it in a listener callback, and it
  stays reachable from tests. Classic scripts share one global lexical
  environment, so a `const` in `byzantine.js` is visible to `app.js` and to
  the epilogue exactly as if it were declared in the same file — but it also
  means no top-level name may be declared in two of the scripts, or loading
  throws a `SyntaxError` before any test runs.
- The getters are live, so `h.app.displayZoom` reflects the current value, not
  a snapshot from load time.

### What is stubbed

| API | Stub | Why |
|---|---|---|
| `canvas.getContext("2d")` | `RecordingContext2D` | jsdom has no canvas. Records every draw call with the drawing state active at the time. |
| `ctx.measureText` | ink model: `length × fontSize × 0.6` advance, plus modelled bounding-box metrics | Deterministic stand-in for font metrics. Font-size sensitive, so the 24px UI font and 21px monospace font measure differently, as in a browser. Also models ink for Byzantine glyphs: zero-advance genus marks, and a mark-aware ascent/descent that grows for an `…Above` or `…Below` mark — see the ratio table in `canvas-stub.js` and `docs/BYZANTINE-SYMBOLS.md` §8. |
| `canvas.toDataURL` | records the call | Lets export tests check the exported size. |
| `AudioContext` | `FakeAudioContext` | Records oscillators, gains and every scheduled parameter change. |
| `HTMLAnchorElement.click` | records `{download, href}` | jsdom cannot navigate or download. |
| `window.devicePixelRatio` | `2` by default | `loadApp({ devicePixelRatio: 3 })` to vary it. |
| `document.fonts` | `load()` and `ready` both resolve immediately | jsdom implements no `FontFaceSet`, and `app.js` waits on one before its first real paint. `loadApp({ fonts: false })` removes `document.fonts` entirely, to exercise the codepath that guards against browsers (and jsdom's own default state) with no `FontFaceSet` at all; `loadApp({ fonts: "reject" })` makes the face fail to load, as a missing or corrupt font file would. |

Because `measureText` is a model rather than real metrics, a test that needs an
expected canvas size or ink box computes it with the exported
`measureTextWidth()` or `measureTextInk()` helper instead of hard-coding a
number.

### Harness helpers

| Helper | Purpose |
|---|---|
| `loadApp(options)` | Fresh window. One per test — never share. `notation: "byzantine"` presets `#notation` *before* the scripts run, the way a browser restores a `<select>` across a soft reload. |
| `buildRelativeScale(h, intervals, extra)` | Build a scale in relative mode; `extra` takes `names`, `labels`, `colors`. |
| `buildAbsoluteScale(h, absolutes, extra)` | Same for absolute mode. |
| `setNoteCount(h, n)` | Click add/remove until the editor holds `n` notes. |
| `typeInto(h, el, value)` | Set a value and dispatch `input`, like a user typing. |
| `selectOption(h, id, value)` | Change a `<select>` and dispatch `change`. |
| `pickColor(h, row, hex)` | Open a row's dropdown and click a swatch. |
| `noteRows(h)` / `intervalRows(h)` | The editor's rows, in order. |
| `setNotation(h, value)` | Switch `#notation` (`"generic"` or `"byzantine"`) and dispatch `change`. |
| `openWell(h, row, kind)` | Click a note row's `"fthora"` or `"martyria"` well; returns its picker panel. |
| `pickFthora(h, row, fthoraId)` | Open the fthora picker and click one option (`""` picks None). |
| `pickMartyria(h, row, { note, genus, ticks, done })` | Open the martyria picker and click a note and/or genus option, then dismiss the panel: `done: true` presses Done, otherwise it re-clicks the well. Either way the ladder propagates — `done` picks which gesture is exercised. |

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

1. Read `docs/PLAN-01.md` — it is the source of truth for intended behaviour —
   and update it if the feature changes the design.
2. Decide where the behaviour is observable: a pure function, the editor's DOM
   model, or the chart's geometry. That tells you which test file to open.
3. **Write the failing test.** Run it. Watch it fail for the right reason.
4. Implement the minimum that makes it pass, as a **named top-level function**
   in whichever of the three scripts it belongs to (top-level functions are
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
