# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-side web app for plotting microtonal music scales (Byzantine/psaltic, Ottoman makam, Western JI). Zero dependencies, no build step, no framework. Open `index.html` directly in a browser to run.

## Files

- `index.html` — page skeleton; loads `style.css`, then `byzantine.js`, `smufl.js`, `symbols-ui.js`, `byzantine-ui.js`, `app.js` (all deferred, in that order).
- `byzantine.js` — Byzantine symbol model: the note/genus/fthora/alteration tables, the two compatibility tables, the SBMuFL resolvers, the note ladder, and the shared, font-agnostic ink-measuring primitives (`inkBox`, `inkCenteringShift(Em)`, `drawGlyphs`, `domGlyphText`, `scanInkBox`, `freezeTable`) that `smufl.js` and `symbols-ui.js` also use. No DOM.
- `smufl.js` — the SMuFL accidental catalogue (28 categories, 501 entries) and its resolvers (`smuflAccidentalById`, `resolveAccidentalGlyphs`). No DOM.
- `symbols-ui.js` — the well and picker machinery shared by both notations: the `SYMBOL_WELLS` registry, the grouped-list picker builder, and search. Built on `byzantine.js` and `smufl.js`.
- `byzantine-ui.js` — only what is Byzantine: the alteration, fthora and martyria picker builders, the martyria draft, and the ladder applied to the editor. Built on `symbols-ui.js`.
- `app.js` — everything else: editor DOM management, interval parsing, canvas rendering, Web Audio playback, PNG export, color picker. Runs at load time, so it loads last.
- `style.css` — all styling.
- `fonts/` — vendored Neanes and Bravura Text SBMuFL/SMuFL fonts (see `README.md`'s NOTICE for licensing).
- `docs/ARCHITECTURE.md` — the architecture (source of truth for intended behavior).
- `docs/BYZANTINE-SYMBOLS.md` — maintainer's map of the Byzantine notation layer: the tables, the two compatibility tables and their different provenance, the ladder, and what a second font would touch.
- `docs/SMUFL-ACCIDENTALS.md` — maintainer's map of the Generic notation's accidental layer: the catalogue's shape and its generator, the 28 categories, and where the family name is written.
- `docs/TESTING.md` — testing guide and the mandatory TDD workflow (**read before changing any behavior**).
- `test/` — Node test-runner suite (`test/unit`, `test/integration`, `test/helpers`).
- `.claude/rules/testing.md` — path-scoped rule; when a source or test file is read it loads and `@`-imports `docs/TESTING.md` into context.

## Architecture

The DOM **is** the data model. `readScaleData()` walks `#editor` children (alternating `.note-row` and `.interval-row`) and produces the scale representation used by `render()`. Any change to the editor triggers re-render via delegated `input`/`change` listeners on `#editor`.

Key concepts:

- **Interval types** (`#interval-type`): `ratio` (e.g. `9/8`), `edo` (step count against `#edo-divisions`), or `cents`. `intervalToCents()` / `intervalToRatio()` / `intervalToDisplayString()` dispatch on the current type. Switching type calls `resetScaleToDefault()` — intervals are not cross-converted.
- **Rendering**: `render()` draws vertically stacked rectangles on a `<canvas>`, heights proportional to cents (`PX_PER_CENT`). Canvas uses `devicePixelRatio` scaling; `displayZoom` only affects CSS display size, not the backing store used for PNG export.
- **Audio**: single shared `AudioContext`, single active oscillator. `getFrequencyForDegree()` multiplies ratios cumulatively from the base note (A=220Hz × 2^(semitones/12)).
- **Color sync** (`syncIntervalColors`): intervals with matching parsed values share a color — editing one interval's value or color propagates to all others with the same value. The palette dropdown is built per-row from `PALETTE`.
- **Startup** (`initUI`): the page has no persistence, so every load resets the settings to their markup defaults and rebuilds the default two-note scale. A browser restores form-control state across a soft reload while `#editor`'s structure comes back as the markup's, which is what put the controls and the DOM-as-data-model out of step. `initUI()` runs at load time *and* on `pageshow`, because Firefox restores before the scripts run and Chromium after `load`.
- **Notation** (`#notation`, `generic` or `byzantine`): switching notation never rebuilds the editor — every note row always carries a name input, an accidental well, and the three Byzantine wells (alteration, fthora, martyria); CSS decides which half shows. In Generic, an accidental is drawn in the chart's sign gutter, the same place a fthora is drawn in Byzantine. See `docs/BYZANTINE-SYMBOLS.md` for the symbol model, the two compatibility tables, the note ladder, and what adding a second font would touch, and `docs/SMUFL-ACCIDENTALS.md` for the accidental catalogue.

## Testing — mandatory TDD

**Every behavioral change follows red/green/refactor. Write the failing test first, watch it fail, then implement.** `docs/TESTING.md` is the full guide; the rules that matter most:

- `npm install` once, then `npm test`. The suite is `node --test` + jsdom, runs in seconds, no browser needed.
- Never write production code that no failing test demanded. Never commit implementation without its tests.
- Bug fixes start with a test that reproduces the bug — it must fail before the fix.
- Run the **whole** suite before committing, not just the file you touched. A test you did not intend to touch going red means you broke something or deliberately changed documented behavior; in the latter case update that test in the same commit and say so in the message.
- Never delete, skip or loosen a test to get green.
- Unit and integration tests only. No end-to-end/UI tests, no pixel or CSS assertions. Chart tests assert the *geometry* passed to the canvas context (sizes, coordinates, draw order), never the resulting image.
- Driving the real page with Playwright to eyeball a change is encouraged, but it is manual verification — it does not replace a test and browser-driving scripts are not committed.
- Keep testable logic in **named top-level functions**, in whichever of the five scripts it belongs to. The harness auto-exports every top-level `function`/`const` from all five scripts to tests; logic buried inside an event-listener callback is unreachable from them.
- `docs/TESTING.md` is not loaded into context automatically. `.claude/rules/testing.md` is path-scoped to `app.js`, `byzantine.js`, `smufl.js`, `symbols-ui.js`, `byzantine-ui.js`, `index.html`, `style.css` and `test/**/*.js`, so reading any of them loads the rule and `@`-imports the guide along with it.

## Conventions

- No external libs **in the app**. `index.html` still loads nothing but `style.css` and its five own scripts, with no build step. `jsdom` is a dev-only dependency of the test suite; don't add more, and don't add anything to the app itself.
- The app is `index.html`, `style.css` and five classic scripts loaded in this
  order: `byzantine.js` (symbol model + shared measuring primitives, no DOM),
  `smufl.js` (SMuFL accidental catalogue and resolvers, no DOM), `symbols-ui.js`
  (wells and pickers shared by both notations), `byzantine-ui.js` (only what is
  Byzantine), `app.js` (everything else; it runs at load time, so it goes
  last). **Never convert these to ES modules**: a `<script type="module">`
  is fetched under CORS and a `file://` page has an opaque origin, so modules
  break "open `index.html` in a browser". Classic scripts share one global
  scope, which also means no top-level name may be declared in two of them —
  that is a load-time SyntaxError.
- `docs/ARCHITECTURE.md` describes the intended design — consult it before non-trivial changes.
- **Commit messages**: always prefix with the GitHub issue number in brackets to annotate which
  issue the work belongs to, e.g. `[#2] Add Byzantine font research`. Use this prefix for every
  commit that relates to an issue.
