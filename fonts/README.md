# Vendored fonts

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

### Why it is vendored rather than linked

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
