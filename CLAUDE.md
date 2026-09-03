# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-side web app for plotting microtonal music scales (Byzantine/psaltic, Ottoman makam, Western JI). Zero dependencies, no build step, no framework. Open `index.html` directly in a browser to run.

## Files

- `index.html` — page skeleton; loads `style.css`, then `byzantine.js`, `smufl.js`, `persistence.js`, `audio.js`, `symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `audio-ui.js`, `app.js` (all deferred, in that order).
- `byzantine.js` — Byzantine symbol model: the note/genus/fthora/alteration tables, the two compatibility tables, the SBMuFL resolvers, the note ladder, and the shared, font-agnostic ink-measuring primitives (`inkBox`, `inkCenteringShift(Em)`, `drawGlyphs`, `domGlyphText`, `scanInkBox`, `freezeTable`) that `smufl.js` and `symbols-ui.js` also use. No DOM.
- `smufl.js` — the SMuFL accidental catalogue (28 categories, 501 entries) and its resolvers (`smuflAccidentalById`, `resolveAccidentalGlyphs`). No DOM.
- `persistence.js` — the `.musp.json` format, version 1: the enum maps, `serializeScaleDocument`, `suggestedFileName`, `parseScaleDocument`, `validateScaleDocument`. No DOM.
- `audio.js` — the audio model, no DOM: the tempo and envelope constants, the WAV file extension, `scaleFrequencies`, `scalePlaybackPlan`, `scheduleScale` (shared by live playback and the offline export) and `encodeWavMono16`.
- `symbols-ui.js` — the well and picker machinery shared by both notations: the `SYMBOL_WELLS` registry, the grouped-list picker builder, and search. Built on `byzantine.js` and `smufl.js`.
- `byzantine-ui.js` — only what is Byzantine: the alteration, fthora and martyria picker builders, the martyria draft, and the ladder applied to the editor. Built on `symbols-ui.js`.
- `persistence-ui.js` — the DOM half of file persistence: the toolbar's handles, the Save menu, the message bar, `collectDocumentState`/`applyDocumentState`, New/Open/Save, the file keyboard shortcuts, and `downloadBlob` — the one `<a download>` every save in the app goes through. Built on `persistence.js`.
- `audio-ui.js` — the DOM half of audio: the Play/Stop transport and its button state, the sounding-note highlight, the WAV export flow, the per-note press-and-hold playback that used to live in `app.js`, and the keyboard shortcuts that reach both (Space, and `1`…`9`).
- `app.js` — everything else: editor DOM management, interval parsing, canvas rendering, PNG export, color picker. Runs at load time, so it loads last.
- `style.css` — all styling.
- `fonts/` — vendored Neanes and Bravura Text SBMuFL/SMuFL fonts (see `README.md`'s NOTICE for licensing).
- `icons/` — seven toolbar SVG icons (new, open, save, add-note, remove-note, play, stop) with `--ink` (`#1a1814`) baked in, since an `<img>`-loaded SVG renders in a document no page CSS reaches.
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
- **Audio**: one `AudioContext` and one sounding voice. `getFrequencyForDegree()` multiplies ratios cumulatively from the base note; `getBaseFrequency()` reads `#base-note` as semitones above C (`0`=C … `11`=B, the same number a `.musp.json` file's `settings.baseNote` stores) and wraps by `(s + 3) % 12` before applying `220 × 2^(.../12)`, which keeps the audible octave at A220…G♯415 for every choice — the default option is C, so the default scale plays at 261.63 Hz. A per-note button plays while held (`audio-ui.js`); **Play** sounds the whole scale — degrees 1…N then N−1…1, quarter notes at 90 BPM — by scheduling every note up front against the audio clock, so no timer takes part in producing sound. The sounding degree's own play button takes the pressed look, driven by `updateSoundingNote()` reading the clock. **Keyboard**: Space toggles Play/Stop, `1`…`9` hold their degree, and Escape blurs a focused text box or `<select>` so the other two become reachable without the mouse (a focused *button* keeps focus — Space is its click, and the Save menu's own Escape restores focus there deliberately). Space and the digits are guarded on `document.activeElement` — a digit is blocked only by something you can type into (so typing `3/2` never plays degrees 3 and 2), while Space is also blocked by a focused button, whose click the browser already makes from it (an *enabled* one — Firefox keeps focus on a button its own click disabled, and the transport's two do exactly that). Every chord (Ctrl/Cmd/Alt/Shift) is left alone, so Shift+Space still scrolls. Every control with a shortcut declares it in both `title` and `aria-keyshortcuts`; `applyShortcutHints()` writes the two Ctrl/Cmd tooltips at load time in the platform's own notation, and `updateTransportButtons()` moves the transport's `aria-keyshortcuts` to whichever of Play/Stop is enabled, since a disabled button claiming Space would promise an activation it will not perform. **Save Audio As WAV** renders the same `scheduleScale()` through an `OfflineAudioContext` at a fixed 44100 Hz and encodes mono 16-bit RIFF/WAVE by hand; see `docs/ARCHITECTURE.md`'s Audio section for why not a compressed format.
- **Saving a file**: all three saves — `.musp.json`, PNG and WAV — hand their bytes to `downloadBlob()` (`persistence-ui.js`), which downloads them as a `Blob` behind an object URL, revoked on the next macrotask. **Never a `data:` URL**: iOS Safari's download manager will not fetch one, so the sheet appears and then nothing is written, silently. See `docs/ARCHITECTURE.md`'s "Handing the browser a file". Where `showSaveFilePicker` exists the scale and audio saves use the File System Access API instead; Safari, Firefox and every `file://` page reach `downloadBlob()`.
- **Color sync** (`syncIntervalColors`): intervals with matching parsed values share a color — editing one interval's value or color propagates to all others with the same value. The palette dropdown is built per-row from `PALETTE`.
- **Startup** (`initUI`): the page has no *automatic* persistence, so every load resets the settings to their markup defaults and rebuilds the default two-note scale. A browser restores form-control state across a soft reload while `#editor`'s structure comes back as the markup's, which is what put the controls and the DOM-as-data-model out of step. `initUI()` runs at load time *and* on `pageshow`, because Firefox restores before the scripts run and Chromium after `load`. The toolbar's **New** button runs this same `initUI()`.
- **Notation** (`#notation`, `generic` or `byzantine`): switching notation never rebuilds the editor — every note row always carries a name input, an accidental well, and the three Byzantine wells (alteration, fthora, martyria); CSS decides which half shows. In Generic, an accidental is drawn in the chart's sign gutter, the same place a fthora is drawn in Byzantine. See `docs/BYZANTINE-SYMBOLS.md` for the symbol model, the two compatibility tables, the note ladder, and what adding a second font would touch, and `docs/SMUFL-ACCIDENTALS.md` for the accidental catalogue.
- **File persistence**: a scale is saved and opened explicitly, never automatically, as a `.musp.json` file (version 1, `persistence.js`) through the sticky toolbar (`persistence-ui.js`). `collectDocumentState()` reads `#editor` and the controls into the file's own vocabulary; `applyDocumentState()` rebuilds them from a validated document by direct value assignment — no `change`/`input` events, so it never triggers `resetScaleToDefault()` or the mode converter while loading. See `docs/ARCHITECTURE.md`'s File Persistence section for the format, the validation rules and the apply order.

## Testing — mandatory TDD

**Every behavioral change follows red/green/refactor. Write the failing test first, watch it fail, then implement.** `docs/TESTING.md` is the full guide; the rules that matter most:

- `npm install` once, then `npm test`. The suite is `node --test` + jsdom, runs in seconds, no browser needed.
- Never write production code that no failing test demanded. Never commit implementation without its tests.
- Bug fixes start with a test that reproduces the bug — it must fail before the fix.
- Run the **whole** suite before committing, not just the file you touched. A test you did not intend to touch going red means you broke something or deliberately changed documented behavior; in the latter case update that test in the same commit and say so in the message.
- Never delete, skip or loosen a test to get green.
- Unit and integration tests only. No end-to-end/UI tests, no pixel or CSS assertions. Chart tests assert the *geometry* passed to the canvas context (sizes, coordinates, draw order), never the resulting image.
- Driving the real page with Playwright to eyeball a change is encouraged, but it is manual verification — it does not replace a test and browser-driving scripts are not committed.
- Keep testable logic in **named top-level functions**, in whichever of the nine scripts it belongs to. The harness auto-exports every top-level `function`, `async function` or `const` from all nine scripts to tests; logic buried inside an event-listener callback is unreachable from them.
- `docs/TESTING.md` is not loaded into context automatically. `.claude/rules/testing.md` is path-scoped to `app.js`, `byzantine.js`, `smufl.js`, `persistence.js`, `audio.js`, `symbols-ui.js`, `byzantine-ui.js`, `persistence-ui.js`, `audio-ui.js`, `index.html`, `style.css` and `test/**/*.js`, so reading any of them loads the rule and `@`-imports the guide along with it.

## Conventions

- No external libs **in the app**. `index.html` still loads nothing but `style.css` and its nine own scripts, with no build step. `jsdom` is a dev-only dependency of the test suite; don't add more, and don't add anything to the app itself.
- The app is `index.html`, `style.css` and nine classic scripts loaded in this
  order: `byzantine.js` (symbol model + shared measuring primitives, no DOM),
  `smufl.js` (SMuFL accidental catalogue and resolvers, no DOM), `persistence.js`
  (the `.musp.json` format, no DOM), `audio.js` (the audio model, no DOM),
  `symbols-ui.js` (wells and pickers shared by both notations), `byzantine-ui.js`
  (only what is Byzantine), `persistence-ui.js` (the toolbar and file flows),
  `audio-ui.js` (the transport, the highlight, the keyboard and the WAV export), `app.js`
  (everything else; it runs at load time, so it goes last). **Never convert
  these to ES modules**: a `<script type="module">`
  is fetched under CORS and a `file://` page has an opaque origin, so modules
  break "open `index.html` in a browser". Classic scripts share one global
  scope, which also means no top-level name may be declared in two of them —
  that is a load-time SyntaxError.
- `docs/ARCHITECTURE.md` describes the intended design — consult it before non-trivial changes.
- **Commit messages**: always prefix with the GitHub issue number in brackets to annotate which
  issue the work belongs to, e.g. `[#2] Add Byzantine font research`. Use this prefix for every
  commit that relates to an issue.
- **Issue assets**: research, designs, plans and scratch files for one GitHub issue live in
  `issues/NNN-slug/`, where `NNN` is the issue number zero-padded to three digits and `slug`
  echoes the branch name — e.g. `issues/015-file-persistence/` for issue #15 on
  `feature/file-persistence`.
