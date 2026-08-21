# Handoff: Byzantine / psaltic symbols in the scale chart

Implements issue #2 of `calinburloiu/music-scale-plot` — replacing the free-text note-name and
accidental fields with real psaltic notation (fthores and martyries) in a new **Byzantine**
notation mode, and drawing them in the chart the way the reference plate does.

## About the design files

The files in this bundle are **design references written in HTML**. They are prototypes of the
intended look and behaviour — not production code to lift. The task is to recreate them inside
`music-scale-plot`'s own environment: vanilla ES5/ES6 in `app.js`, plain CSS in `style.css`, no
build step, no dependencies, opens from `file://`. Keep that character. Nothing here needs a
framework, and adding one would be a regression.

The prototype renders symbols as DOM text because that is what an HTML mock can do. **The real
app draws the chart into `<canvas>`**, so the chart-side symbol placement must be ported to
`ctx.fillText` with the same measured-ink arithmetic (see *Composing a martyria* below — the
maths is identical, `measureText` gives you the same numbers). The editor-side wells and pickers
are ordinary DOM and port directly.

## Fidelity

**High-fidelity.** Colours, type, spacing, borders and the full symbol repertoire are final and
exact. Interaction behaviour (what opens, what it contains, what it writes) is final. The one
thing that is *not* prescriptive is the chart's pixel geometry — box heights in the mock are a
flat 34 px per EDO step, whereas the real chart scales heights by cents; use the app's existing
scaling.

---

## What exists today (baseline)

From `index.html` on `main`. All of it must survive — the design adds to it, replaces nothing
except the two per-note text fields, and only in Byzantine mode.

**Settings panel** — `#base-note` (A–G), `#interval-type` (`ratio` / `edo` / `cents`),
`#edo-settings` → `#edo-divisions` + `#edo-cents-label` (shown only when `interval-type=edo`).

**Scale editor panel** — `#scale-mode` (`relative` / `absolute`); `#editor` containing
alternating `.row.note-row[data-degree]` (`.play-note`, `<label>`, `.cumulative-cents`,
`.note-name`) and `.row.interval-row` (`.interval`, `.cents-label`,
`.interval-label-cluster` → `.interval-label` + `.color-picker-wrapper` → `.color-swatch` +
`.color-dropdown`); `#add-note`, `#remove-note`.

**Chart panel** — `#save-png`, `#chart-style` (`boxes` / `lines`), `#orientation`
(`vertical` / `horizontal`), `#zoom` (range 10–100 step 5) + `#zoom-value`, `<canvas id="chart">`.

---

## New settings

Two new rows at the top of the Settings panel, above Base Note.

### 1. Notation — `#notation`

A three-way segmented control, chart-level (not per note). Values `generic` | `byzantine` |
`maqam`. Default `generic`, so existing behaviour is unchanged until the user opts in.

- `generic` — exactly today's app. `.note-name` and the accidental field are free text.
- `byzantine` — **the note-name field is removed entirely.** A musicologist reads the martyria;
  a textual name is redundant. The two per-note controls become a *fthora well* and a
  *martyria well* (below).
- `maqam` — keeps the free-text name, swaps the left control for Ottoman accidentals. Out of
  scope for issue #2; wire the mode switch so it exists, leave the control set as generic.

### 2. Psaltic font — `#psaltic-font`

A `<select>` — **not** a segmented control or radio group; the list is expected to grow
(`NeanesEngraving`, `NeanesStathisSeries`). Options: `Neanes (recommended)`, `Almouzios`.
Disabled and dimmed (`opacity: .45`) unless notation is `byzantine`.

Switching is a one-line `font-family` change and must never invalidate a saved chart — see
*Store semantics, not codepoints*.

---

## The two wells

Both **34 × 34 px**, same footprint, sitting where `.note-name` and the accidental field were.
They mirror the chart's own geometry: fthora on the left of the row, martyria on the right,
separated by the same 2 px rule the chart uses between them.

