# SMuFL accidentals for issue #13 — findings

Research for [issue #13, *Add support for generic accidentals*](https://github.com/calinburloiu/music-scale-plot/issues/13).

Companion: **[`accidentals-demo.html`](accidentals-demo.html)** — the glyphs themselves, as
live font text at real sizes. This file has the facts and the reasons, the demo has the
rendering; neither restates the other.

Measured against Bravura **1.482** (upstream commit
`37b194378b710cc40e406ab6c4b07608bb9548ae`, 2026-08-24) and the SMuFL 1.4 `glyphnames.json`
/ `ranges.json`.

| Question | Answer |
|---|---|
| Bravura or Bravura Text, for well, picker and diagram alike? | **Bravura Text**, everywhere. Identical symbols; plain Bravura's metrics are unusable outside a notation engine. |
| May we vendor a woff2 in `fonts/`? | **Yes**, with one condition Neanes did not impose: ship *upstream's own* `redist/woff/BravuraText.woff2` byte for byte. Do not convert or subset it while keeping the name. |
| Are the Figure-2 mixed Sagittal symbols available? | **Partly.** SMuFL precomposes the *Revo* flavour only. Nine of the thirteen 72-EDO degrees are a single glyph in *Evo* too; the four others (±4, ±5) are a sagittal glyph followed by ♯ or ♭ — string concatenation, nothing more. |
| How do SMuFL glyphs compose? | Concatenation on zero-side-bearing advances, GPOS `kern`, GSUB `liga` for vertical placement, zero-advance overprinting. §4. |

---

## 1 · Bravura or Bravura Text

Same repository, same sources, and — the point that settles coverage — the same symbols:

| | Bravura | Bravura Text |
|---|---|---|
| Version | 1.482 | 1.482 |
| Units per em | 1000 | 1000 |
| **SMuFL symbols (PUA codepoints)** | **3 468** | **3 468** |
| Total glyphs | 3 715 | 19 269 |
| woff2 size (upstream) | 316 KB | 447 KB |

Bravura Text's extra 15 554 glyphs are the vertical-position variants reached through the
ligature mechanism of §4c, not extra symbols, and are not addressable by codepoint. So the
decision rests on metrics.

**The line box.**

| | Bravura | Bravura Text |
|---|---|---|
| `hhea` ascent / descent | +2012 / −2012 | +1130 / −330 |
| `OS/2` typo ascender / descender | +2012 / −2012 | +800 / −200 |
| Cap height | 475 | 720 |
| **Line box at `line-height: normal`** | **4.02 em** | **1.46 em** |

Bravura declares four ems each way because a notation engine wants the em box to mean "one
staff", not "one line of text": a DOM element claims eight times its font size in height
before anything is drawn, and the usual `line-height: 1` + `overflow: hidden` fix fights the
font. Bravura Text's 1.46 em is an ordinary text line box.

**Where the ink sits**, from `ctx.measureText()` at 100 px — the numbers the app would get:

| Glyph | Bravura ink | Bravura Text ink |
|---|---|---|
| `accidentalSharp` U+E262 | +0.350 em … −0.348 em | +0.680 em … +0.122 em |
| `accSagittal5CommaUp` U+E302 | +0.172 em … −0.359 em | +0.538 em … +0.113 em |

Bravura's baseline is the middle staff line, so glyphs straddle it. In Bravura Text every
accidental sits **entirely above** the baseline, like a letter — a negative
`actualBoundingBoxDescent`. That is the shape this codebase already handles: `docs/TESTING.md`
models Neanes the same way, so the ink-measuring machinery from issue #2 transfers unchanged.
`scanInkBox` does not apply, though — it exists for zero-advance combining marks, and every
Bravura Text accidental has a real advance.

**Scale.** Bravura: 1 em = 4 staff spaces = full staff height (staff space 250 units).
Bravura Text: staff height ≈ the cap height of text at the same size (staff space 200). At
24 px beside 24 px UI text, only Bravura Text is the size of its neighbours — demo §5 and §6.

**Spacers**, for the gap in an Evo pair (§3) — blank, outline-free advance glyphs:

| Character | Advance | In staff spaces |
|---|---|---|
| `U+0020` space | 100 | ½ |
| `-` hyphen | 200 | 1 |
| `=` equals | 400 | 2 |

Bravura has only `U+0020`, and against its 250-unit staff space that is 0.4 of a space
rather than a half — a different quantity under the same character.

**Decision: Bravura Text, for well, picker and chart alike.** The repertoire is identical
and the staff machinery is inert unless used, so nothing is given up. Consequences:

- Load it as Neanes is loaded, and `await document.fonts.load('40px "Bravura Text"')` before
  the first canvas paint.
- `line-height: 1` on any DOM element showing a symbol; `white-space: pre` on a well or
  picker cell, or the `U+0020` of a spaced Evo pair is collapsed away.
- Pin `textBaseline` deliberately — the ink is above the baseline, so `"alphabetic"` puts the
  symbol entirely above the y you pass. Same requirement as `docs/BYZANTINE-SYMBOLS.md` §10.

---

## 2 · Vendoring the font

**Yes, GitHub Pages included** — under one condition Neanes did not impose.

**The licence.** OFL 1.1, like Neanes, but with a **Reserved Font Name**: "Copyright © 2026,
Steinberg Media Technologies GmbH, with Reserved Font Name 'Bravura'". An RFN allows use,
redistribution and modification, but a **Modified Version must be renamed**. Neanes declares
no RFN, which is why this repository could convert it to woff2 itself and still call it
"Neanes"; that route is closed here.

**What counts as modification**, per the OFL FAQ shipped with the font:

- **2.2, WOFF versions** — allowed without renaming, but only if "the original font data
  remains unchanged except for WOFF compression" and the WOFF metadata block is "either
  omitted altogether or present and includes, unaltered, the contents of all equivalent
  metadata in the original font".
- **2.6, subsetting** — "Yes [it is modification]. Removing any parts of the font when
  delivering a web font to a browser, including unused glyphs and smart font code, is
  considered modification… would not normally allow the use of RFNs."

**The route taken:** ship upstream's own `redist/woff/BravuraText.woff2` byte for byte, so no
conversion happens here and FAQ 2.2 is satisfied by construction — the file is the upstream
build; it carries no WOFF metadata block (checked: `flavorData.metaData` is empty), which
2.2 permits; name IDs 0 and 13 carry the Steinberg copyright and the OFL notice and ID 14
points at `http://scripts.sil.org/OFL`. It is an *Original Version*, keeps the name, and no
renaming obligation arises.

```
fonts/BravuraText.woff2     447 KB   sha256 1f2711e9…e07e1574
fonts/Bravura-OFL.txt                upstream LICENSE.txt, verbatim
```

`fonts/Bravura-OFL.txt` is separate from the existing `fonts/OFL.txt`, which is Neanes' bare
licence text: Bravura's copy is prefixed with the copyright line and the RFN declaration, and
that prefix is precisely what must travel with the file.

**GitHub Pages** is no obstacle — a same-origin static file, no CORS surface, no third party.
A CDN is wrong for the reason `fonts/README.md` already records for Neanes: the app must work
from `file://` with no network, and a PUA codepoint has no fallback glyph, so a missing face
makes the symbols *disappear* rather than degrade.

**Not subsetting, for now.** 447 KB is large next to Neanes' 67 KB, and subsetting to the 491
accidental codepoints of §5 plus the spacers was measured:

| | Full | Accidentals-only subset |
|---|---|---|
| Bravura | 316 KB | 34 KB |
| Bravura Text | 447 KB | **30 KB** |

93 % is a real saving, but per FAQ 2.6 a subset must be **renamed** (something like
`MusicScalePlotSMuFL`) with the copyright and licence kept in the name table, and it silently
loses any glyph a later feature wants. Ship the unmodified font; revisit if the payload
becomes a real complaint.

---

## 3 · The Sagittal mixed symbols for 72-EDO

**Figure 2 of the Sagittal paper** (p. 4) gives the thirteen degrees of 72-EDO in four
notations; its last row, the mixed-symbol version, is the picker group issue #13 wants.

- **Revo** (pure): ♯ and ♭ are discarded; one sagittal arrow per degree, the apotome carried
  by the number of shafts.
- **Evo** (mixed): ♯ and ♭ keep the apotome and a single-shaft sagittal to their **left**
  adjusts it. Five twelfths sharp is "sharp, less two twelfths" — 7-comma-down then ♯.

**SMuFL precomposes Revo only.** The spec never says "Evo", "Revo" or "mixed"; it names by
tuning meaning, and a glyph like `accSagittalSharp7CDown` ("Sharp 7C-down, 4° up [72 EDO]")
reads mixed but is not — it is a multi-shaft arrow of 250 units, against 156 + 249 = 405 for
a real sagittal-plus-sharp pair. Across the thirteen degrees:

- **±1, ±2, ±3** (`U+E302`–`E305`, `E30A`, `E30B`) and the natural `U+E261` — one codepoint in
  both flavours; the natural is the standard one, Sagittal defines none.
- **±6** — one codepoint in both, but not the same one: Evo `U+E260` / `U+E262`, Revo `U+E319`
  / `U+E318`.
- **±4, ±5** — one codepoint in Revo (`U+E312`–`E315`), **two in Evo**.

The ladder itself is demo §1, where every cell prints its codepoints under the glyph.

**Composing the four is string concatenation.** Zero side bearings (§4a) make the two glyphs
abut exactly at the ink, as the figure shows: no positioning code, no canvas transform, no
second draw call, in the DOM and `fillText()` alike. The only judgement call is air between
them, which the spacers of §1 answer; demo §2 shows all four options, and **tight reproduces
the paper most closely**, with `U+0020` defensible at small sizes.

Two consequences for #13:

1. An accidental in the model is a **sequence** of codepoints, not one — one datum wider than
   the Byzantine alteration model, and worth building in from the start, since Extended
   Helmholtz-Ellis and Johnston combine the same way.
2. **Offer both flavours.** Revo costs nothing — thirteen single codepoints already in the
   font — and is what a Sagittal user expects. Two sub-groups, "Sagittal (mixed)" and
   "Sagittal (pure)".

---

## 4 · How SMuFL glyphs compose

Four mechanisms; only the first two matter for #13. Demo §3 works one example of each, in
this order.

**4a · Concatenation, and zero side bearings.** A glyph has an advance width (how far the
cursor moves) and a bounding box (where the ink is); the gap between them is the side
bearing. SMuFL sets it to zero — "the advance width of each glyph is exactly equal to the
bounding box of its symbol" (*An introduction to using Bravura Text*) — because a notation
engine positions everything itself. So two accidentals in a row touch precisely, `U+E305
U+E262` is one compound accidental for free, and a compound is exactly as wide as the sum of
its parts, which makes laying one out arithmetic rather than measurement. For a gap, insert a
spacer (`U+0020`, `-`, `=`); they carry no outline, so they are safe inside `fillText()`, but
in the DOM the element needs `white-space: pre`.

**4b · GPOS `kern`.** GPOS adjusts glyphs *after* they are chosen ("when B follows A, move B
left by 40 units") — the reason "AV" has no hole in it. Bravura Text carries one GPOS
feature, `kern`, with 1 333 pairs, mostly figured-bass digits and chord-symbol parts; **no
accidental pair used for Evo is kerned** (verified by reading the table), so what you see is
pure advance stacking. Worth knowing anyway: `kern` is on by default in every browser, DOM
and canvas alike, and `font-kerning: none` turns it off. GPOS also has *mark attachment*
(`mark`/`mkmk`), which is how Neanes stacks a genus mark on a martyria per
`docs/BYZANTINE-SYMBOLS.md` — **Bravura Text has no `mark`/`mkmk` lookups at all.** Sagittal
composition is two full-width glyphs in a row, not mark attachment.

**4c · GSUB `liga`.** GSUB replaces a run of glyphs with a different glyph (`f` + `i` → "fi").
Bravura Text uses it for **vertical positioning**: `U+EB90`…`U+EB9F` each mean "raise/lower
the next symbol by *n* staff positions", so `U+EB99 U+E0A4` is a black notehead two positions
below the middle line. That substitution is where the 19 269 glyphs come from. Browsers apply
`liga` in the DOM **and** in `ctx.fillText()`, with no library. Background knowledge only:
#13 draws accidentals free-standing, not on a staff. It is the mechanism to reach for if the
app ever grows one.

**4d · Zero-advance overprinting.** Staff glyphs (`U+E010`…`U+E014`) and leger lines have an
advance of **zero**: they draw but do not move the cursor, so whatever follows lands on top.
That is how SMuFL puts a symbol on a staff with no positioning code — emit the staff, then the
symbol, whose default vertical position is the middle line. Sagittal does not need this; some
Extended Helmholtz-Ellis and Johnston combinations do.

---

## 5 · Candidate groups for the picker

SMuFL's own ranges map almost one-to-one onto the groups #13 asks for ("Standard, Turkish,
Arabic, Sagittal etc."). Demo §4 draws every glyph of every range below, with names and
descriptions.

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

- The issue's "some accidentals may appear in more than one group for convenience" is
  **necessary**, not convenient: Sims covers only ±1, ±2, ±3, so its ±6 is the ordinary ♯ and
  ♭ from the Standard range, and the same standard ♮ closes the middle of every ladder. A
  72-EDO group that cannot show an apotome is not a 72-EDO group.
- The Sagittal extensions (Athenian through Magrathean, 186 glyphs) are high-precision JI and
  would swamp a picker. Leaving them out costs nothing — they stay in the font for a later
  "all SMuFL accidentals" search.

---

## 6 · Reproducing this

- **Font internals** (metrics, glyph bounds, advances, GPOS/GSUB contents, subset sizes) —
  `fontTools` over the upstream woff2 files.
- **Rendered behaviour** (Revo vs Evo, spacer widths, ligature shifting, line boxes) —
  headless Chrome against [`accidentals-demo.html`](accidentals-demo.html), which reads its
  own numbers back with `ctx.measureText()` so they cannot drift from the font.
- **Glyph names, codepoints, range membership** — SMuFL 1.4 `glyphnames.json` and
  `ranges.json`, inlined into the demo page so it stays one self-contained file.

Plain Bravura is deliberately not vendored: the demo's comparison rows read a locally
installed copy if there is one and say so plainly if there is not.

---

## 7 · Constraints on the implementation

Not a plan — that belongs in its own document — but what this research fixes:

1. **An accidental is a sequence of codepoints**, not a codepoint.
2. **One face, `Bravura Text`, loaded like Neanes** and awaited before the first canvas paint;
   `line-height: 1` and `white-space: pre` wherever a symbol appears in the DOM.
3. **Ink sits above the baseline**, as the Byzantine layer's does — the existing measuring
   approach transfers, but `textBaseline` must be pinned deliberately.
4. **Groups overlap by design**; the picker's data model must allow one codepoint in several
   groups with a group-specific label.
