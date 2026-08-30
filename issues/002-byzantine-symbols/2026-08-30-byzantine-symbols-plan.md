# Byzantine Symbols Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second notation to the app in which every scale degree is labelled with two psaltic signs — a fthora and a martyria drawn from the vendored Neanes font — in the editor and in the chart.

**Architecture:** A logical, font-independent symbol model (`byzantine.js`) with two SBMuFL resolvers is the only place that knows a codepoint. Symbol state lives on the note row as `data-*` attributes, because the DOM is this app's data model. The editor UI (wells, pickers, ladder propagation) lives in `byzantine-ui.js`; `app.js` keeps everything it has today plus a Byzantine branch in `render()`. The three files load as classic `<script>` tags — no modules, no build step, so `file://` keeps working.

**Tech Stack:** Vanilla ES2020 in three classic scripts, canvas 2D, `node --test` + jsdom, the vendored `fonts/Neanes.woff2` (SBMuFL Private Use Area).

**Spec:** `issues/002-byzantine-symbols/2026-08-29-byzantine-symbols-design.md` — read it alongside this plan. Supporting research: `issues/002-byzantine-symbols/MARTYRIA-COMPOSITION.md` (how the font stacks a martyria), `issues/002-byzantine-symbols/SBMUFL-FONTS.md` (the codepoint tables).

**Branch:** `feature/byzantine-mode` (already checked out).

## Global Constraints

- **TDD is mandatory.** `docs/TESTING.md` governs. Every behaviour gets a test that is *run and seen to fail* before the implementation exists. Never delete, skip or loosen a test to get green.
- **Run the whole suite (`npm test`) before every commit**, not just the file you touched.
- **Every commit message is prefixed `[#2]`.** One behavioural change per commit; tests and implementation land together.
- **No new dependencies, no build step.** `index.html` loads `style.css` and classic `<script>` tags only. Never `type="module"` — a module script is fetched under CORS and a `file://` page has an opaque origin, so modules break "open `index.html` in a browser".
- **No duplicate top-level declaration names across `byzantine.js`, `byzantine-ui.js` and `app.js`.** Classic scripts share one global lexical environment, so a repeated top-level `const`/`let` is a **load-time SyntaxError that kills the whole page**. Before adding a top-level name, grep the other two files for it.
- **`byzantine.js` and `byzantine-ui.js` must not touch `app.js`'s top-level `const`s (`editor`, `ctx`, `canvas`, …) at their own load time** — only from inside function bodies, which run after `app.js` has loaded. `app.js` loads last and is the only file that does work at load time.
- **Script order in `index.html` is fixed:** `byzantine.js`, `byzantine-ui.js`, `app.js`, all `defer`.
- **Nothing in the tables names a codepoint.** All SBMuFL knowledge lives in `resolveMartyriaGlyphs`, `resolveFthoraGlyph` and the `BYZ_*_BASE` constants beside them.
- **Default notation is `generic`.** Generic behaviour must be byte-for-byte what it is today; the existing suite is the proof.
- **Font:** family `"Neanes"`, file `fonts/Neanes.woff2`, chart size `BYZ_FONT_SIZE = 40`.
- **No measurement taken before the Neanes face resolves is ever cached.** The chart measures fresh on every `render()`; do not add a measurement cache.
- **Chart tests assert geometry only** — arguments passed to the 2D context. Never pixels, never CSS.
- **Keep logic in named top-level functions.** The harness auto-exports every top-level `function`/`const`; logic buried in a listener callback is unreachable from tests.

## Two notes on the spec

The spec is approved and this plan implements it as written. Two things a reader should know:

1. **§5.5 propagates on `Done` only.** If the user picks a note and then clicks outside the panel instead of pressing **Done**, the well is written but the ladder never propagates, leaving one degree out of sequence with its neighbours. Propagating on any close would be more consistent. Planned as written: only `Done` propagates (Task 10).
2. **The `inkBox` / `drawGlyphs` signatures in §6 differ in how they handle the font** — `inkBox` takes one, `drawGlyphs` does not. Planned as written: `inkBox(ctx, text, font)` sets and restores `ctx.font` around its measurement; `drawGlyphs` uses whatever `ctx.font` the caller has set.

## File structure

| File | Responsibility | Touches the DOM? |
|---|---|---|
| `byzantine.js` (new) | The four vocabulary tables, the two resolvers, the ladder helpers, the ink-measurement helpers. Pure functions and data. | no |
| `byzantine-ui.js` (new) | Well markup, well repaint, both pickers, click routing, ladder propagation. | yes |
| `app.js` | Everything it holds today, plus the `#notation` setting and the chart's Byzantine branch. | yes |
| `index.html` | Three `<script defer>` tags; the two seed note rows gain the wells markup; Settings gains `#notation`. | — |
| `style.css` | `@font-face` for Neanes; the `.notation-byzantine` switch; well and picker styling. | — |
| `test/helpers/harness.js` | Follows `index.html`'s script tags; stubs `document.fonts`; new Byzantine interaction helpers. | — |
| `test/helpers/canvas-stub.js` | Grows an ink model: zero-advance marks and mark-aware ascent/descent. | — |
| `test/unit/byzantine-symbols.test.js` (new) | Tables, resolvers, ladder, ink helpers. | — |
| `test/integration/notation.test.js` (new) | The setting, the DOM switch, well state, `readScaleData`. | — |
| `test/integration/byzantine-pickers.test.js` (new) | Picker contents, ordering, disabled rows, live write, Done, propagation. | — |
| `test/integration/render.test.js` | Extended with the Byzantine chart geometry. | — |
| `test/integration/harness.test.js` | Extended with the multi-script self-test. | — |
| `docs/PLAN-01.md`, `docs/BYZANTINE-SYMBOLS.md` (new), `CLAUDE.md` | Documentation. | — |

---

## Task 1: Three-script layout, a harness that follows `index.html`, and `BYZ_NOTES`

Nothing can be built until `byzantine.js` exists, `index.html` loads it, and the harness stops reading `app.js` by name. This task delivers that plumbing with its first real inhabitant: the 21 note letters.

**Files:**
- Create: `byzantine.js`
- Create: `test/unit/byzantine-symbols.test.js`
- Modify: `index.html:111` (the `<script>` tag)
- Modify: `test/helpers/harness.js:20-30` (paths), `test/helpers/harness.js:56-115` (`loadApp`), and the `module.exports` block
- Modify: `test/integration/harness.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BYZ_NOTES` — a frozen array of 21 objects `{ id: string, octave: "low"|"mid"|"high", letterIndex: 0..6, greek: string, latin: string }`, ascending in pitch. Array index is the note's ladder position and coincides with SBMuFL codepoint order.
  - `BYZ_OCTAVES = ["low", "mid", "high"]`
  - `byzNoteById(id) -> object | null`
  - Harness: `h.scriptFiles` — absolute paths of the scripts that were run, in order. `h.exportedNames` now spans every script.

- [ ] **Step 1: Write the failing test**

Create `test/unit/byzantine-symbols.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");

test("the Byzantine note vocabulary", async (t) => {
  await t.test("holds 21 letters: three registers of seven, ascending in pitch", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = Array.from(h.app.BYZ_NOTES);
    assert.equal(notes.length, 21, "seven degrees in each of three registers");
    assert.deepEqual(
      notes.slice(0, 7).map((n) => n.id),
      ["lowZo", "lowNi", "lowPa", "lowVou", "lowGa", "lowDi", "lowKe"],
      "the low register runs Zo Ni Pa Vou Ga Di Ke"
    );
    assert.deepEqual(
      notes.map((n) => n.octave).filter((o, i, all) => all.indexOf(o) === i),
      ["low", "mid", "high"],
      "the registers appear in ascending order and do not interleave"
    );
  });

  await t.test("numbers each letter by its position within its register", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = Array.from(h.app.BYZ_NOTES);
    assert.deepEqual(
      notes.map((n) => n.letterIndex),
      [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6]
    );
  });

  await t.test("carries a Greek and a Latin name for every letter", () => {
    const h = loadApp();
    t.after(() => h.close());

    const midPa = h.app.byzNoteById("midPa");
    assert.equal(midPa.greek, "Πα");
    assert.equal(midPa.latin, "Pa");
    assert.equal(h.app.byzNoteById("nonesuch"), null, "an unknown id resolves to null");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'BYZ_NOTES')` or `h.app.byzNoteById is not a function`. The harness only loads `app.js`, which has no such names.

- [ ] **Step 3: Create `byzantine.js`**

```js
// Byzantine (psaltic) symbol model.
//
// Nothing in this file's tables names a codepoint, an octave block or an
// above/below variant. All SBMuFL knowledge lives in the resolvers further
// down. A different font encoding is a second pair of resolvers and touches
// nothing else. See docs/BYZANTINE-SYMBOLS.md.

const BYZ_OCTAVES = ["low", "mid", "high"];

const BYZ_LETTERS = [
  { key: "Zo", greek: "Ζω", latin: "Zo" },
  { key: "Ni", greek: "Νη", latin: "Ni" },
  { key: "Pa", greek: "Πα", latin: "Pa" },
  { key: "Vou", greek: "Βου", latin: "Vou" },
  { key: "Ga", greek: "Γα", latin: "Ga" },
  { key: "Di", greek: "Δι", latin: "Di" },
  { key: "Ke", greek: "Κε", latin: "Ke" },
];

// 21 note letters, ascending in pitch. The array index is the note's ladder
// position (see ladderPosition) and coincides with SBMuFL codepoint order.
const BYZ_NOTES = BYZ_OCTAVES.flatMap((octave) =>
  BYZ_LETTERS.map((letter, letterIndex) => ({
    id: octave + letter.key,
    octave: octave,
    letterIndex: letterIndex,
    greek: letter.greek,
    latin: letter.latin,
  }))
);

function byzNoteById(id) {
  return BYZ_NOTES.find((note) => note.id === id) || null;
}
```

- [ ] **Step 4: Load it from `index.html`**

Replace the single script tag with:

```html
  <script src="byzantine.js" defer></script>
  <script src="app.js" defer></script>
```

(`byzantine-ui.js` joins them in Task 5.)

- [ ] **Step 5: Teach the harness to follow the script tags**

In `test/helpers/harness.js`, replace the `APP_PATH` constant and the single-file load with a walk of `index.html`'s `<script src>` tags. Top-level `const`s declared by one `vm.runInContext` call are visible to the next in the same context — exactly as separate `<script>` tags behave — so the epilogue can be built from the union of every file's names and run last.

```js
const ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(ROOT, "index.html");

/** Matches `<script src="...">` in index.html, in document order. */
const SCRIPT_SRC = /<script\b[^>]*\bsrc="([^"]+)"/g;

function scriptPaths(html) {
  return [...html.matchAll(SCRIPT_SRC)].map((m) => path.join(ROOT, m[1]));
}
```

and inside `loadApp`, replacing the `const appSource = ...` line and the `vm.runInContext(...)` block:

```js
  const files = scriptPaths(html).map((file) => ({
    file,
    source: fs.readFileSync(file, "utf8"),
  }));

  const names = [];
  for (const { source } of files) {
    for (const name of topLevelNames(source)) {
      if (!names.includes(name)) names.push(name);
    }
  }

  // Each file runs under its own real filename so stack traces and
  // --experimental-test-coverage attribute the code to the file on disk.
  // Classic scripts share one global lexical environment, so a `const` in
  // byzantine.js is visible to app.js and to the epilogue below.
  for (const { file, source } of files) {
    vm.runInContext(source, dom.getInternalVMContext(), { filename: file });
  }
  vm.runInContext(buildExportEpilogue(names), dom.getInternalVMContext(), {
    filename: path.join(ROOT, "__harness_exports__.js"),
  });
```

Then drop the leading `\n;` from `buildExportEpilogue` (it is now its own script), add `scriptFiles: files.map((f) => f.file)` to the returned harness object, and export `scriptPaths` from the module.

- [ ] **Step 6: Extend the harness self-test**

Append to `test/integration/harness.test.js`, inside the existing `test("the test harness", …)` block:

```js
  await t.test("runs every script index.html loads, in document order", () => {
    const path = require("node:path");
    const h = loadApp();
    t.after(() => h.close());

    const names = h.scriptFiles.map((f) => path.basename(f));
    assert.ok(names.includes("byzantine.js"), `byzantine.js was never run, got ${names}`);
    assert.equal(names.at(-1), "app.js", "app.js must run last: it wires the page up");
  });

  await t.test("re-exports top-level names from every script, not just app.js", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.ok(h.exportedNames.includes("BYZ_NOTES"), "byzantine.js names are missing");
    assert.ok(h.exportedNames.includes("readScaleData"), "app.js names are missing");
    assert.equal(typeof h.app.byzNoteById, "function");
  });
```

- [ ] **Step 7: Run the new tests**

Run: `node --test test/unit/byzantine-symbols.test.js test/integration/harness.test.js`
Expected: PASS.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS, with no test count regressions. If `app.js` failed to see `BYZ_NOTES`, the cross-script lexical scope assumption is wrong — stop and report rather than working around it.

- [ ] **Step 9: Commit**

```bash
git add byzantine.js index.html test/helpers/harness.js test/unit/byzantine-symbols.test.js test/integration/harness.test.js
git commit -m "[#2] Split out byzantine.js and add the note vocabulary

The harness now follows index.html's script tags instead of loading app.js
by name, so every top-level declaration in any of the app's scripts stays
auto-exported to tests."
```

---

## Task 2: The remaining vocabulary tables

**Files:**
- Modify: `byzantine.js`
- Modify: `test/unit/byzantine-symbols.test.js`

**Interfaces:**
- Consumes: `BYZ_NOTES` (Task 1).
- Produces:
  - `BYZ_GENERA` — 12 objects `{ id, index, label }` in SBMuFL block order.
  - `GENUS_NONE = "none"` — the sentinel for "letter alone"; the default.
  - `BYZ_FTHORES` — 16 objects `{ id, index, label }` in `U+E1D0`–`U+E1DF` order.
  - `MARTYRIA_COMPATIBILITY` — `{ [noteId]: genusId[] }`, de-duplicated, in `modes-table.html`'s left-to-right column order.
  - `byzGenusById(id) -> object | null`, `byzFthoraById(id) -> object | null`
  - `compatibleGenera(noteId) -> string[]` — the table's list, or `[]`.
  - `otherGenera(noteId) -> string[]` — every genus id *not* in the table's list, in `BYZ_GENERA` order.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/byzantine-symbols.test.js`:

```js
test("the Byzantine genus vocabulary", async (t) => {
  await t.test("holds the twelve genus signs in SBMuFL block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.BYZ_GENERA).map((g) => g.id),
      [
        "zo", "delta", "alpha", "legetos", "nana", "deltaDotted",
        "alphaDotted", "hardChromaticPa", "hardChromaticDi",
        "softChromaticDi", "softChromaticKe", "zygos",
      ]
    );
    assert.deepEqual(
      Array.from(h.app.BYZ_GENERA).map((g) => g.index),
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      "index must equal the block offset, which the resolver relies on"
    );
  });

  await t.test("reserves a sentinel for 'no genus', which is not one of the twelve", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.GENUS_NONE, "none");
    assert.equal(
      Array.from(h.app.BYZ_GENERA).filter((g) => g.id === h.app.GENUS_NONE).length,
      0
    );
  });
});

test("the fthora vocabulary", async (t) => {
  await t.test("holds the sixteen standalone fthores and chroes in block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      Array.from(h.app.BYZ_FTHORES).map((f) => f.id),
      [
        "diatonicNiLow", "diatonicPa", "diatonicVou", "diatonicGa",
        "diatonicDi", "diatonicKe", "diatonicZo", "diatonicNiHigh",
        "hardChromaticPa", "hardChromaticDi", "softChromaticDi",
        "softChromaticKe", "enharmonic", "chroaZygos", "chroaKliton",
        "chroaSpathi",
      ]
    );
    assert.equal(h.app.byzFthoraById("diatonicPa").index, 1);
    assert.equal(h.app.byzFthoraById("nonesuch"), null);
  });
});

test("the martyria compatibility table", async (t) => {
  await t.test("gives every one of the 21 notes a non-empty genus list", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleGenera(note.id);
      assert.ok(list.length > 0, `${note.id} has no compatible genera`);
    }
  });

  await t.test("names only genera that exist, with no duplicates", () => {
    const h = loadApp();
    t.after(() => h.close());

    const known = Array.from(h.app.BYZ_GENERA).map((g) => g.id);
    for (const note of Array.from(h.app.BYZ_NOTES)) {
      const list = h.app.compatibleGenera(note.id);
      for (const id of list) assert.ok(known.includes(id), `${note.id}: unknown genus ${id}`);
      assert.equal(new Set(list).size, list.length, `${note.id}: duplicated genus`);
    }
  });

  await t.test("keeps the modes table's column order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      h.app.compatibleGenera("midDi"),
      ["deltaDotted", "softChromaticDi", "hardChromaticDi", "zygos", "hardChromaticPa"]
    );
  });

  await t.test("lists every remaining genus as 'other', in block order", () => {
    const h = loadApp();
    t.after(() => h.close());

    const compatible = h.app.compatibleGenera("lowZo");
    const other = h.app.otherGenera("lowZo");

    assert.equal(compatible.length + other.length, 12, "every genus is in exactly one list");
    assert.equal(other.filter((id) => compatible.includes(id)).length, 0, "the lists must not overlap");
    assert.deepEqual(
      other,
      ["zo", "delta", "alpha", "legetos", "deltaDotted", "alphaDotted", "hardChromaticPa", "softChromaticKe", "zygos"],
      "the others follow BYZ_GENERA order"
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: FAIL — `BYZ_GENERA` is undefined and `compatibleGenera` is not a function.

- [ ] **Step 3: Add the tables to `byzantine.js`**

Append below `byzNoteById`:

```js
// The sentinel for "no genus": the letter is drawn alone. This is the default.
const GENUS_NONE = "none";