| State | Border | Background | Contents |
|---|---|---|---|
| empty | `1px dashed #bab6b6` | `#f8f4f4` | the slot's own mark (below) |
| filled | `2px solid #201e1d` | `#fff` | the symbol, ink-centred |
| open | `2px solid #ec3013` | `#fff` | unchanged |

**Empty-slot marks.** An empty well must say *which kind of sign it inserts*, before anything is
in it, and without depending on the psaltic font being loaded. Both are drawn from the well's own
geometry in plain CSS boxes, 15–16 px, `#9b9797`, 2 px strokes:

- **fthora** — a single slashed stroke: a 15 px rule rotated −38°, crossed by a 13 px vertical
  rule at x = 5.
- **martyria** — two deliberately *unequal* tiers so it cannot read as an `=`: a 7 px bar
  centred above a 16 × 7 open-bottomed box (`border: 2px solid; border-top: 0`), 5 px gap.
  Two tiers because what it inserts is two tiers.

Clicking a well opens its picker. Clicking the same well again closes it.

---

## Picker 1 — Fthora (one flat set)

Panel: 244 px wide, `2px solid #201e1d`, `#fff`, `box-shadow: 0 12px 32px rgba(45,43,43,.22)`,
`z-index: 20`, absolutely positioned 8 px below the well (`top: 42px` given a 34 px well).
Header: `Fthora · one set · E1D0–E1DF`, 9 px/700 Archivo, `.12em` tracking, uppercase,
`2px solid #201e1d` bottom border.

One flat list, **no sub-grouping and no second step** — picking a row writes the slot and closes
the panel. First row is `none` (clears the slot), then all sixteen:

| Row | Glyph name | Codepoint |
|---|---|---|
| Diatonic Νη low | `fthoraDiatonicNiLow` | `U+E1D0` |
| Diatonic Πα | `fthoraDiatonicPa` | `U+E1D1` |
| Diatonic Βου | `fthoraDiatonicVou` | `U+E1D2` |
| Diatonic Γα | `fthoraDiatonicGa` | `U+E1D3` |
| Diatonic Δι | `fthoraDiatonicDi` | `U+E1D4` |
| Diatonic Κε | `fthoraDiatonicKe` | `U+E1D5` |
| Diatonic Ζω | `fthoraDiatonicZo` | `U+E1D6` |
| Diatonic Νη high | `fthoraDiatonicNiHigh` | `U+E1D7` |
| Hard chromatic Πα | `fthoraHardChromaticPa` | `U+E1D8` |
| Hard chromatic Δι | `fthoraHardChromaticDi` | `U+E1D9` |
| Soft chromatic Δι | `fthoraSoftChromaticDi` | `U+E1DA` |
| Soft chromatic Κε | `fthoraSoftChromaticKe` | `U+E1DB` |
| Enharmonic | `fthoraEnharmonic` | `U+E1DC` |
| Chroa zygos | `chroaZygos` | `U+E1DD` |
| Chroa kliton | `chroaKliton` | `U+E1DE` |
| Chroa spathi | `chroaSpathi` | `U+E1DF` |

**Use the standalone block `E1D0–E1DF`, which has a normal advance.** The `…Above` (`E190`),
`…Secondary` (`E1A0`), `…Tertiary` (`E1B0`) and `…Below` (`E1C0`) blocks are zero-advance marks
meant to ride a neume — wrong for a chart.

Row: `display:flex`, 8 px gap, `3px 8px` padding, 11 px Archivo; a 26 px ink-centred glyph cell,
the label, then the codepoint right-aligned in 8.5 px monospace `#a8a4a4`. Selected row:
`background #ffe0d9`, `font-weight 600`.

## Picker 2 — Martyria (two sets, composed)

Panel 430 px wide, same chrome. Two columns side by side over a shared footer:

