# Music Scale Plot — Architecture & Implementation Plan

## Overview

Music Scale Plot is a zero-dependency, client-side web application consisting of a single HTML file with embedded CSS and JavaScript. No build tools, frameworks, or external libraries are used. The app runs by opening `index.html` directly in a browser.

## File Structure

```
music-scale-plot/
├── index.html      # Single-page application (HTML + CSS + JS)
├── LICENSE
├── README.md
└── PLAN.md         # This document
```

Everything lives in one `index.html` file for maximum simplicity and portability. The HTML contains three embedded sections:

- `<style>` — all CSS
- `<body>` — the markup skeleton
- `<script>` — all JavaScript logic

## HTML Layout

The page is split into two side-by-side panels using CSS flexbox:

| Left panel — Scale Editor | Right panel — Chart |
|---|---|
| Form-based editor for notes and intervals | `<canvas>` element displaying the scale chart |
| Add / Remove note buttons | Save as PNG button |

## Data Model

The scale is represented as a single JavaScript array of objects:

```js
// Conceptual structure — not literal code
scaleData = [
  { type: "note", degree: 1, name: "C" },
  { type: "interval", ratio: "9/8", label: "major tone" },
  { type: "note", degree: 2, name: "D" },
  ...
]
```

This flat list mirrors the alternating note/interval rows in the editor UI. It is rebuilt from the DOM inputs on every change, keeping the DOM as the single source of truth (no separate state syncing needed for this small app).

## Scale Editor

The editor is a vertical list of rows, alternating between **note rows** and **interval rows**.

### Note row

- Static label: `Note {degree}`
- Text input: note name (optional, placeholder "name")

### Interval row

- Text input: ratio in `p/q` format (placeholder "ratio", e.g. `9/8`)
- Text input: interval label (optional, placeholder "label")

### Controls

- **Add note** button: appends one interval row + one note row at the bottom. The new note's degree increments automatically.
- **Remove last note** button: removes the last note row and its preceding interval row. Disabled when only two notes remain (minimum viable scale = one interval).

All inputs fire an `input` event listener that triggers a chart re-render, giving real-time feedback.

## Chart Rendering (Canvas)

### Geometry

The chart is a vertical stack of rectangles drawn on an HTML5 `<canvas>`. The stack grows **upward** from a baseline so that Note 1 is at the bottom and the highest note is at the top — matching the musical intuition of pitch rising upward.

### Sizing

1. Parse each interval ratio string `"p/q"` into a numeric value `p / q`.
2. Convert to cents: `cents = 1200 * Math.log2(ratio)`.
3. Choose a pixels-per-cent scale factor so the chart fits the available canvas height. A fixed factor (e.g. 3 px/cent) works well for typical scales; the canvas height is set dynamically to accommodate the total cents.
4. Each rectangle's height = `cents * pxPerCent`.
5. All rectangles share the same fixed width.

### Drawing

For each interval (bottom to top):

1. Draw a white-filled rectangle with a black 1 px border.
2. Draw the **interval label** (if any) vertically centered inside the rectangle, to the right of the stack.
3. Draw the **note name** of the note below aligned with the bottom edge, and the note name above aligned with the top edge, to the right of the stack.

Additionally, **note degree numbers** are drawn to the left of the stack at each note boundary, along with the cumulative cents value from the root.

### Text layout

- Note names and degree numbers are placed at the horizontal line boundaries.
- Interval labels are placed at the vertical midpoint of each rectangle.
- All text is rendered to the right (or left for degrees) of the rectangle stack to avoid overlap.

### Canvas resolution

The canvas `width` and `height` attributes are set to `2×` the CSS display size (device-pixel-ratio aware), and the context is scaled by 2, producing crisp output for both screen display and PNG export.

## PNG Export

A **Save as PNG** button calls `canvas.toDataURL("image/png")`, creates a temporary `<a>` element with the `download` attribute set to `scale.png`, and programmatically clicks it. This triggers a file download with no server involvement.

## Event Flow

```
User types in editor  ──►  `input` event on container
                               │
                               ▼
                        Read all inputs from DOM
                        Parse into scaleData[]
                               │
                               ▼
                        Validate ratios (skip
                        rendering on invalid input)
                               │
                               ▼
                        Clear canvas, compute
                        geometry, draw chart
```

Add/Remove note buttons modify the DOM (insert or remove rows) and then trigger the same render path.

## Styling

- Clean, minimal design with a light background.
- Editor inputs are styled for comfortable editing.
- The two panels are responsive: on narrow viewports they stack vertically instead of side-by-side.
- The canvas panel uses `position: sticky` so the chart stays visible while scrolling a long editor list.

## Summary

| Concern | Approach |
|---|---|
| State management | DOM is the source of truth; read inputs on each change |
| Rendering | HTML5 Canvas 2D API |
| Reactivity | Single `input` event listener on the editor container (event delegation) |
| Export | `canvas.toDataURL()` + programmatic download |
| Dependencies | None |
| Build step | None — open `index.html` in a browser |
