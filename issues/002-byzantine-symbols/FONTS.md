# Byzantine / psaltic fonts for issue #2 — findings

Goal: render the symbols seen in the reference chart of issue #2 — **fthores** (left of the
box separators), **martyries** (right, a stylized Greek note letter with an ichos/genus sign
stacked above or below it), and **microtonal accidentals** (diesis / yfesis).

All candidates below were downloaded and inspected locally (glyph coverage, metrics, OpenType
tables) and rendered to the specimen images in `specimens/`.

## TL;DR

**Ship an SBMuFL font — `Almouzios` or `Neanes`, both OFL 1.1 — vendored as a woff2 in the
repo. Keep Noto Music only as an optional standards-based export path.**

| Font | Licence | Encoding | Hosting | Verdict |
|---|---|---|---|---|
| **Almouzios** | OFL 1.1 | SBMuFL (PUA) | self-host / jsDelivr | ⭐ Heavier, calligraphic letterforms — by eye, the closest to the reference scan |
| **Neanes** (+ `…Engraving`, `StathisSeries`) | OFL 1.1 | SBMuFL (PUA) | self-host / jsDelivr | ⭐ Lighter "engraved" letterforms; **functionally identical** to Almouzios — a family, by the SBMuFL authors |
| Noto Music | OFL 1.1 | Unicode `U+1D000` | Google Fonts / Adobe Fonts | Fallback / Unicode-export path only — see the trade-off below |

### Why not Noto Music as the default, despite Google Fonts hosting?

> **Update:** the requirement was relaxed — the font need not be on Google/Adobe Fonts, only
> publicly hosted. That removes Noto Music's sole remaining advantage outright. Serving a
> vendored woff2 from the repo's own GitHub Pages site *is* public hosting, so the choice is now
> decided purely on encoding and glyph repertoire, where SBMuFL wins on every axis.

Because the hosting advantage cancels itself out anyway, and SBMuFL wins on everything else:

- **The Google Fonts advantage evaporates the moment we care about offline use.** This app opens
  from `file://` with zero network and no build step. Preserving that means vendoring a woff2 —
  at which point "it's on Google Fonts" buys nothing, and a 71 KB local Almouzios is no worse
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

### Almouzios vs Neanes — the differences

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

**Conclusion: this is a typographic choice and it belongs to the client, not to us.** The two are
drop-in interchangeable, so implement against SBMuFL, put both specimens in front of them, and
let them decide. Swapping afterwards is a one-line `font-family` change.

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

---

## Option A — Almouzios ⭐

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
- **Automatic stacking** via the zero-advance `…Above` / `…Below` marks (see above). This
  removes the fiddliest part of the feature.

---

## Option B — Neanes family ⭐

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

## Option C — Noto Music (standards-based fallback / export path)

- Google Fonts: <https://fonts.google.com/noto/specimen/Noto+Music> · also on Adobe Fonts.
- Licence: **SIL OFL 1.1**.
- Encoding: Unicode `U+1D000–1D0F5`.
- **Verified coverage: all 246 assigned Byzantine codepoints present, none missing.**
- Google serves the whole Byzantine block as a single 35 KB woff2 subset:

  ```html
  <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Noto+Music&display=swap">
  ```
  `unicode-range: U+25CC, U+2669-266F, U+1D000-1D0F5, U+1D100-1D126, U+1D129-1D1EA, U+1D200-1D245`

- Specimen: `specimens/noto-music.png`. The glyph shapes are a faithful, fairly thin rendering
  of the traditional signs and match the reference chart's repertoire.

### Codepoints relevant to issue #2