- **Genus · mark above, E17x** — twelve rows, `U+E170`–`U+E17B` in order: Zo (diatonic),
  Δ tetartos, Α protos, Legetos, Nana (tritos), Δ dotted, Α dotted, Hard chromatic Πα,
  Hard chromatic Δι, Soft chromatic Δι, Soft chromatic Κε, Zygos.
  (The parallel `…Below` block is `U+E150`–`U+E15B`; `above = below + 0x20`. The chart uses
  *above*.)
- **Echos · note letter, E13x** — the seven degrees, in SBMuFL order
  **Ζω, Νη, Πα, Βου, Γα, Δι, Κε**. Codepoint is `0xE130 + octave*7 + degreeIndex`, where
  octave is `0` low / `1` middle / `2` high — so middle Ζω is `E137`, middle Πα is `E139`,
  high Κε is `E144`.

Then an **Octave** row (Low / Middle / High segmented, default Middle) and a **Composed** footer
showing the live result plus its two codepoints in monospace, and a *Done* button.

Each Genus row previews its mark **composed onto the currently selected note letter**, not
floating alone — otherwise the user is judging a mark they will never see in isolation.

Only the martyria is composed. The fthora is a single glyph.

---

## Composing a martyria — read this before you write the renderer

FONTS.md says SBMuFL's zero-advance `…Above` marks plus `mark`/`mkmk` GPOS let you emit
`note + genusAbove` as one string and let the shaper stack it. **Measured in the browser, this
does not happen**, in either face:

```
Neanes, 100px:
  \uE139 (martyriaNotePa)            advance 73.7   ink x  36.1 … 66.98   ink y -37.0 … -6.73
  \uE177 (martyriaHardChromaticPaAbove) advance 0   ink x -36.1 … 36.12   ink y -13.5 … 18.93
  \uE139\uE177                       advance 73.7   ink x  36.1 … 109.82
```

`109.82 == 73.7 + 36.12` exactly — the mark is drawn at the pen *after* the base with zero anchor
adjustment, landing to the upper right, outside the letter. `font-feature-settings: "mark" 1,
"mkmk" 1` changes nothing; reversing the order just puts the mark to the left. The likely reason
is that PUA codepoints are Unicode category `Co`, so HarfBuzz will not apply the `mark` feature
without GDEF mark classes. FONTS.md verified the features *exist* in the font, not that they
*apply*. **Do not build on the one-`fillText` claim without re-testing it.**

So compose it yourself. This is FONTS.md's own documented fallback path, and it is short. All
values in units of 1/100 em (measure at 100 px, scale by `fontSize/100`):

```js
// ink box helper: L,R,T,B relative to the pen, y negative = above the baseline
function ink(ctx, fam, s) {
  ctx.font = '100px "' + fam + '"';
  const m = ctx.measureText(s);
  return { adv: m.width,
           L: -m.actualBoundingBoxLeft,  R: m.actualBoundingBoxRight,
           T: -m.actualBoundingBoxAscent, B: m.actualBoundingBoxDescent };
}

const GAP = 3;                                  // 0.03 em of air above the letter
function compose(ctx, fam, base, mark) {
  const b = ink(ctx, fam, base);
  if (!mark) return { dx: 0, dy: 0, adv: b.adv, cx: (b.L + b.R) / 2, cy: (b.T + b.B) / 2 };
  const k = ink(ctx, fam, mark);
  const dx = (b.L + b.R) / 2 - (k.L + k.R) / 2; // centre the mark on the letter's ink
  const dy = (b.T - GAP) - k.B;                 // lift it clear of the letter's ink top
  const L = Math.min(b.L, k.L + dx), R = Math.max(b.R, k.R + dx);
  const T = Math.min(b.T, k.T + dy), B = Math.max(b.B, k.B + dy);
  return { dx, dy, adv: b.adv, cx: (L + R) / 2, cy: (T + B) / 2 };  // cx,cy = union ink centre
}
```

