# SBMuFL fonts — the shipping choice for issue #2

Companion to [`FONTS.md`](FONTS.md), which holds the generic findings and the cross-encoding
comparison. **This file is the one an implementer needs**: everything specific to the SBMuFL
faces — the two candidates, their codepoints, their metrics, hosting, licensing and the
implementation notes. Non-SBMuFL faces are in [`OTHER-FONTS.md`](OTHER-FONTS.md) and are not
needed here.

**Decision: ship `Neanes`** (SIL OFL 1.1, from [`neanes/sbmufl`](https://github.com/neanes/sbmufl)),
vendored as a woff2 in the repo. `Almouzios` is documented below because it is drop-in
interchangeable and was the other finalist — swapping is a one-line `font-family` change.

---

## Almouzios vs Neanes — the differences

**There is no functional difference.** All four SBMuFL faces were measured against the 352-glyph
spec and are identical where it matters:

| | Almouzios | Neanes | NeanesEngraving | NeanesStathisSeries |
|---|---|---|---|---|
| SBMuFL coverage | 352/352 | 352/352 | 352/352 | 352/352 |
| GPOS (auto-stacking) | `mark`, `mkmk` | `mark`, `mkmk` | `mark`, `mkmk` | `mark`, `mkmk` |
| Units per em | 1000 | 1000 | 1000 | 1000 |
| woff2 size | ~71 KB | ~69 KB | ~69 KB | ~70 KB |
| Ink density (4 sampled glyphs) | 0.448 | 0.422 | 0.422 | 0.455 |

Where they genuinely differ:

| | **Almouzios** | **Neanes family** |
|---|---|---|
| Upstream | [ilizol/Almouzios](https://github.com/ilizol/Almouzios), a third-party face | [neanes/sbmufl](https://github.com/neanes/sbmufl), **by the authors of the SBMuFL standard itself** |
| Provenance | Built on *KA Almouzios*, **gaps filled from Noto Music and Alegreya** to reach compliance | Derived from the "EZ" fonts of St. Anthony's Monastery |
| Breadth | **One face** | **A family**: `Neanes`, `NeanesEngraving`, `NeanesRTL`, `NeanesStathisSeries` (+ Engraving variants) |
| Copyright line | none in the font or LICENSE | `Copyright (c) 2022, Daniel` |
| Look (see specimens) | Heavier, more calligraphic letterforms — closer to the scanned book page | Lighter, cleaner, more geometric — a crisper modern engraving |

Two honest caveats on that last row. First, **the "Almouzios is bolder" claim is a visual
impression from the specimen renders, not a measured fact** — the ink-density figures above are
nearly identical across all four, and StathisSeries actually scores *denser* than Almouzios. The
real difference is **letterform design, not stroke weight**, so judge it by eye from
`specimens/almouzios.png` vs `specimens/neanes.png`. Second, Almouzios' gap-filling from two
unrelated typefaces is a theoretical risk of mild stylistic unevenness across its glyph set;
nothing in the rendered specimen shows this, but Neanes has no such mixed provenance.

This was a typographic choice rather than a technical one, and it was made in favour of
**Neanes**: it comes from the authors of the standard, has no mixed provenance, and brings a
family of related faces. The two remain drop-in interchangeable, so nothing below depends on
that choice.

---

## Option A — Almouzios

- <https://github.com/ilizol/Almouzios> — "A SBMuFL-compliant OpenType byzantine music font."
- Licence: **SIL OFL 1.1** (LICENSE in repo; GitHub reports `OFL-1.1`).
- Formats: `Almouzios.otf` and `Almouzios.ttf` in the repo root. Converting to woff2 locally
  gives **~71 KB** (from 213 KB OTF) — OFL explicitly permits format conversion and
  redistribution, keep the licence file alongside.
- Encoding: SBMuFL PUA. Derived from *KA Almouzios*, filling gaps from Noto Music and Alegreya
  to reach full SBMuFL compliance.
- Not on Google/Adobe Fonts, but it is CDN-reachable without self-hosting (verified 200 + CORS
  `access-control-allow-origin: *`):

  ```
  https://cdn.jsdelivr.net/gh/ilizol/Almouzios@<commit-sha>/Almouzios.otf
  ```
  **Pin a commit SHA, not a tag** — see [Public hosting](#public-hosting-verified) below; neither
  repo publishes tags. Better still, vendor the woff2 in the repo.

- Specimen: `specimens/almouzios.png`. By eye, **the closest match to the reference book image**
  — heavy, calligraphic letterforms very like the martyries and fthores in the scan. (This is a
  visual judgement, not a measured one — see
  [Almouzios vs Neanes](#almouzios-vs-neanes--the-differences).)
- Glyph names are semantic and self-documenting: `martyriaNoteNi/Pa/Vou/Ga/Di/Ke/Zo` (plus
  `…Low` / `…High` octave variants), `martyriaAlphaAbove`, `martyriaDeltaBelow`,
  `martyriaNanaAbove`, `martyriaHardChromaticPaBelow`, `martyriaZygosBelow`, `martyriaTick`,
  `fthoraDiatonicNi/Pa/Vou/Ga/Di/Ke/Zo`, `fthoraHardChromatic…`, `fthoraSoftChromatic…`,
  `fthoraEnharmonic`, and the `diesis…` / `yfesis…` families. The full name→codepoint map is
  `sbmufl/metadata/glyphnames.json` in the repo (352 glyphs) — that file is what we'd
  hard-code the symbol menus from.
- **Automatic stacking** via the zero-advance `…Above` / `…Below` marks (see
  [`FONTS.md`](FONTS.md#two-encodings)). This removes the fiddliest part of the feature.

---

## Option B — Neanes family ⭐ (chosen)

- <https://github.com/neanes/sbmufl/tree/master/fonts> — `Neanes`, `NeanesRTL`,
  `NeanesStathisSeries`, each with an `…Engraving` variant.
- Licence: **SIL OFL 1.1** — `fonts/LICENSE` in the `sbmufl` repo covers them. (The Neanes
  *application* is GPL-3.0; that does not apply to the fonts. The fonts derive from the "EZ"
  Byzantine Music Font Package of St. Anthony's Greek Orthodox Monastery, acknowledged
  upstream.)
- Encoding: SBMuFL PUA, same as Almouzios — **drop-in interchangeable with it**, so we can
  offer both behind one symbol table. (`Neanes.otf` also maps 50 characters in the Unicode
  Byzantine block, but that coverage is partial — don't rely on it.)
- woff2: ~69 KB. Verified 352/352 SBMuFL coverage with `mark`/`mkmk` GPOS, identical to Almouzios.
- Specimen: `specimens/neanes.png`. Lighter, cleaner, "modern engraving" letterforms — good if
  the book wants a crisper page than the scan. See [Almouzios vs Neanes](#almouzios-vs-neanes--the-differences)
  for the full side-by-side.

---

## SBMuFL codepoints — martyries, fthores, accidentals

[`FONTS.md`](FONTS.md) names SBMuFL glyphs but never gives their codepoints; this section does. The
source of truth is [`metadata/glyphnames.json`](https://github.com/neanes/sbmufl/blob/master/metadata/glyphnames.json)
in `neanes/sbmufl`. **The spec now holds 387 glyphs, not the 352 quoted above** — that figure is
from an older snapshot. Re-verified against the pinned OTFs: **Almouzios 387/387,
Neanes 387/387**, so the "drop-in interchangeable" conclusion stands.

Codepoints are the same in every SBMuFL face — only the outlines and metrics differ.

### Martyria — note letters (base glyph, normal advance)

| Degree | Low octave | Middle | High |
|---|---|---|---|
| Ζω (Zo) | `U+E130` `martyriaNoteZoLow` | `U+E137` `martyriaNoteZo` | `U+E13E` `martyriaNoteZoHigh` |
| Νη (Ni) | `U+E131` `martyriaNoteNiLow` | `U+E138` `martyriaNoteNi` | `U+E13F` `martyriaNoteNiHigh` |
| Πα (Pa) | `U+E132` `martyriaNotePaLow` | `U+E139` `martyriaNotePa` | `U+E140` `martyriaNotePaHigh` |
| Βου (Vou) | `U+E133` `martyriaNoteVouLow` | `U+E13A` `martyriaNoteVou` | `U+E141` `martyriaNoteVouHigh` |
| Γα (Ga) | `U+E134` `martyriaNoteGaLow` | `U+E13B` `martyriaNoteGa` | `U+E142` `martyriaNoteGaHigh` |
| Δι (Di) | `U+E135` `martyriaNoteDiLow` | `U+E13C` `martyriaNoteDi` | `U+E143` `martyriaNoteDiHigh` |
| Κε (Ke) | `U+E136` `martyriaNoteKeLow` | `U+E13D` `martyriaNoteKe` | `U+E144` `martyriaNoteKeHigh` |

Plus `U+E145` `martyriaTick` (the vertical tick placed before a martyria; zero advance).

### Martyria — genus / ichos signs (zero advance, GPOS-stacked)

The `…Below` block is `U+E150–U+E15B`, the `…Above` block `U+E170–U+E17B`; same order in both, so
`above = below + 0x20`.

| Sign | Below | Above |
|---|---|---|
| Zo (diatonic Zo) | `U+E150` `martyriaZoBelow` | `U+E170` `martyriaZoAbove` |
| Δ (delta — tetartos) | `U+E151` `martyriaDeltaBelow` | `U+E171` `martyriaDeltaAbove` |
| Α (alpha — protos) | `U+E152` `martyriaAlphaBelow` | `U+E172` `martyriaAlphaAbove` |
| Legetos | `U+E153` `martyriaLegetosBelow` | `U+E173` `martyriaLegetosAbove` |
| Nana (tritos/enharmonic) | `U+E154` `martyriaNanaBelow` | `U+E174` `martyriaNanaAbove` |
| Δ dotted | `U+E155` `martyriaDeltaDottedBelow` | `U+E175` `martyriaDeltaDottedAbove` |
| Α dotted | `U+E156` `martyriaAlphaDottedBelow` | `U+E176` `martyriaAlphaDottedAbove` |
| Hard chromatic Πα | `U+E157` `martyriaHardChromaticPaBelow` | `U+E177` `martyriaHardChromaticPaAbove` |
| Hard chromatic Δι | `U+E158` `martyriaHardChromaticDiBelow` | `U+E178` `martyriaHardChromaticDiAbove` |
| Soft chromatic Δι | `U+E159` `martyriaSoftChromaticDiBelow` | `U+E179` `martyriaSoftChromaticDiAbove` |
| Soft chromatic Κε | `U+E15A` `martyriaSoftChromaticKeBelow` | `U+E17A` `martyriaSoftChromaticKeAbove` |
| Zygos | `U+E15B` `martyriaZygosBelow` | `U+E17B` `martyriaZygosAbove` |

**Composing one** is string concatenation — the mark's zero advance plus `mark`/`mkmk` GPOS does
the stacking and centring, in `<canvas>` as in HTML:

```js
const martyriaDiWithAlphaAbove = "\uE13C\uE172";  // Δι + α above
const martyriaPaHardChromatic  = "\uE139\uE157";  // Πα + hard-chromatic Πα below
ctx.fillText(martyriaDiWithAlphaAbove, x, y);      // one call, stacked automatically
```

### Fthores

Five parallel blocks, same 13 symbols in the same order in each — `standalone = Above + 0x40`:

| Block | Range | Use |
|---|---|---|
| `…Above` | `U+E190–U+E19F` | zero advance; attaches above a neume |
| `…Secondary` | `U+E1A0–U+E1AF` | zero advance; second fthora on one neume |
| `…Tertiary` | `U+E1B0–U+E1BF` | zero advance; third |
| `…Below` | `U+E1C0–U+E1CF` | zero advance; attaches below a neume |
| **plain (standalone)** | **`U+E1D0–U+E1DF`** | **normal advance — this is the one the chart wants** |

| Fthora | Standalone | Above | Below |
|---|---|---|---|
| Diatonic Νη low | `U+E1D0` `fthoraDiatonicNiLow` | `U+E190` | `U+E1C0` |
| Diatonic Πα | `U+E1D1` `fthoraDiatonicPa` | `U+E191` | `U+E1C1` |
| Diatonic Βου | `U+E1D2` `fthoraDiatonicVou` | `U+E192` | `U+E1C2` |
| Diatonic Γα | `U+E1D3` `fthoraDiatonicGa` | `U+E193` | `U+E1C3` |
| Diatonic Δι | `U+E1D4` `fthoraDiatonicDi` | `U+E194` | `U+E1C4` |
| Diatonic Κε | `U+E1D5` `fthoraDiatonicKe` | `U+E195` | `U+E1C5` |
| Diatonic Ζω | `U+E1D6` `fthoraDiatonicZo` | `U+E196` | `U+E1C6` |
| Diatonic Νη high | `U+E1D7` `fthoraDiatonicNiHigh` | `U+E197` | `U+E1C7` |
| Hard chromatic Πα | `U+E1D8` `fthoraHardChromaticPa` | `U+E198` | `U+E1C8` |
| Hard chromatic Δι | `U+E1D9` `fthoraHardChromaticDi` | `U+E199` | `U+E1C9` |
| Soft chromatic Δι | `U+E1DA` `fthoraSoftChromaticDi` | `U+E19A` | `U+E1CA` |
| Soft chromatic Κε | `U+E1DB` `fthoraSoftChromaticKe` | `U+E19B` | `U+E1CB` |
| Enharmonic | `U+E1DC` `fthoraEnharmonic` | `U+E19C` | `U+E1CC` |

The three **chroes** share the blocks, occupying the last three slots of each:

| Chroa | Standalone | Above | Below |
|---|---|---|---|
| Zygos | `U+E1DD` `chroaZygos` | `U+E19D` | `U+E1CD` |
| Kliton | `U+E1DE` `chroaKliton` | `U+E19E` | `U+E1CE` |
| Spathi | `U+E1DF` `chroaSpathi` | `U+E19F` | `U+E1CF` |

### Microtonal accidentals (diesis / yfesis)

All zero advance — designed to attach to a neume. `2/4/6/8` are twelfths of a tone (the
`…DODEKATA` family in Unicode), which lines up with the app's 72-EDO arithmetic.

| Amount | Diesis (raise) | Yfesis (lower) |
|---|---|---|
| 2/12 tone | `U+E1F0` `diesis2` (alt `U+1D0D0`) | `U+E200` `yfesis2` (alt `U+1D0D4`) |
| 4/12 tone | `U+E1F1` `diesis4` (alt `U+1D0D1`) | `U+E201` `yfesis4` (alt `U+1D0D5`) |
| 6/12 tone | `U+E1F2` `diesis6` (alt `U+1D0D2`) | `U+E202` `yfesis6` (alt `U+1D0D6`) |
| 8/12 tone | `U+E1F3` `diesis8` (alt `U+1D0D3`) | `U+E203` `yfesis8` (alt `U+1D0D7`) |
| generic, above | `U+E1F4` `diesisGenikiAbove` | `U+E204` `yfesisGenikiAbove` |
| generic, below | `U+E1F5` `diesisGenikiBelow` | `U+E205` `yfesisGenikiBelow` |

`…Secondary` (`U+E1F6–U+E1F9`, `U+E206–U+E209`) and `…Tertiary` (`U+E1FA–U+E1FD`,
`U+E20A–U+E20D`) exist for stacking a second/third accidental on one neume; the chart needs
neither. Generic secondary/tertiary are `U+E1FE/U+E1FF` and `U+E20E/U+E20F`.

`glyphnames.json`'s `alternateCodepoint` field is the Unicode equivalent where one exists — it is
exactly the data to build `UNICODE_MAP` from, and it is **absent for every martyria and fthora
glyph**, confirming that only SBMuFL can express them.

### Metrics: measure, never hard-code

Measured on the two pinned OTFs (upem 1000 in both). The zero-advance marks behave identically,
but **the standalone glyphs do not share metrics between faces** — the earlier claim that the
faces are "identical where it matters" holds for codepoints and GPOS, not for advances or vertical
placement:

| Glyph | Almouzios adv / bbox y | Neanes adv / bbox y |
|---|---|---|
| `martyriaNotePa` `U+E139` | 1000 / **−339 … −91** (below baseline) | 737 / **68 … 370** (above baseline) |
| `fthoraDiatonicPa` `U+E1D1` | 900 / 643 … 1047 | 364 / 653 … 1040 |
| `fthoraSoftChromaticDi` `U+E1DA` | 900 / 840 … 1065 | 960 / 800 … 1104 |
| `diesis2` `U+E1F0` | 0 / −230 … 6 | 0 / 290 … 609 |
| `martyriaAlphaAbove` `U+E172` | 0 / −96 … 509 | 0 / −186 … 320 |

Two consequences for the design:

1. **Standalone fthores sit high above the baseline** (y ≈ 0.65–1.1 em) because the font expects
   them over a neume. Drawn on their own with `textBaseline: "alphabetic"` they land far above
   the intended spot.
2. **A martyria's note letter is below the baseline in Almouzios and above it in Neanes.** Any
   hard-coded `y` offset would break on a font swap.

So place every symbol from its measured box rather than from a constant: use
`ctx.measureText(s)` and centre on `actualBoundingBoxLeft/Right` and
`actualBoundingBoxAscent/Descent`. That keeps the font picker a genuine one-line `font-family`
change. (Test-side note: the harness's `measureText` model returns width only, so geometry tests
must assert on the placement helper's inputs, not on real ink boxes.)

---

## Public hosting (verified)

**Yes — both are publicly fetchable by the page today, via jsDelivr, with correct headers.**
Tested with `Origin: https://calinburloiu.github.io`:

| URL | Status | `Content-Type` | CORS | Transfer (brotli) |
|---|---|---|---|---|
| `cdn.jsdelivr.net/gh/ilizol/Almouzios@<sha>/Almouzios.otf` | 200 | `font/otf` | `*` | **87 KB** (of 213 KB) |
| `cdn.jsdelivr.net/gh/neanes/sbmufl@<sha>/fonts/Neanes.otf` | 200 | `font/otf` | `*` | **89 KB** (of 249 KB) |

All the `…Engraving`, `NeanesRTL` and `NeanesStathisSeries` faces sit in the same `fonts/`
directory and are reachable the same way. `@font-face` accepts OTF directly
(`format('opentype')`); no conversion is needed just to make it load.

### Two gotchas

1. **Neither repo has any tags or releases** — `data.jsdelivr.com` reports zero versions for
   both, and `@latest` silently falls back to the default branch. So a `@latest` or branch URL
   is *mutable* (the upstream author can change the glyphs under you) and jsDelivr caches it for
   only 12 h. **Pin the commit SHA**, which returns
   `cache-control: max-age=31536000, immutable`. Verified working:
   `…/gh/ilizol/Almouzios@b9703ba74b18721bdacbf1421d2fa2c6009a906f/Almouzios.otf` and
   `…/gh/neanes/sbmufl@9519b83e43ddf1dc655c9a1f3be88ec01017baf5/fonts/Neanes.otf`.
2. **`raw.githubusercontent.com` works but is the wrong tool**: it does send
   `access-control-allow-origin: *`, so the font *will* load — but it serves
   `application/octet-stream` with **no compression** (the full 213 KB on the wire, 2.5× the
   jsDelivr transfer) and a 5-minute cache, and GitHub does not offer it as a production CDN.

### Recommendation: vendor anyway

Both CDN paths work, but self-hosting the woff2 in this repo beats them on every measure:

- **Smaller**: ~71 KB woff2 vs ~87 KB brotli'd OTF.
- **Same-origin on github.io**, so no third-party dependency and no CORS surface at all.
- **Keeps the app openable from `file://` with zero network**, which is its current character.
- **Immune to upstream changes**, without needing SHA-pinning discipline.

Note that GitHub Pages already *is* "publicly hosted" — putting `fonts/Neanes.woff2` in the
repo means the page downloads it from `calinburloiu.github.io`, satisfying the requirement
directly. Use jsDelivr only if you'd rather not commit binaries.

---

## Licensing: can we ship these on github.io?

**Yes — all of them, including commercially. No permission needed.** Checked against the actual
licence texts, not assumed.

The project is **Apache License 2.0** (`/LICENSE`). The fonts are **SIL OFL 1.1**. These combine
cleanly: the OFL FAQ states that *"only the portions based on the Font Software are required to
be released under the OFL"*, so an Apache-2.0 app that bundles OFL fonts is a permitted
aggregation — the app stays Apache-2.0, the fonts stay OFL.

Serving them from `calinburloiu.github.io` is squarely the intended use. The OFL FAQ calls
loading fonts via `@font-face` *"recommended and explicitly allowed by the licensing model"*.
Note that this **is** redistribution (unlike merely linking Google Fonts), which is what makes
the checklist below mandatory rather than optional.

### Verified: neither font declares a Reserved Font Name

This is the one OFL clause that could have caused trouble, and it does not apply. I grepped both
licence files: the only occurrences of "Reserved Font Name" are the boilerplate *definition* in
the licence body — **no `with Reserved Font Name …` declaration follows any copyright
statement** in either. Name-table check:

| Font | nameID 0 (copyright) | RFN declared |
|---|---|---|
| Almouzios | `SIL OPEN FONT LICENSE Version 1.1` | none |
| Neanes / NeanesEngraving | `Copyright (c) 2022, Daniel` | none |
| NeanesStathisSeries | *(absent)* | none |

Consequence: **OTF→WOFF2 conversion is unrestricted and we may keep the original names.** (Had
an RFN been declared, the OFL FAQ's WOFF carve-out would still have covered us: a conversion
keeps its name provided the font data is unchanged apart from compression and WOFF metadata is
either omitted or preserved intact. `fontTools`' `flavor = 'woff2'` omits WOFF metadata and
preserves the tables, so it qualifies either way.)

### Checklist before shipping

1. Commit each font's **full OFL text** alongside the woff2 (e.g. `fonts/OFL-Neanes.txt`,
   `fonts/OFL-Almouzios.txt`). The FAQ permits a metadata-only link for webfonts but *"strongly
   recommends against"* it — and since we're vendoring files into a public repo, shipping the
   text costs nothing.
2. Add a **NOTICE / third-party section** to `README.md` making clear the Apache-2.0 licence
   does **not** cover the fonts. OFL clause 5 forbids redistributing the Font Software under any
   other licence, so the repo must not let the root `LICENSE` be read as covering `fonts/`.
3. **Attribute explicitly.** Neanes is `Copyright (c) 2022, Daniel`; Almouzios ships no copyright
   line upstream, so if it is ever added, credit
   [ilizol/Almouzios](https://github.com/ilizol/Almouzios) (built on *KA Almouzios*). As a
   courtesy — matching what Neanes itself does — acknowledge the "EZ" Byzantine Music Font
   Package of St. Anthony's Greek Orthodox Monastery, the shared ancestor of these faces.
4. Never offer the font files as a **standalone download** — OFL forbids selling them by
   themselves; bundled-in-an-app use (free or paid) is fine.
5. If shipping `NeanesStathisSeries`, take it from **`neanes/sbmufl/fonts/`** (covered by that
   directory's `LICENSE`), not from the standalone `neanes-StathisSeriesFont` repo, which has no
   licence file of its own.

---

## A font picker: recommended, and nearly free

Offering the client a choice of face is well supported by the coverage data: all four SBMuFL faces are **352/352 glyphs
with identical `mark`/`mkmk` GPOS**, so switching between them is a **single `font-family`
change with no glyph remapping and no re-authoring of the symbol tables**. A saved chart stays
valid across a switch.

That makes a "Byzantine font" dropdown a few lines of work, and it genuinely serves the client:
Neanes or NeanesEngraving for a clean page; StathisSeries for that editorial tradition;
Almouzios for reproducing the heavy, calligraphic look of the scanned book. Total cost is
~70 KB per face — so consider lazy-loading only the selected one rather than all of them.

Because the symbol ids are semantic (step 1 of the notes below), a Unicode-encoded face could
join the same dropdown as a further choice, routed through `UNICODE_MAP` instead of
`SBMUFL_MAP` — see [`OTHER-FONTS.md`](OTHER-FONTS.md#if-noto-music-is-ever-added) for what that
would cost.

---

## Implementation notes for the Byzantine mode

1. **Store semantics, not codepoints.** Each dropdown entry should be an id like
   `{ id: 'fthoraNenano', label: 'Fthora nenano' }`, with two lookup tables:
   `UNICODE_MAP['fthoraNenano'] = 0x1D0C7` and `SBMUFL_MAP['fthoraNenano'] = 0xE1D4`-style.
   Switching fonts then never invalidates a saved chart.
2. **Martyria = two selects** (note letter + ichos sign), matching the vertical stacking in the
   UI, as issue #2 proposes. With an SBMuFL font: emit `noteGlyph + ichosAboveGlyph` in a single
   `fillText` — GPOS does the rest.
3. **Vendor the woff2, don't link a CDN.** Convert the OTF locally (fontTools: `f.flavor =
   'woff2'`) and commit ~69 KB next to `style.css` with the OFL text — OFL explicitly permits
   format conversion and redistribution. This keeps the app's open-from-`file://`, zero-network,
   no-build-step character intact, which a Google Fonts or jsDelivr `<link>` would give up.
4. **Canvas + webfonts:** `render()` must wait for the face before drawing, or the first paint
   (and a PNG export triggered early) silently falls back. Use
   `await document.fonts.load('40px "Neanes"')` / `document.fonts.ready` and re-render on
   resolve.
5. **PNG export:** unaffected — canvas is tainted by cross-origin images, never by fonts.

## Sources

- [SBMuFL standard](https://github.com/neanes/sbmufl) ·
  [`metadata/glyphnames.json`](https://github.com/neanes/sbmufl/blob/master/metadata/glyphnames.json) (387 glyphs, name → codepoint) ·
  [SBMuFL fonts + OFL licence](https://github.com/neanes/sbmufl/tree/master/fonts)
- [Almouzios](https://github.com/ilizol/Almouzios)
- [Neanes scorewriter](https://github.com/neanes/neanes) ·
  [St. Anthony's "EZ" fonts](https://stanthonysmonastery.org/pages/writing-with-byzantine-notation)