| Role in the chart | Codepoints |
|---|---|
| Note letters of the martyria (Πα Βου Γα Δι Κε Ζω Νη — the "stylized Greek letter") | `U+1D0E9`–`U+1D0EF` — `ARKTIKO PA/VOU/GA/DI/KE/ZO/NI` |
| Ichos signs stacked with them | `U+1D0A2`–`U+1D0AB`, `U+1D0B1`–`U+1D0B3` — `MARTYRIA PROTOS ICHOS` … `MARTYRIA PLAGIOS TETARTOS ICHOS` |
| Fthores (left-hand markers) | `U+1D0BA`–`U+1D0CC` — `FTHORA DIATONIKI PA/NANA/DI/KE/ZO/NI ANO/NI KATO`, `FTHORA MALAKON CHROMA …`, `FTHORA SKLIRON CHROMA …`, `FTHORA NENANO`, `FTHORA ENARMONIOS ANTIFONIA`; plus `U+1D0C8`–`U+1D0CA` `CHROA ZYGOS / KLITON / SPATHI` |
| Microtonal accidentals | `U+1D0CD`–`U+1D0D9` — `YFESIS/DIESIS TRITIMORION`, `DIESIS TETARTIMORION`, `DIESIS APLI/MONOGRAMMOS/DIGRAMMOS/TRIGRAMMOS` (2/4/6/8 twelfths), the matching `YFESIS` set, `GENIKI DIESIS`, `GENIKI YFESIS` |
| Older / archaic fthores, if wanted | `U+1D034` `FTHORA ARCHAION`, `U+1D035` `IMIFTHORA`, `U+1D0B9` `FTHORA ARCHAION DEYTEROU ICHOU`, `U+1D0B6` `ENARXIS KAI FTHORA VOU` |

The `DIESIS/YFESIS …DODEKATA` family maps directly onto 72-EDO twelfths-of-a-tone, which is
exactly what the app's EDO mode computes — a nice fit.

### Caveats