// Twelve genus (ichos) signs, in SBMuFL block order — which is also the
// picker's fallback order. `index` is the offset within the block; the
// resolver adds it to the register's base codepoint.
const BYZ_GENERA = [
  { id: "zo", index: 0, label: "Ζω (diatonic)" },
  { id: "delta", index: 1, label: "Δ tetartos" },
  { id: "alpha", index: 2, label: "Α protos" },
  { id: "legetos", index: 3, label: "Legetos" },
  { id: "nana", index: 4, label: "Nana (tritos)" },
  { id: "deltaDotted", index: 5, label: "Δ dotted" },
  { id: "alphaDotted", index: 6, label: "Α dotted" },
  { id: "hardChromaticPa", index: 7, label: "Hard chromatic Πα" },
  { id: "hardChromaticDi", index: 8, label: "Hard chromatic Δι" },
  { id: "softChromaticDi", index: 9, label: "Soft chromatic Δι" },
  { id: "softChromaticKe", index: 10, label: "Soft chromatic Κε" },
  { id: "zygos", index: 11, label: "Zygos" },
];

// Sixteen fthores: the standalone block, which has a normal advance. The
// zero-advance Above/Secondary/Tertiary/Below variants are meant to ride a
// neume and are not used here.
const BYZ_FTHORES = [
  { id: "diatonicNiLow", index: 0, label: "Diatonic Νη (low)" },
  { id: "diatonicPa", index: 1, label: "Diatonic Πα" },
  { id: "diatonicVou", index: 2, label: "Diatonic Βου" },
  { id: "diatonicGa", index: 3, label: "Diatonic Γα" },
  { id: "diatonicDi", index: 4, label: "Diatonic Δι" },
  { id: "diatonicKe", index: 5, label: "Diatonic Κε" },
  { id: "diatonicZo", index: 6, label: "Diatonic Ζω" },
  { id: "diatonicNiHigh", index: 7, label: "Diatonic Νη (high)" },
  { id: "hardChromaticPa", index: 8, label: "Hard chromatic Πα" },
  { id: "hardChromaticDi", index: 9, label: "Hard chromatic Δι" },
  { id: "softChromaticDi", index: 10, label: "Soft chromatic Δι" },
  { id: "softChromaticKe", index: 11, label: "Soft chromatic Κε" },
  { id: "enharmonic", index: 12, label: "Enharmonic" },
  { id: "chroaZygos", index: 13, label: "Zygos" },
  { id: "chroaKliton", index: 14, label: "Kliton" },
  { id: "chroaSpathi", index: 15, label: "Spathi" },
];

// Per note, the genera the modes table pairs with it: de-duplicated, in the
// table's left-to-right column order (Modes I–VIII, varys, then the three
// transcribed makam scales). Derived by hand from
// issues/002-byzantine-symbols/modes-table.html, which is not final — see
// docs/BYZANTINE-SYMBOLS.md for how to redo this when that table changes.
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

function byzGenusById(id) {
  return BYZ_GENERA.find((genus) => genus.id === id) || null;
}

function byzFthoraById(id) {
  return BYZ_FTHORES.find((fthora) => fthora.id === id) || null;
}

/** The genera the modes table pairs with this note, in the table's order. */
function compatibleGenera(noteId) {
  return MARTYRIA_COMPATIBILITY[noteId] || [];
}

/** Every other genus, in BYZ_GENERA order — the uncommon combinations. */
function otherGenera(noteId) {
  const compatible = compatibleGenera(noteId);
  return BYZ_GENERA.filter((genus) => !compatible.includes(genus.id)).map((genus) => genus.id);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add byzantine.js test/unit/byzantine-symbols.test.js
git commit -m "[#2] Add the genus, fthora and compatibility tables"
```

---

## Task 3: The SBMuFL resolvers

The only two functions in the codebase that know a codepoint.

**Files:**
- Modify: `byzantine.js`
- Modify: `test/unit/byzantine-symbols.test.js`

**Interfaces:**
- Consumes: `BYZ_NOTES`, `BYZ_GENERA`, `BYZ_FTHORES`, `GENUS_NONE`, `byzNoteById`, `byzGenusById`, `byzFthoraById`.
- Produces:
  - `resolveMartyriaGlyphs(noteId, genusId, ticks) -> string` — the letter, then the genus mark (unless `GENUS_NONE`), then `ticks` copies of `martyriaTick`. Returns `""` for an unknown note.
  - `resolveFthoraGlyph(fthoraId) -> string` — one character, or `""` for an unknown id.
  - `BYZ_NOTE_BASE`, `BYZ_GENUS_BELOW_BASE`, `BYZ_GENUS_ABOVE_BASE`, `BYZ_TICK`, `BYZ_FTHORA_BASE`.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/byzantine-symbols.test.js`:

```js
test("resolving a martyria to glyphs", async (t) => {
  await t.test("puts the letter first and the genus mark second", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Middle Pa + alpha: the worked example in MARTYRIA-COMPOSITION.md §6.
    assert.equal(h.app.resolveMartyriaGlyphs("midPa", "alpha", 0), "\uE139\uE152");
  });

  await t.test("takes the mark from the Above set for the low register", () => {
    const h = loadApp();
    t.after(() => h.close());

    // A low letter carries only a martyriaTop anchor, so it accepts …Above.
    assert.equal(h.app.resolveMartyriaGlyphs("lowZo", "nana", 0), "\uE130\uE174");
    assert.equal(h.app.resolveMartyriaGlyphs("lowKe", "alpha", 0), "\uE136\uE172");
  });

  await t.test("takes the mark from the Below set for the middle and high registers", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("midZo", "zo", 0), "\uE137\uE150");
    assert.equal(h.app.resolveMartyriaGlyphs("highKe", "softChromaticDi", 0), "\uE144\uE159");
  });

  await t.test("draws the letter alone when the genus is none", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0), "\uE139");
    assert.equal(h.app.resolveMartyriaGlyphs("midPa", "", 0), "\uE139", "a missing genus is the same as none");
  });

  await t.test("appends the octave tick after the mark", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("highKe", "softChromaticDi", 1), "\uE144\uE159\uE145");
    assert.equal(h.app.resolveMartyriaGlyphs("highKe", h.app.GENUS_NONE, 1), "\uE144\uE145");
  });

  await t.test("resolves nothing for an unknown note", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveMartyriaGlyphs("nonesuch", "alpha", 0), "");
  });
});

test("resolving a fthora to a glyph", async (t) => {
  await t.test("indexes the standalone block", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveFthoraGlyph("diatonicNiLow"), "\uE1D0");
    assert.equal(h.app.resolveFthoraGlyph("diatonicPa"), "\uE1D1");
    assert.equal(h.app.resolveFthoraGlyph("chroaSpathi"), "\uE1DF");
  });

  await t.test("resolves nothing for an unknown or empty id", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.resolveFthoraGlyph("nonesuch"), "");
    assert.equal(h.app.resolveFthoraGlyph(""), "");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: FAIL — `h.app.resolveMartyriaGlyphs is not a function`.

- [ ] **Step 3: Add the resolvers to `byzantine.js`**

Append:

```js
// ---------------------------------------------------------------------------
// SBMuFL resolvers — the only code that knows a codepoint.
//
// Swapping to a different encoding (the Byzantine Music Unicode block, say) is
// a second pair of these two functions. Nothing above this line changes.
// ---------------------------------------------------------------------------

const BYZ_NOTE_BASE = 0xe130;        // martyriaNoteZoLow; three contiguous blocks of seven
const BYZ_GENUS_BELOW_BASE = 0xe150; // marks that hang under the letter
const BYZ_GENUS_ABOVE_BASE = 0xe170; // marks that sit over the letter
const BYZ_TICK = 0xe145;             // martyriaTick — a spacing glyph, not a mark
const BYZ_FTHORA_BASE = 0xe1d0;      // fthoraDiatonicNiLow

/**
 * The glyph string for one martyria: letter, then genus mark, then ticks.
 *
 * The register decides which mark set is used, because each letter carries
 * only one anchor — martyriaTop for the low register, martyriaBottom for the
 * middle and high ones. Pair a middle letter with an …Above mark and the
 * font's mark-to-base lookup cannot attach it. See MARTYRIA-COMPOSITION.md §5.
 */
function resolveMartyriaGlyphs(noteId, genusId, ticks) {
  const note = byzNoteById(noteId);
  if (!note) return "";

  let out = String.fromCharCode(
    BYZ_NOTE_BASE + BYZ_OCTAVES.indexOf(note.octave) * BYZ_LETTERS.length + note.letterIndex
  );

  const genus = genusId && genusId !== GENUS_NONE ? byzGenusById(genusId) : null;
  if (genus) {
    const base = note.octave === "low" ? BYZ_GENUS_ABOVE_BASE : BYZ_GENUS_BELOW_BASE;
    out += String.fromCharCode(base + genus.index);
  }

  for (let i = 0; i < (ticks || 0); i++) out += String.fromCharCode(BYZ_TICK);
  return out;
}

function resolveFthoraGlyph(fthoraId) {
  const fthora = byzFthoraById(fthoraId);
  return fthora ? String.fromCharCode(BYZ_FTHORA_BASE + fthora.index) : "";
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add byzantine.js test/unit/byzantine-symbols.test.js
git commit -m "[#2] Resolve logical martyria and fthora ids to SBMuFL glyphs"
```

---

## Task 4: The note ladder

A martyria's letter is not chosen per degree independently — a scale runs through consecutive letters. This task delivers the arithmetic; Task 10 wires it to the UI.

**Files:**
- Modify: `byzantine.js`
- Modify: `test/unit/byzantine-symbols.test.js`

**Interfaces:**
- Consumes: `BYZ_NOTES`, `byzNoteById`.
- Produces:
  - `LADDER_MAX = 27` — `highKe` plus one octave tick.
  - `ladderPosition(noteId, ticks) -> number` — `noteIndex + 7 × ticks`; `-1` for an unknown note.
  - `ladderNoteAt(position) -> { noteId, ticks } | null`.
  - `isLadderPositionLegal(position, degree, degreeCount) -> boolean` — `degree` is 1-based.

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/byzantine-symbols.test.js`:

```js
test("the note ladder", async (t) => {
  await t.test("numbers the 21 letters 0 to 20 in pitch order", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderPosition("lowZo", 0), 0);
    assert.equal(h.app.ladderPosition("midZo", 0), 7);
    assert.equal(h.app.ladderPosition("highKe", 0), 20);
    assert.equal(h.app.ladderPosition("nonesuch", 0), -1);
  });

  await t.test("extends upward by an octave tick, to 27", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderPosition("highZo", 1), 21);
    assert.equal(h.app.ladderPosition("highKe", 1), 27);
    assert.equal(h.app.LADDER_MAX, 27);
  });

  await t.test("maps a position back to a letter and a tick count", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual({ ...h.app.ladderNoteAt(0) }, { noteId: "lowZo", ticks: 0 });
    assert.deepEqual({ ...h.app.ladderNoteAt(20) }, { noteId: "highKe", ticks: 0 });
    assert.deepEqual({ ...h.app.ladderNoteAt(21) }, { noteId: "highZo", ticks: 1 });
    assert.deepEqual({ ...h.app.ladderNoteAt(27) }, { noteId: "highKe", ticks: 1 });
  });

  await t.test("has nothing below the bottom or above the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.ladderNoteAt(-1), null, "there is no register below low Ζω");
    assert.equal(h.app.ladderNoteAt(28), null, "there is no second tick");
  });

  await t.test("round-trips every legal position", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (let p = 0; p <= h.app.LADDER_MAX; p++) {
      const at = h.app.ladderNoteAt(p);
      assert.ok(at, `position ${p} has no note`);
      assert.equal(h.app.ladderPosition(at.noteId, at.ticks), p, `position ${p} did not round-trip`);
    }
  });
});

test("which ladder positions a degree may take", async (t) => {
  await t.test("refuses a position that would push a predecessor below the bottom", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5: two degrees sit below it, so it cannot start below 2.
    assert.equal(h.app.isLadderPositionLegal(1, 3, 5), false);
    assert.equal(h.app.isLadderPositionLegal(2, 3, 5), true);
  });

  await t.test("refuses a position that would push a successor above the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Degree 3 of 5: two degrees sit above it, so it cannot start above 25.
    assert.equal(h.app.isLadderPositionLegal(25, 3, 5), true);
    assert.equal(h.app.isLadderPositionLegal(26, 3, 5), false);
  });

  await t.test("lets the only degree of a one-note scale sit anywhere", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.isLadderPositionLegal(0, 1, 1), true);
    assert.equal(h.app.isLadderPositionLegal(27, 1, 1), true);
    assert.equal(h.app.isLadderPositionLegal(28, 1, 1), false, "still off the ladder");
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: FAIL — `h.app.ladderPosition is not a function`.

- [ ] **Step 3: Add the ladder helpers to `byzantine.js`**

Append:

```js
// ---------------------------------------------------------------------------
// The note ladder.
//
// Positions 0–20 are the 21 letters. Above high Κε there is no higher SBMuFL
// block, so a trailing martyriaTick marks one extra octave: positions 21–27
// are the high letters again, ticked. Below low Ζω there is no equivalent, so
// the ladder simply stops.
// ---------------------------------------------------------------------------

const LADDER_MAX = 27;

function ladderPosition(noteId, ticks) {
  const index = BYZ_NOTES.findIndex((note) => note.id === noteId);
  if (index < 0) return -1;
  return index + BYZ_LETTERS.length * (ticks || 0);
}

function ladderNoteAt(position) {
  if (!Number.isInteger(position) || position < 0 || position > LADDER_MAX) return null;
  const ticks = position < BYZ_NOTES.length ? 0 : 1;
  const index = position - BYZ_LETTERS.length * ticks;
  return { noteId: BYZ_NOTES[index].id, ticks: ticks };
}

/**
 * True when putting `degree` (1-based, of `degreeCount`) at `position` leaves
 * room on the ladder for every other degree of the scale.
 */
function isLadderPositionLegal(position, degree, degreeCount) {
  if (!Number.isInteger(position) || position < 0 || position > LADDER_MAX) return false;
  if (position < degree - 1) return false;
  return position + (degreeCount - degree) <= LADDER_MAX;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add byzantine.js test/unit/byzantine-symbols.test.js
git commit -m "[#2] Add the note ladder and its legality rule"
```

---

## Task 5: The Notation setting, the wells markup, and the DOM switch

**Files:**
- Create: `byzantine-ui.js`
- Create: `test/integration/notation.test.js`
- Modify: `index.html` — the third script tag; `#notation` at the top of Settings; the two seed note rows
- Modify: `app.js` — `notationSelect`, `getNotation`, `onNotationChange`, `makeNoteRowHTML`, the listener block at the bottom
- Modify: `style.css` — `@font-face`, the `.notation-byzantine` switch, well styling
- Modify: `test/helpers/harness.js` — `setNotation` helper

**Interfaces:**
- Consumes: nothing from Tasks 2–4 yet.
- Produces:
  - `byzantine-ui.js`: `makeSymbolWellsHTML() -> string`.
  - `app.js`: `getNotation() -> "generic" | "byzantine"`, `onNotationChange()`, `notationSelect`.
  - Harness: `setNotation(h, value)`.

- [ ] **Step 1: Write the failing tests**

Create `test/integration/notation.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  typeInto,
  setNoteCount,
} = require("../helpers/harness.js");

test("the Notation setting", async (t) => {
  await t.test("starts as Generic, so nothing changes until the user opts in", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.document.getElementById("notation").value, "generic");
    assert.equal(h.app.getNotation(), "generic");
  });

  await t.test("offers exactly Generic and Byzantine", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      [...h.document.getElementById("notation").options].map((o) => o.value),
      ["generic", "byzantine"]
    );
  });

  await t.test("sits in Settings, above Base Note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.el(".settings-panel");
    const rows = [...panel.querySelectorAll(".notation-row, .base-note-row")];
    assert.ok(rows[0].classList.contains("notation-row"), "Notation must come first");
  });

  await t.test("marks the editor when Byzantine is chosen, and unmarks it again", () => {
    const h = loadApp();
    t.after(() => h.close());

    setNotation(h, "byzantine");
    assert.ok(h.editor().classList.contains("notation-byzantine"));

    setNotation(h, "generic");
    assert.ok(!h.editor().classList.contains("notation-byzantine"));
  });

  await t.test("redraws the chart when the notation changes", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    setNotation(h, "byzantine");
    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });
});

test("the symbol wells on a note row", async (t) => {
  await t.test("gives every note row a fthora well and a martyria well", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);

    for (const row of noteRows(h)) {
      assert.ok(row.querySelector(".fthora-well"), "no fthora well");
      assert.ok(row.querySelector(".martyria-well"), "no martyria well");
      assert.ok(row.querySelector(".fthora-picker"), "no fthora picker panel");
      assert.ok(row.querySelector(".martyria-picker"), "no martyria picker panel");
    }
  });

  await t.test("puts the fthora well to the left of the martyria well, mirroring the chart", () => {
    const h = loadApp();
    t.after(() => h.close());

    const row = noteRows(h)[0];
    const wells = [...row.querySelectorAll(".fthora-well-wrapper, .martyria-well-wrapper")];
    assert.ok(wells[0].classList.contains("fthora-well-wrapper"));
    assert.ok(wells[1].classList.contains("martyria-well-wrapper"));
  });

  await t.test("keeps the name input on the row in both notations, so nothing is discarded", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    setNotation(h, "byzantine");
    setNotation(h, "generic");

    assert.equal(noteRows(h)[0].querySelector(".note-name").value, "Pa", "the typed name was lost");
  });

  await t.test("gives a new note the wells too", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    setNoteCount(h, 3);

    const last = noteRows(h).at(-1);
    assert.ok(last.querySelector(".fthora-well"));
    assert.ok(last.querySelector(".martyria-well"));
  });

  await t.test("keeps the wells when the scale mode changes and the rows are rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    for (const row of noteRows(h)) {
      assert.ok(row.querySelector(".martyria-well"), "the rebuild dropped the wells");
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/notation.test.js`
Expected: FAIL — `setNotation is not a function` from the harness, and `#notation` does not exist.

- [ ] **Step 3: Add the `setNotation` helper to the harness**

In `test/helpers/harness.js`, below `selectOption`:

```js
/** Switches the Notation setting and dispatches the `change` event. */
function setNotation(harness, value) {
  return selectOption(harness, "notation", value);
}
```

and add `setNotation` to `module.exports`.

- [ ] **Step 4: Create `byzantine-ui.js` with the wells markup**

```js
// Byzantine notation: the editor UI.
//
// This file declares functions only. It loads before app.js, so it must not
// read app.js's top-level constants (editor, ctx, …) at load time — only from
// inside a function body, which runs after app.js has loaded.

/** The two symbol wells and their picker panels, for one note row. */
function makeSymbolWellsHTML() {
  return (
    '<div class="fthora-well-wrapper">' +
      '<button type="button" class="fthora-well is-empty" title="Fthora"></button>' +
      '<div class="fthora-picker"></div>' +
    "</div>" +
    '<div class="martyria-well-wrapper">' +
      '<button type="button" class="martyria-well is-empty" title="Martyria"></button>' +
      '<div class="martyria-picker"></div>' +
    "</div>"
  );
}
```

- [ ] **Step 5: Wire the setting into `index.html`**

Add the third script tag, before `app.js`:

```html
  <script src="byzantine.js" defer></script>
  <script src="byzantine-ui.js" defer></script>
  <script src="app.js" defer></script>
```

Add the setting as the first row of the Settings panel, above `.base-note-row`:

```html
      <div class="notation-row">
        <label for="notation">Notation</label>
        <select id="notation">
          <option value="generic">Generic</option>
          <option value="byzantine">Byzantine</option>
        </select>
      </div>
```

And append the wells to **both** seed note rows, after their `.note-name` input:

```html
          <input type="text" class="note-name" placeholder="name">
          <div class="fthora-well-wrapper">
            <button type="button" class="fthora-well is-empty" title="Fthora"></button>
            <div class="fthora-picker"></div>
          </div>
          <div class="martyria-well-wrapper">
            <button type="button" class="martyria-well is-empty" title="Martyria"></button>
            <div class="martyria-picker"></div>
          </div>
```

- [ ] **Step 6: Wire the setting into `app.js`**

Add the element lookup beside the other `document.getElementById` calls (after line 35):

```js
const notationSelect = document.getElementById("notation");
```

Add the two functions beside `getScaleMode` (after line 56):

```js
function getNotation() {
  return notationSelect.value;
}

function onNotationChange() {
  editor.classList.toggle("notation-byzantine", getNotation() === "byzantine");
  render();
}
```

Append the wells in `makeNoteRowHTML` — both return statements:

```js
  if (mode === "absolute") {
    // …
    return playBtn + labelHtml + absInput + '<span class="abs-cents-label"></span>' +
      nameInput + makeSymbolWellsHTML();
  }
  return playBtn + labelHtml + '<span class="cumulative-cents"></span>' +
    nameInput + makeSymbolWellsHTML();
```

Register the listener beside the others at the bottom of the file:

```js
notationSelect.addEventListener("change", onNotationChange);
```

- [ ] **Step 7: Style the switch in `style.css`**

Add the face near the top, after the `@import`:

```css
@font-face {
  font-family: "Neanes";
  src: url("fonts/Neanes.woff2") format("woff2");
  font-display: block;
}
```

Add the Notation row to the existing Settings selectors — extend the `.base-note-row`, `.base-note-row label`, `.base-note-row select`, `:hover` and `:focus` rule groups (style.css:95, 114, 126, 142, 148) with `.notation-row`, `.notation-row label` and `.notation-row select` so the control matches Base Note exactly.

Then the switch and the wells:

```css
/* --- Notation switch --- */

/* Both sets of controls live on every note row; CSS decides which are visible,
   so a switch discards nothing. */
.note-row .fthora-well-wrapper,
.note-row .martyria-well-wrapper { display: none; }

#editor.notation-byzantine .note-row .note-name { display: none; }

#editor.notation-byzantine .note-row .fthora-well-wrapper,
#editor.notation-byzantine .note-row .martyria-well-wrapper {
  display: block;
  position: relative;
  flex: 0 0 auto;
}

/* .note-name carried the right-alignment; the first visible well takes it on. */
#editor.notation-byzantine .note-row .fthora-well-wrapper { margin-left: auto; }

/* --- Symbol wells --- */

.fthora-well,
.martyria-well {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 3px;
  background: var(--paper-fade);
  color: var(--ink);
  cursor: pointer;
  font-family: "Neanes", serif;
  font-size: 22px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.fthora-well:hover,
.martyria-well:hover { border-color: var(--ink); }

/* An empty well says which sign it takes, in pure CSS, so it is legible
   before the webfont arrives. */
.fthora-well.is-empty,
.martyria-well.is-empty {
  border-style: dashed;
  position: relative;
}

.fthora-well.is-empty::before {
  content: "";
  position: absolute;
  width: 15px;
  height: 2px;
  background: var(--ink-faint);
  transform: rotate(-45deg);
}

.martyria-well.is-empty::before,
.martyria-well.is-empty::after {
  content: "";
  position: absolute;
  height: 2px;
  background: var(--ink-faint);
}

.martyria-well.is-empty::before { width: 14px; top: 12px; }
.martyria-well.is-empty::after  { width:  8px; top: 19px; }
```

- [ ] **Step 8: Run the tests**

Run: `node --test test/integration/notation.test.js`
Expected: PASS.

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: PASS. Watch `test/integration/editor.test.js` and `test/integration/render.test.js` in particular — `makeNoteRowHTML` changed shape.

- [ ] **Step 10: Commit**

```bash
git add byzantine-ui.js index.html app.js style.css test/helpers/harness.js test/integration/notation.test.js
git commit -m "[#2] Add the Notation setting and the two symbol wells

Every note row carries the name input and both wells at all times; CSS
decides which are visible, so switching notation discards nothing."
```

---

## Task 6: Well state — read, write, repaint, and survive a rebuild

The wells exist but hold nothing. This task gives them a state model on the note row and a repaint that turns that state into glyphs.

**Files:**
- Modify: `byzantine-ui.js`
- Modify: `app.js` — `onScaleModeChange` (app.js:934-997) preserves the symbol attributes; `addNote` and `resetScaleToDefault` repaint
- Modify: `test/integration/notation.test.js`

**Interfaces:**
- Consumes: `resolveMartyriaGlyphs`, `resolveFthoraGlyph`, `GENUS_NONE` (Tasks 2–3).
- Produces (all in `byzantine-ui.js`):
  - `readNoteSymbols(row) -> { fthora: string, martyria: { note: string, genus: string, ticks: number } | null }`
  - `writeMartyria(row, noteId, genusId, ticks) -> void`
  - `clearMartyria(row) -> void`
  - `writeFthora(row, fthoraId) -> void` — `""` clears it
  - `refreshNoteRowWells(row) -> void`
  - `noteSymbolAttrs(row) -> object` and `applyNoteSymbolAttrs(row, attrs) -> void` — carry state across a row rebuild

The four `data-*` attributes on a `.note-row`:

| attribute | value |
|---|---|
| `data-fthora` | a `BYZ_FTHORES` id, or absent |
| `data-martyria-note` | a `BYZ_NOTES` id, or absent |
| `data-martyria-genus` | a `BYZ_GENERA` id or `"none"`; absent when there is no martyria |
| `data-martyria-ticks` | `"0"` or `"1"`; absent when there is no martyria |

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/notation.test.js`:

```js
test("symbol state on a note row", async (t) => {
  await t.test("reads nothing from a fresh row", () => {
    const h = loadApp();
    t.after(() => h.close());

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.fthora, "");
    assert.equal(symbols.martyria, null);
  });

  await t.test("stores a martyria as data attributes and reads it back", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);

    assert.equal(row.dataset.martyriaNote, "midPa");
    assert.equal(row.dataset.martyriaGenus, "alpha");
    assert.equal(row.dataset.martyriaTicks, "0");
    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 0,
    });
  });

  await t.test("defaults a martyria written with no genus to the 'none' sentinel", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "", 0);

    assert.equal(h.app.readNoteSymbols(row).martyria.genus, h.app.GENUS_NONE);
  });

  await t.test("clears a martyria completely, leaving no stale attributes", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 1);
    h.app.clearMartyria(row);

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(row.dataset.martyriaNote, undefined);
    assert.equal(row.dataset.martyriaGenus, undefined);
    assert.equal(row.dataset.martyriaTicks, undefined);
  });

  await t.test("stores and clears a fthora independently of the martyria", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");

    h.app.writeFthora(row, "");
    assert.equal(h.app.readNoteSymbols(row).fthora, "");
    assert.equal(row.dataset.fthora, undefined);
    assert.ok(h.app.readNoteSymbols(row).martyria, "clearing the fthora must not touch the martyria");
  });
});

