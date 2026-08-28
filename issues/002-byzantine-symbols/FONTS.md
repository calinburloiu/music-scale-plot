# Byzantine / psaltic fonts for issue #2 — findings

Goal: render the symbols seen in the reference chart of issue #2 — **fthores** (left of the
box separators), **martyries** (right, a stylized Greek note letter with an ichos/genus sign
stacked above or below it), and **microtonal accidentals** (diesis / yfesis).

All candidates below were downloaded and inspected locally (glyph coverage, metrics, OpenType
tables) and rendered to the specimen images in `specimens/`.

This file keeps the **generic findings and the comparison between the options**. The
font-specific detail lives in two companion files:

| File | Contents | Who needs it |
|---|---|---|
| [`SBMUFL-FONTS.md`](SBMUFL-FONTS.md) | The SBMuFL faces: Neanes and Almouzios, the full codepoint tables, metrics, hosting, licensing checklist, font picker and implementation notes | **The implementer — read this one** |
| [`OTHER-FONTS.md`](OTHER-FONTS.md) | Noto Music (Unicode-encoded, kept as an export/interop path) and everything evaluated and rejected | Only for a future Unicode-export feature |

## TL;DR

**Ship the SBMuFL font `Neanes` (OFL 1.1), vendored as a woff2 in the repo. Keep Noto Music
only as an optional standards-based export path.**

| Font | Licence | Encoding | Hosting | Verdict |
|---|---|---|---|---|
| **Neanes** (+ `…Engraving`, `StathisSeries`) | OFL 1.1 | SBMuFL (PUA) | self-host / jsDelivr | ⭐ **Chosen.** Lighter "engraved" letterforms; by the SBMuFL authors — [details](SBMUFL-FONTS.md#option-b--neanes-family--chosen) |
| **Almouzios** | OFL 1.1 | SBMuFL (PUA) | self-host / jsDelivr | Runner-up. Heavier, calligraphic letterforms — by eye, the closest to the reference scan; **functionally identical** to Neanes, so it stays a one-line swap — [details](SBMUFL-FONTS.md#option-a--almouzios) |
| Noto Music | OFL 1.1 | Unicode `U+1D000` | Google Fonts / Adobe Fonts | Fallback / Unicode-export path only — see the trade-off below and [details](OTHER-FONTS.md#noto-music-standards-based-fallback--export-path) |

The choice between the two SBMuFL faces was typographic, not technical: they are drop-in
interchangeable, and the full side-by-side is in
[`SBMUFL-FONTS.md`](SBMUFL-FONTS.md#almouzios-vs-neanes--the-differences).

### Why not Noto Music as the default, despite Google Fonts hosting?

> **Update:** the requirement was relaxed — the font need not be on Google/Adobe Fonts, only
> publicly hosted. That removes Noto Music's sole remaining advantage outright. Serving a
> vendored woff2 from the repo's own GitHub Pages site *is* public hosting, so the choice is now
> decided purely on encoding and glyph repertoire, where SBMuFL wins on every axis.

Because the hosting advantage cancels itself out anyway, and SBMuFL wins on everything else:

- **The Google Fonts advantage evaporates the moment we care about offline use.** This app opens
  from `file://` with zero network and no build step. Preserving that means vendoring a woff2 —
  at which point "it's on Google Fonts" buys nothing, and a ~70 KB local SBMuFL face is no worse
  than a 35 KB local Noto Music subset. The `<link>`-tag convenience only matters if we accept
  that the chart silently loses its symbols offline.
- **SBMuFL composes the martyria for us; Unicode does not.** Verified: the `…Above`/`…Below`
  glyphs have zero advance and the fonts carry `mark`/`mkmk` GPOS anchors, so
  `martyriaNotePa + martyriaAlphaAbove` is one string and the shaper stacks and centres it —
  in `<canvas>` too. With Noto Music we hand-position two `fillText` calls per martyria, and
  the font has a [known bug](https://github.com/googlefonts/noto-fonts/issues/1310) placing
  contrasting-height signs inconsistently, so we'd need a per-symbol offset table on top.
- **SBMuFL is also the richer repertoire**, not merely the more convenient one:

  | | SBMuFL | Unicode block |
  |---|---|---|
  | Martyria note letters | 21 (Νη Πα Βου Γα Δι Κε Ζω × low/middle/high octave) | 7 (`ARKTIKO PA`…`NI`, no octave variants) |
  | Genus signs to stack on them | 24 (12 `…Above` + 12 `…Below`, martyria-sized) | 13 pre-composed `MARTYRIA … ICHOS`, not decomposable |
  | Fthores | 52 | ~19 |
  | Diesis / yfesis | 24 | 13 |

  The reference chart's martyries *are* letter-plus-genus-sign composites, which is exactly
  SBMuFL's model. Unicode has no martyria-sized chromatic genus signs to stack at all.

**What Unicode still buys:** portable, standard codepoints. PUA text is meaningless outside its
font, so if the client ever needs to paste these symbols into Word or InDesign, or if we add an
SVG/text export, Unicode output matters. That's a real but secondary need — the app renders to
canvas and exports PNG.

**Therefore:** store a semantic id per symbol (e.g. `fthoraNenano`) with two lookup tables,
`SBMUFL_MAP` for rendering and `UNICODE_MAP` for export/interop. That costs little now and keeps
both doors open — see [Two encodings](#two-encodings) below.

---

## Two encodings

This is the single most important technical fact for the implementation.

**1. Unicode Byzantine Musical Symbols block, `U+1D000–U+1D0F5`** (246 assigned characters).
Standardised, but the characters are plain non-combining symbols (`So`), so composing a
martyria = drawing two glyphs and positioning the second one ourselves.

**2. SBMuFL — "Standard Byzantine Music Font Layout"** (<https://github.com/neanes/sbmufl>),
the Byzantine analogue of SMuFL. Maps ~350 glyphs into the Private Use Area (`U+E000+`) and,
crucially, ships **zero-advance `…Above` / `…Below` mark glyphs plus `mark`/`mkmk` GPOS
anchors**. So the martyria the issue describes — "two characters one above the other" — is
just the two-character string `martyriaNotePa + martyriaAlphaAbove`; the browser's shaper
stacks and centres them. This works in `<canvas>` `fillText` too, since canvas text goes
through the same HarfBuzz shaping path.

Verified on Almouzios: `martyriaNotePa` advance = 1000, `martyriaAlphaAbove` advance = **0**,
GPOS features = `mark`, `mkmk`.

The per-glyph codepoints for the chosen encoding are in
[`SBMUFL-FONTS.md`](SBMUFL-FONTS.md#sbmufl-codepoints--martyries-fthores-accidentals); the
Unicode ones in [`OTHER-FONTS.md`](OTHER-FONTS.md#codepoints-relevant-to-issue-2).

---

## Sources

Font-specific sources are listed in each companion file:
[`SBMUFL-FONTS.md`](SBMUFL-FONTS.md#sources) · [`OTHER-FONTS.md`](OTHER-FONTS.md#sources).
General references:

- [Byzantine Musical Symbols Unicode block](https://en.wikipedia.org/wiki/Byzantine_Musical_Symbols) ·
  [Codepoints listing](https://codepoints.net/byzantine_musical_symbols)
- [SBMuFL standard](https://github.com/neanes/sbmufl) ·
  [`metadata/glyphnames.json`](https://github.com/neanes/sbmufl/blob/master/metadata/glyphnames.json) (387 glyphs, name → codepoint)
