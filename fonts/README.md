# Vendored fonts

Two faces, both under the SIL Open Font License 1.1, both vendored rather than linked for
the reason set out under [Why they are vendored](#why-they-are-vendored-rather-than-linked).

| File | Used for | Licence | Reserved Font Name |
|---|---|---|---|
| [`Neanes.woff2`](Neanes.woff2) | Byzantine martyries, fthores, alterations | [OFL 1.1](OFL.txt) | none |
| [`BravuraText.woff2`](BravuraText.woff2) | Generic (SMuFL) accidentals | [OFL 1.1](Bravura-OFL.txt) | **"Bravura"** |

## Neanes

`Neanes.woff2` is the Byzantine music font used for martyries, fthores and microtonal
accidentals. It is **not covered by the repository's Apache-2.0 licence** — see below.

| | |
|---|---|
| Upstream | [neanes/sbmufl](https://github.com/neanes/sbmufl) → `fonts/Neanes.otf` |
| Commit | `9519b83e43ddf1dc655c9a1f3be88ec01017baf5` |
| Version | 1.0.9 |
| Copyright | Copyright (c) 2022, Daniel |
| Licence | [SIL Open Font License 1.1](OFL.txt) — no Reserved Font Name is declared |
| Encoding | [SBMuFL](https://neanes.github.io/sbmufl/) (Private Use Area, `U+E000`+) |
| Conversion | OTF → WOFF2 with `fontTools` (`font.flavor = "woff2"`); outlines, `cmap` and the `mark`/`mkmk` GPOS tables are unchanged |
| Size | 68 KB (from 249 KB OTF) |

The Neanes fonts derive from the "EZ" Byzantine Music Font Package of St. Anthony's Greek
Orthodox Monastery, acknowledged upstream.

### Why they are vendored rather than linked

The app opens from `file://` with no build step and no network, and that has to keep working.
A CDN or Google Fonts `<link>` would silently drop every symbol offline, and PUA codepoints have
no fallback glyph — the text would simply disappear, not degrade. Serving the file from this
repository also means GitHub Pages serves it same-origin, with no third-party dependency and no
CORS surface. See [`issues/002-byzantine-symbols/FONTS.md`](../issues/002-byzantine-symbols/FONTS.md)
for the full font survey and the licensing analysis.

### Using it

```css
@font-face {
  font-family: "Neanes";
  src: url("fonts/Neanes.woff2") format("woff2");
  font-display: block;
}
```

Adjust the relative path to the page. Wait for the face before drawing to a canvas
(`await document.fonts.load('40px "Neanes"')`), or the first paint falls back to blanks.

### Terms to respect

- Keep [`OFL.txt`](OFL.txt) alongside the font file.
- Do not offer the font as a standalone download; bundling it in an application is what the OFL
  permits.
- The OFL covers only the font. The rest of the repository stays under Apache-2.0.

## Bravura Text

`BravuraText.woff2` is the SMuFL reference font, used for the generic microtonal accidentals
(standard, 24- and 72-EDO, Sagittal, Turkish, Arabic, Persian, just intonation). It is **not
covered by the repository's Apache-2.0 licence** — see below.

| | |
|---|---|
| Upstream | [steinbergmedia/bravura](https://github.com/steinbergmedia/bravura) → `redist/woff/BravuraText.woff2` |
| Commit | `37b194378b710cc40e406ab6c4b07608bb9548ae` |
| Version | 1.482 |
| Copyright | Copyright © 2026, Steinberg Media Technologies GmbH |
| Licence | [SIL Open Font License 1.1](Bravura-OFL.txt) — **with Reserved Font Name "Bravura"** |
| Encoding | [SMuFL 1.4](https://w3c.github.io/smufl/latest/) (Private Use Area, `U+E000`+) |
| Conversion | **none** — this is upstream's own woff2 build, byte for byte |
| Size | 447 KB, sha256 `1f2711e9…e07e1574` |

### Why the *Text* face and not plain Bravura

Both carry the same 3 468 SMuFL symbols at the same codepoints. Plain Bravura declares an
ascent and a descent of 2.012 em each — a 4 em line box, since it is scaled for a notation
engine where one em is the staff height — and its glyphs straddle the baseline. Bravura Text
is 1.13/0.33 em, is scaled to sit inline with text at the same point size, and puts every
accidental's ink entirely above the baseline, exactly as Neanes does. It also carries three
blank spacer characters (`U+0020`, `-`, `=` = ½, 1 and 2 staff spaces) used to space a
compound accidental. See
[`issues/013-generic-accidentals/2026-09-01-smufl-accidentals-research.md`](../issues/013-generic-accidentals/2026-09-01-smufl-accidentals-research.md).

### Terms to respect — note the Reserved Font Name

- Keep [`Bravura-OFL.txt`](Bravura-OFL.txt) alongside the font file. It carries the copyright
  line and the RFN declaration, unlike the bare `OFL.txt` kept for Neanes.
- **Do not modify this file and keep the name.** Unlike Neanes, Bravura declares an RFN, so a
  Modified Version must be renamed. Per the OFL FAQ, *subsetting counts as modification*
  (FAQ 2.6), and so does format conversion unless the data is unchanged and the WOFF metadata
  is faithful or absent (FAQ 2.2). Shipping upstream's own woff2 unaltered is what keeps the
  name usable — replace it only with a newer upstream build, never with a locally converted or
  subsetted one.
- Do not offer the font as a standalone download.
- The OFL covers only the font. The rest of the repository stays under Apache-2.0.

### Using it

```css
@font-face {
  font-family: "Bravura Text";
  src: url("fonts/BravuraText.woff2") format("woff2");
  font-display: block;
}
```

Wait for the face before drawing to a canvas (`await document.fonts.load('40px "Bravura Text"')`).
In the DOM, a symbol wants `line-height: 1`, and a compound accidental containing a `U+0020`
spacer wants `white-space: pre`.
