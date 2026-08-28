# Non-SBMuFL fonts — evaluated, not shipped

Companion to [`FONTS.md`](FONTS.md), which holds the generic findings and explains why an SBMuFL
font won. This file keeps the record of every **non-SBMuFL** option that was looked at: Noto
Music (the Unicode-encoded runner-up, still useful as an export/interop path) and the options
that were rejected outright.

**An implementer of the Byzantine mode does not need this file** — go to
[`SBMUFL-FONTS.md`](SBMUFL-FONTS.md) instead. This is here so the research is not lost and so a
future Unicode-export feature has somewhere to start.

---

## Noto Music (standards-based fallback / export path)

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

### If Noto Music is ever added

Because the symbol ids are semantic (step 1 of the implementation notes in
[`SBMUFL-FONTS.md`](SBMUFL-FONTS.md#implementation-notes-for-the-byzantine-mode)), **Noto Music
can join the same font dropdown** as a further choice, routed through `UNICODE_MAP` instead of
`SBMUFL_MAP`. It is the only entry needing the manual two-`fillText` stacking path, so add it
only if the Unicode-export benefit is wanted:

- **Martyria composition:** two `fillText` calls instead of one; keep a small per-symbol
  vertical-offset table to work around the known placement inconsistency above.

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

## Sources

- [Noto Music specimen (Google Fonts)](https://fonts.google.com/noto/specimen/Noto+Music) ·
  [Noto Music on Adobe Fonts](https://fonts.adobe.com/fonts/noto-music) ·
  [Noto docs specimen](https://notofonts.github.io/noto-docs/specimen/NotoMusic/) ·
  [Noto Music Byzantine positioning bug](https://github.com/googlefonts/noto-fonts/issues/1310)
- [Neume Sans (WIP)](https://github.com/ilizol/Neume-Sans) ·
  [CTAN byzfonts](https://ctan.org/pkg/byzfonts) ·
  [St. Anthony's "EZ" fonts](https://stanthonysmonastery.org/pages/writing-with-byzantine-notation)
