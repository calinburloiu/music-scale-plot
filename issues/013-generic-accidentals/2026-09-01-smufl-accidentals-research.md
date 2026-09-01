# SMuFL accidentals for issue #13 — findings

Research for [issue #13, *Add support for generic accidentals*](https://github.com/calinburloiu/music-scale-plot/issues/13).
Four questions were asked; all four are answered below, with the evidence that
produced each answer rather than the conclusion alone.

Companion page: **[`accidentals-demo.html`](accidentals-demo.html)** — every claim on this
page that is about how a glyph *looks* is demonstrated there, in live font text, from
`file://` or from GitHub Pages.

---

## Summary

| Question | Answer |
|---|---|
| Bravura or Bravura Text, for well, picker and diagram alike? | **Bravura Text**, everywhere. Identical symbols; the metrics of plain Bravura are unusable outside a notation engine. |
| May we vendor a woff2 in `fonts/`? | **Yes** — with one condition Neanes did not have: ship *upstream's own* `redist/woff/BravuraText.woff2` byte-for-byte. Do not convert or subset it while keeping the name. |
| Are the Figure-2 mixed Sagittal symbols available? | **Partly.** Seven of the thirteen 72-EDO degrees are single SMuFL glyphs. The other six — ±4, ±5, ±6 — are **not**: SMuFL precomposes only the *Revo* flavour. The mixed (*Evo*) forms are composed as two codepoints, and need nothing but string concatenation. |
| How do SMuFL glyphs compose? | Four mechanisms: plain concatenation on zero-side-bearing advances, GPOS `kern`, GSUB `liga` for vertical placement, and zero-advance glyphs for overprinting. §5 is the primer. |

Everything below was measured locally against Bravura **1.482** (upstream commit
`37b194378b710cc40e406ab6c4b07608bb9548ae`, 2026-08-24) and against the SMuFL 1.4
`glyphnames.json` / `ranges.json` metadata.

---

## 1 · Bravura or Bravura Text

Both faces are shipped from the same repository and built from the same sources. The
first thing to establish is that this is **not** a question about glyph coverage:

| | Bravura | Bravura Text |
|---|---|---|
| Version | 1.482 | 1.482 |
| Units per em | 1000 | 1000 |
| **SMuFL symbols (PUA codepoints)** | **3 468** | **3 468** |
| Total glyphs | 3 715 | 19 269 |
| woff2 size (upstream) | 316 KB | 447 KB |

The symbols are the same symbols at the same codepoints. Bravura Text's extra 15 554
glyphs are not extra symbols — they are the vertical-position variants reached through
the ligature mechanism of §5c, which are not addressable by codepoint at all.

So the decision rests entirely on metrics, and there the two faces are built for
different jobs.

### The line box

| | Bravura | Bravura Text |
|---|---|---|
| `hhea` ascent / descent | +2012 / −2012 | +1130 / −330 |
| `OS/2` typo ascender / descender | +2012 / −2012 | +800 / −200 |
| Cap height | 475 | 720 |
| **Line box demanded at `line-height: normal`** | **4.02 em** | **1.46 em** |

Bravura declares four ems of ascent and four ems of descent, because a notation engine
positions every glyph itself and wants the em box to mean "one staff", not "one line of
text". Put a Bravura glyph in a DOM element and the element claims **eight times** its
font size in height before you have drawn anything. Every well, every picker cell and
every table row on the demo page would be four times taller than its ink, and the usual
fixes (`line-height: 1` plus `overflow: hidden`) fight the font rather than use it.

Bravura Text's 1.46 em is an ordinary text line box.

### Where the ink sits relative to the baseline

Measured with `ctx.measureText()` at 100 px — the numbers the app itself would get:

| Glyph | Bravura ink | Bravura Text ink |
|---|---|---|
| `accidentalSharp` U+E262 | +0.350 em … −0.348 em | +0.680 em … +0.122 em |
| `accSagittal5CommaUp` U+E302 | +0.172 em … −0.359 em | +0.538 em … +0.113 em |

In Bravura the baseline is the **middle staff line**, so glyphs straddle it. In Bravura
Text every accidental sits **entirely above the baseline**, like a letter — its
`actualBoundingBoxDescent` is negative.

That second shape is the one this codebase already knows how to handle. `docs/TESTING.md`
describes the canvas stub as modelling "a fthora and every sign of alteration with ink
sitting *entirely above* the baseline (a negative descent)", because that is what Neanes
does. Choosing Bravura Text means the accidental layer measures the way the Byzantine
layer already measures, and the ink-measuring machinery added for issue #2 — including
`scanInkBox`, the WebKit workaround — applies unchanged.

One thing that does *not* carry over: `scanInkBox` exists because Neanes has zero-advance
combining marks whose ink `measureText` will not report on some engines. Every Bravura
Text accidental has a real non-zero advance, so `measureText().width` is meaningful and
that pixel-scanning path is not needed here.

### Scale

Bravura is scaled so that one em = four staff spaces = the full staff height. Bravura Text
is scaled so that the staff height is about the cap height of a text font at the same
point size (staff space = 200 units against Bravura's 250). Practically: set both to
`font-size: 24px` beside 24px UI text and the Bravura Text symbol is the one that looks
like it belongs; the Bravura one is roughly twice as large and overshoots its row.

### Spacing characters

Composing an Evo pair (§4) wants a controllable gap. Bravura Text provides three blank,
outline-free advance glyphs:

| Character | Advance | In staff spaces |
|---|---|---|
| `U+0020` space | 100 | ½ |
| `-` hyphen | 200 | 1 |
| `=` equals | 400 | 2 |

Bravura has only `U+0020`, and at 100 units against its 250-unit staff space that is
0.4 of a space rather than a half — a different quantity under the same character.

### Decision

**Bravura Text, for the well, the picker and the chart alike.** One face everywhere, as
the issue asks. Nothing is given up: the repertoire is identical, and the ligature and
staff machinery Bravura Text adds is inert unless used.

Concrete consequences for the implementation:

- Load it exactly as Neanes is loaded, and `await document.fonts.load('40px "Bravura Text"')`
  before the first canvas paint.
- Any DOM element showing a symbol wants `line-height: 1`; a well or picker cell also wants
  `white-space: pre`, or the `U+0020` inside a spaced Evo pair is collapsed away.
- On canvas, `textBaseline` matters. The ink is above the baseline, so `"alphabetic"` puts
  the symbol entirely above the y you pass. Pin it deliberately, exactly as
  `docs/BYZANTINE-SYMBOLS.md` §10 requires for Neanes.

---

## 2 · Vendoring the font

**Yes, and it can be served from GitHub Pages** — but the licence is stricter here than
it was for Neanes, in one specific way.

### The licence

Bravura is under the **SIL Open Font License 1.1**, like Neanes. Unlike Neanes it declares
a **Reserved Font Name**:

> Copyright © 2026, Steinberg Media Technologies GmbH, **with Reserved Font Name "Bravura"**.

An RFN means: anyone may use, redistribute and modify the font, but a **Modified Version
must be renamed**. Neanes declares no RFN, which is why this repository could convert
`Neanes.otf` to woff2 itself with `fontTools` and still call the result "Neanes". That
move is not available here.

### What counts as modification

The OFL FAQ shipped with the font is explicit on both points that matter:

- **FAQ 2.2 — "Can I make and use WOFF versions of OFL fonts?"** Yes, and *without*
  changing the name, but only if "the original font data remains unchanged except for WOFF
  compression" and the WOFF metadata block is "either omitted altogether or present and
  includes, unaltered, the contents of all equivalent metadata in the original font".
- **FAQ 2.6 — "Is subsetting a web font considered modification?"** "Yes. Removing any
  parts of the font when delivering a web font to a browser, including unused glyphs and
  smart font code, is considered modification… would not normally allow the use of RFNs."

### The route taken

Ship **upstream's own woff2, byte for byte**. Steinberg publish
`redist/woff/BravuraText.woff2` themselves, so no conversion is performed by this project
at all, and FAQ 2.2's conditions are met by construction:

- the file is the upstream build, unaltered;
- it carries **no WOFF extended-metadata block** (checked: `flavorData.metaData` is empty),
  which FAQ 2.2 permits — "omitted altogether";
- name ID 0 and name ID 13 both carry the Steinberg copyright and the OFL notice, and name
  ID 14 points at `http://scripts.sil.org/OFL`.

So the vendored file is an *Original Version*, keeps the name "Bravura Text", and no
renaming obligation arises.

Vendored as:

```
fonts/BravuraText.woff2     447 KB   sha256 1f2711e9…e07e1574
fonts/Bravura-OFL.txt                upstream LICENSE.txt, verbatim
```

`fonts/Bravura-OFL.txt` is kept separate from the existing `fonts/OFL.txt`: the latter is
the bare licence text carried for Neanes, while Bravura's copy is prefixed with the
Steinberg copyright line and the RFN declaration, which is precisely the part that must
travel with the file.

### GitHub Pages

No obstacle. It is a static file served same-origin from the repository, so there is no
CORS surface and no third-party dependency, and `.woff2` is served with the right type.
This is the same reasoning `fonts/README.md` already records for Neanes, and the same
reason a CDN link is the wrong answer: the app must keep working from `file://` with no
network, and a PUA codepoint has no fallback glyph — a missing face makes the symbols
*disappear*, it does not degrade them.

### The size question, and why we are not subsetting

447 KB is large next to Neanes' 67 KB. Subsetting to only the accidental ranges — the 491
codepoints of every range in §6 plus the three spacers — was measured:

| | Full | Accidentals-only subset |
|---|---|---|
| Bravura | 316 KB | 34 KB |
| Bravura Text | 447 KB | **30 KB** |

A 93 % saving is real, and it may be worth taking later. But per FAQ 2.6 a subset is a
Modified Version, so taking it means **renaming the face** (something like
`MusicScalePlotSMuFL`, matching this project rather than Steinberg's name), keeping the
copyright and licence in the name table, and documenting the change. That is a deliberate
decision with its own maintenance cost — a subset silently loses any glyph a later feature
wants — and it should not be smuggled in as an optimisation. Ship the unmodified font
first; revisit if the payload becomes a real complaint.

---

## 3 · The Sagittal mixed symbols for 72-EDO

The figure in question is **Figure 2 of the Sagittal paper** (page 4): four notations for
the thirteen degrees of 72-EDO, from six twelfths of a tone flat to six sharp. Its last
row is the *mixed-symbol version*, and that is the row issue #13 wants as a picker group.

### Evo and Revo

The paper names two flavours:

- **Revo** ("revolutionary", pure): the conventional ♯ and ♭ are discarded entirely. Each
  degree is one sagittal arrow, and the apotome is carried by the number of shafts.
- **Evo** (mixed): the conventional ♯ and ♭ are kept for the apotome, and a single-shaft
  sagittal symbol is written immediately to its **left** to adjust it. So five twelfths
  sharp is "sharp, less two twelfths": a 7-comma-down sagittal followed by ♯.

The single-shaft symbols — degrees ±1, ±2, ±3 — are identical in both flavours. Only the
outer six degrees differ.

### What SMuFL actually ships

**SMuFL precomposes the Revo flavour only.** The specification never uses the words "Evo",
"Revo" or "mixed"; it lists the Sagittal symbols by their tuning meaning. The glyphs
named like `accSagittalSharp7CDown` ("Sharp 7C-down, 4° up [72 EDO]") read as though they
were the mixed form, but they are not: rendering them beside a hand-built pair shows the
precomposed glyph is a multi-shaft sagittal arrow, matching the paper's Revo row, and the
advance widths agree — `accSagittalSharp7CDown` is 250 units, while a real
sagittal-plus-sharp pair is 156 + 249 = 405.

So, for the 72-EDO ladder:

| Degree | Evo (mixed) — Figure 2 | Revo — precomposed |
|---:|---|---|
| −6 | `U+E260` ♭ | `U+E319` accSagittalFlat |
| −5 | `U+E302` + `U+E260` | `U+E315` accSagittalFlat5CUp |
| −4 | `U+E304` + `U+E260` | `U+E313` accSagittalFlat7CUp |
| −3 | `U+E30B` accSagittal11MediumDiesisDown | *(same)* |
| −2 | `U+E305` accSagittal7CommaDown | *(same)* |
| −1 | `U+E303` accSagittal5CommaDown | *(same)* |
| 0 | `U+E261` ♮ | *(same — Sagittal defines no natural)* |
| +1 | `U+E302` accSagittal5CommaUp | *(same)* |
| +2 | `U+E304` accSagittal7CommaUp | *(same)* |
| +3 | `U+E30A` accSagittal11MediumDiesisUp | *(same)* |
| +4 | `U+E305` + `U+E262` | `U+E312` accSagittalSharp7CDown |
| +5 | `U+E303` + `U+E262` | `U+E314` accSagittalSharp5CDown |
| +6 | `U+E262` ♯ | `U+E318` accSagittalSharp |

Seven of thirteen degrees are one codepoint in either flavour. Six are one codepoint in
Revo and two in Evo.

### How to compose the six

Nothing exotic is required — **string concatenation**. Because every SMuFL glyph has zero
side bearings (§5a), the two glyphs abut exactly at the ink, which is what the figure
shows. The whole mixed row is therefore expressible as a short table of codepoint
sequences, in the DOM and in `ctx.fillText()` alike, with no positioning code, no canvas
transforms and no second draw call.

The only judgement call is air between the two symbols, and the font answers that with the
three blank spacer characters of §1. The demo page shows all four options side by side on
each of the four composed degrees; **tight (no spacer) reproduces the paper most closely**,
with `U+0020` a defensible looser alternative at small sizes.

Implementation consequence for issue #13: an accidental in the model must be able to be a
**sequence** of codepoints, not a single one. That is one datum wider than the Byzantine
alteration model, and it is worth building in from the start rather than retrofitting —
several other groups (Extended Helmholtz-Ellis, Johnston) combine symbols the same way.

### Both flavours are worth offering

The figure's mixed row is what was asked for, and it is the right default for readers
coming from standard notation. But the Revo row costs nothing extra — it is thirteen
single codepoints already in the font — and it is what a Sagittal user will expect. Two
sub-groups, "Sagittal (mixed)" and "Sagittal (pure)", is the natural shape.

---

## 4 · How SMuFL glyphs compose — a primer

Four mechanisms, in the order you will meet them. Only the first two matter for issue #13;
the other two are here so the next reader is not surprised by them. All four are
demonstrated live in §3 of [`accidentals-demo.html`](accidentals-demo.html).

### 4a · Plain concatenation, and zero side bearings

A font glyph has an **advance width** (how far the cursor moves) and a **bounding box**
(where the ink is). The gap between them at either end is the **side bearing** — in a text
font it is the built-in breathing room that stops letters colliding.

SMuFL fonts set the side bearings to **zero**: "all glyphs have zero side-bearings, i.e.
the advance width of each glyph is exactly equal to the bounding box of its symbol"
(*An introduction to using Bravura Text*, §Zero-width characters). A notation engine
positions every symbol itself and does not want the font's opinion.

For us that is a gift: two accidentals written one after the other touch precisely, and
`U+E305 U+E262` renders as one compound accidental with no work at all. It is also the
reason a compound accidental is exactly as wide as the sum of its parts, which makes
laying one out beside a chart arithmetic rather than measurement.

To open a gap, insert one of the blank spacer characters (`U+0020`, `-`, `=`). They carry
no outline, so they are safe inside a `fillText()` string as well as in the DOM — but in
the DOM the element needs `white-space: pre`, or HTML collapses the leading space.

### 4b · GPOS `kern` — pair positioning

**GPOS** (Glyph POSitioning) is the OpenType table for adjustments applied *after* the
glyphs have been chosen: "when glyph B follows glyph A, move B left by 40 units". The
best-known use is kerning — the reason "AV" is not written with a hole in the middle.

Bravura Text carries exactly one GPOS feature, `kern`, with 1 333 pairs, mostly for
figured-bass digits and chord-symbol parts. **None of the accidental pairs used for the
Evo flavour is kerned**, verified by reading the table directly, so what you see is pure
advance-width stacking. Worth knowing anyway: `kern` is on by default in every browser,
in the DOM and on canvas alike, and `font-kerning: none` turns it off if a future pair
ever surprises you.

GPOS also has a *mark attachment* mechanism (`mark`/`mkmk`) for hanging accents on
letters — that is what the Neanes font uses to stack a genus mark on a martyria, per
`docs/BYZANTINE-SYMBOLS.md`. **Bravura Text has no `mark`/`mkmk` lookups at all.** Sagittal
composition is not mark attachment; it is two full-width glyphs in a row.

### 4c · GSUB `liga` — substituting a sequence for one glyph

**GSUB** (Glyph SUBstitution) replaces a run of glyphs with a different glyph. In a text
font this is what turns `f` + `i` into a single "fi". Bravura Text uses it for **vertical
positioning**: sixteen codepoints `U+EB90`…`U+EB9F` mean "raise/lower the next symbol by
*n* staff positions". Write the shifter, then the symbol, and the ligature lookup swaps
the two-glyph run for a single pre-drawn glyph at that height:

```
U+EB99 U+E0A4    →   a black notehead two staff positions below the middle line
```

That substitution is where Bravura Text's 19 269 glyphs come from. Browsers apply `liga`
by default in the DOM **and** in `ctx.fillText()` — canvas text is shaped by the same
engine — so this works with no library.

Issue #13 draws accidentals free-standing beside a chart rather than on a staff, so this
is background knowledge, not a tool we need. It is the mechanism to reach for if the app
ever grows a staff.

### 4d · Zero-advance glyphs — overprinting

Staff glyphs (`U+E010`…`U+E014`) and leger lines have an advance width of **zero**: they
draw, but they do not move the cursor. Whatever follows lands on top of them. That is how
SMuFL puts a symbol on a staff without any positioning code — emit the staff, then the
symbol, and the symbol's default vertical position (the middle staff line, for every
movable glyph) does the rest.

The same trick composes symbols that genuinely overlap rather than abut. Sagittal does not
need it; some of the Extended Helmholtz-Ellis and Johnston combinations do.

---

## 5 · Candidate groups for the picker

SMuFL already partitions its accidentals into named ranges, and they map almost one-to-one
onto the groups issue #13 asks for ("Standard, Turkish, Arabic, Sagittal etc."). Every one
of these is present in the vendored font and drawn in §4 of the demo page.

| Range | Description | Glyphs | Suggested picker group |
|---|---|---:|---|
| `U+E260`–`E26F` | Standard accidentals (12-EDO) | 14 | **Standard** |
| `U+E270`–`E27F` | Gould arrow quarter-tone (24-EDO) | 12 | **24-EDO** |
| `U+E280`–`E28F` | Stein-Zimmermann (24-EDO) | 6 | **24-EDO** |
| `U+E290`–`E29F` | Extended Stein-Zimmermann | 13 | **24-EDO** |
| `U+E2A0`–`E2AF` | Sims (72-EDO) | 6 | **72-EDO** |
| `U+E420`–`E43F` | Wyschnegradsky (72-EDO) | 22 | **72-EDO** |
| `U+E2B0`–`E2BF` | Johnston (just intonation) | 8 | **Just intonation** |
| `U+E2C0`–`E2FF` | Extended Helmholtz-Ellis (JI) | 60 | **Just intonation** |
| `U+E300`–`E30F` | Spartan Sagittal, single-shaft | 16 | **Sagittal** |
| `U+E310`–`E33F` | Spartan Sagittal, multi-shaft | 38 | **Sagittal (pure / Revo)** |
| `U+E340`–`E41F` | Athenian / Trojan / Promethean / Olympian / Magrathean extensions | 186 | *out of scope for now* |
| `U+E440`–`E44F` | Arel-Ezgi-Uzdilek (AEU) | 8 | **Turkish** |
| `U+E450`–`E45F` | Turkish folk music | 8 | **Turkish** |
| `U+E460`–`E46F` | Persian (koron, sori) | 2 | **Persian** |
| `U+ED30`–`ED3F` | Arabic | 9 | **Arabic** |
| `U+E470`–`E49F` | Other accidentals | 32 | **Other** |
| `U+ED50`–`ED5F` | Stockhausen (24-EDO) | 15 | **Other** |
| `U+E9E0`–`E9EF` | Medieval and Renaissance | 6 | **Other** |

Two observations that bear on the design:

- The issue's note that "some accidentals may appear in more than one group for
  convenience" is not just convenience — it is **necessary**. Sims covers only ±1, ±2 and
  ±3 twelfths of a tone; its ±6 is the ordinary ♯ and ♭ from the Standard range. A 72-EDO
  group that cannot show an apotome is not a 72-EDO group. The same standard ♮ closes the
  middle of every ladder.
- The Sagittal extension ranges (Athenian through Magrathean, 186 glyphs) exist for
  high-precision JI and would swamp a picker. Leaving them out of the groups costs nothing:
  they stay in the font, and a later "all SMuFL accidentals" search could reach them.

---

## 6 · Reproducing this

Nothing here was taken on faith; each figure came from one of three sources.

- **Font internals** (metrics, glyph bounds, advance widths, GPOS/GSUB contents, subset
  sizes) — `fontTools` over the upstream woff2 files.
- **Rendered behaviour** (Revo vs Evo, spacer widths, ligature shifting, line boxes) —
  headless Chrome against [`accidentals-demo.html`](accidentals-demo.html), which reads
  its own numbers back with `ctx.measureText()` so they cannot drift from the font.
- **Glyph names, codepoints and range membership** — the SMuFL 1.4 `glyphnames.json` and
  `ranges.json`, whose contents are inlined into the demo page so it stays a single
  self-contained file.

The demo page deliberately does **not** vendor plain Bravura: its comparison rows read a
locally installed copy if there is one and say so plainly if there is not.

---

## 7 · What this leaves for the implementation

Not a plan — the plan belongs in its own document — but the four constraints this research
puts on one:

1. **An accidental is a sequence of codepoints, not a codepoint.** Six of the thirteen
   Sagittal mixed symbols are two glyphs, and the JI groups will want the same.
2. **One face, `Bravura Text`, loaded like Neanes** and awaited before the first canvas
   paint; `line-height: 1` and `white-space: pre` wherever a symbol appears in the DOM.
3. **Ink sits above the baseline**, as the Byzantine layer's already does — so the chart's
   existing measuring approach transfers, but `textBaseline` must be pinned deliberately.
4. **Groups overlap by design**, and the picker's data model has to allow the same
   codepoint in more than one group with a group-specific label.
