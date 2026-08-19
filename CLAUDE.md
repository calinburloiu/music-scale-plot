# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-side web app for plotting microtonal music scales (Byzantine/psaltic, Ottoman makam, Western JI). Zero dependencies, no build step, no framework. Open `index.html` directly in a browser to run.

## Files

- `index.html` — page skeleton; loads `style.css` and `app.js` (deferred).
- `app.js` — all logic: editor DOM management, interval parsing, canvas rendering, Web Audio playback, PNG export, color picker.
- `style.css` — all styling.
- `docs/PLAN-01.md` — architecture / design plan (source of truth for intended behavior).
- `docs/TESTING.md` — testing guide and the mandatory TDD workflow (**read before changing any behavior**).
- `test/` — Node test-runner suite (`test/unit`, `test/integration`, `test/helpers`).
- `.claude/rules/testing.md` — path-scoped rule; loads automatically when a source or test file is read and requires `docs/TESTING.md` to be read before editing.

## Architecture

The DOM **is** the data model. `readScaleData()` walks `#editor` children (alternating `.note-row` and `.interval-row`) and produces the scale representation used by `render()`. Any change to the editor triggers re-render via delegated `input`/`change` listeners on `#editor`.

Key concepts:

- **Interval types** (`#interval-type`): `ratio` (e.g. `9/8`), `edo` (step count against `#edo-divisions`), or `cents`. `intervalToCents()` / `intervalToRatio()` / `intervalToDisplayString()` dispatch on the current type. Switching type calls `resetScaleToDefault()` — intervals are not cross-converted.
- **Rendering**: `render()` draws vertically stacked rectangles on a `<canvas>`, heights proportional to cents (`PX_PER_CENT`). Canvas uses `devicePixelRatio` scaling; `displayZoom` only affects CSS display size, not the backing store used for PNG export.
- **Audio**: single shared `AudioContext`, single active oscillator. `getFrequencyForDegree()` multiplies ratios cumulatively from the base note (A=220Hz × 2^(semitones/12)).
- **Color sync** (`syncIntervalColors`): intervals with matching parsed values share a color — editing one interval's value or color propagates to all others with the same value. The palette dropdown is built per-row from `PALETTE`.

## Testing — mandatory TDD

**Every behavioral change follows red/green/refactor. Write the failing test first, watch it fail, then implement.** `docs/TESTING.md` is the full guide; the rules that matter most:

- `npm install` once, then `npm test`. The suite is `node --test` + jsdom, runs in seconds, no browser needed.
- Never write production code that no failing test demanded. Never commit implementation without its tests.
- Bug fixes start with a test that reproduces the bug — it must fail before the fix.
- Run the **whole** suite before committing, not just the file you touched. A test you did not intend to touch going red means you broke something or deliberately changed documented behavior; in the latter case update that test in the same commit and say so in the message.
- Never delete, skip or loosen a test to get green.
- Unit and integration tests only. No end-to-end/UI tests, no pixel or CSS assertions. Chart tests assert the *geometry* passed to the canvas context (sizes, coordinates, draw order), never the resulting image.
- Driving the real page with Playwright to eyeball a change is encouraged, but it is manual verification — it does not replace a test and browser-driving scripts are not committed.
- Keep testable logic in **named top-level functions** in `app.js`. The harness auto-exports every top-level `function`/`const` to tests; logic buried inside an event-listener callback is unreachable from them.
- `docs/TESTING.md` is not loaded into context automatically. `.claude/rules/testing.md` is path-scoped to `app.js`, `index.html`, `style.css` and `test/**/*.js`, so reading any of them loads the rule telling you to go read the guide.

## Conventions

- No external libs **in the app**. `index.html` still loads nothing but `style.css` and `app.js`, with no build step. `jsdom` is a dev-only dependency of the test suite; don't add more, and don't add anything to the app itself.
- Keep HTML/CSS/JS in the three root files; don't split into modules.
- `docs/PLAN-01.md` describes the intended design — consult it before non-trivial changes.