test("what a well shows", async (t) => {
  await t.test("paints the resolved glyphs into the well button", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
    assert.equal(
      row.querySelector(".fthora-well").textContent,
      h.app.resolveFthoraGlyph("diatonicPa")
    );
  });

  await t.test("marks a well empty when it holds nothing, and filled when it does", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    assert.ok(well.classList.contains("is-empty"), "a fresh well is empty");

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    assert.ok(!well.classList.contains("is-empty"), "a written well is not empty");

    h.app.clearMartyria(row);
    assert.ok(well.classList.contains("is-empty"), "a cleared well is empty again");
    assert.equal(well.textContent, "", "a cleared well shows nothing");
  });

  await t.test("shows the letter alone when the genus is none", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0),
      "the well shows the bare letter"
    );
  });
});

test("symbols across an editor rebuild", async (t) => {
  await t.test("survive a notation switch, because nothing is rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");

    setNotation(h, "generic");
    setNotation(h, "byzantine");

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.martyria.note, "midPa");
    assert.equal(symbols.fthora, "diatonicPa");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0),
      "the well was not repainted"
    );
  });

  await t.test("survive a scale-mode change, which rebuilds the rows but keeps names", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 1);
    h.app.writeFthora(noteRows(h)[1], "diatonicVou");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.deepEqual({ ...h.app.readNoteSymbols(noteRows(h)[0]).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 1,
    });
    assert.equal(h.app.readNoteSymbols(noteRows(h)[1]).fthora, "diatonicVou");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 1),
      "the rebuilt well was not repainted"
    );
  });

  await t.test("are dropped by an interval-type change, which resets the scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    h.document.getElementById("interval-type").value = "cents";
    h.document.getElementById("interval-type").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.equal(
      h.app.readNoteSymbols(noteRows(h)[0]).martyria,
      null,
      "resetScaleToDefault drops symbols, exactly as it already drops names"
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/notation.test.js`
Expected: FAIL — `h.app.readNoteSymbols is not a function`.

- [ ] **Step 3: Add the state model to `byzantine-ui.js`**

Append below `makeSymbolWellsHTML`:

```js
// ---------------------------------------------------------------------------
// Symbol state.
//
// The DOM is this app's data model, so a note row carries its own symbols as
// data-* attributes. Row add/remove bookkeeping then comes for free.
// ---------------------------------------------------------------------------

const NOTE_SYMBOL_ATTRS = ["fthora", "martyriaNote", "martyriaGenus", "martyriaTicks"];

function readNoteSymbols(row) {
  const noteId = row.dataset.martyriaNote || "";
  return {
    fthora: row.dataset.fthora || "",
    martyria: noteId
      ? {
          note: noteId,
          genus: row.dataset.martyriaGenus || GENUS_NONE,
          ticks: parseInt(row.dataset.martyriaTicks || "0", 10) || 0,
        }
      : null,
  };
}

function writeMartyria(row, noteId, genusId, ticks) {
  row.dataset.martyriaNote = noteId;
  row.dataset.martyriaGenus = genusId || GENUS_NONE;
  row.dataset.martyriaTicks = String(ticks || 0);
  refreshNoteRowWells(row);
}

function clearMartyria(row) {
  delete row.dataset.martyriaNote;
  delete row.dataset.martyriaGenus;
  delete row.dataset.martyriaTicks;
  refreshNoteRowWells(row);
}

function writeFthora(row, fthoraId) {
  if (fthoraId) row.dataset.fthora = fthoraId;
  else delete row.dataset.fthora;
  refreshNoteRowWells(row);
}

/** Repaints both wells of one row from its data-* attributes. */
function refreshNoteRowWells(row) {
  const symbols = readNoteSymbols(row);

  const fthoraWell = row.querySelector(".fthora-well");
  if (fthoraWell) {
    fthoraWell.textContent = symbols.fthora ? resolveFthoraGlyph(symbols.fthora) : "";
    fthoraWell.classList.toggle("is-empty", !symbols.fthora);
  }

  const martyriaWell = row.querySelector(".martyria-well");
  if (martyriaWell) {
    martyriaWell.textContent = symbols.martyria
      ? resolveMartyriaGlyphs(symbols.martyria.note, symbols.martyria.genus, symbols.martyria.ticks)
      : "";
    martyriaWell.classList.toggle("is-empty", !symbols.martyria);
  }
}

/** Snapshot of a row's symbol attributes, for carrying across a rebuild. */
function noteSymbolAttrs(row) {
  const attrs = {};
  for (const key of NOTE_SYMBOL_ATTRS) attrs[key] = row.dataset[key];
  return attrs;
}

function applyNoteSymbolAttrs(row, attrs) {
  for (const key of NOTE_SYMBOL_ATTRS) {
    if (attrs[key] === undefined) delete row.dataset[key];
    else row.dataset[key] = attrs[key];
  }
  refreshNoteRowWells(row);
}
```

- [ ] **Step 4: Carry the symbols across a scale-mode change in `app.js`**

`onScaleModeChange` already preserves note names across the rebuild; symbols get the same treatment. In the collection loop (app.js:938-947), add the snapshot:

```js
      noteData.push({
        name: nameInp ? nameInp.value : "",
        absolute: absInp ? absInp.value : "",
        symbols: noteSymbolAttrs(row),
      });
```

and in the rebuild loop (app.js:970-980), restore it after the name:

```js
    const nameInp = noteRow.querySelector(".note-name");
    if (nameInp) nameInp.value = noteData[i].name;
    applyNoteSymbolAttrs(noteRow, noteData[i].symbols);
    editor.appendChild(noteRow);
```

`resetScaleToDefault` needs no change: it writes fresh `innerHTML` with no data attributes, so symbols are dropped exactly as names are.

- [ ] **Step 5: Run the tests**

Run: `node --test test/integration/notation.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add byzantine-ui.js app.js test/integration/notation.test.js
git commit -m "[#2] Store the note symbols on the row and paint them into the wells

A scale-mode change carries the symbols across the rebuild, as it already
does for note names. An interval-type change still resets the scale."
```

---

## Task 7: `readScaleData()` carries the symbols

The chart reads the editor through `readScaleData()`. This task puts the symbols into that reading; Tasks 12–13 draw them.

**Files:**
- Modify: `app.js` — `readScaleData` (app.js:281-347)
- Modify: `test/integration/notation.test.js`

**Interfaces:**
- Consumes: `readNoteSymbols` (Task 6).
- Produces: every `type: "note"` item from `readScaleData()` gains two fields:
  - `fthora: string` — a `BYZ_FTHORES` id, or `""`
  - `martyria: { note: string, genus: string, ticks: number } | null`

  Both are read from the row regardless of notation, so switching notation does not change what `readScaleData()` reports — only what `render()` does with it.

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/notation.test.js`:

```js
test("readScaleData and the note symbols", async (t) => {
  await t.test("reports no symbols for a row that has none", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "");
    assert.equal(notes[0].martyria, null);
  });

  await t.test("reports the symbols each note row holds", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeMartyria(noteRows(h)[1], "midVou", h.app.GENUS_NONE, 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "diatonicPa");
    assert.deepEqual({ ...notes[0].martyria }, { note: "midPa", genus: "alpha", ticks: 0 });
    assert.equal(notes[1].fthora, "");
    assert.deepEqual({ ...notes[1].martyria }, { note: "midVou", genus: "none", ticks: 0 });
  });

  await t.test("keeps reporting the name alongside the symbols", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].name, "Pa", "the name is still part of the reading");
    assert.equal(notes[0].martyria.note, "midPa");
  });

  await t.test("reports the same symbols in either notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const generic = h.app.readScaleData().filter((item) => item.type === "note")[0];
    setNotation(h, "byzantine");
    const byzantine = h.app.readScaleData().filter((item) => item.type === "note")[0];

    assert.deepEqual({ ...byzantine.martyria }, { ...generic.martyria });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/notation.test.js`
Expected: FAIL — `expected undefined to equal ''` on the `fthora` field.

- [ ] **Step 3: Extend `readScaleData` in `app.js`**

In the note branch (app.js:288-301), add the symbols to the pushed item:

```js
    if (row.classList.contains("note-row")) {
      degree++;
      const absInp = row.querySelector(".absolute-interval");
      const nameEl = row.querySelector(".note-name");
      const symbols = readNoteSymbols(row);
      raw.push({
        type: "note",
        absVal: absInp ? absInp.value.trim() : "",
      });
      items.push({
        type: "note",
        degree: degree,
        name: nameEl ? nameEl.value.trim() : "",
        fthora: symbols.fthora,
        martyria: symbols.martyria,
      });
    } else {
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/integration/notation.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS. `test/integration/scale-data.test.js` asserts on the shape of these items — if it compares whole objects, it will need the two new fields; update it in this commit and say so.

- [ ] **Step 6: Commit**

```bash
git add app.js test/integration/notation.test.js
git commit -m "[#2] Report each note's fthora and martyria from readScaleData"
```

---

## Task 8: The fthora picker

**Files:**
- Modify: `byzantine-ui.js`
- Modify: `app.js` — the editor click listener (app.js:1119-1146) and `closeAllDropdowns` (app.js:1035-1043)
- Modify: `style.css`
- Create: `test/integration/byzantine-pickers.test.js`
- Modify: `test/helpers/harness.js` — `openWell`, `pickFthora`

**Interfaces:**
- Consumes: `BYZ_FTHORES`, `resolveFthoraGlyph`, `writeFthora`, `readNoteSymbols`.
- Produces (in `byzantine-ui.js`):
  - `makeByzOption({ className, data, glyph, label, disabled }) -> HTMLButtonElement`
  - `buildFthoraPicker(panel, row) -> void`
  - `toggleWellPicker(well) -> void`
  - `closeByzantinePickers() -> void`
  - `handleByzantineClick(e) -> boolean` — `true` when it handled the event
  - `applyByzantineOption(option) -> void`
- Produces (harness): `openWell(h, noteRow, kind)`, `pickFthora(h, noteRow, fthoraId)`.

- [ ] **Step 1: Add the harness helpers**

In `test/helpers/harness.js`, below `pickColor`:

```js
/** Clicks a well and returns its picker panel. `kind` is "fthora" or "martyria". */
function openWell(harness, noteRow, kind) {
  fireClick(harness, noteRow.querySelector(`.${kind}-well`));
  return noteRow.querySelector(`.${kind}-picker`);
}

/** Opens the fthora picker and clicks one of its rows. `""` picks None. */
function pickFthora(harness, noteRow, fthoraId) {
  const panel = openWell(harness, noteRow, "fthora");
  const option = panel.querySelector(`.fthora-option[data-fthora="${fthoraId}"]`);
  if (!option) throw new Error(`No fthora option "${fthoraId}" in the picker`);
  fireClick(harness, option);
}
```

Add both to `module.exports`.

- [ ] **Step 2: Write the failing tests**

Create `test/integration/byzantine-pickers.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  openWell,
  pickFthora,
  fireClick,
} = require("../helpers/harness.js");

function byzantineApp(t) {
  const h = loadApp();
  t.after(() => h.close());
  setNotation(h, "byzantine");
  return h;
}

test("the fthora picker", async (t) => {
  await t.test("opens when the well is clicked and closes when it is clicked again", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "fthora");
    assert.ok(panel.classList.contains("open"), "the panel did not open");

    fireClick(h, row.querySelector(".fthora-well"));
    assert.ok(!panel.classList.contains("open"), "the panel did not close");
  });

  await t.test("lists None first, then all sixteen fthores in block order", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    const ids = [...panel.querySelectorAll(".fthora-option")].map((o) => o.dataset.fthora);
    assert.equal(ids[0], "", "None must come first");
    assert.deepEqual(ids.slice(1), Array.from(h.app.BYZ_FTHORES).map((f) => f.id));
  });

  await t.test("shows each fthora's glyph and its label", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    const option = panel.querySelector('.fthora-option[data-fthora="diatonicPa"]');
    assert.equal(option.querySelector(".byz-glyph").textContent, h.app.resolveFthoraGlyph("diatonicPa"));
    assert.equal(option.querySelector(".byz-label").textContent, h.app.byzFthoraById("diatonicPa").label);
  });

  await t.test("writes the pick to the row and closes the panel", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickFthora(h, row, "diatonicPa");

    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");
    assert.ok(!row.querySelector(".fthora-picker").classList.contains("open"));
    assert.equal(
      row.querySelector(".fthora-well").textContent,
      h.app.resolveFthoraGlyph("diatonicPa"),
      "the well was not repainted"
    );
  });

  await t.test("clears the slot when None is picked", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickFthora(h, row, "diatonicPa");

    pickFthora(h, row, "");

    assert.equal(h.app.readNoteSymbols(row).fthora, "");
    assert.ok(row.querySelector(".fthora-well").classList.contains("is-empty"));
  });

  await t.test("redraws the chart when a fthora is picked", () => {
    const h = byzantineApp(t);
    h.ctx.reset();

    pickFthora(h, noteRows(h)[0], "diatonicPa");

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("keeps only one picker open at a time", () => {
    const h = byzantineApp(t);

    const first = openWell(h, noteRows(h)[0], "fthora");
    const second = openWell(h, noteRows(h)[1], "fthora");

    assert.ok(!first.classList.contains("open"), "the first panel stayed open");
    assert.ok(second.classList.contains("open"));
  });

  await t.test("closes when the colour picker opens, and the other way round", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    fireClick(h, h.el(".interval-row .color-swatch"));

    assert.ok(!panel.classList.contains("open"), "opening a colour dropdown must close the fthora panel");
  });

  await t.test("closes when the user clicks outside the editor", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "fthora");

    fireClick(h, h.document.body);

    assert.ok(!panel.classList.contains("open"));
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: FAIL — the panel never gains the `open` class, because nothing listens for a well click.

- [ ] **Step 4: Build the picker in `byzantine-ui.js`**

Append:

```js
// ---------------------------------------------------------------------------
// Pickers.
//
// Only one picker is open at a time. Opening one goes through app.js's
// closeAllDropdowns(), which is the same machinery the colour picker uses, so
// the two can never be open together.
// ---------------------------------------------------------------------------

/** One clickable row of a picker: a glyph preview and a label. */
function makeByzOption(spec) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "byz-option " + spec.className;
  for (const key of Object.keys(spec.data)) button.dataset[key] = spec.data[key];
  if (spec.disabled) button.disabled = true;

  const glyph = document.createElement("span");
  glyph.className = "byz-glyph";
  glyph.textContent = spec.glyph;

  const label = document.createElement("span");
  label.className = "byz-label";
  label.textContent = spec.label;

  button.appendChild(glyph);
  button.appendChild(label);
  return button;
}

/** One flat list: None, then the sixteen fthores in block order. */
function buildFthoraPicker(panel, row) {
  const current = readNoteSymbols(row).fthora;
  panel.innerHTML = "";
  panel.appendChild(
    makeByzOption({ className: "fthora-option", data: { fthora: "" }, glyph: "", label: "None" })
  );
  for (const fthora of BYZ_FTHORES) {
    const option = makeByzOption({
      className: "fthora-option",
      data: { fthora: fthora.id },
      glyph: resolveFthoraGlyph(fthora.id),
      label: fthora.label,
    });
    if (current === fthora.id) option.classList.add("is-selected");
    panel.appendChild(option);
  }
}

function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(".fthora-picker, .martyria-picker");
  const wasOpen = panel.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;

  const row = well.closest(".note-row");
  buildFthoraPicker(panel, row);
  panel.classList.add("open");
  row.classList.add("picker-open");
}

function closeByzantinePickers() {
  for (const panel of editor.querySelectorAll(".fthora-picker.open, .martyria-picker.open")) {
    panel.classList.remove("open");
    const row = panel.closest(".note-row");
    if (row) row.classList.remove("picker-open");
  }
}

function applyByzantineOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;
  if (option.classList.contains("fthora-option")) {
    writeFthora(row, option.dataset.fthora);
    closeAllDropdowns();
  }
  render();
}

/**
 * Routes a click inside the editor. Returns true when it handled the event, so
 * app.js's listener can stop.
 */
function handleByzantineClick(e) {
  const well = e.target.closest(".fthora-well, .martyria-well");
  if (well) {
    e.stopPropagation();
    toggleWellPicker(well);
    return true;
  }

  const option = e.target.closest(".byz-option");
  if (option) {
    e.stopPropagation();
    if (!option.disabled) applyByzantineOption(option);
    return true;
  }

  // A click on the panel's own chrome must not reach the document listener,
  // which would close it.
  if (e.target.closest(".fthora-picker, .martyria-picker")) {
    e.stopPropagation();
    return true;
  }
  return false;
}
```

`toggleWellPicker` builds the martyria picker in Task 9; for now both wells open a fthora list, which the martyria tests will immediately reject.

- [ ] **Step 5: Route the clicks from `app.js`**

At the very top of the editor click listener (app.js:1119):

```js
editor.addEventListener("click", function (e) {
  if (handleByzantineClick(e)) return;

  const swatch = e.target.closest(".color-swatch");
```

And extend `closeAllDropdowns` so the two picker families close together:

```js
function closeAllDropdowns() {
  const openDropdowns = editor.querySelectorAll(".color-dropdown.open");
  for (const dd of openDropdowns) {
    dd.classList.remove("open");
    const row = dd.closest(".interval-row");
    if (row) row.classList.remove("dropdown-open");
  }
  closeByzantinePickers();
}
```

- [ ] **Step 6: Style the picker in `style.css`**

```css
/* --- Symbol pickers --- */

.fthora-picker,
.martyria-picker {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  margin-top: 7px;
  padding: 6px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    0 14px 38px -10px rgba(30, 20, 10, 0.38);
}

/* The panels are tall, so they scroll. They never flip up: a scrolling panel
   cannot escape the editor. */
.fthora-picker.open {
  display: block;
  max-height: 320px;
  overflow-y: auto;
}

#editor .note-row.picker-open { z-index: 100; }

.byz-option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.3rem 0.5rem;
  border: 0;
  border-radius: 3px;
  background: none;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
}

.byz-option:hover:not(:disabled) { background: var(--paper-fade); }
.byz-option:disabled { opacity: 0.35; cursor: default; }
.byz-option.is-selected { background: var(--paper-fade); font-weight: 600; }

.byz-glyph {
  flex: 0 0 auto;
  width: 2rem;
  font-family: "Neanes", serif;
  font-size: 26px;
  line-height: 1.4;
  text-align: center;
}

.byz-label {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
}
```

- [ ] **Step 7: Run the tests**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: PASS.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS. `test/integration/color-label-sync.test.js` exercises `closeAllDropdowns`; it must stay green.

- [ ] **Step 9: Commit**

```bash
git add byzantine-ui.js app.js style.css test/helpers/harness.js test/integration/byzantine-pickers.test.js
git commit -m "[#2] Add the fthora picker

Opening a picker goes through closeAllDropdowns(), so a symbol picker and a
colour dropdown can never be open at the same time."
```

---

## Task 9: The martyria picker

Two columns over a shared footer. **Notes** on the left, **Genus** on the right, **Done** below. Picking writes the well and re-renders immediately; propagation is Task 10.

**Files:**
- Modify: `byzantine-ui.js`
- Modify: `style.css`
- Modify: `test/integration/byzantine-pickers.test.js`
- Modify: `test/helpers/harness.js` — `pickMartyria`

**Interfaces:**
- Consumes: `BYZ_NOTES`, `BYZ_GENERA`, `GENUS_NONE`, `compatibleGenera`, `otherGenera`, `byzGenusById`, `resolveMartyriaGlyphs`, `ladderPosition`, `isLadderPositionLegal`, `writeMartyria`, `clearMartyria`, `readNoteSymbols`, `makeByzOption`.
- Produces (in `byzantine-ui.js`):
  - `buildMartyriaPicker(panel, row) -> void`
  - `buildNotesColumn(degree, degreeCount, current, showTicks) -> HTMLElement`
  - `buildGenusColumn(current) -> HTMLElement`
  - `noteRowDegree(row) -> number`
  - `degreeCount() -> number`
  - `scaleHasTicks() -> boolean`
- Produces (harness): `pickMartyria(h, noteRow, { note, genus, ticks, done })`.

Markup the picker produces:

```html
<div class="martyria-picker-body">
  <div class="martyria-notes-column">
    <div class="byz-column-title">Notes</div>
    <button class="byz-option martyria-note-option" data-note="" data-ticks="0">…None…</button>
    <div class="byz-group-title">Low</div>
    <button class="byz-option martyria-note-option" data-note="lowZo" data-ticks="0">…</button>
    …
  </div>
  <div class="martyria-genus-column">
    <div class="byz-column-title">Genus</div>
    <button class="byz-option martyria-genus-option" data-genus="none">…None…</button>
    …compatible genera, in the modes table's column order…
    <div class="byz-separator"></div>
    …every other genus, in BYZ_GENERA order…
  </div>
</div>
<div class="martyria-picker-footer">
  <button type="button" class="martyria-done">Done</button>
</div>
```

- [ ] **Step 1: Add the harness helper**

In `test/helpers/harness.js`, below `pickFthora`:

```js
/**
 * Drives the martyria picker: opens it, picks a note and/or a genus, then
 * either presses Done (which propagates the ladder) or closes the panel by
 * clicking the well again (which does not).
 */
function pickMartyria(harness, noteRow, { note, genus, ticks = 0, done = false } = {}) {
  openWell(harness, noteRow, "martyria");

  if (note !== undefined) {
    const selector = `.martyria-note-option[data-note="${note}"][data-ticks="${ticks}"]`;
    const option = noteRow.querySelector(selector);
    if (!option) throw new Error(`No note option "${note}" (ticks ${ticks}) in the picker`);
    if (option.disabled) throw new Error(`Note option "${note}" is disabled for this degree`);
    fireClick(harness, option);
  }

  if (genus !== undefined) {
    // Picking a note rebuilds the panel, so the genus option must be re-queried.
    const option = noteRow.querySelector(`.martyria-genus-option[data-genus="${genus}"]`);
    if (!option) throw new Error(`No genus option "${genus}" in the picker`);
    fireClick(harness, option);
  }

  if (done) fireClick(harness, noteRow.querySelector(".martyria-done"));
  else fireClick(harness, noteRow.querySelector(".martyria-well"));
}
```

Add `pickMartyria` to `module.exports`.

- [ ] **Step 2: Write the failing tests**

Append to `test/integration/byzantine-pickers.test.js` (extend the import list with `pickMartyria` and `setNoteCount`):

```js
test("the martyria picker: the Notes column", async (t) => {
  await t.test("lists None, then the 21 letters in three labelled octave groups", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const ids = [...panel.querySelectorAll(".martyria-note-option")].map((o) => o.dataset.note);
    assert.equal(ids[0], "", "None must come first");
    assert.deepEqual(ids.slice(1), Array.from(h.app.BYZ_NOTES).map((n) => n.id));

    assert.deepEqual(
      [...panel.querySelectorAll(".martyria-notes-column .byz-group-title")].map((el) => el.textContent),
      ["Low", "Middle", "High"]
    );
  });

  await t.test("shows the bare letter and its Greek and Latin name", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const option = panel.querySelector('.martyria-note-option[data-note="midPa"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0),
      "the Notes column previews the letter without a genus"
    );
    assert.equal(option.querySelector(".byz-label").textContent, "Πα Pa");
  });

  await t.test("disables the positions that would not leave room for the whole scale", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    // Degree 2 of 3: one degree below, one above. Legal range is 1 … 26.
    const panel = openWell(h, noteRows(h)[1], "martyria");

    const disabled = (noteId) =>
      panel.querySelector(`.martyria-note-option[data-note="${noteId}"]`).disabled;

    assert.equal(disabled("lowZo"), true, "no predecessor could sit below low Ζω");
    assert.equal(disabled("lowNi"), false);
    assert.equal(disabled("highKe"), false, "high Κε still leaves the tick octave above");
  });

  await t.test("shows the illegal rows rather than hiding them, so the range is visible", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const panel = openWell(h, noteRows(h)[2], "martyria");

    assert.ok(
      panel.querySelector('.martyria-note-option[data-note="lowZo"]'),
      "an illegal row must still be listed"
    );
  });

  await t.test("hides the tick rows until some degree has actually reached them", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(
      panel.querySelector('.martyria-note-option[data-ticks="1"]'),
      null,
      "the tick octave is a consequence of a pick, not an ordinary choice"
    );
  });

  await t.test("shows the tick rows once a degree carries a tick", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[1], "highZo", h.app.GENUS_NONE, 1);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.ok(
      panel.querySelector('.martyria-note-option[data-note="highZo"][data-ticks="1"]'),
      "the ticked rows should be listed now"
    );
    assert.deepEqual(
      [...panel.querySelectorAll(".martyria-notes-column .byz-group-title")].map((el) => el.textContent),
      ["Low", "Middle", "High", "High + octave tick"]
    );
  });

  await t.test("marks the row the well currently holds", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    const selected = panel.querySelectorAll(".martyria-note-option.is-selected");
    assert.equal(selected.length, 1);
    assert.equal(selected[0].dataset.note, "midPa");
  });
});

test("the martyria picker: the Genus column", async (t) => {
  await t.test("is inert until a note is selected", () => {
    const h = byzantineApp(t);
    const panel = openWell(h, noteRows(h)[0], "martyria");

    assert.equal(panel.querySelectorAll(".martyria-genus-option").length, 0);
    assert.ok(panel.querySelector(".martyria-genus-column").classList.contains("is-inert"));
  });

  await t.test("puts None first, then the compatible genera in the modes table's order", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const ids = [...row.querySelectorAll(".martyria-genus-option")].map((o) => o.dataset.genus);
    assert.equal(ids[0], h.app.GENUS_NONE);
    assert.deepEqual(ids.slice(1, 6), h.app.compatibleGenera("midDi"));
  });

  await t.test("separates the compatible genera from the uncommon ones with a rule", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const column = row.querySelector(".martyria-genus-column");
    const children = [...column.children];
    const ruleIndex = children.findIndex((el) => el.classList.contains("byz-separator"));
    assert.ok(ruleIndex > 0, "there is no separator");

    const before = children.slice(0, ruleIndex).filter((el) => el.dataset.genus);
    const after = children.slice(ruleIndex).filter((el) => el.dataset.genus);
    assert.deepEqual(
      before.map((el) => el.dataset.genus).slice(1),
      h.app.compatibleGenera("midDi")
    );
    assert.deepEqual(after.map((el) => el.dataset.genus), h.app.otherGenera("midDi"));
  });

  await t.test("previews every genus composed on the selected letter", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));

    const option = row.querySelector('.martyria-genus-option[data-genus="zygos"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("midDi", "zygos", 0),
      "a genus is only ever seen on a letter, so that is what the row shows"
    );
  });

  await t.test("recomposes the previews when a different letter is picked", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midDi"]'));
    fireClick(h, row.querySelector('.martyria-note-option[data-note="lowDi"]'));

    const option = row.querySelector('.martyria-genus-option[data-genus="delta"]');
    assert.equal(
      option.querySelector(".byz-glyph").textContent,
      h.app.resolveMartyriaGlyphs("lowDi", "delta", 0),
      "the low register takes the Above mark set, so the preview must change"
    );
  });
});

test("picking a martyria", async (t) => {
  await t.test("writes the letter as soon as it is clicked, with no genus", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "none",
      ticks: 0,
    });
  });

  await t.test("keeps the panel open after a pick, so the genus can follow", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");
    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(row.querySelector(".martyria-picker").classList.contains("open"));
  });

  await t.test("adds the genus without disturbing the letter", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    pickMartyria(h, row, { note: "midPa", genus: "alpha" });

    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 0,
    });
    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
  });

  await t.test("keeps the genus when the letter is changed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa", genus: "alpha" });

    pickMartyria(h, row, { note: "midVou" });

    assert.equal(h.app.readNoteSymbols(row).martyria.genus, "alpha");
  });

  await t.test("clears the well when None is picked, without touching the fthora", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    pickMartyria(h, row, { note: "midPa", genus: "alpha" });
    pickFthora(h, row, "diatonicPa");

    pickMartyria(h, row, { note: "" });

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");
  });

  await t.test("ignores a genus click while no letter is selected", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];

    openWell(h, row, "martyria");

    assert.equal(row.querySelector(".martyria-genus-option"), null);
    assert.equal(h.app.readNoteSymbols(row).martyria, null);
  });

  await t.test("redraws the chart on every pick", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");
    h.ctx.reset();

    fireClick(h, row.querySelector('.martyria-note-option[data-note="midPa"]'));

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("closes the panel when Done is pressed", () => {
    const h = byzantineApp(t);
    const row = noteRows(h)[0];
    openWell(h, row, "martyria");

    fireClick(h, row.querySelector(".martyria-done"));

    assert.ok(!row.querySelector(".martyria-picker").classList.contains("open"));
  });

  await t.test("does nothing when a disabled row is clicked", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    const row = noteRows(h)[2];
    const panel = openWell(h, row, "martyria");

    fireClick(h, panel.querySelector('.martyria-note-option[data-note="lowZo"]'));

    assert.equal(h.app.readNoteSymbols(row).martyria, null, "an illegal position must not be written");
    assert.ok(panel.classList.contains("open"), "and the panel stays open");
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: FAIL — the martyria well opens a fthora list, so `.martyria-note-option` matches nothing.

- [ ] **Step 4: Build the martyria picker in `byzantine-ui.js`**

Append:

```js
function degreeCount() {
  return editor.querySelectorAll(".note-row").length;
}

function noteRowDegree(row) {
  return parseInt(row.dataset.degree, 10) || 1;
}

/** True once some degree has been pushed into the tick octave. */
function scaleHasTicks() {
  for (const row of editor.querySelectorAll(".note-row")) {
    if (parseInt(row.dataset.martyriaTicks || "0", 10) > 0) return true;
  }
  return false;
}

function byzColumnTitle(text) {
  const el = document.createElement("div");
  el.className = "byz-column-title";
  el.textContent = text;
  return el;
}

function byzGroupTitle(text) {
  const el = document.createElement("div");
  el.className = "byz-group-title";
  el.textContent = text;
  return el;
}

function buildMartyriaPicker(panel, row) {
  const current = readNoteSymbols(row).martyria;

  panel.innerHTML = "";

  const body = document.createElement("div");
  body.className = "martyria-picker-body";
  body.appendChild(buildNotesColumn(noteRowDegree(row), degreeCount(), current, scaleHasTicks()));
  body.appendChild(buildGenusColumn(current));
  panel.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "martyria-picker-footer";
  const done = document.createElement("button");
  done.type = "button";
  done.className = "martyria-done";
  done.textContent = "Done";
  footer.appendChild(done);
  panel.appendChild(footer);
}

function buildNotesColumn(degree, count, current, showTicks) {
  const column = document.createElement("div");
  column.className = "martyria-notes-column";
  column.appendChild(byzColumnTitle("Notes"));
  column.appendChild(
    makeByzOption({
      className: "martyria-note-option",
      data: { note: "", ticks: "0" },
      glyph: "",
      label: "None",
    })
  );

  const groups = [
    { title: "Low", octave: "low", ticks: 0 },
    { title: "Middle", octave: "mid", ticks: 0 },
    { title: "High", octave: "high", ticks: 0 },
  ];
  // The tick octave is a consequence of a pick, not an ordinary choice, so it
  // is only offered once propagation has actually reached into it.
  if (showTicks) groups.push({ title: "High + octave tick", octave: "high", ticks: 1 });

  for (const group of groups) {
    column.appendChild(byzGroupTitle(group.title));
    for (const note of BYZ_NOTES) {
      if (note.octave !== group.octave) continue;
      const position = ladderPosition(note.id, group.ticks);
      const option = makeByzOption({
        className: "martyria-note-option",
        data: { note: note.id, ticks: String(group.ticks) },
        glyph: resolveMartyriaGlyphs(note.id, GENUS_NONE, group.ticks),
        label: note.greek + " " + note.latin,
        disabled: !isLadderPositionLegal(position, degree, count),
      });
      if (current && current.note === note.id && current.ticks === group.ticks) {
        option.classList.add("is-selected");
      }
      column.appendChild(option);
    }
  }
  return column;
}

function buildGenusColumn(current) {
  const column = document.createElement("div");
  column.className = "martyria-genus-column";
  column.appendChild(byzColumnTitle("Genus"));

  if (!current) {
    column.classList.add("is-inert");
    return column;
  }

  // Every row previews itself on the selected letter, because that is the only
  // form the user will ever see it in. The octave tick is left off: it marks a
  // register, not a genus.
  function genusOption(id, label) {
    const option = makeByzOption({
      className: "martyria-genus-option",
      data: { genus: id },
      glyph: resolveMartyriaGlyphs(current.note, id, 0),
      label: label,
    });
    if (current.genus === id) option.classList.add("is-selected");
    return option;
  }

  column.appendChild(genusOption(GENUS_NONE, "None"));
  for (const id of compatibleGenera(current.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }

  const separator = document.createElement("div");
  separator.className = "byz-separator";
  column.appendChild(separator);

  for (const id of otherGenera(current.note)) {
    column.appendChild(genusOption(id, byzGenusById(id).label));
  }
  return column;
}
```

- [ ] **Step 5: Dispatch on the well kind and handle the new options**

Replace `toggleWellPicker`'s build call:

```js
function toggleWellPicker(well) {
  const panel = well.parentElement.querySelector(".fthora-picker, .martyria-picker");
  const wasOpen = panel.classList.contains("open");
  closeAllDropdowns();
  if (wasOpen) return;

  const row = well.closest(".note-row");
  if (panel.classList.contains("fthora-picker")) buildFthoraPicker(panel, row);
  else buildMartyriaPicker(panel, row);
  panel.classList.add("open");
  row.classList.add("picker-open");
}
```

Extend `applyByzantineOption`:

```js
function applyByzantineOption(option) {
  const row = option.closest(".note-row");
  if (!row) return;

  if (option.classList.contains("fthora-option")) {
    writeFthora(row, option.dataset.fthora);
    closeAllDropdowns();
  } else if (option.classList.contains("martyria-note-option")) {
    if (!option.dataset.note) {
      clearMartyria(row);
    } else {
      const existing = readNoteSymbols(row).martyria;
      writeMartyria(
        row,
        option.dataset.note,
        existing ? existing.genus : GENUS_NONE,
        parseInt(option.dataset.ticks, 10) || 0
      );
    }
    // Rebuild so the genus previews recompose on the new letter.
    buildMartyriaPicker(row.querySelector(".martyria-picker"), row);
  } else if (option.classList.contains("martyria-genus-option")) {
    const existing = readNoteSymbols(row).martyria;
    if (!existing) return;
    writeMartyria(row, existing.note, option.dataset.genus, existing.ticks);
    buildMartyriaPicker(row.querySelector(".martyria-picker"), row);
  }
  render();
}
```

And add the **Done** branch to `handleByzantineClick`, before the `.byz-option` branch:

```js
  const done = e.target.closest(".martyria-done");
  if (done) {
    e.stopPropagation();
    closeAllDropdowns();
    render();
    return true;
  }
```

(Task 10 adds the propagation call here.)

- [ ] **Step 6: Style the two columns in `style.css`**

```css
.martyria-picker.open { display: block; }

.martyria-picker-body {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
}

.martyria-notes-column,
.martyria-genus-column {
  max-height: 300px;
  overflow-y: auto;
  min-width: 9rem;
}

.martyria-genus-column.is-inert { opacity: 0.45; }

.byz-column-title {
  position: sticky;
  top: 0;
  padding: 0.25rem 0.5rem;
  background: var(--paper);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.byz-group-title {
  padding: 0.35rem 0.5rem 0.15rem;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.byz-separator {
  height: 1px;
  margin: 0.4rem 0.5rem;
  background: var(--rule);
}

.martyria-picker-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--rule);
}

.martyria-done {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  background: var(--paper-fade);
  color: var(--ink);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.8rem;
  cursor: pointer;
}

.martyria-done:hover { border-color: var(--ink); }
```

- [ ] **Step 7: Run the tests**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: PASS.

- [ ] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add byzantine-ui.js style.css test/helpers/harness.js test/integration/byzantine-pickers.test.js
git commit -m "[#2] Add the martyria picker

Notes on the left, Genus on the right. The genus rows preview themselves
composed on the selected letter, because that is the only form they are
ever seen in."
```

---

## Task 10: Ladder propagation

A scale runs through consecutive letters, so setting one degree sets them all. **Done** propagates; adding a note continues the ladder.

**Files:**
- Modify: `byzantine-ui.js`
- Modify: `app.js` — `addNote` (app.js:236-269)
- Modify: `test/integration/byzantine-pickers.test.js`

**Interfaces:**
- Consumes: `ladderPosition`, `ladderNoteAt`, `readNoteSymbols`, `writeMartyria`, `GENUS_NONE`, `getNotation`.
- Produces (in `byzantine-ui.js`):
  - `propagateMartyriaLadder(sourceRow) -> void`
  - `continueLadderOnNewNote(prevRow, newRow) -> void`

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/byzantine-pickers.test.js`:

```js
test("the ladder", async (t) => {
  function martyriaNotes(h) {
    return noteRows(h).map((row) => {
      const m = h.app.readNoteSymbols(row).martyria;
      return m ? m.note : null;
    });
  }

  await t.test("runs the other degrees through the consecutive letters on Done", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 4);

    pickMartyria(h, noteRows(h)[1], { note: "midNi", done: true });

    assert.deepEqual(martyriaNotes(h), ["midZo", "midNi", "midPa", "midVou"]);
  });

  await t.test("propagates downward as well as upward", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[2], { note: "midPa", done: true });

    assert.deepEqual(martyriaNotes(h), ["lowKe", "midZo", "midPa"]);
  });

  await t.test("does not propagate until Done is pressed", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo" });

    assert.deepEqual(martyriaNotes(h), ["midZo", null, null]);
  });

  await t.test("leaves each degree's own genus alone", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo" });
    pickMartyria(h, noteRows(h)[2], { note: "midPa", genus: "alpha" });

    pickMartyria(h, noteRows(h)[1], { note: "midNi", done: true });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "alpha"],
      "propagation moves letters, never genera"
    );
  });

  await t.test("gives an empty neighbour the letter with no genus", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo", done: true });

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.genus),
      ["zo", "none", "none"]
    );
  });

  await t.test("never touches the fthores", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickFthora(h, noteRows(h)[2], "diatonicPa");

    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    assert.equal(h.app.readNoteSymbols(noteRows(h)[2]).fthora, "diatonicPa");
  });

  await t.test("carries the octave tick into the top register", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);

    pickMartyria(h, noteRows(h)[0], { note: "highKe", done: true });

    assert.deepEqual(martyriaNotes(h), ["highKe", "highZo", "highNi"]);
    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.ticks),
      [0, 1, 1],
      "above high Κε the tick marks the extra octave"
    );
  });

  await t.test("does not propagate when the well is cleared", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 3);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    pickMartyria(h, noteRows(h)[0], { note: "", done: true });

    assert.deepEqual(martyriaNotes(h), [null, "midNi", "midPa"], "only that one well is cleared");
  });
});