- Glyph vertical placement is inconsistent between signs of contrasting height; there is a
  known upstream bug, [notofonts/music#1](https://github.com/googlefonts/noto-fonts/issues/1310)
  ("Wrong positions for Byzantine musical symbols with contrasting heights"). Since we draw on
  canvas we control `y` per symbol anyway, so this is manageable but means **we must position
  the martyria's two halves ourselves** (measure the glyph bbox / use a per-symbol offset table).
- Stacking is manual: two `fillText` calls, or one call per line with a hand-tuned offset.
- Metrics for reference: upem 1000, typo ascender 1389, descender −398. Advances vary a lot
  (312–619 for the symbols we care about), so centre horizontally with `measureText`.

---

## Evaluated and rejected

| Option | Verdict |
|---|---|
| **"EZ" Byzantine Music Fonts** (St. Anthony's Monastery) | The ancestor of most modern Byzantine faces and visually excellent, but legacy 8-bit encoded, distributed for Windows/Mac with Word macros, and **the site states no licence terms** — no explicit redistribution/webfont permission. Not usable for a public web page without asking the monastery. Use the OFL-licensed Neanes/Almouzios derivatives instead. |
| **CTAN `byzfonts`** ([pkg page](https://ctan.org/pkg/byzfonts), [archive](https://ctan.org/tex-archive/fonts/byzfonts)) | LPPL, LaTeX-oriented. I checked the archive tree: it ships **only METAFONT sources** — `byzf.mf`, `byyf.mf`, `bzal.mf`, an `Alphabet/` tree (Caps, Smalls, Ligs, Witns), `Defs/`, four `.sty` files, `XAP_*` symbol collections and `Examples/`. No TTF/OTF/Type 1 binaries at all, so it would need an MF→OTF conversion (mftrace/FontForge) plus a hand-built cmap before it could be a webfont — and the result would still be a bitmap-traced outline. Not worth it given the OTF options above. |
| **`ilizol/Neume-Sans`** (OFL 1.1) | Explicitly marked `[WIP]` in its README; generated with opentype.js. Worth watching, not worth shipping. |
| **Noto Sans Symbols 2** | Despite the name, **does not** cover the Byzantine block — that's Noto Music's job. |
| **Symbola / FreeSerif / Musica** | Cover the block to varying degrees but are generic pan-Unicode faces with weak Byzantine shapes; Symbola's licence was changed to a restrictive one in later releases. No advantage over Noto Music. |
| **`music-notation.info` "Byzantina"** page | Site's TLS handshake fails; the font is in any case an old shareware/legacy-encoded face from the pre-Unicode era. Superseded. |
| **analogion.com technology page / Luc Devroye's font list** | Useful directories, but everything free-and-current they point at funnels back to the EZ lineage, i.e. Neanes / Almouzios. Nothing new that is both openly licensed and Unicode/SBMuFL encoded. |

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

Note that GitHub Pages already *is* "publicly hosted" — putting `fonts/Almouzios.woff2` in the
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

1. Commit each font's **full OFL text** alongside the woff2 (e.g. `fonts/OFL-Almouzios.txt`,
   `fonts/OFL-Neanes.txt`). The FAQ permits a metadata-only link for webfonts but *"strongly
   recommends against"* it — and since we're vendoring files into a public repo, shipping the
   text costs nothing.
2. Add a **NOTICE / third-party section** to `README.md` making clear the Apache-2.0 licence
   does **not** cover the fonts. OFL clause 5 forbids redistributing the Font Software under any
   other licence, so the repo must not let the root `LICENSE` be read as covering `fonts/`.
3. **Attribute explicitly.** Almouzios ships no copyright line upstream, so credit
   [ilizol/Almouzios](https://github.com/ilizol/Almouzios) (built on *KA Almouzios*); Neanes is
   `Copyright (c) 2022, Daniel`. As a courtesy — matching what Neanes itself does — acknowledge
   the "EZ" Byzantine Music Font Package of St. Anthony's Greek Orthodox Monastery, the shared
   ancestor of these faces.
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
Almouzios for reproducing the heavy, calligraphic look of the scanned book; Neanes or
NeanesEngraving for a cleaner page; StathisSeries for that editorial tradition. Total cost is
~70 KB per face — so consider lazy-loading only the selected one rather than all of them.

Because the symbol ids are semantic (step 1 of the notes below), **Noto Music can join the same
dropdown** as a fourth choice, routed through `UNICODE_MAP` instead of `SBMUFL_MAP`. It is the
only entry needing the manual two-`fillText` stacking path, so add it only if the Unicode-export
benefit is wanted.

---

## Implementation notes for the Byzantine mode

1. **Store semantics, not codepoints.** Each dropdown entry should be an id like
   `{ id: 'fthoraNenano', label: 'Fthora nenano' }`, with two lookup tables:
   `UNICODE_MAP['fthoraNenano'] = 0x1D0C7` and `SBMUFL_MAP['fthoraNenano'] = 0xE1D4`-style.
   Switching fonts then never invalidates a saved chart.
2. **Martyria = two selects** (note letter + ichos sign), matching the vertical stacking in the
   UI, as issue #2 proposes.
   - With an SBMuFL font: emit `noteGlyph + ichosAboveGlyph` in a single `fillText` — GPOS does
     the rest.
   - With Noto Music: two `fillText` calls; keep a small per-symbol vertical-offset table to
     work around the known placement inconsistency.
3. **Vendor the woff2, don't link a CDN.** Convert the OTF locally (fontTools: `f.flavor =
   'woff2'`) and commit ~71 KB next to `style.css` with the OFL text — OFL explicitly permits
   format conversion and redistribution. This keeps the app's open-from-`file://`, zero-network,
   no-build-step character intact, which a Google Fonts or jsDelivr `<link>` would give up.
4. **Canvas + webfonts:** `render()` must wait for the face before drawing, or the first paint
   (and a PNG export triggered early) silently falls back. Use
   `await document.fonts.load('40px "Almouzios"')` / `document.fonts.ready` and re-render on
   resolve.
5. **PNG export:** unaffected — canvas is tainted by cross-origin images, never by fonts.

## Sources

- [Noto Music specimen (Google Fonts)](https://fonts.google.com/noto/specimen/Noto+Music) ·
  [Noto Music on Adobe Fonts](https://fonts.adobe.com/fonts/noto-music) ·
  [Noto docs specimen](https://notofonts.github.io/noto-docs/specimen/NotoMusic/)
- [Byzantine Musical Symbols Unicode block](https://en.wikipedia.org/wiki/Byzantine_Musical_Symbols) ·
  [Codepoints listing](https://codepoints.net/byzantine_musical_symbols)
- [SBMuFL standard](https://github.com/neanes/sbmufl) ·
  [SBMuFL fonts + OFL licence](https://github.com/neanes/sbmufl/tree/master/fonts)
- [Almouzios](https://github.com/ilizol/Almouzios) · [Neume Sans (WIP)](https://github.com/ilizol/Neume-Sans)
- [Neanes scorewriter](https://github.com/neanes/neanes) ·
  [St. Anthony's "EZ" fonts](https://stanthonysmonastery.org/pages/writing-with-byzantine-notation)
- [CTAN byzfonts](https://ctan.org/pkg/byzfonts) ·
  [Noto Music Byzantine positioning bug](https://github.com/googlefonts/noto-fonts/issues/1310)