To draw the cluster ink-centred on `(x, y)` in canvas, with `k = fontSize / 100`:

```js
const p = compose(ctx, fam, base, mark);
ctx.font = fontSize + 'px "' + fam + '"';
ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
ctx.fillText(base, x - p.cx * k, y - p.cy * k);
if (mark) ctx.fillText(mark, x - p.cx * k + p.dx * k, y - p.cy * k + p.dy * k);
```

### Two traps, both hit during this design

1. **Centre on the ink box, on both axes.** Vertical is not optional: `martyriaNotePa` sits
   *below* the baseline in Almouzios (ink y +9.1 … +33.9) and *above* it in Neanes
   (−37.0 … −6.73), and standalone fthores sit at y ≈ −0.65 … −1.1 em because the font expects
   them over a neume. Any constant offset breaks on a font swap. Horizontal matters too — in the
   DOM version, flex-centring already centres the *advance* box, so the ink correction is
   `adv/2 − cx`, not `−cx`; getting that wrong drifts every glyph left by half an advance.
2. **Never cache a measurement taken before the webfont has loaded.** `measureText` silently
   returns fallback-font boxes until then, so a cache populated during first paint poisons every
   symbol for the life of the page. Await the faces and throw the cache away:

```js
await Promise.all([document.fonts.load('40px "Neanes"'),
                   document.fonts.load('40px "Almouzios"')]);
await document.fonts.ready;
inkCache = {};   // discard everything measured before this point
render();        // and re-render, or the first paint (and an early PNG export) is wrong
```

---

## Store semantics, not codepoints

Per FONTS.md, and it matters for the font picker and for saved charts. Each slot holds ids:

```js
{ fthora: 'fthoraHardChromaticPa' | null,
  martyria: { genus: 'martyriaHardChromaticPaAbove', degree: 'Pa', octave: 'mid' } }
```

with `SBMUFL_MAP[id] -> 0xE1D8` for rendering and `UNICODE_MAP[id]` for a future
SVG/clipboard/text export. Note that `glyphnames.json`'s `alternateCodepoint` is **absent for
every martyria and fthora**, so `UNICODE_MAP` covers only the accidentals — which is itself the
argument for SBMuFL. Switching faces then touches nothing but `font-family`.

Also available and not used by this design, in case they come up: `martyriaTick` `U+E145`
(zero-advance tick before a martyria) and the diesis / yfesis families,
`U+E1F0`–`U+E1F5` and `U+E200`–`U+E205`, whose 2/4/6/8-twelfths members line up with the app's
72-EDO arithmetic.

## Fonts

Both OFL 1.1, both SBMuFL, identical codepoints and identical composition maths — the choice
is purely typographic and belongs to the client. Almouzios is the heavier, calligraphic face and
the closer match to the scanned plate; Neanes is the crisper engraving.

The prototype loads them from the SHA-pinned jsDelivr URLs in FONTS.md, which is fine for a mock.
**For the app, vendor woff2 in the repo** (~70 KB each) per FONTS.md: it keeps the
open-from-`file://`, zero-network, no-build character, is smaller than the brotli'd OTF, and is
same-origin on github.io. Ship each font's full OFL text alongside, add a NOTICE section to
`README.md` so the root Apache-2.0 licence is not read as covering `fonts/`, and credit
`ilizol/Almouzios` and `Copyright (c) 2022, Daniel` respectively.

Loading order matters for the PNG export: `render()` must await the face, or `Save as PNG`
triggered early exports fallback glyphs. Fonts never taint a canvas, so the export itself is
unaffected.

## Chart rendering

Per separator line, low to high:

- **cumulative cents** in the left gutter, 10.5 px monospace `#7d7979`, right-aligned
- **fthora** (if any), ink-centred, joined to the separator by a 12 px `1.5px` leader rule
- **the separator** itself, `2px solid #201e1d`
- **martyria** cluster to the right of the line, 11 px in from it