test("adding and removing notes in Byzantine notation", async (t) => {
  await t.test("continues the ladder onto the new degree, with no genus", () => {
    const h = byzantineApp(t);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", genus: "zo", done: true });

    fireClick(h, h.document.getElementById("add-note"));

    const added = h.app.readNoteSymbols(noteRows(h).at(-1)).martyria;
    assert.deepEqual({ ...added }, { note: "midPa", genus: "none", ticks: 0 });
  });

  await t.test("leaves the new well empty when the previous degree has no martyria", () => {
    const h = byzantineApp(t);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(h.app.readNoteSymbols(noteRows(h).at(-1)).martyria, null);
  });

  await t.test("leaves the new well empty when the ladder is exhausted", () => {
    const h = byzantineApp(t);
    h.app.writeMartyria(noteRows(h).at(-1), "highKe", h.app.GENUS_NONE, 1);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(
      h.app.readNoteSymbols(noteRows(h).at(-1)).martyria,
      null,
      "there is nothing above high Κε plus a tick"
    );
  });

  await t.test("does not continue the ladder in Generic notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeMartyria(noteRows(h).at(-1), "midZo", h.app.GENUS_NONE, 0);

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(h.app.readNoteSymbols(noteRows(h).at(-1)).martyria, null);
  });

  await t.test("leaves the remaining degrees alone when the last note is removed", () => {
    const h = byzantineApp(t);
    setNoteCount(h, 4);
    pickMartyria(h, noteRows(h)[0], { note: "midZo", done: true });

    fireClick(h, h.document.getElementById("remove-note"));

    assert.deepEqual(
      noteRows(h).map((row) => h.app.readNoteSymbols(row).martyria.note),
      ["midZo", "midNi", "midPa"]
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: FAIL — `Done` closes the panel but the other degrees stay `null`.

- [ ] **Step 3: Add propagation to `byzantine-ui.js`**

Append:

```js
// ---------------------------------------------------------------------------
// The ladder, applied to the editor.
// ---------------------------------------------------------------------------

/**
 * Runs every other degree through the consecutive letters around `sourceRow`.
 * Each degree keeps whatever genus it had; a degree that had none gets the
 * sentinel. Fthores are never touched.
 */
function propagateMartyriaLadder(sourceRow) {
  if (!sourceRow) return;
  const rows = Array.from(editor.querySelectorAll(".note-row"));
  const sourceIndex = rows.indexOf(sourceRow);
  const source = readNoteSymbols(sourceRow).martyria;
  if (sourceIndex < 0 || !source) return;

  const base = ladderPosition(source.note, source.ticks);
  for (let j = 0; j < rows.length; j++) {
    if (j === sourceIndex) continue;
    const target = ladderNoteAt(base + (j - sourceIndex));
    if (!target) continue; // off the ladder — leave that well as it is
    const existing = readNoteSymbols(rows[j]).martyria;
    writeMartyria(rows[j], target.noteId, existing ? existing.genus : GENUS_NONE, target.ticks);
  }
}

/** A new degree continues the ladder: previous position + 1, no genus. */
function continueLadderOnNewNote(prevRow, newRow) {
  if (!prevRow || !newRow) return;
  const previous = readNoteSymbols(prevRow).martyria;
  if (!previous) return;
  const next = ladderNoteAt(ladderPosition(previous.note, previous.ticks) + 1);
  if (!next) return;
  writeMartyria(newRow, next.noteId, GENUS_NONE, next.ticks);
}
```

- [ ] **Step 4: Propagate from Done**

In `handleByzantineClick`, replace the Done branch:

```js
  const done = e.target.closest(".martyria-done");
  if (done) {
    e.stopPropagation();
    const row = done.closest(".note-row");
    closeAllDropdowns();
    propagateMartyriaLadder(row);
    render();
    return true;
  }
```

- [ ] **Step 5: Continue the ladder from `addNote` in `app.js`**

In `addNote`, capture the previous note row before appending and continue the ladder after:

```js
function addNote() {
  const mode = getScaleMode();
  const degree = getDegreeCount() + 1;
  const defaultVal = getDefaultIntervalValue();
  const prevNoteRow = editor.querySelector(".note-row:last-of-type");

  // … existing row construction and appends …

  if (getNotation() === "byzantine") continueLadderOnNewNote(prevNoteRow, noteRow);

  const key = getIntervalRowKey(intervalRow);
  // … the rest is unchanged …
}
```

`editor.querySelector(".note-row:last-of-type")` is read **before** the new rows are appended, so it is the previous last degree.

- [ ] **Step 6: Run the tests**

Run: `node --test test/integration/byzantine-pickers.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add byzantine-ui.js app.js test/integration/byzantine-pickers.test.js
git commit -m "[#2] Propagate the note ladder across the scale

Done runs every other degree through the consecutive letters; each keeps
its own genus. A new degree continues the ladder with no genus."
```

---

## Task 11: Ink measurement — `inkBox`, `drawGlyphs`, and the stub's ink model

A martyria's ink sits well above the baseline in Neanes and below it in other SBMuFL faces, and a fthora sits around −0.65 … −1.1 em because the font expects it over a neume. A constant offset would break on a font swap, so both signs are placed from measured ink. This task delivers the two helpers and teaches the canvas stub to model ink the way a real font does.

**Files:**
- Modify: `byzantine.js`
- Modify: `test/helpers/canvas-stub.js`
- Modify: `test/helpers/harness.js` — re-export `measureTextInk`
- Modify: `test/unit/byzantine-symbols.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces (in `byzantine.js`):
  - `BYZ_FONT_SIZE = 40`
  - `byzantineFont(size) -> string` — e.g. `'40px "Neanes", serif'`
  - `inkBox(ctx, text, font) -> { adv, left, right, top, bottom }` — the ink's extent relative to the pen origin, with `y` growing downward, so `top` is normally negative. Sets and restores `ctx.font`.
  - `drawGlyphs(ctx, text, x, y, { align, vAlign }) -> void` — `align` is `"left" | "center" | "right"`, `vAlign` is `"top" | "middle" | "bottom"`; both default to `"left"` / `"middle"`. Uses `ctx.font` as the caller set it. Draws nothing for an empty string.
- Produces (test helpers): `measureTextInk(text, font)` and the model's ratio constants, re-exported from `harness.js`.

### The model

`measureText` keeps `width = advance sum` and gains the four `actualBoundingBox*` fields. The model has the same *shape* as a real SBMuFL font, so a test can catch "forgot the mark does not advance the pen":

| rule | value |
|---|---|
| advance, ordinary glyph | `size × 0.6` |
| advance, a genus mark (`U+E150`–`U+E17B`) | **0** |
| ink left side bearing | `size × 0.05` |
| ink width per glyph | `size × 0.6` |
| ascent | `size × 0.75` |
| ascent when an `…Above` mark (`U+E170`–`U+E17B`) is present | `size × 1.15` |
| descent | `size × 0.2` |
| descent when a `…Below` mark (`U+E150`–`U+E15B`) is present | `size × 0.6` |

Like the existing 0.6 ratio this is a documented model, not real metrics. Tests compute expected values from `measureTextInk` rather than hard-coding numbers.

- [ ] **Step 1: Grow the canvas stub's measurement model**

In `test/helpers/canvas-stub.js`, replace the `CHAR_WIDTH_RATIO`/`measureTextWidth` block with:

```js
const CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_FONT_SIZE = 10;

// The ink model. A genus mark has no advance, an …Above mark raises the
// modelled ascent and a …Below mark deepens the descent, so the stub has the
// same shape as a real SBMuFL font. See docs/TESTING.md §5.
const INK_LEFT_BEARING_RATIO = 0.05;
const INK_WIDTH_RATIO = 0.6;
const ASCENT_RATIO = 0.75;
const DESCENT_RATIO = 0.2;
const MARK_ABOVE_ASCENT_RATIO = 1.15;
const MARK_BELOW_DESCENT_RATIO = 0.6;

const MARK_BELOW_FIRST = 0xe150;
const MARK_BELOW_LAST = 0xe15b;
const MARK_ABOVE_FIRST = 0xe170;
const MARK_ABOVE_LAST = 0xe17b;

function isZeroAdvance(code) {
  return code >= MARK_BELOW_FIRST && code <= MARK_ABOVE_LAST;
}

function fontSizeOf(font) {
  const size = parseFloat(font);
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_FONT_SIZE;
}

/** The full measurement model, exposed so tests can predict layout maths. */
function measureTextInk(text, font) {
  const size = fontSizeOf(font);
  const chars = [...String(text)];

  let pen = 0;
  let right = 0;
  let ascent = size * ASCENT_RATIO;
  let descent = size * DESCENT_RATIO;

  for (const ch of chars) {
    const code = ch.codePointAt(0);
    right = Math.max(right, pen + size * (INK_LEFT_BEARING_RATIO + INK_WIDTH_RATIO));
    if (code >= MARK_ABOVE_FIRST && code <= MARK_ABOVE_LAST) {
      ascent = Math.max(ascent, size * MARK_ABOVE_ASCENT_RATIO);
    } else if (code >= MARK_BELOW_FIRST && code <= MARK_BELOW_LAST) {
      descent = Math.max(descent, size * MARK_BELOW_DESCENT_RATIO);
    }
    if (!isZeroAdvance(code)) pen += size * CHAR_WIDTH_RATIO;
  }

  return {
    width: pen,
    actualBoundingBoxLeft: chars.length ? -size * INK_LEFT_BEARING_RATIO : 0,
    actualBoundingBoxRight: right,
    actualBoundingBoxAscent: chars.length ? ascent : 0,
    actualBoundingBoxDescent: chars.length ? descent : 0,
  };
}

/** Advance width only — what the app's non-Byzantine measurement uses. */
function measureTextWidth(text, font) {
  return measureTextInk(text, font).width;
}
```

Change `RecordingContext2D.measureText` to `return measureTextInk(text, this.font);` and add `measureTextInk` and the ratio constants to the module's exports.

Re-export `measureTextInk` from `test/helpers/harness.js` (it already re-exports `measureTextWidth`).

- [ ] **Step 2: Write the failing tests**

Append to `test/unit/byzantine-symbols.test.js` (add `measureTextInk` to the harness import):

```js
test("the ink model in the canvas stub", async (t) => {
  await t.test("gives a genus mark no advance, so it lands on the letter", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    const letter = measureTextInk("\uE139", font);
    const composed = measureTextInk("\uE139\uE152", font);

    assert.equal(composed.width, letter.width, "the mark must not move the pen");
  });

  await t.test("gives the octave tick a normal advance, because it is a spacing glyph", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    assert.ok(
      measureTextInk("\uE144\uE145", font).width > measureTextInk("\uE144", font).width,
      "martyriaTick is not a mark"
    );
  });

  await t.test("raises the ascent for an Above mark and deepens the descent for a Below one", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = '40px "Neanes"';

    const plain = measureTextInk("\uE139", font);
    const above = measureTextInk("\uE130\uE174", font);
    const below = measureTextInk("\uE139\uE152", font);

    assert.ok(above.actualBoundingBoxAscent > plain.actualBoundingBoxAscent);
    assert.ok(below.actualBoundingBoxDescent > plain.actualBoundingBoxDescent);
  });
});

test("measuring a glyph string's ink", async (t) => {
  await t.test("reports the ink's extent relative to the pen, not the advance", () => {
    const h = loadApp();
    t.after(() => h.close());
    const font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    const text = h.app.resolveMartyriaGlyphs("midPa", "alpha", 0);

    const box = h.app.inkBox(h.ctx, text, font);
    const metrics = measureTextInk(text, font);

    closeTo(box.adv, metrics.width, 1e-9, "adv is the advance");
    closeTo(box.left, -metrics.actualBoundingBoxLeft, 1e-9, "left is the ink's left edge");
    closeTo(box.right, metrics.actualBoundingBoxRight, 1e-9);
    closeTo(box.top, -metrics.actualBoundingBoxAscent, 1e-9, "y grows downward, so top is negative");
    closeTo(box.bottom, metrics.actualBoundingBoxDescent, 1e-9);
  });

  await t.test("leaves the context's font as it found it", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.font = "24px sans-serif";

    h.app.inkBox(h.ctx, "\uE139\uE152", '40px "Neanes"');

    assert.equal(h.ctx.font, "24px sans-serif", "measuring must not leak a font change");
  });
});

