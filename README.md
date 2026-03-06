# Music Scale Plot

A client-side web application for plotting charts of microtonal music scales expressed in just intonation.

Supports scales from various traditions including Byzantine/psaltic music, Ottoman makam, and Western tuning systems. Intervals are entered as ratios (e.g. `9/8` for a major tone, `5/4` for a just major third) and the resulting chart displays vertically stacked rectangles whose heights are proportional to each interval's size in cents.

## Usage

Open `index.html` in a browser. No build step or server required. The page loads `style.css` and `app.js` from the same directory.

1. Use the scale editor to define notes and intervals.
2. The chart updates in real-time as you type.
3. Click **Save as PNG** to export the chart.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