Between separators, the interval box: `2px` left and right borders only, `#fff` fill, the
division count centred in 13 px Archivo. Height scales with cents (the mock uses a flat 34 px
per EDO step; use the app's real scaling).

In `generic` and `maqam` modes the fthora and martyria columns are replaced by the note-name
text, and the cents gutter stays.

## Interactions & state

New state: `notation`, `psalticFont`, and per note `{ fthora, martyria: {genus, degree, octave} }`.
Plus transient picker state: which well is open, and whether its panel is flipped.

- Clicking a well toggles its picker. Only one picker open at a time.
- **Flip-up.** Before opening, compare the panel's height (≈350 px fthora, ≈420 px martyria)
  against the space between the well's bottom and the bottom of the editor panel. If it does not
  fit and there *is* room above, anchor `bottom: 42px` instead of `top: 42px`. Without this the
  panel escapes the panel on the lower rows.
- Fthora: picking a row writes and closes. Martyria: picking leaves the panel open (the user is
  usually setting genus and degree together); *Done* closes it.
- Every pick re-renders the chart immediately, matching the app's existing live-update behaviour.
- Switching notation mode away from `byzantine` must **not** discard the stored symbol ids — the
  user will switch back.

## Design tokens

From the Modernist system the mock is built on. Zero border radius everywhere, on purpose.

| Token | Value |
|---|---|
| page background | `#f3f2f2` |
| panel background | `#f8f4f4` |
| well / field background | `#fff` |
| ink | `#201e1d` |
| accent (primary action, selection, focus) | `#ec3013` |
| accent tint (selected picker row) | `#ffe0d9` |
| secondary text | `#605d5d` |
| tertiary / hint text | `#7d7979` |
| empty-slot mark, placeholder | `#9b9797` |
| codepoint monospace | `#a8a4a4` |
| hairline rule | `#d7d3d3` / `#e2dede` |
| dashed empty-slot border | `#bab6b6` |
| strong rule | `2px solid #201e1d` |
| soft strong rule | `2px solid rgba(32,30,29,.4)` |
| panel shadow | `0 12px 32px rgba(45,43,43,.22)` |
| radius | `0` |
| focus ring | `2px solid #ec3013`, `outline-offset: 2px` |

Type: **Archivo** throughout the UI (400/500/600/700/800). Panel titles 11 px/700, `.16em`
tracking, uppercase. Field labels 10 px/600, `.12em`, uppercase. Body and rows 11–13 px/400–500.
Numeric readouts (cents, codepoints) in `ui-monospace, Menlo, monospace`. Psaltic glyphs in
`"Neanes"` / `"Almouzios"` with `line-height: 0`.

Minimum control size 22 px (play button); wells 34 px; picker rows 26 px tall.

## Assets

- `Neanes.otf` — `neanes/sbmufl`, `fonts/Neanes.otf`, commit `9519b83e43ddf1dc655c9a1f3be88ec01017baf5`
- `Almouzios.otf` — `ilizol/Almouzios`, root, commit `b9703ba74b18721bdacbf1421d2fa2c6009a906f`
- No images or icons. The empty-slot marks are CSS boxes; the play button is `&#9654;`.

## Files in this bundle

| File | What it is |
|---|---|
| `Byzantine Symbols UX (design 3).dc.html` | the design source — options `#3a`, `#3b`, `#3c`, `#3d`. This is the design to build. |
| `support.js` | runtime the design file needs in order to open in a browser. Not part of the app. |
| `FONTS.md` | the font research this design implements, with the full codepoint tables. Its GPOS conclusion is corrected above. |
| `Byzantine Symbols UX — standalone.html` | the same design as one self-contained offline file, fonts inlined — for sharing, not for building from. |

Open the design file in a browser and read `#3a` (the app in Byzantine mode, one picker open),
`#3d` (both pickers open and complete), `#3b` (the empty-slot marks) and `#3c` (the two faces
side by side).
