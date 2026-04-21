# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Client-side web app for plotting microtonal music scales (Byzantine/psaltic, Ottoman makam, Western JI). Zero dependencies, no build step, no framework. Open `index.html` directly in a browser to run.

## Files

- `index.html` — page skeleton; loads `style.css` and `app.js` (deferred).
- `app.js` — all logic: editor DOM management, interval parsing, canvas rendering, Web Audio playback, PNG export, color picker.
- `style.css` — all styling.
- `docs/PLAN-01.md` — architecture / design plan (source of truth for intended behavior).

## Architecture

The DOM **is** the data model. `readScaleData()` walks `#editor` children (alternating `.note-row` and `.interval-row`) and produces the scale representation used by `render()`. Any change to the editor triggers re-render via delegated `input`/`change` listeners on `#editor`.

Key concepts:

- **Interval types** (`#interval-type`): `ratio` (e.g. `9/8`), `edo` (step count against `#edo-divisions`), or `cents`. `intervalToCents()` / `intervalToRatio()` / `intervalToDisplayString()` dispatch on the current type. Switching type calls `resetScaleToDefault()` — intervals are not cross-converted.
- **Rendering**: `render()` draws vertically stacked rectangles on a `<canvas>`, heights proportional to cents (`PX_PER_CENT`). Canvas uses `devicePixelRatio` scaling; `displayZoom` only affects CSS display size, not the backing store used for PNG export.
- **Audio**: single shared `AudioContext`, single active oscillator. `getFrequencyForDegree()` multiplies ratios cumulatively from the base note (A=220Hz × 2^(semitones/12)).
- **Color sync** (`syncIntervalColors`): intervals with matching parsed values share a color — editing one interval's value or color propagates to all others with the same value. The palette dropdown is built per-row from `PALETTE`.

## Conventions

- No external libs. Don't add dependencies or a build step.
- Keep HTML/CSS/JS in the three root files; don't split into modules.
- `docs/PLAN-01.md` describes the intended design — consult it before non-trivial changes.