test("drawing ink-anchored glyphs", async (t) => {
  function drawn(h, text, x, y, options) {
    h.ctx.reset();
    h.ctx.font = h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
    h.app.drawGlyphs(h.ctx, text, x, y, options);
    const [call] = h.ctx.callsOf("fillText");
    return { call, box: h.app.inkBox(h.ctx, text, h.ctx.font) };
  }

  await t.test("puts the ink's left edge on x when asked to align left", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "\uE139\uE152", 100, 50, { align: "left", vAlign: "middle" });

    closeTo(call.args[1] + box.left, 100, 1e-9, "ink left edge");
  });

  await t.test("puts the ink's right edge on x when asked to align right", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "\uE1D1", 100, 50, { align: "right", vAlign: "middle" });

    closeTo(call.args[1] + box.right, 100, 1e-9, "ink right edge");
  });

  await t.test("centres the ink horizontally when asked", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "\uE139\uE152", 100, 50, { align: "center", vAlign: "middle" });

    closeTo(call.args[1] + (box.left + box.right) / 2, 100, 1e-9, "ink centre");
  });

  await t.test("centres the ink vertically on y, measured, not guessed", () => {
    const h = loadApp();
    t.after(() => h.close());
    const { call, box } = drawn(h, "\uE130\uE174", 100, 50, { align: "left", vAlign: "middle" });

    closeTo(call.args[2] + (box.top + box.bottom) / 2, 50, 1e-9, "ink vertical centre");
  });

  await t.test("puts the ink's top or bottom edge on y when asked", () => {
    const h = loadApp();
    t.after(() => h.close());

    const top = drawn(h, "\uE139\uE152", 100, 50, { align: "center", vAlign: "top" });
    closeTo(top.call.args[2] + top.box.top, 50, 1e-9, "ink top edge");

    const bottom = drawn(h, "\uE139\uE152", 100, 50, { align: "center", vAlign: "bottom" });
    closeTo(bottom.call.args[2] + bottom.box.bottom, 50, 1e-9, "ink bottom edge");
  });

  await t.test("draws from a neutral alignment, so the caller's anchoring is the only one", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.textAlign = "center";
    h.ctx.textBaseline = "top";
    const { call } = drawn(h, "\uE139", 100, 50, { align: "left", vAlign: "middle" });

    assert.equal(call.state.textAlign, "left");
    assert.equal(call.state.textBaseline, "alphabetic");
  });

  await t.test("draws nothing for an empty string", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    h.app.drawGlyphs(h.ctx, "", 100, 50, { align: "left", vAlign: "middle" });

    assert.equal(h.ctx.callsOf("fillText").length, 0);
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: FAIL — `h.app.inkBox is not a function`. (The ink-model tests should already pass, since Step 1 built the stub; if they do not, fix the stub before continuing.)

- [ ] **Step 4: Add the helpers to `byzantine.js`**

Append:

```js
// ---------------------------------------------------------------------------
// Ink-anchored text.
//
// A martyria's ink sits well above the baseline in Neanes and below it in
// other SBMuFL faces, and a fthora sits around -0.65 … -1.1 em because the
// font expects it over a neume. A constant offset would break on a font swap,
// so both signs are placed from measured ink, on both axes, always.
// ---------------------------------------------------------------------------

const BYZ_FONT_SIZE = 40;

function byzantineFont(size) {
  return (size || BYZ_FONT_SIZE) + 'px "Neanes", serif';
}

/**
 * The ink's extent relative to the pen origin, with y growing downward — so
 * `top` is normally negative. `adv` is the advance width, which for a martyria
 * is narrower than the ink because the genus mark has no advance.
 */
function inkBox(ctx, text, font) {
  const previousFont = ctx.font;
  if (font) ctx.font = font;
  const metrics = ctx.measureText(text);
  ctx.font = previousFont;

  return {
    adv: metrics.width,
    left: -(metrics.actualBoundingBoxLeft || 0),
    right: metrics.actualBoundingBoxRight === undefined ? metrics.width : metrics.actualBoundingBoxRight,
    top: -(metrics.actualBoundingBoxAscent || 0),
    bottom: metrics.actualBoundingBoxDescent || 0,
  };
}

/**
 * Draws `text` so that its *ink* lands on (x, y) as asked, rather than its
 * baseline and pen origin. Uses ctx.font as the caller set it.
 */
function drawGlyphs(ctx, text, x, y, options) {
  if (!text) return;
  const align = (options && options.align) || "left";
  const vAlign = (options && options.vAlign) || "middle";
  const box = inkBox(ctx, text, ctx.font);

  let penX = x - box.left;
  if (align === "right") penX = x - box.right;
  else if (align === "center") penX = x - (box.left + box.right) / 2;

  let penY = y - (box.top + box.bottom) / 2;
  if (vAlign === "top") penY = y - box.top;
  else if (vAlign === "bottom") penY = y - box.bottom;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, penX, penY);
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/unit/byzantine-symbols.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. `measureText` now returns extra fields; nothing in `app.js` reads them yet, and `measureTextWidth` is unchanged for text with no marks, so the existing render tests must stay green. If one goes red, the model changed behaviour for ordinary text — fix the model, not the test.

- [ ] **Step 7: Commit**

```bash
git add byzantine.js test/helpers/canvas-stub.js test/helpers/harness.js test/unit/byzantine-symbols.test.js
git commit -m "[#2] Measure and draw glyphs by their ink, not their baseline

The canvas stub grows a matching ink model: zero-advance genus marks, and
an ascent/descent that responds to Above and Below marks."
```

---

## Task 12: The chart in vertical orientation

The rule is a substitution: **wherever the chart draws a note name today, Byzantine notation draws the martyria instead**, and the fthora gets a new gutter on the other side of the boxes. This task does the vertical orientation, in both chart styles.

**Files:**
- Modify: `app.js` — `render()` (app.js:526-765) and `drawLinesVertical` (app.js:457-524)
- Modify: `test/integration/render.test.js`

**Interfaces:**
- Consumes: `martyria`/`fthora` on the note items (Task 7); `inkBox`, `drawGlyphs`, `byzantineFont`, `BYZ_FONT_SIZE` (Task 11); `resolveMartyriaGlyphs`, `resolveFthoraGlyph` (Task 3).
- Produces (in `app.js`):
  - `NOTE_TEXT_HEIGHT = 28` — the note-text band the horizontal charts already reserve, extracted from the two literals.
  - `martyriaTextOf(noteItem) -> string`, `fthoraTextOf(noteItem) -> string`
  - `maxInkExtent(texts, font) -> { width, height }`
  - `drawByzantineMark(text, x, y, align, vAlign) -> void`
  - `drawNoteLabel(text, x, y, spec) -> void` — one call site shape for both notations
  - Each interval in `render()` gains `fthoraBelow` and `fthoraAbove`; `noteBelow`/`noteAbove` hold the martyria glyphs in Byzantine notation.
  - `drawLinesVertical(intervals, stackLength, maxIntervalTextWidth, font, monoFont, byz)` — `byz` is `{ on, font, gutter, anchor }`.

### The geometry

| quantity | Generic | Byzantine |
|---|---|---|
| `fthoraGutter` | `0` | `maxFthoraInkWidth + TEXT_MARGIN`, or `0` when no fthora is set |
| boxes' left edge (`baseX`) | `CANVAS_PADDING` | `CANVAS_PADDING + fthoraGutter` |
| line chart's axis centre | `CANVAS_PADDING + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH / 2` | the same, plus `fthoraGutter` |
| note text | name, `textAlign: "left"`, `textBaseline: "middle"`, at `textX` | martyria, ink left edge at `textX`, ink centred vertically on the separator's `y` |
| fthora | — | ink right edge at `CANVAS_PADDING + fthoraGutter − TEXT_MARGIN`, ink centred vertically on the separator's `y` |
| `displayWidth` | as today | as today, plus `fthoraGutter` |

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/render.test.js` (extend the imports with `setNotation`, `pickMartyria`, `pickFthora`, `noteRows` and `measureTextInk`):

```js
// --- Byzantine notation -----------------------------------------------------

function byzantineChart(t, symbols, options = {}) {
  const h = loadApp();
  t.after(() => h.close());
  setNotation(h, "byzantine");
  buildRelativeScale(h, options.intervals || ["9/8"]);

  noteRows(h).forEach((row, i) => {
    const spec = symbols[i];
    if (!spec) return;
    if (spec.note) pickMartyria(h, row, { note: spec.note, genus: spec.genus, ticks: spec.ticks || 0 });
    if (spec.fthora) pickFthora(h, row, spec.fthora);
  });

  if (options.style) selectOption(h, "chart-style", options.style);
  if (options.orientation) selectOption(h, "orientation", options.orientation);
  h.ctx.reset();
  h.app.render();
  return h;
}

/** The martyria glyph string the chart should be drawing for one degree. */
function martyriaOf(h, spec) {
  return h.app.resolveMartyriaGlyphs(spec.note, spec.genus || h.app.GENUS_NONE, spec.ticks || 0);
}

function byzFontOf(h) {
  return h.app.byzantineFont(h.app.BYZ_FONT_SIZE);
}

function inkWidth(h, text) {
  const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
  return box.right - box.left;
}

function drawnCall(h, text) {
  const call = h.ctx.callsOf("fillText").find((c) => c.args[0] === text);
  assert.ok(call, `"${text}" was never drawn; drawn: ${JSON.stringify(h.ctx.drawnText())}`);
  return call;
}

test("Byzantine notation, vertical boxes", async (t) => {
  const PA = { note: "midPa", genus: "alpha" };
  const VOU = { note: "midVou", genus: "legetos" };

  await t.test("draws a martyria for each degree instead of a note name", () => {
    const h = byzantineChart(t, [PA, VOU]);

    const text = h.ctx.drawnText();
    assert.ok(text.includes(martyriaOf(h, PA)), "the first martyria is missing");
    assert.ok(text.includes(martyriaOf(h, VOU)), "the second martyria is missing");
  });

  await t.test("draws nothing for a degree whose wells are empty", () => {
    const h = byzantineChart(t, [PA, {}]);

    assert.deepEqual(
      h.ctx.drawnText().filter((s) => s.charCodeAt(0) >= 0xe000),
      [martyriaOf(h, PA)],
      "an empty well draws nothing, exactly as an empty name does"
    );
  });

  await t.test("ignores the typed note names, which belong to Generic notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.el(".note-name"), "Pa");
    setNotation(h, "byzantine");
    h.ctx.reset();
    h.app.render();

    assert.ok(!h.ctx.drawnText().includes("Pa"), "the name must not be drawn in Byzantine notation");
  });

  await t.test("draws the martyria in Neanes at the Byzantine size", () => {
    const h = byzantineChart(t, [PA, VOU]);

    assert.equal(drawnCall(h, martyriaOf(h, PA)).state.font, byzFontOf(h));
  });

  await t.test("puts the martyria's ink left edge where the note name starts", () => {
    const h = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(
      call.args[1] + box.left,
      CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN,
      1e-6,
      "ink left edge, no fthora so no gutter"
    );
  });

  await t.test("centres the martyria's ink on the separator, not its baseline", () => {
    const h = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const separatorY = CANVAS_PADDING + TONE; // degree 1 sits at the base of the stack

    closeTo(call.args[2] + (box.top + box.bottom) / 2, separatorY, 1e-6, "ink vertical centre");
  });

  await t.test("opens a left gutter for the fthora and shifts the boxes into it", () => {
    const withFthora = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);
    const without = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = withFthora.app;

    const gutter = inkWidth(withFthora, withFthora.app.resolveFthoraGlyph("diatonicPa")) + TEXT_MARGIN;

    closeTo(
      withFthora.ctx.callsOf("fillRect")[0].args[0],
      CANVAS_PADDING + gutter,
      1e-6,
      "the boxes start clear of the gutter"
    );
    closeTo(
      parseFloat(withFthora.canvas().style.width) - parseFloat(without.canvas().style.width),
      gutter,
      1e-6,
      "the canvas grew by exactly the gutter"
    );
  });

  await t.test("right-aligns the fthora's ink a text margin clear of the boxes", () => {
    const h = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = inkWidth(h, text) + TEXT_MARGIN;

    closeTo(
      call.args[1] + box.right,
      CANVAS_PADDING + gutter - TEXT_MARGIN,
      1e-6,
      "ink right edge"
    );
  });

  await t.test("centres the fthora's ink on the same separator as its martyria", () => {
    const h = byzantineChart(t, [{ ...PA, fthora: "diatonicPa" }, VOU]);

    const martyria = drawnCall(h, martyriaOf(h, PA));
    const martyriaBox = h.app.inkBox(h.ctx, martyriaOf(h, PA), byzFontOf(h));
    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthora = drawnCall(h, fthoraText);
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));

    closeTo(
      fthora.args[2] + (fthoraBox.top + fthoraBox.bottom) / 2,
      martyria.args[2] + (martyriaBox.top + martyriaBox.bottom) / 2,
      1e-6,
      "the two signs sit on the same line"
    );
  });

  await t.test("opens no gutter when no degree carries a fthora", () => {
    const h = byzantineChart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    closeTo(h.ctx.callsOf("fillRect")[0].args[0], CANVAS_PADDING, 1e-9);
  });

  await t.test("sizes the canvas from the widest martyria", () => {
    const narrow = byzantineChart(t, [{ note: "midPa" }, { note: "midVou" }]);
    const wide = byzantineChart(t, [{ note: "midPa", genus: "alpha", ticks: 0 }, { note: "highKe", ticks: 1 }]);

    assert.ok(
      parseFloat(wide.canvas().style.width) > parseFloat(narrow.canvas().style.width),
      "the ticked martyria is wider, so the canvas must grow"
    );
  });

  await t.test("leaves the box geometry, colours and interval labels untouched", () => {
    const h = byzantineChart(t, [PA, VOU], { intervals: ["9/8", "10/9"] });

    const heights = h.ctx.callsOf("fillRect").map((c) => c.args[3]);
    closeTo(heights[0], TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(heights[1], MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
    assert.ok(h.ctx.drawnText().includes("9/8"), "the interval value is still drawn");
  });
});

test("Byzantine notation, vertical lines", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  await t.test("draws the martyria where the note name goes, right of the axis", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines" });
    const { CANVAS_PADDING, TEXT_MARGIN, TICK_LENGTH } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    const gutter = inkWidth(h, h.app.resolveFthoraGlyph("diatonicPa")) + TEXT_MARGIN;
    const maxIntervalTextWidth = measureTextWidth("9/8", '21px "SF Mono", monospace');
    const axisCenterX = CANVAS_PADDING + gutter + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH / 2;

    closeTo(
      call.args[1] + box.left,
      axisCenterX + TICK_LENGTH / 2 + TEXT_MARGIN,
      1e-6,
      "ink left edge, clear of the tick"
    );
  });

  await t.test("shifts the axis right by the fthora gutter", () => {
    const withFthora = byzantineChart(t, [PA, VOU], { style: "lines" });
    const without = byzantineChart(t, [{ note: "midPa", genus: "alpha" }, VOU], { style: "lines" });
    const gutter =
      inkWidth(withFthora, withFthora.app.resolveFthoraGlyph("diatonicPa")) + withFthora.app.TEXT_MARGIN;

    const axisOf = (h) =>
      h.ctx.calls.find((c) => c.method === "moveTo" && c.state.lineWidth === h.app.LINE_STYLE_WIDTH).args[0];

    closeTo(axisOf(withFthora) - axisOf(without), gutter, 1e-6);
  });

  await t.test("right-aligns the fthora's ink at the edge of the gutter", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines" });
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(call.args[1] + box.right, CANVAS_PADDING + inkWidth(h, text), 1e-6, "ink right edge");
  });

  await t.test("still draws one coloured segment per interval and a tick per note", () => {
    const h = byzantineChart(t, [PA, VOU], { style: "lines", intervals: ["9/8", "10/9"] });

    const segments = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.LINE_STYLE_WIDTH);
    const ticks = h.ctx.callsOf("stroke").filter((c) => c.state.lineWidth === h.app.TICK_WIDTH);
    assert.equal(segments.length, 2);
    assert.equal(ticks.length, 3);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/render.test.js`
Expected: FAIL — `"…" was never drawn`; `render()` still draws the (empty) note names.

- [ ] **Step 3: Add the text helpers to `app.js`**

Beside the other constants (after app.js:39):

```js
const NOTE_TEXT_HEIGHT = 28;
```

and replace the two `28` literals in the display-size formulas with it, in this same commit.

Beside `intervalToDisplayString` (after app.js:388):

```js
function martyriaTextOf(noteItem) {
  const m = noteItem.martyria;
  return m ? resolveMartyriaGlyphs(m.note, m.genus, m.ticks) : "";
}

function fthoraTextOf(noteItem) {
  return noteItem.fthora ? resolveFthoraGlyph(noteItem.fthora) : "";
}

/** The widest and tallest ink among `texts`, ignoring the empty ones. */
function maxInkExtent(texts, font) {
  let width = 0;
  let height = 0;
  for (const text of texts) {
    if (!text) continue;
    const box = inkBox(ctx, text, font);
    width = Math.max(width, box.right - box.left);
    height = Math.max(height, box.bottom - box.top);
  }
  return { width: width, height: height };
}

function drawByzantineMark(text, x, y, align, vAlign) {
  if (!text) return;
  ctx.font = byzantineFont(BYZ_FONT_SIZE);
  ctx.fillStyle = "#000";
  drawGlyphs(ctx, text, x, y, { align: align, vAlign: vAlign });
}

/**
 * Draws a note's label: a typed name in Generic notation, a martyria in
 * Byzantine. `spec` carries both anchorings so each chart path states its own.
 */
function drawNoteLabel(text, x, y, spec) {
  if (!text) return;
  if (spec.byzantine) {
    drawByzantineMark(text, x, y, spec.align, spec.vAlign);
    return;
  }
  ctx.font = spec.font;
  ctx.fillStyle = "#000";
  ctx.textAlign = spec.textAlign;
  ctx.textBaseline = spec.textBaseline;
  ctx.fillText(text, x, y);
}
```

- [ ] **Step 4: Carry the symbols into the intervals in `render()`**

Just after `const data = readScaleData();`:

```js
  const notation = getNotation();
  const isByzantine = notation === "byzantine";
  const byzFont = byzantineFont(BYZ_FONT_SIZE);
```

and in the `intervals.push({...})` call:

```js
      intervals.push({
        cents: cents,
        label: interval.label,
        displayInterval: interval.displayInterval,
        noteBelow: isByzantine ? martyriaTextOf(note) : note.name,
        noteAbove: nextNote ? (isByzantine ? martyriaTextOf(nextNote) : nextNote.name) : "",
        fthoraBelow: isByzantine ? fthoraTextOf(note) : "",
        fthoraAbove: nextNote && isByzantine ? fthoraTextOf(nextNote) : "",
        color: interval.color || "#FFFFFF",
      });
```

- [ ] **Step 5: Make the measurement pass notation-aware**

Replace the note half of the measurement block (the `maxNoteWidth` loop) with:

```js
  let maxNoteWidth = 0;
  let maxNoteHeight = NOTE_TEXT_HEIGHT;
  let maxFthoraWidth = 0;
  let maxFthoraHeight = 0;

  if (isByzantine) {
    // Measured every render: no measurement taken before the Neanes face
    // resolves is ever cached.
    const notes = maxInkExtent(
      intervals.flatMap((iv) => [iv.noteBelow, iv.noteAbove]),
      byzFont
    );
    maxNoteWidth = notes.width;
    maxNoteHeight = notes.height;

    const fthores = maxInkExtent(
      intervals.flatMap((iv) => [iv.fthoraBelow, iv.fthoraAbove]),
      byzFont
    );
    maxFthoraWidth = fthores.width;
    maxFthoraHeight = fthores.height;
  } else {
    ctx.font = font;
    for (const iv of intervals) {
      if (iv.noteBelow) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteBelow).width);
      if (iv.noteAbove) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteAbove).width);
    }
  }
```

The `maxLabelWidth` / `maxRatioWidth` measurement is unchanged and stays in the UI and monospace fonts.

- [ ] **Step 6: Size and place the gutter**

After `const isLines = chartStyle === "lines";`:

```js
  const fthoraGutter = !isByzantine
    ? 0
    : isHorizontal
      ? (maxFthoraHeight > 0 ? maxFthoraHeight + TEXT_MARGIN : 0)
      : (maxFthoraWidth > 0 ? maxFthoraWidth + TEXT_MARGIN : 0);
  // The fthora's ink is right-aligned (vertical) or bottom-aligned
  // (horizontal) here, a text margin clear of whatever starts after the gutter.
  const fthoraAnchor = CANVAS_PADDING + fthoraGutter - TEXT_MARGIN;
  const noteBandH = isByzantine ? maxNoteHeight : NOTE_TEXT_HEIGHT;
  const byz = { on: isByzantine, font: byzFont, gutter: fthoraGutter, anchor: fthoraAnchor };
```

Add `fthoraGutter` to the **two vertical branches** of the display-size
`if`/`else` chain. The two horizontal branches keep the code they have today;
Task 13 changes them.

```js
  } else if (isLines && !isHorizontal) {
    displayWidth = CANVAS_PADDING + fthoraGutter + maxIntervalTextWidth + TEXT_MARGIN +
      TICK_LENGTH + TEXT_MARGIN + maxNoteWidth + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING * 2 + stackLength;
  }
```

```js
  } else {
    const textAreaWidth = maxTextWidth + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING + fthoraGutter + RECT_WIDTH + TEXT_MARGIN +
      textAreaWidth + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING * 2 + stackLength;
  }
```

- [ ] **Step 7: Draw the two signs in the vertical box path**

In the final `else` branch of `render()`, change the origin and the note drawing:

```js
    const baseX = CANVAS_PADDING + fthoraGutter;
    const baseY = CANVAS_PADDING + stackLength;
    const noteSpec = {
      byzantine: isByzantine,
      font: font,
      align: "left",
      vAlign: "middle",
      textAlign: "left",
      textBaseline: "middle",
    };
```

and replace the two note blocks at the end of the loop:

```js
      if (j === 0) {
        drawNoteLabel(iv.noteBelow, textX, y, noteSpec);
        if (isByzantine) drawByzantineMark(iv.fthoraBelow, fthoraAnchor, y, "right", "middle");
      }
      drawNoteLabel(iv.noteAbove, textX, rectY, noteSpec);
      if (isByzantine) drawByzantineMark(iv.fthoraAbove, fthoraAnchor, rectY, "right", "middle");
```

- [ ] **Step 8: Draw them in the vertical line path**

Give `drawLinesVertical` the extra parameter and shift its axis:

```js
function drawLinesVertical(intervals, stackLength, maxIntervalTextWidth, font, monoFont, byz) {
  const axisCenterX = CANVAS_PADDING + byz.gutter + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH / 2;
```

and replace its two note blocks:

```js
    const noteSpec = {
      byzantine: byz.on,
      font: font,
      align: "left",
      vAlign: "middle",
      textAlign: "left",
      textBaseline: "middle",
    };
    if (j === 0) {
      drawNoteLabel(iv.noteBelow, noteTextX, ly, noteSpec);
      if (byz.on) drawByzantineMark(iv.fthoraBelow, byz.anchor, ly, "right", "middle");
    }
    drawNoteLabel(iv.noteAbove, noteTextX, segTopY, noteSpec);
    if (byz.on) drawByzantineMark(iv.fthoraAbove, byz.anchor, segTopY, "right", "middle");
```

Update the call site: `drawLinesVertical(intervals, stackLength, maxIntervalTextWidth, font, monoFont, byz);`

- [ ] **Step 9: Run the tests**

Run: `node --test test/integration/render.test.js`
Expected: PASS — the vertical Byzantine tests and every existing test.

- [ ] **Step 10: Run the whole suite**

Run: `npm test`
Expected: PASS. The generic paths went through `drawNoteLabel`, so any change in the drawn output is a regression, not a deliberate change.

- [ ] **Step 11: Commit**

```bash
git add app.js test/integration/render.test.js
git commit -m "[#2] Draw the martyria and fthora in the vertical chart

The martyria replaces the note name; the fthora gets a left gutter that
widens the canvas. Both are placed from measured ink, on both axes, so a
font swap does not move them."
```

---

## Task 13: The chart in horizontal orientation

Same substitution, rotated: the martyria goes where the note name goes today, below the boxes, and the fthora gets a new gutter **above** them.

**Files:**
- Modify: `app.js` — `render()`'s horizontal box path and `drawLinesHorizontal` (app.js:389-455)
- Modify: `test/integration/render.test.js`

**Interfaces:**
- Consumes: everything Task 12 produced.
- Produces: `drawLinesHorizontal(intervals, stackLength, maxNoteWidth, intervalTextBlockH, font, monoFont, byz)`.

### The geometry

| quantity | Generic | Byzantine |
|---|---|---|
| `fthoraGutter` | `0` | `maxFthoraInkHeight + TEXT_MARGIN`, or `0` when no fthora is set |
| boxes' top edge (`baseY`) | `CANVAS_PADDING` | `CANVAS_PADDING + fthoraGutter` |
| line chart's axis centre | `CANVAS_PADDING + intervalTextBlockH + TEXT_MARGIN + TICK_LENGTH / 2` | the same, plus `fthoraGutter` |
| note text | name, `textAlign: "center"`, `textBaseline: "top"`, at `textY` | martyria, ink top edge at `textY`, ink centred horizontally on the separator's `x` |
| fthora | — | ink bottom edge at `CANVAS_PADDING + fthoraGutter − TEXT_MARGIN`, ink centred horizontally on the separator's `x` |
| note band height | `NOTE_TEXT_HEIGHT` (28) | the tallest martyria's ink height, or `0` when no martyria is set |
| `displayHeight` | as today | as today, plus `fthoraGutter`, with the note band resized |

- [ ] **Step 1: Write the failing tests**

Append to `test/integration/render.test.js`:

```js
test("Byzantine notation, horizontal boxes", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  function chart(t, symbols) {
    return byzantineChart(t, symbols, { orientation: "horizontal" });
  }

  await t.test("draws each martyria below the boxes, centred on its separator", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(
      call.args[1] + (box.left + box.right) / 2,
      CANVAS_PADDING,
      1e-6,
      "the first separator is the left edge of the first box"
    );
  });

  await t.test("puts the martyria's ink top edge where the note text band starts", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));
    const gutter = fthoraBox.bottom - fthoraBox.top + TEXT_MARGIN;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    closeTo(
      call.args[2] + box.top,
      CANVAS_PADDING + gutter + RECT_WIDTH + TEXT_MARGIN,
      1e-6,
      "ink top edge"
    );
  });

  await t.test("opens a top gutter for the fthora and pushes the boxes down into it", () => {
    const withFthora = chart(t, [PA, VOU]);
    const without = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = withFthora.app;

    const fthoraText = withFthora.app.resolveFthoraGlyph("diatonicPa");
    const box = withFthora.app.inkBox(withFthora.ctx, fthoraText, byzFontOf(withFthora));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(
      withFthora.ctx.callsOf("fillRect")[0].args[1],
      CANVAS_PADDING + gutter,
      1e-6,
      "the boxes start below the gutter"
    );
    closeTo(
      parseFloat(withFthora.canvas().style.height) - parseFloat(without.canvas().style.height),
      gutter,
      1e-6,
      "the canvas grew by exactly the gutter"
    );
  });

  await t.test("bottom-aligns the fthora's ink a text margin clear of the boxes", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(call.args[2] + box.bottom, CANVAS_PADDING + gutter - TEXT_MARGIN, 1e-6, "ink bottom edge");
  });

  await t.test("centres the fthora over the same separator as its martyria", () => {
    const h = chart(t, [PA, VOU]);

    const martyriaText = martyriaOf(h, PA);
    const martyria = drawnCall(h, martyriaText);
    const martyriaBox = h.app.inkBox(h.ctx, martyriaText, byzFontOf(h));
    const fthoraText = h.app.resolveFthoraGlyph("diatonicPa");
    const fthora = drawnCall(h, fthoraText);
    const fthoraBox = h.app.inkBox(h.ctx, fthoraText, byzFontOf(h));

    closeTo(
      fthora.args[1] + (fthoraBox.left + fthoraBox.right) / 2,
      martyria.args[1] + (martyriaBox.left + martyriaBox.right) / 2,
      1e-6,
      "the two signs sit on the same vertical"
    );
  });

  await t.test("sizes the note band from the martyria's ink, not the 28px name band", () => {
    const h = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);
    const { CANVAS_PADDING, RECT_WIDTH, TEXT_MARGIN } = h.app;

    const tallest = Math.max(
      ...[martyriaOf(h, { note: "midPa", genus: "alpha" }), martyriaOf(h, VOU)].map((text) => {
        const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
        return box.bottom - box.top;
      })
    );

    closeTo(
      parseFloat(h.canvas().style.height),
      CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + (tallest + TEXT_MARGIN * 2) + CANVAS_PADDING,
      1e-6
    );
  });

  await t.test("leaves the box geometry untouched", () => {
    const h = byzantineChart(t, [PA, VOU], {
      orientation: "horizontal",
      intervals: ["9/8", "10/9"],
    });

    const widths = h.ctx.callsOf("fillRect").map((c) => c.args[2]);
    closeTo(widths[0], TONE * h.app.PX_PER_CENT, 1e-9);
    closeTo(widths[1], MINOR_TONE * h.app.PX_PER_CENT, 1e-9);
  });
});

test("Byzantine notation, horizontal lines", async (t) => {
  const PA = { note: "midPa", genus: "alpha", fthora: "diatonicPa" };
  const VOU = { note: "midVou", genus: "legetos" };

  function chart(t, symbols) {
    return byzantineChart(t, symbols, { orientation: "horizontal", style: "lines" });
  }

  await t.test("draws the martyria below the tick, centred on the separator", () => {
    const h = chart(t, [PA, VOU]);
    const { TICK_WIDTH } = h.app;

    const text = martyriaOf(h, PA);
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));

    const firstTickX = h.ctx.calls.find(
      (c) => c.method === "moveTo" && c.state.lineWidth === TICK_WIDTH
    ).args[0];

    closeTo(call.args[1] + (box.left + box.right) / 2, firstTickX, 1e-6, "ink centred on the tick");
  });

  await t.test("shifts the axis down by the fthora gutter", () => {
    const withFthora = chart(t, [PA, VOU]);
    const without = chart(t, [{ note: "midPa", genus: "alpha" }, VOU]);

    const box = withFthora.app.inkBox(
      withFthora.ctx,
      withFthora.app.resolveFthoraGlyph("diatonicPa"),
      byzFontOf(withFthora)
    );
    const gutter = box.bottom - box.top + withFthora.app.TEXT_MARGIN;

    const axisOf = (h) =>
      h.ctx.calls.find((c) => c.method === "moveTo" && c.state.lineWidth === h.app.LINE_STYLE_WIDTH).args[1];

    closeTo(axisOf(withFthora) - axisOf(without), gutter, 1e-6);
  });

  await t.test("bottom-aligns the fthora above the axis", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING, TEXT_MARGIN } = h.app;

    const text = h.app.resolveFthoraGlyph("diatonicPa");
    const call = drawnCall(h, text);
    const box = h.app.inkBox(h.ctx, text, byzFontOf(h));
    const gutter = box.bottom - box.top + TEXT_MARGIN;

    closeTo(call.args[2] + box.bottom, CANVAS_PADDING + gutter - TEXT_MARGIN, 1e-6, "ink bottom edge");
  });

  await t.test("makes the side padding half the widest martyria", () => {
    const h = chart(t, [PA, VOU]);
    const { CANVAS_PADDING } = h.app;

    const widest = Math.max(
      ...[martyriaOf(h, PA), martyriaOf(h, VOU)].map((text) => inkWidth(h, text))
    );
    const firstTickX = h.ctx.calls.find(
      (c) => c.method === "moveTo" && c.state.lineWidth === h.app.TICK_WIDTH
    ).args[0];

    closeTo(firstTickX, CANVAS_PADDING + widest / 2, 1e-6, "the axis starts half a martyria in");
  });

  await t.test("draws every martyria exactly once", () => {
    const h = byzantineChart(
      t,
      [PA, VOU, { note: "midGa", genus: "nana" }],
      { orientation: "horizontal", style: "lines", intervals: ["9/8", "10/9"] }
    );

    const text = h.ctx.drawnText();
    for (const spec of [PA, VOU, { note: "midGa", genus: "nana" }]) {
      const glyphs = martyriaOf(h, spec);
      assert.equal(text.filter((s) => s === glyphs).length, 1, `${spec.note} drawn once`);
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `node --test test/integration/render.test.js`
Expected: FAIL — the horizontal paths still draw names and reserve the 28px band.

- [ ] **Step 3: Size the horizontal charts**

In `render()`, add `fthoraGutter` and `noteBandH` to the **two horizontal
branches** of the display-size `if`/`else` chain. The two vertical branches
already took their gutter in Task 12 and are not touched here.

The first branch of the chain:

```js
  if (isLines && isHorizontal) {
    const halfNote = maxNoteWidth / 2;
    displayWidth = CANVAS_PADDING + halfNote + stackLength + halfNote + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING + fthoraGutter + intervalTextBlockH + TEXT_MARGIN +
      TICK_LENGTH + TEXT_MARGIN + noteBandH + CANVAS_PADDING;
  }
```

and the third:

```js
  } else if (isHorizontal) {
    const textAreaHeight = noteBandH + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING * 2 + stackLength + maxTextWidth;
    displayHeight = CANVAS_PADDING + fthoraGutter + RECT_WIDTH + TEXT_MARGIN +
      textAreaHeight + CANVAS_PADDING;
  }
