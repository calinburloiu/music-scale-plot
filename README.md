# Music Scale Plot

A client-side web application for plotting charts of microtonal music scales expressed in just intonation.

Supports scales from various traditions including Byzantine/psaltic music, Ottoman makam, and Western tuning systems. Intervals are entered as ratios (e.g. `9/8` for a major tone, `5/4` for a just major third) and the resulting chart displays vertically stacked rectangles whose heights are proportional to each interval's size in cents.

## Usage

Open `index.html` in a browser. No build step or server required. The page loads `style.css` and, in order, `byzantine.js`, `smufl.js`, `symbols-ui.js`, `byzantine-ui.js` and `app.js` (all `defer`), from the same directory.

1. Use the scale editor to define notes and intervals.
2. The chart updates in real-time as you type.
3. Click **Save as PNG** to export the chart.

## Development

The app itself has no dependencies and no build step. The test suite uses Node's
built-in test runner with jsdom as its only dev dependency:

```bash
npm install
npm test
```

**All development follows strict TDD (red/green/refactor)** — write the failing
test first. See [docs/TESTING.md](docs/TESTING.md) for the workflow, what is and
is not tested, and how the test harness loads the app's scripts.

## License

Apache License 2.0 — see [LICENSE](LICENSE).

### Third-party assets

`fonts/Neanes.woff2` and `fonts/BravuraText.woff2` are **not** covered by the Apache-2.0
licence above.

`fonts/Neanes.woff2` is the [Neanes](https://github.com/neanes/sbmufl) Byzantine music font,
Copyright (c) 2022, Daniel, licensed under the [SIL Open Font License 1.1](fonts/OFL.txt).

`fonts/BravuraText.woff2` is the [Bravura](https://github.com/steinbergmedia/bravura) SMuFL
reference font (the *Text* optical variant), Copyright © 2026 Steinberg Media Technologies
GmbH, licensed under the SIL Open Font License 1.1 **with Reserved Font Name "Bravura"**
([fonts/Bravura-OFL.txt](fonts/Bravura-OFL.txt)). Because it declares a Reserved Font Name, it
must **not** be modified, subsetted or re-converted while still calling itself "Bravura" — the
vendored file is upstream's own woff2 build, byte for byte; see
[fonts/README.md](fonts/README.md) for the sha256 and the full terms.

See [fonts/README.md](fonts/README.md) for both fonts' provenance and terms.