```

- [ ] **Step 4: Draw the two signs in the horizontal box path**

In the `else if (isHorizontal)` branch of `render()`:

```js
    const baseX = CANVAS_PADDING;
    const baseY = CANVAS_PADDING + fthoraGutter;
    const textY = baseY + RECT_WIDTH + TEXT_MARGIN;
    const noteSpec = {
      byzantine: isByzantine,
      font: font,
      align: "center",
      vAlign: "top",
      textAlign: "center",
      textBaseline: "top",
    };
```

and replace the two note blocks at the end of the loop:

```js
      if (j === 0) {
        drawNoteLabel(iv.noteBelow, x, textY, noteSpec);
        if (isByzantine) drawByzantineMark(iv.fthoraBelow, x, fthoraAnchor, "center", "bottom");
      }
      drawNoteLabel(iv.noteAbove, x + w, textY, noteSpec);
      if (isByzantine) drawByzantineMark(iv.fthoraAbove, x + w, fthoraAnchor, "center", "bottom");
```

- [ ] **Step 5: Draw them in the horizontal line path**

Give `drawLinesHorizontal` the extra parameter and shift its axis:

```js
function drawLinesHorizontal(intervals, stackLength, maxNoteWidth, intervalTextBlockH, font, monoFont, byz) {
  const halfNote = maxNoteWidth / 2;
  const axisCenterY = CANVAS_PADDING + byz.gutter + intervalTextBlockH + TEXT_MARGIN + TICK_LENGTH / 2;
```

and replace its two note blocks:

```js
    const noteSpec = {
      byzantine: byz.on,
      font: font,
      align: "center",
      vAlign: "top",
      textAlign: "center",
      textBaseline: "top",
    };
    if (j === 0) {
      drawNoteLabel(iv.noteBelow, lx, noteTextY, noteSpec);
      if (byz.on) drawByzantineMark(iv.fthoraBelow, lx, byz.anchor, "center", "bottom");
    }
    drawNoteLabel(iv.noteAbove, lx + w, noteTextY, noteSpec);
    if (byz.on) drawByzantineMark(iv.fthoraAbove, lx + w, byz.anchor, "center", "bottom");
```

Update the call site: `drawLinesHorizontal(intervals, stackLength, maxNoteWidth, intervalTextBlockH, font, monoFont, byz);`

- [ ] **Step 6: Run the tests**

Run: `node --test test/integration/render.test.js`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app.js test/integration/render.test.js
git commit -m "[#2] Draw the martyria and fthora in the horizontal chart

The fthora gets a top gutter; the note band is sized from the martyria's
ink instead of the fixed 28px name band."
```

---

## Task 14: Waiting for the font

PUA codepoints have **no fallback glyph**. Draw before the face arrives and the chart gets fallback metrics and blank boxes — silently, and an early *Save as PNG* bakes that in. So the app asks for the face at startup and redraws once it resolves.

**Files:**
- Modify: `app.js`
- Modify: `test/helpers/harness.js` — stub `document.fonts`
- Modify: `test/integration/notation.test.js`

**Interfaces:**
- Consumes: `BYZ_FONT_SIZE` (Task 11), `render()`.
- Produces (in `app.js`):
  - `byzFontReady` — a `let`, `false` until the face resolves.
  - `loadByzantineFont() -> Promise | null` — `null` when the environment has no `FontFaceSet`.
- Produces (harness): a `document.fonts` stub recording every `load()` call; `h.fontLoads`; `loadApp({ fonts: false })` boots without a `FontFaceSet` at all.

- [ ] **Step 1: Stub `document.fonts` in the harness**

In `loadApp`, beside the other stubs:

```js
  // --- fonts -------------------------------------------------------------
  // jsdom implements no FontFaceSet. app.js waits on one before its first real
  // paint, because PUA codepoints have no fallback glyph.
  const fontLoads = [];
  if (options.fonts !== false) {
    Object.defineProperty(document, "fonts", {
      value: {
        load(spec) {
          fontLoads.push(spec);
          return Promise.resolve([]);
        },
        ready: Promise.resolve(),
      },
      configurable: true,
    });
  }
```

Add `fontLoads` to the returned harness object, and document the new option beside `devicePixelRatio` in the JSDoc.

- [ ] **Step 2: Write the failing tests**

Append to `test/integration/notation.test.js`:

```js
test("waiting for the Neanes face", async (t) => {
  await t.test("asks the browser for Neanes at the chart's size on startup", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.fontLoads.length, 1, "the font was never requested");
    assert.match(h.fontLoads[0], /^40px "Neanes"$/);
  });

  await t.test("redraws once the face has resolved", async () => {
    const h = loadApp();
    t.after(() => h.close());
    const before = h.ctx.callsOf("fillRect").length;

    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(
      h.ctx.callsOf("fillRect").length > before,
      "the first paint used fallback metrics and was never replaced"
    );
    assert.equal(h.app.byzFontReady, true);
  });

  await t.test("boots without a FontFaceSet, because jsdom and old browsers have none", () => {
    const h = loadApp({ fonts: false });
    t.after(() => h.close());

    assert.deepEqual(h.jsdomErrors, [], "app.js threw when document.fonts was missing");
    assert.equal(h.app.loadByzantineFont(), null);
  });

  await t.test("re-measures on every render, so no pre-font measurement survives", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", h.app.GENUS_NONE, 0);
    h.app.render();
    const narrow = parseFloat(h.canvas().style.width);

    h.app.writeMartyria(noteRows(h)[0], "highKe", "softChromaticDi", 1);
    h.app.render();

    assert.ok(
      parseFloat(h.canvas().style.width) > narrow,
      "a cached measurement would have kept the canvas at its old width"
    );
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `node --test test/integration/notation.test.js`
Expected: FAIL — `h.fontLoads` is empty; nothing ever asked for the font.

- [ ] **Step 4: Load the font from `app.js`**

Beside the other `let`s (after app.js:42):

```js
let byzFontReady = false;
```

Beside `loadByzantineFont`'s neighbours, near `savePNG`:

```js
/**
 * Asks for the Neanes face and redraws once it resolves.
 *
 * PUA codepoints have no fallback glyph, so a chart drawn before the face
 * arrives shows blank boxes and measures with fallback metrics. Guarded,
 * because jsdom (and old browsers) have no FontFaceSet.
 */
function loadByzantineFont() {
  const fonts = document.fonts;
  if (!fonts || typeof fonts.load !== "function") return null;
  return fonts
    .load(BYZ_FONT_SIZE + 'px "Neanes"')
    .then(function () {
      return fonts.ready;
    })
    .then(function () {
      byzFontReady = true;
      render();
    })
    .catch(function () {
      // The face never arrived. The chart keeps drawing with fallback
      // metrics rather than failing; nothing was cached from it.
    });
}
```

And call it in the startup block at the bottom, after the first `render()`:

```js
updateRemoveBtn();
updateZoom();
updateAllLabels();
render();
loadByzantineFont();
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/integration/notation.test.js`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npm test`
Expected: PASS. Every harness now sees one extra `render()` on the next microtask turn; a test that counts draw calls across an `await` may need the count updated — if so, update it in this commit and say so in the message.

- [ ] **Step 7: Commit**

```bash
git add app.js test/helpers/harness.js test/integration/notation.test.js
git commit -m "[#2] Wait for the Neanes face before trusting the chart's metrics

PUA codepoints have no fallback glyph, so a chart drawn before the face
resolves is silently blank. Nothing measured beforehand is cached."
```

---

## Task 15: Documentation

**Files:**
- Modify: `docs/PLAN-01.md`
- Create: `docs/BYZANTINE-SYMBOLS.md`
- Modify: `CLAUDE.md`
- Modify: `docs/TESTING.md`

`README.md` already carries the font NOTICE and needs no change.

`docs/TESTING.md` is not in the spec's §9 list, but §5 of it describes a harness that reads `app.js` by name and a `measureText` that returns only a width. Both statements are now false, so the guide is corrected here rather than left to mislead the next reader.

- [ ] **Step 1: Update `docs/PLAN-01.md`**

It is the source of truth for intended behaviour. Add or amend:

- **File Structure** (line 7) — three scripts instead of one, in load order, with the one-line reason: classic scripts because `file://` has an opaque origin and a module script would be blocked by CORS.
- **HTML Layout** (line 27) — `#notation` at the top of the Settings panel; the two wells and their picker panels on every note row.
- **Data Model** (line 36) — the four `data-*` attributes a note row carries, and the two fields `readScaleData()` adds to each note item (`fthora`, `martyria`).
- **Scale Editor → Note row** (line 56) — every row holds the name input *and* both wells at all times; CSS decides which are visible, so a notation switch discards nothing.
- A new **Notation** section — the two values, that `generic` is the default and unchanged, the logical model vs. the resolvers, and the note ladder with its two boundary rules.
- **Chart Rendering → Text layout** (line 99) — the substitution rule (martyria in place of the note name), the fthora gutter on the opposite side in each orientation, and that both signs are placed from measured ink on both axes.
- **Chart Rendering → Sizing** (line 83) — the fthora gutter's contribution to `displayWidth` (vertical) and `displayHeight` (horizontal), and the note band sized from martyria ink.

- [ ] **Step 2: Write `docs/BYZANTINE-SYMBOLS.md`**

The human's map. Sections, in this order:

1. **What the two signs are** — a fthora is the psaltic accidental, a martyria is the note's name; one goes each side of a separator. Point at `issues/002-byzantine-symbols/MARTYRIA-COMPOSITION.md` for the typography.
2. **The four tables** (`byzantine.js`) — what each is, and the rule that **none of them names a codepoint**: `BYZ_NOTES` (21 letters, array index *is* the ladder position), `BYZ_GENERA` (12, block order, `index` is the block offset), `GENUS_NONE`, `BYZ_FTHORES` (16 standalone), `MARTYRIA_COMPATIBILITY`.
3. **`MARTYRIA_COMPATIBILITY` is hand-maintained.** State plainly that `issues/002-byzantine-symbols/modes-table.html` is not final, and give the procedure to redo the table when it changes:
   - open `modes-table.html`; its columns are Modes I–VIII, varys, then Müstear, Nişabur and Hisar, left to right;
   - read one row (one degree) left to right, writing down each cell's genus id;
   - drop repeats, keeping the **first** occurrence, so the order is the table's column order;
   - the result is that note's array. Nothing else in the codebase changes;
   - `test/unit/byzantine-symbols.test.js` checks every note has a non-empty list of known, non-duplicated genera, and pins `midDi`'s order as a sample. Update that sample if the table's column order changes.
4. **The register rule lives in one function.** `resolveMartyriaGlyphs` chooses the `…Above` mark set for the low register and `…Below` for the middle and high ones, because each letter carries only one anchor (`martyriaTop` vs. `martyriaBottom`). Nothing else may encode that rule. Cite `MARTYRIA-COMPOSITION.md` §5.
5. **The ladder.** Positions 0–27; `ticks` extends upward only, because there is no SBMuFL block above high Κε and none below low Ζω; the two legality inequalities; propagation moves letters only, never genera, never fthores.
6. **Adding a second font.** List exactly what changes: a second `@font-face`, a second pair of resolvers, and the font family passed to `byzantineFont`. The tables, the ladder, the pickers, `readScaleData` and the chart do not. Note that `inkBox`/`drawGlyphs` exist precisely so a face whose ink sits on the other side of the baseline needs no offset tuning.
7. **The ink model in the tests** — a pointer to `test/helpers/canvas-stub.js` and the ratio table, with the reminder that it is a documented model, not real metrics.

- [ ] **Step 3: Update `CLAUDE.md`**

Replace the Conventions bullet:

```
- Keep HTML/CSS/JS in the three root files; don't split into modules.
```

with:

```
- The app is `index.html`, `style.css` and three classic scripts loaded in this
  order: `byzantine.js` (symbol model, no DOM), `byzantine-ui.js` (editor UI for
  Byzantine notation), `app.js` (everything else; it runs at load time, so it
  goes last). **Never convert these to ES modules**: a `<script type="module">`
  is fetched under CORS and a `file://` page has an opaque origin, so modules
  break "open `index.html` in a browser". Classic scripts share one global
  scope, which also means no top-level name may be declared in two of them —
  that is a load-time SyntaxError.
```

Also extend the **Files** list with `byzantine.js`, `byzantine-ui.js`, `fonts/` and `docs/BYZANTINE-SYMBOLS.md`, and add a Notation line to **Architecture** pointing at the new guide.

- [ ] **Step 4: Update `docs/TESTING.md`**

In §5:

- "Reads `app.js` from disk" becomes "reads the `<script src>` tags out of `index.html` and runs each file under its own real filename, then runs one generated epilogue built from the union of their top-level names". Keep the point that any new top-level declaration in **any** of the scripts is testable automatically.
- The stub table gains `document.fonts` (`load()` and `ready` resolve immediately; `loadApp({ fonts: false })` removes it), and the `ctx.measureText` row gains the ink model: zero-advance genus marks, mark-aware ascent and descent, with a pointer to the ratio table in `canvas-stub.js`.
- The harness-helpers table gains `setNotation`, `openWell`, `pickFthora` and `pickMartyria`.

In §4, add the three new test files to the layout tree.

- [ ] **Step 5: Check the docs against the code**

Run: `npm test`
Expected: PASS (no code changed, but the suite is the check that the branch is still green before the documentation commit).

Then re-read each claim you wrote against the file it describes — a doc that names a function that does not exist is worse than no doc.

- [ ] **Step 6: Commit**

```bash
git add docs/PLAN-01.md docs/BYZANTINE-SYMBOLS.md CLAUDE.md docs/TESTING.md
git commit -m "[#2] Document Byzantine notation

docs/BYZANTINE-SYMBOLS.md records where a human edits the compatibility
table and what a second font would touch. TESTING.md is corrected: the
harness now follows index.html's script tags and the canvas stub models ink."
```

---

## Finishing the branch

With all fifteen tasks green:

- [ ] `npm test` — the whole suite, one last time.
- [ ] Open `index.html` from `file://` in a real browser. Switch Notation to Byzantine, set a martyria on one degree, press **Done**, and confirm the ladder ran; set a fthora; check all four orientation × style combinations and *Save as PNG*. This is manual verification, not a test — do not commit any browser-driving script.
- [ ] Then use `superpowers:finishing-a-development-branch` to decide how `feature/byzantine-mode` is integrated.
