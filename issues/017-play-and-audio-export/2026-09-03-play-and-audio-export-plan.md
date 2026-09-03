# Scale Playback and Audio Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a transport — Play and Stop buttons that sound the whole scale up and back down as quarter notes at 90 BPM — and a Save-menu item that writes the same melody to a mono 16-bit 44.1 kHz WAV file.

**Architecture:** Two new classic scripts join the existing seven. `audio.js` (no DOM) owns the numbers: the frequency of each degree, the note-by-note schedule as plain data, the node graph that schedule becomes, and the RIFF/WAVE encoder. `audio-ui.js` owns the DOM half: the two toolbar buttons, the sounding-note highlight, the Save-menu item — and the per-note press-and-hold playback that moves out of `app.js`, so one file owns the oscillator. Live playback and the offline export call the *same* `scheduleScale()`, so the exported file is what the reader heard by construction.

**Tech Stack:** Vanilla ES2020 classic scripts, Web Audio (`AudioContext` live, `OfflineAudioContext` for export), `Blob` + `URL.createObjectURL` for the download. Tests: `node --test` + jsdom, no browser. No new runtime dependency, no build step.

**Spec:** [`issues/017-play-and-audio-export/2026-09-03-play-and-audio-export-design.md`](2026-09-03-play-and-audio-export-design.md) — read it before Task 1. Section references below (§3.2, §7.2, …) point into it.

---

## Global Constraints

Every task's requirements implicitly include all of these.

- **Mandatory TDD.** Red → green → refactor, per `docs/TESTING.md`. Write the failing test, **run it and watch it fail for the right reason**, then implement the least code that passes. No production code that no failing test demanded.
- **Run the whole suite before every commit:** `npm test`. The baseline at the start of this plan is **965 tests, 965 passing**. A test you did not mean to touch going red means you broke something — fix the code, or, if you deliberately changed documented behaviour, change that test in the same commit and say so in the commit message.
- **Never delete, skip or loosen a test** to get green.
- **No new dependencies** — not in the app, not in the tests. `jsdom` stays the only dev dependency.
- **No ES modules, ever.** `index.html` loads classic `<script src="…" defer>` tags. A `<script type="module">` is fetched under CORS and a `file://` page has an opaque origin, which would break "open `index.html` in a browser".
- **Classic scripts share one global lexical scope: no top-level name may be declared in two of the nine files**, or the page throws a `SyntaxError` before anything runs. Every new top-level name in this plan was checked against the existing eight files and is free.
- **Keep testable logic in named top-level functions.** The harness auto-exports every top-level `function`, `async function`, `const`, `let` and `var` from every script to `h.app`. Logic buried in a listener callback is unreachable from tests.
- **Commit message prefix:** every commit starts with `[#17]`, e.g. `[#17] Add the playback plan`.
- **Fixed values, copied from the spec — use these exact numbers:**
  - `QUARTER_SECONDS = 60 / 90` (0.6̅ s per note, quarter notes at 90 BPM)
  - `NOTE_PEAK_GAIN = 0.3`, `ATTACK_SECONDS = 0.02`, `RELEASE_SECONDS = 0.05`
  - `PLAYBACK_LEAD_SECONDS = 0.05` (live scheduling lead; the offline render uses none)
  - `EXPORT_SAMPLE_RATE = 44100`, mono, 16-bit PCM
  - Waveform `"triangle"`, one oscillator + one gain per note
  - Sequence: degrees `1, 2, … N, N−1, … 1` — **2N−1 notes**, top note not repeated
- **Exact user-visible copy — these strings, verbatim:**
  - Save menu, in order: `Save As Music Scale Plot file`, `<hr>`, `Save Chart As PNG`, `Save Audio As WAV`
  - Toolbar `aria-label`/`title`: `Play scale`, `Stop playing`
  - Export failure message: `Could not save the audio file.`
- **Element ids:** `#play-scale`, `#stop-scale`, `#save-audio`. The PNG item keeps its existing id `#save-png` — only its text changes.
- **Icons are `<img>`-loaded SVGs with `#1a1814` baked in.** An `<img>`-loaded SVG renders in an isolated document no page CSS reaches, so `currentColor` never resolves. `icons/play.svg` and `icons/stop.svg` bring the count of files carrying that literal from five to seven.

---

## File Structure

**New app files**

| File | Responsibility |
|---|---|
| `audio.js` | No DOM. Constants, `scaleFrequencies()`, `scalePlaybackPlan()`, `scheduleScale()`, `encodeWavMono16()`, `writeWavAscii()`. Loads 4th, after `persistence.js`. |
| `audio-ui.js` | The DOM half: the transport buttons and their state, the sounding-note highlight, the WAV export flow, and the per-note press-and-hold playback moved out of `app.js`. Loads 8th, after `persistence-ui.js` and before `app.js`. |
| `icons/play.svg`, `icons/stop.svg` | Two toolbar glyphs in the existing idiom (24×24 box, rounded 1.8-unit stroke, `#1a1814` baked in). |

**New test files**

| File | Covers |
|---|---|
| `test/helpers/wav.js` | Reads a mono 16-bit RIFF/WAVE file back out of its bytes, for the two tests that assert on one. |
| `test/unit/playback-plan.test.js` | `scaleFrequencies()` and `scalePlaybackPlan()`. |
| `test/unit/wav-encoding.test.js` | Every header field, the sample scaling and the clamp. |
| `test/integration/playback.test.js` | The transport: scheduling, envelopes, button state, Stop, the highlight, the guards. |
| `test/integration/audio-export.test.js` | The offline render, the WAV bytes, both save paths, the filename, the guard. |

**Modified files**

| File | Change |
|---|---|
| `index.html` | Two `<script>` tags; the Play/Stop toolbar group; the Save-menu rename and the new item. |
| `app.js` | `getAudioContext`, `startTone`, `stopTone`, `handlePlayStart`, `audioCtx`, `activeOsc`, `activeGain` and four listener registrations move out; `getFrequencyForDegree()` is re-expressed on `scaleFrequencies()`. |
| `persistence.js` | `suggestedFileName(name, extension = SCALE_FILE_EXTENSION)`. |
| `style.css` | The `.play-note.sounding` rule. |
| `test/helpers/audio-stub.js` | `state`/`resume()`/`advanceTo()`/`onended` on the online context; a new `FakeOfflineAudioContext`. |
| `test/helpers/harness.js` | Installs `OfflineAudioContext` and the object-URL shim; records binary picker writes; adds `savedAudioFile()`. |
| `test/integration/harness.test.js` | The script-order assertion: seven names → nine. |
| `test/integration/toolbar.test.js` | The `aria-label` list, the Save-menu item list, the new buttons. |
| `test/unit/scale-file-format.test.js` | One case for the second `suggestedFileName()` argument. |
| `.claude/rules/testing.md` | `audio.js` and `audio-ui.js` added to `paths:`. |
| `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`, `README.md` | The documentation sweep (Task 11). |

---

## Notes carried over from the design

Two things the spec decided that look like mistakes on first reading. Do not "fix" them:

1. ~~**The Play guard reuses the save guard's wording**~~ — **amended in review.** The guard did say *"Cannot save"* on Play, as design §8's "the same guard, the same message" asked. It was wrong: the reader pressed Play and nothing was being saved. `invalidIntervalMessage()` now takes the verb (`invalidIntervalMessage("play")` from `playScale()`), so Play says *"Cannot play: interval 2 is not a valid ratio."* while both saves are unchanged. Every future action that refuses a broken scale names itself the same way.
2. **PNG export keeps its hardcoded `scale.png`.** Design §7.3 notes bringing it in line with the scale's name would be an improvement and explicitly does not do it here.

---

## Task 1: `audio.js` — the frequencies and the playback plan

**Files:**
- Create: `audio.js`
- Modify: `index.html` (one `<script>` tag), `app.js:139-152` (`getFrequencyForDegree`), `.claude/rules/testing.md` (`paths:`)
- Test: `test/unit/playback-plan.test.js` (create), `test/integration/harness.test.js:65-77` (script order)

**Interfaces:**
- Consumes: `readScaleData()` output from `app.js` — an array of `{type: "note", degree, name, …}` and `{type: "interval", cents, …}` items, where an unparseable interval's `cents` is `NaN`.
- Produces:
  - `QUARTER_SECONDS`, `NOTE_PEAK_GAIN`, `ATTACK_SECONDS`, `RELEASE_SECONDS`, `PLAYBACK_LEAD_SECONDS`, `EXPORT_SAMPLE_RATE` — number constants.
  - `scaleFrequencies(data, baseFrequency) → number[]` — one Hz value per note row, in degree order.
  - `scalePlaybackPlan(frequencies) → {degree: number, frequency: number, start: number, duration: number}[]` — `2N−1` entries, `start` in seconds from zero.

- [ ] **Step 1: Write the failing test**

Create `test/unit/playback-plan.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  buildRelativeScale,
  selectOption,
  intervalRows,
  typeInto,
} = require("../helpers/harness.js");
const { closeTo, equalArray } = require("../helpers/assertions.js");

test("scaleFrequencies", async (t) => {
  await t.test("gives one frequency per note, multiplying the intervals up", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 3, "three notes, two intervals");
    closeTo(frequencies[0], 220);
    closeTo(frequencies[1], 220 * (9 / 8), 1e-9);
    closeTo(frequencies[2], 220 * (5 / 4), 1e-9, "9/8 * 10/9");
  });

  await t.test("skips an unparseable interval rather than poisoning the rest", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops", "10/9"]);

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 4, "the broken interval still separates two notes");
    closeTo(frequencies[2], 220 * (9 / 8), 1e-9, "the broken interval contributes nothing");
    closeTo(frequencies[3], 220 * (5 / 4), 1e-9);
  });

  await t.test("a descending interval lowers the pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "-1200");

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    closeTo(frequencies[1], 110, 1e-9, "an octave down");
  });

  await t.test("a zero-width interval leaves two notes at the same pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "0");

    const frequencies = h.app.scaleFrequencies(h.app.readScaleData(), 220);
    assert.equal(frequencies.length, 2, "both notes are still there");
    closeTo(frequencies[1], 220, 1e-9);
  });

  await t.test("gives nothing for an empty scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    equalArray(h.app.scaleFrequencies([], 220), []);
  });
});

test("scalePlaybackPlan", async (t) => {
  await t.test("goes up and back down without repeating the top note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const plan = h.app.scalePlaybackPlan([100, 200, 300, 400]);
    assert.equal(plan.length, 7, "2N-1 notes for N = 4 degrees");
    equalArray(plan.map((e) => e.degree), [1, 2, 3, 4, 3, 2, 1]);
    equalArray(plan.map((e) => e.frequency), [100, 200, 300, 400, 300, 200, 100]);
  });

  await t.test("lays the notes end to end, one quarter each", () => {
    const h = loadApp();
    t.after(() => h.close());

    const quarter = h.app.QUARTER_SECONDS;
    closeTo(quarter, 60 / 90, 1e-12, "quarter notes at 90 BPM");

    const plan = h.app.scalePlaybackPlan([100, 200, 300]);
    plan.forEach((entry, i) => {
      closeTo(entry.start, i * quarter, 1e-12, `note ${i + 1} starts a quarter after note ${i}`);
      closeTo(entry.duration, quarter, 1e-12);
    });
  });

  await t.test("the smallest legal scale is three notes long", () => {
    const h = loadApp();
    t.after(() => h.close());

    const plan = h.app.scalePlaybackPlan([100, 200]);
    equalArray(plan.map((e) => e.degree), [1, 2, 1]);
    closeTo(plan.length * h.app.QUARTER_SECONDS, 2, 1e-12, "two seconds at 90 BPM");
  });

  await t.test("a single degree sounds once, and no degrees sound not at all", () => {
    const h = loadApp();
    t.after(() => h.close());

    equalArray(h.app.scalePlaybackPlan([440]).map((e) => e.degree), [1]);
    equalArray(h.app.scalePlaybackPlan([]), []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/unit/playback-plan.test.js`
Expected: FAIL — `h.app.scaleFrequencies is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Create `audio.js`:

```js
// ---------------------------------------------------------------------------
// The audio model: what the scale sounds like, as numbers. No DOM.
//
// Loads before symbols-ui.js, in the same no-DOM group as byzantine.js,
// smufl.js and persistence.js. Everything here is a pure function over the
// scale data audio-ui.js hands it, so the same schedule drives live playback
// and the offline render that becomes the exported file.
// ---------------------------------------------------------------------------

// Quarter notes at 90 BPM, from issue #17. Named rather than inlined so that
// whoever adds tempo settings later has one place to look.
const QUARTER_SECONDS = 60 / 90;

// The envelope the per-note play button already produces, so a played scale
// sounds like the notes the reader has been auditioning by hand.
const NOTE_PEAK_GAIN = 0.3;
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.05;

// Live playback schedules from `currentTime + this` rather than from
// currentTime: the lead absorbs the cost of building the graph, so the first
// note is not clipped by its own scheduling. The offline render uses none —
// nothing can be late in a render that is not realtime.
const PLAYBACK_LEAD_SECONDS = 0.05;

// Fixed, not taken from the device's AudioContext — the same principle
// savePNG() follows in re-rendering at EXPORT_SCALE rather than at
// devicePixelRatio. The same scale exported from a Mac running its output at
// 48 kHz and from a machine at 44.1 kHz must produce the same file.
const EXPORT_SAMPLE_RATE = 44100;

/**
 * One frequency per note row, in degree order.
 *
 * Walks readScaleData()'s output once, accumulating cents. An interval the app
 * cannot read contributes nothing rather than poisoning everything above it,
 * which is the rule getFrequencyForDegree() has always followed.
 */
function scaleFrequencies(data, baseFrequency) {
  const frequencies = [];
  let cents = 0;
  for (const item of data) {
    if (item.type === "note") {
      frequencies.push(baseFrequency * Math.pow(2, cents / 1200));
    } else if (item.type === "interval" && !isNaN(item.cents)) {
      cents += item.cents;
    }
  }
  return frequencies;
}

/**
 * The melody, as data: degrees 1…N then N−1…1, so the scale is played the way
 * it is practised and the top note sounds once. 2N−1 entries, each a quarter
 * long and each carrying the degree it belongs to — so the sounding-note
 * highlight needs no second mapping from time back to a row.
 */
function scalePlaybackPlan(frequencies) {
  const order = [];
  for (let i = 0; i < frequencies.length; i++) order.push(i);
  for (let i = frequencies.length - 2; i >= 0; i--) order.push(i);
  return order.map(function (index, position) {
    return {
      degree: index + 1,
      frequency: frequencies[index],
      start: position * QUARTER_SECONDS,
      duration: QUARTER_SECONDS,
    };
  });
}
```

Add the script tag to `index.html`, after `persistence.js`:

```html
  <script src="persistence.js" defer></script>
  <script src="audio.js" defer></script>
  <script src="symbols-ui.js" defer></script>
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test test/unit/playback-plan.test.js`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and fix the one expected break**

Run: `npm test`
Expected: FAIL — `test/integration/harness.test.js` "runs every script index.html loads, in document order" now sees eight files.

This is a deliberate change to documented behaviour, so update that assertion. In `test/integration/harness.test.js`, replace the array in that test with:

```js
    assert.deepEqual(
      h.scriptFiles.map((f) => path.basename(f)),
      ["byzantine.js", "smufl.js", "persistence.js", "audio.js", "symbols-ui.js",
       "byzantine-ui.js", "persistence-ui.js", "app.js"],
      "the load order is load-bearing: smufl.js before symbols-ui.js, which names " +
        "byzantine-ui.js's picker builders, audio.js in the no-DOM group before the " +
        "UI built on it, and app.js last because it wires the page up"
    );
```

Run: `npm test`
Expected: PASS — 0 failing, and the suite is larger than the 965-test baseline by the new cases.

- [ ] **Step 6: Refactor `getFrequencyForDegree()` onto the new function**

Under a green suite. `app.js`'s `getFrequencyForDegree()` re-reads the whole editor on every call, which the transport would turn into O(N²). Replace `app.js:139-152` with:

```js
function getFrequencyForDegree(degree) {
  // Re-expressed on audio.js's scaleFrequencies() so the transport and the
  // per-note button compute pitch the same way, once per press instead of once
  // per degree. The signature and the fallback are unchanged: a degree that
  // does not exist still sounds the base frequency.
  const frequencies = scaleFrequencies(readScaleData(), getBaseFrequency());
  const frequency = frequencies[degree - 1];
  return frequency === undefined ? getBaseFrequency() : frequency;
}
```

Run: `npm test`
Expected: PASS, unchanged. `test/unit/pitch.test.js` is the proof — it already covers degree 0, degree 99, unparseable intervals and every interval type. **No assertion in it may change.** If one does, the re-expression is not equivalent; fix the code.

- [ ] **Step 7: Add `audio.js` to the path-scoped testing rule**

In `.claude/rules/testing.md`, add to the `paths:` list, after `persistence.js`:

```yaml
  - "audio.js"
```

- [ ] **Step 8: Commit**

```bash
git add audio.js index.html app.js .claude/rules/testing.md \
        test/unit/playback-plan.test.js test/integration/harness.test.js
git commit -m "$(cat <<'EOF'
[#17] Add audio.js with the scale's frequencies and playback plan

scaleFrequencies() walks the scale data once and gives one frequency per
degree; scalePlaybackPlan() turns those into the up-and-back-down melody as
data, 2N-1 quarter notes each naming its degree.

getFrequencyForDegree() is re-expressed on top of it — same signature, same
fallback, but one walk of the editor per press instead of one per degree.
harness.test.js's script-order assertion grows to eight files.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 2: The WAV encoder

**Files:**
- Modify: `audio.js` (append)
- Test: `test/unit/wav-encoding.test.js` (create), `test/helpers/wav.js` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `encodeWavMono16(samples, sampleRate) → Uint8Array` — a 44-byte canonical RIFF/WAVE header followed by little-endian 16-bit PCM. `samples` is a `Float32Array` (or any indexable with `.length`).
  - `writeWavAscii(view, offset, text)` — writes each character's code as one byte.
  - Test helper `wavHeader(bytes) → object`, `wavSamples(bytes) → Int16Array`.

- [ ] **Step 1: Write the test helper**

Create `test/helpers/wav.js`:

```js
"use strict";

/**
 * Reads a mono 16-bit RIFF/WAVE file back out of its bytes.
 *
 * Deliberately literal: it decodes each field at its fixed offset rather than
 * walking the chunk list, so a field written to the wrong place shows up as a
 * wrong value instead of being quietly skipped over.
 *
 * The bytes come from the jsdom realm, so they are copied into a host-realm
 * array first — the same cross-realm care equalArray() takes in assertions.js.
 */
function viewOf(bytes) {
  const copy = Uint8Array.from(bytes);
  return { copy, view: new DataView(copy.buffer) };
}

function ascii(copy, offset, length) {
  return String.fromCharCode(...copy.slice(offset, offset + length));
}

function wavHeader(bytes) {
  const { copy, view } = viewOf(bytes);
  return {
    chunkId: ascii(copy, 0, 4),
    chunkSize: view.getUint32(4, true),
    format: ascii(copy, 8, 4),
    subchunk1Id: ascii(copy, 12, 4),
    subchunk1Size: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    subchunk2Id: ascii(copy, 36, 4),
    subchunk2Size: view.getUint32(40, true),
  };
}

function wavSamples(bytes) {
  const { view } = viewOf(bytes);
  const count = view.getUint32(40, true) / 2;
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(44 + i * 2, true);
  return samples;
}

module.exports = { wavHeader, wavSamples };
```

- [ ] **Step 2: Write the failing test**

Create `test/unit/wav-encoding.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");
const { wavHeader, wavSamples } = require("../helpers/wav.js");

/** Encodes `values` at 44.1 kHz through the app and hands back the bytes. */
function encode(h, values, sampleRate = 44100) {
  return h.app.encodeWavMono16(Float32Array.from(values), sampleRate);
}

test("encodeWavMono16", async (t) => {
  await t.test("writes a canonical 44-byte mono 16-bit header", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bytes = encode(h, [0, 0, 0, 0]);
    assert.equal(bytes.length, 44 + 8, "44 header bytes plus two per sample");

    assert.deepEqual(wavHeader(bytes), {
      chunkId: "RIFF",
      chunkSize: 36 + 8,
      format: "WAVE",
      subchunk1Id: "fmt ",
      subchunk1Size: 16,
      audioFormat: 1, // PCM
      numChannels: 1,
      sampleRate: 44100,
      byteRate: 44100 * 2,
      blockAlign: 2,
      bitsPerSample: 16,
      subchunk2Id: "data",
      subchunk2Size: 8,
    });
  });

  await t.test("declares the sample rate it was given, not a fixed one", () => {
    const h = loadApp();
    t.after(() => h.close());

    const header = wavHeader(encode(h, [0], 48000));
    assert.equal(header.sampleRate, 48000);
    assert.equal(header.byteRate, 96000, "the byte rate follows the sample rate");
  });

  await t.test("scales the two ends of the range asymmetrically", () => {
    const h = loadApp();
    t.after(() => h.close());

    // -1.0 and +1.0 must reach the full signed range without wrapping, which
    // takes 0x8000 below zero and 0x7fff above it. The fractional cases pin
    // the truncation DataView.setInt16 applies, so a later switch to rounding
    // cannot slip in unnoticed.
    assert.deepEqual(
      Array.from(wavSamples(encode(h, [0, 1, -1, 0.5, -0.5]))),
      [0, 32767, -32768, 16383, -16384]
    );
  });

  await t.test("clamps rather than wrapping, so an over-driven sample cannot click", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Clipping should never occur in practice — one voice at a time, peak gain
    // 0.3, no overlap. The clamp is here because an encoder that trusts its
    // input produces a file that clicks.
    assert.deepEqual(
      Array.from(wavSamples(encode(h, [2, -2, 1.0001, -1.0001]))),
      [32767, -32768, 32767, -32768]
    );
  });

  await t.test("an empty buffer is still a valid, empty file", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bytes = encode(h, []);
    assert.equal(bytes.length, 44);
    const header = wavHeader(bytes);
    assert.equal(header.subchunk2Size, 0);
    assert.equal(header.chunkSize, 36, "the RIFF size still counts the header");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/unit/wav-encoding.test.js`
Expected: FAIL — `h.app.encodeWavMono16 is not a function`.

- [ ] **Step 4: Write the minimal implementation**

Append to `audio.js`:

```js
// --- the WAV encoder -------------------------------------------------------
//
// A canonical 44-byte RIFF/WAVE header followed by little-endian 16-bit PCM.
// Hand-written because the alternatives all cost something this app will not
// pay: MediaRecorder has no offline mode and encodes in wall-clock time, and
// every compressed format a browser can produce natively is either unplayable
// on some platform or absent from some browser. See the design's §2.1.

function writeWavAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function encodeWavMono16(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);

  writeWavAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeWavAscii(view, 8, "WAVE");
  writeWavAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);   // Subchunk1Size, for PCM
  view.setUint16(20, 1, true);    // AudioFormat: PCM
  view.setUint16(22, 1, true);    // NumChannels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);    // BlockAlign
  view.setUint16(34, 16, true);   // BitsPerSample
  writeWavAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    // Asymmetric on purpose: signed 16-bit runs -32768…32767, so -1.0 and +1.0
    // only reach both ends without wrapping if they are scaled by different
    // numbers. setInt16 truncates towards zero, which is fine for audio.
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return bytes;
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/unit/wav-encoding.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 6: Commit**

```bash
git add audio.js test/helpers/wav.js test/unit/wav-encoding.test.js
git commit -m "$(cat <<'EOF'
[#17] Encode a mono 16-bit WAV by hand

encodeWavMono16() writes the canonical 44-byte RIFF/WAVE header and
little-endian PCM, clamping and scaling -1.0 and +1.0 onto the full signed
range asymmetrically so neither end wraps.

test/helpers/wav.js reads the fields back at their fixed offsets, so a field
written to the wrong place fails loudly instead of being skipped.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 3: `audio-ui.js` — move the per-note playback out of `app.js`

A pure lift with **no behaviour change**. `test/unit/pitch.test.js` already covers every behaviour being moved, so it is the proof: not one of its assertions may change. The transport and the per-note button are about to share a pressed visual state and the question of who owns the sounding oscillator; leaving them in separate files is precisely the tangle.

**Files:**
- Create: `audio-ui.js`
- Modify: `index.html` (one `<script>` tag), `app.js` (delete the moved code), `.claude/rules/testing.md` (`paths:`)
- Test: `test/integration/harness.test.js` (script order); `test/unit/pitch.test.js` must stay green **unchanged**

**Interfaces:**
- Consumes: `QUARTER_SECONDS`…`RELEASE_SECONDS` and `NOTE_PEAK_GAIN` from `audio.js` (Task 1); `getFrequencyForDegree()` from `app.js`, resolved at click time.
- Produces: `getAudioContext() → AudioContext`, `startTone(frequency)`, `stopTone()`, `handlePlayStart(event)`, and the module-level `audioCtx`, `activeOsc`, `activeGain`, `audioEditor`.

- [ ] **Step 1: Watch the existing suite prove the move**

There is no new behaviour, so there is no new test. Run the file that owns the behaviour first, so you know it is green *before* you touch anything:

Run: `node --test test/unit/pitch.test.js`
Expected: PASS.

- [ ] **Step 2: Create `audio-ui.js` with the moved code**

```js
// ---------------------------------------------------------------------------
// The audio UI: the per-note play buttons, the transport, and the WAV export.
//
// Like persistence-ui.js, this file only *defines* functions and *wires*
// listeners at its top level: it loads before app.js, which runs at load time,
// so it must never call into app.js here. Its handlers resolve app.js's
// globals — getFrequencyForDegree, readScaleData, invalidIntervalMessage — at
// click time, long afterwards.
//
// #editor is read under its own name because app.js declares `const editor`
// for the same element: classic scripts share one lexical scope, so a second
// `const editor` would be a load-time SyntaxError, and reading app.js's before
// app.js has run would hit the temporal dead zone.
// ---------------------------------------------------------------------------

const audioEditor = document.getElementById("editor");

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// --- the per-note play buttons ---------------------------------------------

let activeOsc = null;
let activeGain = null;

function startTone(frequency) {
  stopTone();
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(NOTE_PEAK_GAIN, ctx.currentTime + ATTACK_SECONDS);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  activeOsc = osc;
  activeGain = gain;
}

function stopTone() {
  if (!activeOsc) return;
  const ctx = getAudioContext();
  activeGain.gain.cancelScheduledValues(ctx.currentTime);
  activeGain.gain.setValueAtTime(activeGain.gain.value, ctx.currentTime);
  activeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + RELEASE_SECONDS);
  activeOsc.stop(ctx.currentTime + RELEASE_SECONDS);
  activeOsc = null;
  activeGain = null;
}

function handlePlayStart(e) {
  const btn = e.target.closest(".play-note");
  if (!btn) return;
  e.preventDefault();
  const noteRow = btn.closest(".note-row");
  if (!noteRow) return;
  const degree = parseInt(noteRow.dataset.degree, 10);
  startTone(getFrequencyForDegree(degree));
}

audioEditor.addEventListener("mousedown", handlePlayStart);
audioEditor.addEventListener("touchstart", handlePlayStart);
document.addEventListener("mouseup", stopTone);
document.addEventListener("touchend", stopTone);
```

Note the one refactor folded into the move: the literals `0.3`, `0.02` and `0.05` become `NOTE_PEAK_GAIN`, `ATTACK_SECONDS` and `RELEASE_SECONDS` from `audio.js`. The numbers are identical, so `pitch.test.js` stays green.

- [ ] **Step 3: Delete the moved code from `app.js`**

Remove exactly these, and nothing else:

1. `let audioCtx = null;` (the line after `let displayZoom = 1;`)
2. The whole `function getAudioContext() { … }` block, and the blank line after it
3. `let activeOsc = null;`, `let activeGain = null;`, and the whole `startTone` and `stopTone` functions (the block between `getFrequencyForDegree`'s closing brace and `function updateZoom()`)
4. The whole `function handlePlayStart(e) { … }` block
5. These four listener registrations, leaving `editor.addEventListener("keydown", handleEditorEnter);` in place:

```js
editor.addEventListener("mousedown", handlePlayStart);
editor.addEventListener("touchstart", handlePlayStart);
document.addEventListener("mouseup", stopTone);
document.addEventListener("touchend", stopTone);
```

`getBaseFrequency()` and `getFrequencyForDegree()` **stay** in `app.js`: they read `#base-note` and call `readScaleData()`, which is `app.js`'s own model layer.

- [ ] **Step 4: Add the script tag**

In `index.html`, between `persistence-ui.js` and `app.js`:

```html
  <script src="persistence-ui.js" defer></script>
  <script src="audio-ui.js" defer></script>
  <script src="app.js" defer></script>
```

- [ ] **Step 5: Run the suite and update the one script-order assertion**

Run: `npm test`
Expected: FAIL — only `test/integration/harness.test.js`'s script-order test, now seeing nine files. Update its array to:

```js
      ["byzantine.js", "smufl.js", "persistence.js", "audio.js", "symbols-ui.js",
       "byzantine-ui.js", "persistence-ui.js", "audio-ui.js", "app.js"],
```

Run: `npm test`
Expected: PASS — 0 failing. **`test/unit/pitch.test.js` must pass with no edits.** If it does not, the move changed behaviour — find out how, and fix the code rather than the test.

- [ ] **Step 6: Add `audio-ui.js` to the path-scoped testing rule**

In `.claude/rules/testing.md`, add after `persistence-ui.js`:

```yaml
  - "audio-ui.js"
```

- [ ] **Step 7: Commit**

```bash
git add audio-ui.js index.html app.js .claude/rules/testing.md test/integration/harness.test.js
git commit -m "$(cat <<'EOF'
[#17] Move the per-note playback into audio-ui.js

getAudioContext, startTone, stopTone and handlePlayStart leave app.js with the
four listener registrations that drive them, so one file owns the sounding
oscillator before the transport starts sharing it.

A lift with no behaviour change: pitch.test.js proves it and is untouched. The
envelope's three literals become audio.js's named constants, which are the same
numbers. #editor is read under its own name because app.js declares `editor`
for it and classic scripts share one lexical scope.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 4: Rename "Save As PNG" to "Save Chart As PNG"

Small and independent: the menu is about to hold two exports, so each item has to say which of the two representations it writes. The id stays `save-png`, so no wiring changes.

**Files:**
- Modify: `index.html` (one line)
- Test: `test/integration/toolbar.test.js:202-213`

**Interfaces:**
- Consumes: nothing.
- Produces: the Save menu's second item now reads `Save Chart As PNG`. Its id is unchanged (`#save-png`), so `savePNG` stays wired as it is.

- [ ] **Step 1: Write the failing test**

In `test/integration/toolbar.test.js`, change the expected labels in the test named `"holds the two save items, the PNG one moved from the Chart panel"`:

```js
      ["Save As Music Scale Plot file", "Save Chart As PNG"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/integration/toolbar.test.js`
Expected: FAIL — actual `"Save As PNG"`, expected `"Save Chart As PNG"`.

- [ ] **Step 3: Rename the item**

In `index.html`:

```html
          <button type="button" id="save-png">Save Chart As PNG</button>
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/integration/toolbar.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing. The other references to `#save-png` are by id, so nothing else moves.

- [ ] **Step 5: Commit**

```bash
git add index.html test/integration/toolbar.test.js
git commit -m "$(cat <<'EOF'
[#17] Rename the PNG item to "Save Chart As PNG"

The Save menu is about to hold two exports, so each item says which of the two
representations it writes. The id is unchanged, so nothing rewires.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 5: The transport — Play, Stop, and the scheduled melody

**Files:**
- Create: `icons/play.svg`, `icons/stop.svg`
- Modify: `index.html` (the toolbar group), `audio-ui.js` (append), `test/helpers/audio-stub.js`
- Test: `test/integration/playback.test.js` (create), `test/integration/toolbar.test.js` (the `aria-label` list)

**Interfaces:**
- Consumes: `QUARTER_SECONDS`, `NOTE_PEAK_GAIN`, `ATTACK_SECONDS`, `RELEASE_SECONDS`, `PLAYBACK_LEAD_SECONDS`, `scaleFrequencies()`, `scalePlaybackPlan()` (Task 1); `getAudioContext()`, `stopTone()` (Task 3); `readScaleData()`, `getBaseFrequency()` from `app.js`.
- Produces:
  - `scheduleScale(ctx, plan, destination, t0) → {oscillator, gain}[]` in `audio.js` — used by live playback here and by the offline render in Task 9.
  - `playScale()`, `stopScale()`, `isScalePlaying() → boolean`, `updateTransportButtons()`, `handleScaleEnded()` in `audio-ui.js`.
  - `let playback` — `{plan, t0, nodes, frameId, degree}` while a scale is playing, `null` otherwise.
  - Stub additions: `FakeAudioContext#state`, `#resumeCalls`, `#resume()`, `#advanceTo(time)`; `FakeOscillatorNode#onended`, `#ended`.

- [ ] **Step 1: Extend the audio stub**

The stub has no way to express a suspended context or the natural end of an oscillator, and the transport turns on both. In `test/helpers/audio-stub.js`:

In `FakeOscillatorNode`'s constructor, after `this.stopped = null;`:

```js
    // The natural end of a note. FakeAudioContext#advanceTo() fires it, so a
    // test can reach the end of a scale without waiting ten real seconds.
    this.onended = null;
    this.ended = false;
```

In `FakeAudioContext`'s constructor, after `this.currentTime = 0;`:

```js
    // A context created earlier in the page's life may be suspended when Play
    // is pressed; the app resumes it first.
    this.state = "running";
    this.resumeCalls = 0;
```

And add two methods to `FakeAudioContext`:

```js
  resume() {
    this.resumeCalls++;
    this.state = "running";
    return Promise.resolve();
  }

  /**
   * Moves the audio clock, firing `onended` for every oscillator whose stop
   * time has now passed — the one signal the transport treats as the
   * authoritative end of a scale.
   */
  advanceTo(time) {
    this.currentTime = time;
    for (const osc of this.oscillators) {
      if (osc.ended || osc.stopped === null || osc.stopped > time) continue;
      osc.ended = true;
      if (typeof osc.onended === "function") osc.onended();
    }
  }
```

- [ ] **Step 2: Write the failing test**

Create `test/integration/playback.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  buildRelativeScale,
  selectOption,
} = require("../helpers/harness.js");
const { closeTo, equalArray } = require("../helpers/assertions.js");

function pressPlay(h) {
  fireClick(h, h.document.getElementById("play-scale"));
}

function pressStop(h) {
  fireClick(h, h.document.getElementById("stop-scale"));
}

test("playing the scale", async (t) => {
  await t.test("schedules 2N-1 notes up and back down, at the planned pitches", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);

    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators.length, 5, "three degrees make five notes");
    equalArray(ctx.oscillators.map((o) => o.type), Array(5).fill("triangle"));

    const expected = [220, 220 * (9 / 8), 220 * (5 / 4), 220 * (9 / 8), 220];
    ctx.oscillators.forEach((osc, i) => {
      closeTo(osc.frequency.value, expected[i], 1e-9, `note ${i + 1}`);
    });
  });

  await t.test("lays the notes end to end after a scheduling lead", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);

    const quarter = h.app.QUARTER_SECONDS;
    const lead = h.app.PLAYBACK_LEAD_SECONDS;
    const ctx = h.audioContexts[0];
    ctx.oscillators.forEach((osc, i) => {
      closeTo(osc.started, lead + i * quarter, 1e-12, `note ${i + 1} starts`);
      closeTo(osc.stopped, lead + (i + 1) * quarter, 1e-12, `note ${i + 1} stops`);
    });
  });

  await t.test("gives every note an attack, a sustain and a release", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);

    const start = h.app.PLAYBACK_LEAD_SECONDS;
    const end = start + h.app.QUARTER_SECONDS;
    const events = h.audioContexts[0].gains[0].gain.events;

    // The third event is load-bearing: without it the automation would ramp
    // from the end of the attack all the way to the end of the note — a slow
    // decay, not a sustain with a release.
    equalArray(
      events.map((e) => e.type),
      ["setValueAtTime", "linearRampToValueAtTime", "setValueAtTime", "linearRampToValueAtTime"]
    );
    equalArray(events.map((e) => e.value), [0, 0.3, 0.3, 0]);
    closeTo(events[0].time, start, 1e-12, "silence at the note's start");
    closeTo(events[1].time, start + h.app.ATTACK_SECONDS, 1e-12, "attack");
    closeTo(events[2].time, end - h.app.RELEASE_SECONDS, 1e-12, "the sustain is anchored");
    closeTo(events[3].time, end, 1e-12, "release lands on the note boundary");
  });

  await t.test("routes every note to the destination", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);

    const ctx = h.audioContexts[0];
    assert.equal(ctx.gains.length, 3, "one gain per note");
    for (const gain of ctx.gains) {
      assert.deepEqual(gain.connectedTo, [ctx.destination]);
    }
  });

  await t.test("resumes a context the browser had suspended", () => {
    const h = loadApp();
    t.after(() => h.close());

    const ctx = h.app.getAudioContext();
    ctx.state = "suspended";
    pressPlay(h);

    assert.equal(ctx.resumeCalls, 1, "a suspended context makes no sound until resumed");
  });

  await t.test("swaps the transport buttons while it plays", () => {
    const h = loadApp();
    t.after(() => h.close());
    const play = h.document.getElementById("play-scale");
    const stop = h.document.getElementById("stop-scale");

    assert.equal(play.disabled, false, "Play is available when idle");
    assert.equal(stop.disabled, true, "Stop is not");

    pressPlay(h);
    assert.equal(h.app.isScalePlaying(), true);
    assert.equal(play.disabled, true, "a second press must not stack a second melody");
    assert.equal(stop.disabled, false);

    pressStop(h);
    assert.equal(h.app.isScalePlaying(), false);
    assert.equal(play.disabled, false);
    assert.equal(stop.disabled, true);
  });

  await t.test("a second press while playing changes nothing", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const scheduled = h.audioContexts[0].oscillators.length;
    pressPlay(h);

    assert.equal(h.audioContexts[0].oscillators.length, scheduled, "no second melody");
  });

  await t.test("Stop silences every note still to come", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    ctx.currentTime = 1.0; // partway through the second note
    pressStop(h);

    const release = h.app.RELEASE_SECONDS;
    for (const osc of ctx.oscillators) {
      closeTo(osc.stopped, 1.0 + release, 1e-12, "every node stops after one release");
    }
    for (const gain of ctx.gains) {
      const last = gain.gain.events.at(-1);
      assert.deepEqual([last.type, last.value], ["linearRampToValueAtTime", 0]);
      closeTo(last.time, 1.0 + release, 1e-12);
    }
  });

  await t.test("the end of the last note ends the scale, with nobody watching", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    // The authoritative end is onended on the last oscillator, not the
    // animation loop: requestAnimationFrame is throttled in a background tab
    // and the buttons must return to idle whether or not anyone is looking.
    ctx.advanceTo(h.app.PLAYBACK_LEAD_SECONDS + 3 * h.app.QUARTER_SECONDS);

    assert.equal(h.app.isScalePlaying(), false, "the scale ended by itself");
    assert.equal(h.document.getElementById("play-scale").disabled, false);
    assert.equal(h.document.getElementById("stop-scale").disabled, true);
  });

  await t.test("a deliberate Stop does not also run the natural-end path", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    pressStop(h);
    pressPlay(h); // a second scale, whose own ending is the one that counts
    const ctx = h.audioContexts[0];
    const secondScale = ctx.oscillators.slice(3);

    // Advancing past the *first* scale's stop times must not tear down the
    // second: stopScale() clears onended before stopping the nodes.
    ctx.advanceTo(1.0);
    assert.equal(h.app.isScalePlaying(), true, "the second scale is still playing");
    assert.equal(secondScale.length, 3, "the second scale was scheduled in full");
  });

  await t.test("pressing Stop when nothing is playing is harmless", () => {
    const h = loadApp();
    t.after(() => h.close());

    pressStop(h);
    assert.equal(h.audioContexts.length, 0, "no AudioContext is created just to stop nothing");
    assert.deepEqual(h.jsdomErrors, []);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/integration/playback.test.js`
Expected: FAIL — `Cannot read properties of null (reading 'dispatchEvent')`, because `#play-scale` does not exist yet.

- [ ] **Step 4: Draw the two icons**

Create `icons/play.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 5l11 7-11 7z"/>
</svg>
```

Create `icons/stop.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#1a1814" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="6" y="6" width="12" height="12" rx="1.5"/>
</svg>
```

Both bake `#1a1814` rather than using `currentColor`, for the reason in the Global Constraints.

- [ ] **Step 5: Add the toolbar group**

In `index.html`, after the `remove-note` button and before the hidden `<input type="file">`:

```html
      <span class="toolbar-separator"></span>
      <button type="button" id="play-scale" class="toolbar-btn" aria-label="Play scale" title="Play scale">
        <img src="icons/play.svg" alt="">
      </button>
      <button type="button" id="stop-scale" class="toolbar-btn" aria-label="Stop playing" title="Stop playing" disabled>
        <img src="icons/stop.svg" alt="">
      </button>
```

A third group after the note-editing pair, so the toolbar reads file actions, then editing, then transport. Stop carries `disabled` in the markup, so the idle state needs no load-time call. `.toolbar-separator` and `.toolbar-btn:disabled` are already styled — no CSS is needed here.

- [ ] **Step 6: Add `scheduleScale()` to `audio.js`**

Append to `audio.js`, before the WAV encoder section:

```js
/**
 * Turns a plan into sounding nodes, one oscillator and one gain per note.
 *
 * Used by **both** live playback and the offline export, the only difference
 * being which context and destination it is handed — so the exported file is
 * what the reader heard by construction, not because two implementations agree.
 *
 * Everything is scheduled up front against the audio clock. No timer takes any
 * part in producing sound, so playback cannot drift and cannot be delayed by a
 * busy main thread.
 */
function scheduleScale(ctx, plan, destination, t0) {
  const nodes = [];
  for (const entry of plan) {
    const start = t0 + entry.start;
    const end = start + entry.duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = entry.frequency;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(NOTE_PEAK_GAIN, start + ATTACK_SECONDS);
    // Anchors the sustain. Without it the automation ramps from the end of the
    // attack all the way to the end of the note — a slow decay, not a sustain
    // with a release. The release is also what articulates consecutive notes:
    // each reaches silence exactly where the next one's attack begins.
    gain.gain.setValueAtTime(NOTE_PEAK_GAIN, end - RELEASE_SECONDS);
    gain.gain.linearRampToValueAtTime(0, end);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(end);

    nodes.push({ oscillator: osc, gain: gain });
  }
  return nodes;
}
```

- [ ] **Step 7: Add the transport to `audio-ui.js`**

Append:

```js
// --- the transport ---------------------------------------------------------

const playScaleBtn = document.getElementById("play-scale");
const stopScaleBtn = document.getElementById("stop-scale");

/** `{plan, t0, nodes, frameId, degree}` while a scale is playing; null otherwise. */
let playback = null;

function isScalePlaying() {
  return playback !== null;
}

function updateTransportButtons() {
  // Play is disabled while a scale plays rather than restarting it, so a
  // double-click cannot stack two melodies on top of each other.
  playScaleBtn.disabled = isScalePlaying();
  stopScaleBtn.disabled = !isScalePlaying();
}

function playScale() {
  if (isScalePlaying()) return;

  const plan = scalePlaybackPlan(scaleFrequencies(readScaleData(), getBaseFrequency()));
  if (plan.length === 0) return;

  const ctx = getAudioContext();
  // Play is always reached from a user gesture, so the autoplay policy permits
  // it — but a context created earlier in the page's life may be suspended.
  if (ctx.state === "suspended") ctx.resume();

  const t0 = ctx.currentTime + PLAYBACK_LEAD_SECONDS;
  const nodes = scheduleScale(ctx, plan, ctx.destination, t0);
  playback = { plan: plan, t0: t0, nodes: nodes, frameId: null, degree: null };
  // The authoritative end of a scale, because requestAnimationFrame is
  // throttled in a background tab and the buttons must return to idle whether
  // or not anyone is looking.
  nodes[nodes.length - 1].oscillator.onended = handleScaleEnded;
  updateTransportButtons();
}

/** The natural end: the nodes have finished, so there is nothing to silence. */
function handleScaleEnded() {
  if (!playback) return;
  playback = null;
  updateTransportButtons();
}

function stopScale() {
  if (!playback) return;
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  const end = now + RELEASE_SECONDS;
  for (const node of playback.nodes) {
    // Cleared before the node is stopped, so a deliberate stop does not also
    // run the natural-end path.
    node.oscillator.onended = null;
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setValueAtTime(node.gain.gain.value, now);
    node.gain.gain.linearRampToValueAtTime(0, end);
    node.oscillator.stop(end);
  }
  playback = null;
  updateTransportButtons();
}

playScaleBtn.addEventListener("click", playScale);
stopScaleBtn.addEventListener("click", stopScale);
```

- [ ] **Step 8: Run the new test**

Run: `node --test test/integration/playback.test.js`
Expected: PASS.

- [ ] **Step 9: Run the suite and update the toolbar's label list**

Run: `npm test`
Expected: FAIL — `test/integration/toolbar.test.js`, `"names every button, because none of them carries text"`. Two buttons were deliberately added, so update its expectation:

```js
    assert.deepEqual(labels, [
      "New", "Open", "Save", "Add note", "Remove last note", "Play scale", "Stop playing",
    ]);
```

While you are in that test file, add one covering the group, immediately after it:

```js
  await t.test("puts the transport in its own group after the note buttons", () => {
    const h = loadApp();
    t.after(() => h.close());

    // File actions, then editing, then playback — each pair behind its own
    // separator.
    const ids = h.all("#toolbar > *").map((el) => el.id || el.className);
    assert.deepEqual(ids.slice(-4), [
      "toolbar-separator", "play-scale", "stop-scale", "open-file-input",
    ]);
    assert.equal(h.document.getElementById("stop-scale").disabled, true, "Stop is idle at rest");
  });
```

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 10: Commit**

```bash
git add icons/play.svg icons/stop.svg index.html audio.js audio-ui.js \
        test/helpers/audio-stub.js test/integration/playback.test.js \
        test/integration/toolbar.test.js
git commit -m "$(cat <<'EOF'
[#17] Play the whole scale from the toolbar

Play schedules the melody up front against the audio clock — 2N-1 quarter
notes, one oscillator and one gain each, with an attack, an anchored sustain
and a release that lands on the note boundary. No timer takes any part in
producing sound.

Stop ramps every live node to silence and clears onended first, so a
deliberate stop does not also run the natural-end path; the end of the last
oscillator is what returns the buttons to idle in a background tab.

toolbar.test.js's aria-label list grows by the two new buttons.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 6: The sounding-note highlight

While the scale plays, the note currently sounding shows it: that degree's own play button takes the pressed look, as though the user were holding it down. Reuses an affordance the reader already knows rather than inventing a second highlight.

**Files:**
- Modify: `audio-ui.js` (append + two call sites), `style.css` (one rule)
- Test: `test/integration/playback.test.js` (append)

**Interfaces:**
- Consumes: `playback`, `playScale()`, `stopScale()`, `handleScaleEnded()` (Task 5); `QUARTER_SECONDS` (Task 1).
- Produces: `updateSoundingNote()`, `setSoundingDegree(degree)` — `null` clears — and `tickSoundingNote()`. `playback.frameId` and `playback.degree` become live.

- [ ] **Step 1: Write the failing test**

Append to `test/integration/playback.test.js`:

```js
/** The degree whose play button currently wears the pressed look, or null. */
function soundingDegree(h) {
  const button = h.el("#editor .play-note.sounding");
  return button ? Number(button.closest(".note-row").dataset.degree) : null;
}

test("the sounding note", async (t) => {
  await t.test("follows the audio clock across the note boundaries", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    const quarter = h.app.QUARTER_SECONDS;
    const t0 = h.app.PLAYBACK_LEAD_SECONDS;

    // Driven through updateSoundingNote() rather than by racing a real 16ms
    // animation frame: the function reads the clock, so the clock is the input.
    const seen = [];
    for (const step of [0, 1, 2, 3, 4]) {
      ctx.currentTime = t0 + step * quarter + quarter / 2;
      h.app.updateSoundingNote();
      seen.push(soundingDegree(h));
    }
    assert.deepEqual(seen, [1, 2, 3, 2, 1], "up and back down");
  });

  await t.test("shows nothing before the first note and after the last", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];

    ctx.currentTime = 0; // still inside the scheduling lead
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), null, "nothing sounds during the lead");

    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + h.app.QUARTER_SECONDS / 2;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1);

    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + 99;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), null, "past the end of the plan");
  });

  await t.test("marks exactly one button at a time", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + h.app.QUARTER_SECONDS * 1.5;
    h.app.updateSoundingNote();

    assert.equal(h.all("#editor .play-note.sounding").length, 1);
  });

  await t.test("clears when the scale is stopped", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    h.audioContexts[0].currentTime = h.app.PLAYBACK_LEAD_SECONDS + 0.1;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1, "something must be lit before clearing means anything");

    pressStop(h);
    assert.equal(soundingDegree(h), null);
  });

  await t.test("clears when the scale ends on its own", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + 0.1;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1);

    ctx.advanceTo(h.app.PLAYBACK_LEAD_SECONDS + 3 * h.app.QUARTER_SECONDS);
    assert.equal(soundingDegree(h), null);
  });

  await t.test("does nothing at all once playback is over", () => {
    const h = loadApp();
    t.after(() => h.close());

    // No context, no playback: the frame callback must be a no-op rather than
    // reaching for a clock that does not exist.
    h.app.updateSoundingNote();
    assert.equal(h.audioContexts.length, 0);
    assert.deepEqual(h.jsdomErrors, []);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/integration/playback.test.js`
Expected: FAIL — `h.app.updateSoundingNote is not a function`.

- [ ] **Step 3: Implement the highlight**

Append to `audio-ui.js`:

```js
// --- the sounding note -----------------------------------------------------

/** Moves the pressed look to `degree`'s play button; null clears it. */
function setSoundingDegree(degree) {
  for (const button of audioEditor.querySelectorAll(".play-note.sounding")) {
    button.classList.remove("sounding");
  }
  if (degree === null || degree === undefined) return;
  const row = audioEditor.querySelector('.note-row[data-degree="' + degree + '"]');
  const button = row && row.querySelector(".play-note");
  if (button) button.classList.add("sounding");
}

/**
 * One frame of the highlight, read off the audio clock rather than counted in
 * frames — a dropped frame then costs nothing, and a test can advance the
 * clock instead of racing a real 16ms callback.
 */
function updateSoundingNote() {
  if (!playback) return;
  const elapsed = getAudioContext().currentTime - playback.t0;
  const entry = elapsed < 0 ? null : playback.plan[Math.floor(elapsed / QUARTER_SECONDS)];
  const degree = entry ? entry.degree : null;
  if (degree === playback.degree) return; // only touch the DOM on a boundary
  setSoundingDegree(degree);
  playback.degree = degree;
}

function tickSoundingNote() {
  if (!playback) return;
  updateSoundingNote();
  if (playback) playback.frameId = requestAnimationFrame(tickSoundingNote);
}
```

Then wire it into the three places that own playback's lifetime:

In `playScale()`, as the last statement:

```js
  updateTransportButtons();
  playback.frameId = requestAnimationFrame(tickSoundingNote);
```

In `handleScaleEnded()`:

```js
function handleScaleEnded() {
  if (!playback) return;
  cancelAnimationFrame(playback.frameId);
  playback = null;
  setSoundingDegree(null);
  updateTransportButtons();
}
```

In `stopScale()`, replacing its last two statements:

```js
  cancelAnimationFrame(playback.frameId);
  playback = null;
  setSoundingDegree(null);
  updateTransportButtons();
```

- [ ] **Step 4: Add the CSS rule**

In `style.css`, immediately after the `.play-note:active` rule:

```css
/* The sounding note during scale playback, reproducing what a real press looks
   like — the hover fill *and* the active geometry, since a mouse press on a
   desktop is also a hover. Last, so it wins the specificity tie with :hover. */
.play-note.sounding {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--paper);
  transform: scale(0.95);
  box-shadow: 0 1px 3px -1px rgba(138, 46, 26, 0.35);
}
```

- [ ] **Step 5: Run the tests**

Run: `node --test test/integration/playback.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 6: Commit**

```bash
git add audio-ui.js style.css test/integration/playback.test.js
git commit -m "$(cat <<'EOF'
[#17] Light the sounding degree's own play button

The note currently sounding takes the pressed look, reusing the affordance the
reader already knows instead of inventing a second highlight.

updateSoundingNote() reads the audio clock rather than counting frames, so a
dropped frame costs nothing and a test can advance the clock instead of racing
a real animation frame; requestAnimationFrame only calls it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 7: The two interaction rules and the Play guard

Three behaviours, all about who owns the one sounding voice:

- Pressing a per-note play button stops a playing scale first. There is one transport and one voice; a held note taking over is the only reading that does not produce two melodies at once.
- Stop stops a held note as well as a playing scale.
- Play refuses a scale with an unreadable interval, through the same guard, the same message and the same self-clearing behaviour `savePNG()` and `saveScaleFile()` already use.

Editing the scale during playback deliberately does **not** interrupt it — the plan was scheduled in full when Play was pressed. There is a test for that below.

**Files:**
- Modify: `audio-ui.js` (`startTone`, `stopScale`, `playScale`)
- Test: `test/integration/playback.test.js` (append)

**Interfaces:**
- Consumes: `stopTone()` (Task 3); `stopScale()`, `playScale()` (Task 5); `invalidIntervalMessage()`, `INVALID_SCALE_MESSAGE`, `showToolbarMessage()` from `app.js`/`persistence-ui.js`, resolved at click time.
- Produces: no new names. `startTone()` gains a first line; `stopScale()` gains a first line; `playScale()` gains the guard.

- [ ] **Step 1: Write the failing test**

Append to `test/integration/playback.test.js`:

First, extend the require at the top of the file — `typeInto` and `intervalRows`
join what Task 5 already imports, rather than a second `require` appearing
halfway down:

```js
const {
  loadApp,
  fireClick,
  buildRelativeScale,
  selectOption,
  typeInto,
  intervalRows,
} = require("../helpers/harness.js");
```

Then append:

```js
function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

function pressNote(h, index) {
  h.all("#editor .note-row")[index]
    .querySelector(".play-note")
    .dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));
}

test("one transport, one voice", async (t) => {
  await t.test("a per-note press stops a playing scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    const scheduled = ctx.oscillators.length;
    ctx.currentTime = 0.5;
    pressNote(h, 0);

    assert.equal(h.app.isScalePlaying(), false, "the scale gives way to the held note");
    assert.equal(soundingDegree(h), null, "and its highlight goes with it");
    for (const osc of ctx.oscillators.slice(0, scheduled)) {
      closeTo(osc.stopped, 0.5 + h.app.RELEASE_SECONDS, 1e-12);
    }
    assert.equal(ctx.oscillators.length, scheduled + 1, "the held note is sounding");
    assert.equal(ctx.oscillators.at(-1).stopped, null, "and is still held");
  });

  await t.test("Stop silences a held note too", () => {
    const h = loadApp();
    t.after(() => h.close());

    pressNote(h, 0);
    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators[0].stopped, null, "the note is held to start with");

    pressStop(h);
    closeTo(ctx.oscillators[0].stopped, h.app.RELEASE_SECONDS, 1e-12);
  });

  await t.test("editing the scale mid-melody does not interrupt it", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const scheduled = h.audioContexts[0].oscillators.length;
    // Re-scheduling mid-melody has no musical meaning, and stopping on every
    // keystroke would make the editor unusable while listening.
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "3/2");

    assert.equal(h.app.isScalePlaying(), true, "the scale plays out as scheduled");
    assert.equal(h.audioContexts[0].oscillators.length, scheduled, "and nothing is re-scheduled");
  });
});

test("refusing to play an invalid scale", async (t) => {
  await t.test("will not play while a box is unreadable, and says which", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    pressPlay(h);

    assert.equal(h.app.isScalePlaying(), false, "nothing may play");
    assert.equal(h.audioContexts.length, 0, "not even an AudioContext");
    assert.equal(messageText(h), "Cannot play: interval 2 is not a valid ratio."); // reworded in review; see note 1
  });

  await t.test("the complaint takes itself down when the box is fixed", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["oops"]);

    pressPlay(h);
    assert.notEqual(messageText(h), "", "the bar should be saying something");

    // The same self-clearing INVALID_SCALE_MESSAGE kind the save guards use:
    // the complaint describes a state the editor is in, so it stops being true
    // the moment that state does.
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "9/8");
    assert.equal(messageText(h), "");

    pressPlay(h);
    assert.equal(h.app.isScalePlaying(), true);
  });
});
```

Note the wording: this said *"Cannot save"* even on Play while design §8 asked for the same guard *and* the same message. Review corrected it — the guard is still shared, but the verb is now a parameter. See note 1 in "Notes carried over from the design" above.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/integration/playback.test.js`
Expected: FAIL — the per-note press does not stop the scale, Stop leaves the held note sounding, and Play sounds an invalid scale without a message.

- [ ] **Step 3: Implement the three rules**

In `audio-ui.js`, `startTone()`'s first statement becomes:

```js
function startTone(frequency) {
  // One transport and one voice: a held note taking over from a playing scale
  // is the only reading that does not produce two melodies at once.
  // stopScale() stops the held note too, so stopTone() is not called twice.
  stopScale();
  const ctx = getAudioContext();
```

(The old `stopTone();` line goes; `stopScale()` covers it.)

`stopScale()`'s first statement becomes:

```js
function stopScale() {
  // Stop is one control over one voice: a held note is the other thing that
  // could be sounding, and it stops too.
  stopTone();
  if (!playback) return;
```

And `playScale()` gains the guard, before it touches the audio:

```js
function playScale() {
  if (isScalePlaying()) return;

  // A scale with a hole in it is not one the app should play, any more than it
  // is one it should hand out — the same guard, message and self-clearing
  // behaviour the two saves use.
  const problem = invalidIntervalMessage();
  if (problem) {
    showToolbarMessage(problem, INVALID_SCALE_MESSAGE);
    return;
  }

  const plan = scalePlaybackPlan(scaleFrequencies(readScaleData(), getBaseFrequency()));
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/integration/playback.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing. In particular `test/unit/pitch.test.js`'s `"releasing without playing anything is harmless"` must still pass: `stopScale()` returns before reaching `getAudioContext()` when nothing is playing, and `stopTone()` returns before reaching it when nothing is held.

- [ ] **Step 5: Commit**

```bash
git add audio-ui.js test/integration/playback.test.js
git commit -m "$(cat <<'EOF'
[#17] Give the scale and the held note one transport between them

A per-note press stops a playing scale, and Stop silences whichever of the two
is sounding — one voice, one control over it.

Play refuses an unreadable scale through the same invalidIntervalMessage()
guard and the same self-clearing message kind the two saves use. Editing during
playback deliberately does not interrupt: the plan was scheduled in full when
Play was pressed, and re-scheduling mid-melody has no musical meaning.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 8: `suggestedFileName()` takes an extension

**Files:**
- Modify: `persistence.js:178-196`
- Test: `test/unit/scale-file-format.test.js` (append one block)

**Interfaces:**
- Consumes: nothing.
- Produces: `suggestedFileName(name, extension = SCALE_FILE_EXTENSION) → string`. Every existing one-argument call and test keeps working, which is the point of the default.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/scale-file-format.test.js`, after the existing `suggestedFileName` block:

```js
test("suggestedFileName's extension", async (t) => {
  await t.test("defaults to the scale file's, so every existing call is unchanged", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.suggestedFileName("Hicaz Hümayun"), "hicaz-humayun.musp.json");
  });

  await t.test("takes another when one is given, sharing the slug rule", () => {
    const h = loadApp();
    t.after(() => h.close());
    // The audio export names its file after the scale, with the same slug rule
    // and the same diacritic folding as the .musp.json save.
    assert.equal(h.app.suggestedFileName("Hicaz Hümayun", ".wav"), "hicaz-humayun.wav");
  });

  await t.test("still falls back to \"scale\" for a name that slugs away", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.app.suggestedFileName("", ".wav"), "scale.wav");
    assert.equal(h.app.suggestedFileName("ἦχος πρῶτος", ".wav"), "scale.wav");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/unit/scale-file-format.test.js`
Expected: FAIL — `"hicaz-humayun.musp.json" !== "hicaz-humayun.wav"`; the second argument is ignored.

- [ ] **Step 3: Add the parameter**

In `persistence.js`, change the signature and the return, and extend the doc comment's first line:

```js
/**
 * "Hicaz Hümayun" -> "hicaz-humayun.musp.json", or "hicaz-humayun.wav" for
 * another extension. Lowercased, every run outside a-z0-9 collapsed to one
 * dash, the ends trimmed. A name that slugs away to nothing gives "scale".
 *
 * The extension defaults to the scale file's, so the audio export shares one
 * slug rule with the .musp.json save rather than growing a second.
 */
function suggestedFileName(name, extension = SCALE_FILE_EXTENSION) {
```

and

```js
  return (slug || "scale") + extension;
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/unit/scale-file-format.test.js`
Expected: PASS — including every existing one-argument case, unchanged.

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 5: Commit**

```bash
git add persistence.js test/unit/scale-file-format.test.js
git commit -m "$(cat <<'EOF'
[#17] Let suggestedFileName take an extension

Defaulted to the scale file's, so every existing call and test is unchanged and
the audio export shares one slug rule — diacritic folding included — with the
.musp.json save rather than growing a second.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 9: Render the scale offline to WAV bytes

**Files:**
- Modify: `audio-ui.js` (append), `test/helpers/audio-stub.js`, `test/helpers/harness.js`
- Test: `test/integration/audio-export.test.js` (create)

**Interfaces:**
- Consumes: `scaleFrequencies()`, `scalePlaybackPlan()`, `scheduleScale()`, `encodeWavMono16()`, `QUARTER_SECONDS`, `EXPORT_SAMPLE_RATE` (Tasks 1, 2, 5); `readScaleData()`, `getBaseFrequency()` from `app.js`.
- Produces:
  - `async function renderScaleWav() → Uint8Array` in `audio-ui.js`.
  - Stub: `FakeOfflineAudioContext` and `envelopeValueAt()` in `audio-stub.js`; `window.OfflineAudioContext` and `h.offlineContexts` in the harness.

- [ ] **Step 1: Add the offline stub**

`startRendering()` **interprets the automation; it does not synthesise audio.** It renders each scheduled gain envelope as the piecewise-linear curve its `setValueAtTime`/`linearRampToValueAtTime` events describe, with the oscillator modelled as a constant `1.0`. The rendered buffer therefore carries the *envelope schedule* — real app logic — and no fake DSP. Same choice `canvas-stub.js` makes in recording draw calls rather than rasterising.

Append to `test/helpers/audio-stub.js`, before the `module.exports`:

```js
/**
 * The value an automation curve holds at `time`, from the events recorded on
 * the param: a linear ramp interpolates from the previous event, a
 * setValueAtTime holds until its own time. Before the first event the param
 * reads as its first scheduled value, which is how the app always starts a
 * note — at silence.
 */
function envelopeValueAt(param, time) {
  const events = param.events.filter((e) => e.type !== "cancelScheduledValues");
  if (events.length === 0) return 0;
  if (time <= events[0].time) return events[0].value;

  let previous = events[0];
  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    if (time >= event.time) {
      previous = event;
      continue;
    }
    if (event.type === "linearRampToValueAtTime") {
      const span = event.time - previous.time;
      const ratio = span > 0 ? (time - previous.time) / span : 1;
      return previous.value + (event.value - previous.value) * ratio;
    }
    return previous.value;
  }
  return previous.value;
}

/**
 * A rendering stand-in for OfflineAudioContext.
 *
 * It interprets the schedule rather than synthesising audio: every oscillator
 * is a constant 1.0 between its start and stop, multiplied by the envelope its
 * gain node describes. So a test asserts the numbers the app handed the API,
 * which is the same line docs/TESTING.md draws for the chart.
 */
class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(numberOfChannels, length, sampleRate) {
    super();
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.renderCalls = 0;
  }

  startRendering() {
    this.renderCalls++;
    const data = new Float32Array(this.length);
    for (const osc of this.oscillators) {
      const gain = osc.connectedTo[0];
      if (!gain || !gain.gain) continue;
      const from = Math.max(0, Math.round((osc.started || 0) * this.sampleRate));
      const to =
        osc.stopped === null
          ? this.length
          : Math.min(this.length, Math.round(osc.stopped * this.sampleRate));
      for (let i = from; i < to; i++) {
        data[i] += envelopeValueAt(gain.gain, i / this.sampleRate);
      }
    }
    return Promise.resolve({
      numberOfChannels: this.numberOfChannels,
      length: this.length,
      sampleRate: this.sampleRate,
      getChannelData: () => data,
    });
  }
}
```

Add both to the exports:

```js
module.exports = {
  FakeAudioContext,
  FakeOfflineAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
  FakeAudioParam,
  envelopeValueAt,
};
```

- [ ] **Step 2: Install it in the harness**

In `test/helpers/harness.js`, change the require:

```js
const { FakeAudioContext, FakeOfflineAudioContext } = require("./audio-stub.js");
```

and extend the audio block:

```js
  // --- audio -------------------------------------------------------------
  const audioContexts = [];
  window.AudioContext = class TrackedAudioContext extends FakeAudioContext {
    constructor() {
      super();
      audioContexts.push(this);
    }
  };
  const offlineContexts = [];
  window.OfflineAudioContext = class TrackedOfflineAudioContext extends FakeOfflineAudioContext {
    constructor(numberOfChannels, length, sampleRate) {
      super(numberOfChannels, length, sampleRate);
      offlineContexts.push(this);
    }
  };
```

and add to the returned `harness` object, beside `audioContexts`:

```js
    /** Every OfflineAudioContext the app constructed, one per audio export. */
    offlineContexts,
```

- [ ] **Step 3: Write the failing test**

Create `test/integration/audio-export.test.js`:

```js
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, buildRelativeScale, selectOption } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");
const { wavHeader, wavSamples } = require("../helpers/wav.js");

/** The rendered value at `seconds`, from the offline context's buffer. */
function sampleAt(data, seconds, sampleRate) {
  return data[Math.round(seconds * sampleRate)];
}

test("rendering the scale offline", async (t) => {
  await t.test("renders mono at a fixed 44.1 kHz, long enough for every note", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();

    assert.equal(h.offlineContexts.length, 1, "one render per export");
    const offline = h.offlineContexts[0];
    assert.equal(offline.numberOfChannels, 1, "mono");
    // Fixed, not the device's: the same scale exported from a machine running
    // its output at 48 kHz must produce the same file.
    assert.equal(offline.sampleRate, 44100);
    assert.equal(offline.length, Math.ceil(3 * h.app.QUARTER_SECONDS * 44100));
  });

  await t.test("starts at zero offline — nothing can be late in a render", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();

    const first = h.offlineContexts[0].oscillators[0];
    assert.equal(first.started, 0, "no scheduling lead offline");
  });

  await t.test("carries each note's envelope, and lands on silence at the end", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();
    const offline = h.offlineContexts[0];
    // The stub's render is a pure function of what was scheduled, so it can be
    // asked again for the buffer the export already consumed.
    const data = (await offline.startRendering()).getChannelData(0);
    const rate = offline.sampleRate;
    const quarter = h.app.QUARTER_SECONDS;

    closeTo(sampleAt(data, 0, rate), 0, 1e-4, "the first note fades in rather than clicking on");
    closeTo(sampleAt(data, h.app.ATTACK_SECONDS, rate), 0.3, 1e-3, "attack reaches the peak");
    closeTo(sampleAt(data, quarter / 2, rate), 0.3, 1e-3, "and sustains there");
    closeTo(sampleAt(data, quarter - 0.0005, rate), 0, 1e-2, "release reaches silence");
    closeTo(sampleAt(data, quarter, rate), 0, 1e-3, "and the next note starts from it");
    closeTo(data[data.length - 1], 0, 1e-2, "the last note's release is not cut off");
  });

  await t.test("never clips, so the encoder's clamp is never reached in practice", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    await h.app.renderScaleWav();
    const data = (await h.offlineContexts[0].startRendering()).getChannelData(0);

    let peak = 0;
    for (const value of data) peak = Math.max(peak, Math.abs(value));
    assert.ok(peak <= 0.3 + 1e-6, `one voice at a time peaks at 0.3, got ${peak}`);
  });

  await t.test("hands back a valid WAV of the rendered length", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    const bytes = await h.app.renderScaleWav();
    const header = wavHeader(bytes);

    assert.equal(header.chunkId, "RIFF");
    assert.equal(header.format, "WAVE");
    assert.equal(header.audioFormat, 1);
    assert.equal(header.numChannels, 1);
    assert.equal(header.sampleRate, 44100);
    assert.equal(header.bitsPerSample, 16);
    assert.equal(header.subchunk2Size, h.offlineContexts[0].length * 2);
    assert.equal(wavSamples(bytes).length, h.offlineContexts[0].length);
  });

  await t.test("a longer scale renders a longer file", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);

    await h.app.renderScaleWav();
    // Four degrees make seven notes, not four.
    assert.equal(h.offlineContexts[0].length, Math.ceil(7 * h.app.QUARTER_SECONDS * 44100));
    assert.equal(h.offlineContexts[0].oscillators.length, 7);
  });

  await t.test("follows the base note, like everything else that sounds", async () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz
    buildRelativeScale(h, ["3/2"]);

    await h.app.renderScaleWav();
    const frequencies = h.offlineContexts[0].oscillators.map((o) => o.frequency.value);
    closeTo(frequencies[0], 220, 1e-9);
    closeTo(frequencies[1], 330, 1e-9);
    closeTo(frequencies[2], 220, 1e-9);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `node --test test/integration/audio-export.test.js`
Expected: FAIL — `h.app.renderScaleWav is not a function`.

- [ ] **Step 5: Implement the render**

Append to `audio-ui.js`:

```js
// --- the audio export ------------------------------------------------------

/**
 * The scale as WAV bytes, rendered offline.
 *
 * The same scheduleScale() live playback uses, handed a different context and
 * destination — so the file is what the reader heard rather than a second
 * implementation of it. No scheduling lead: nothing can be late in a render
 * that is not realtime, and the last note's release reaches zero exactly at
 * the buffer's end, so nothing is cut off.
 */
async function renderScaleWav() {
  const plan = scalePlaybackPlan(scaleFrequencies(readScaleData(), getBaseFrequency()));
  const total = plan.length * QUARTER_SECONDS;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(total * EXPORT_SAMPLE_RATE),
    EXPORT_SAMPLE_RATE
  );
  scheduleScale(offline, plan, offline.destination, 0);
  const buffer = await offline.startRendering();
  return encodeWavMono16(buffer.getChannelData(0), EXPORT_SAMPLE_RATE);
}
```

- [ ] **Step 6: Run the tests**

Run: `node --test test/integration/audio-export.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 7: Commit**

```bash
git add audio-ui.js test/helpers/audio-stub.js test/helpers/harness.js \
        test/integration/audio-export.test.js
git commit -m "$(cat <<'EOF'
[#17] Render the scale to WAV bytes offline

renderScaleWav() hands the same scheduleScale() an OfflineAudioContext at a
fixed 44100 Hz, so the file is what the reader heard and does not vary by
machine — the principle savePNG() already follows with EXPORT_SCALE.

The harness's offline stub interprets the automation rather than synthesising
audio: each gain envelope as the piecewise-linear curve its events describe,
the oscillator a constant 1.0. Real app logic asserted, no fake DSP.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 10: "Save Audio As WAV" in the Save menu

**Files:**
- Modify: `index.html` (one menu item), `audio-ui.js` (append), `test/helpers/harness.js`
- Test: `test/integration/audio-export.test.js` (append), `test/integration/toolbar.test.js` (the menu item list)

**Interfaces:**
- Consumes: `renderScaleWav()` (Task 9); `suggestedFileName(name, extension)` (Task 8); `closeSaveMenu()`, `clearToolbarMessage()`, `showToolbarMessage()`, `INVALID_SCALE_MESSAGE` from `persistence-ui.js`; `invalidIntervalMessage()`, `scaleNameInput` from `app.js`.
- Produces:
  - `AUDIO_FILE_EXTENSION = ".wav"`, `AUDIO_FILE_PICKER_TYPES`, `async function saveAudioFile()`, `downloadAudioFile(fileName, bytes)`.
  - Harness: `h.objectUrls`, `savedAudioFile(harness)`, and `data` on `writtenFiles` entries.

- [ ] **Step 1: Add the object-URL shim and the read-back helper**

jsdom implements neither `URL.createObjectURL` nor `Blob#arrayBuffer()`, so the shim records the real Blob and a `FileReader` reads it back — the test then asserts the bytes a browser would actually have written.

In `test/helpers/harness.js`, after the `// --- downloads ---` block:

```js
  // --- object URLs --------------------------------------------------------
  // jsdom implements neither createObjectURL nor revokeObjectURL. The shim
  // keeps the real Blob, so a test reads the actual WAV back rather than
  // decoding base64 out of a data: URL.
  const objectUrls = [];
  window.URL.createObjectURL = function createObjectURL(blob) {
    const url = `blob:http://localhost/${objectUrls.length + 1}`;
    objectUrls.push({ url, blob, revoked: false });
    return url;
  };
  window.URL.revokeObjectURL = function revokeObjectURL(url) {
    const entry = objectUrls.find((o) => o.url === url);
    if (entry) entry.revoked = true;
  };
```

Add it to the returned `harness` object, beside `downloads`:

```js
    /** `{ url, blob, revoked }` for every object URL the app created. */
    objectUrls,
```

Record binary picker writes too — the audio save hands `write()` a `Uint8Array`, not a string. In the `showSaveFilePicker` stub, change the `write` line to:

```js
            write: (data) => {
              writtenFiles.push({
                name: pickerOptions.suggestedName,
                // A scale document arrives as a string; a WAV arrives as bytes,
                // and stringifying 900 KB of samples would help nobody.
                text: typeof data === "string" ? data : "",
                data: data,
              });
              return Promise.resolve();
            },
```

Add two helpers near `savedScaleFile`, and export both:

```js
/** Reads a jsdom Blob's bytes; jsdom's Blob has no arrayBuffer(), FileReader does. */
function blobBytes(harness, blob) {
  return new Promise(function (resolve, reject) {
    const reader = new harness.window.FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * The audio file the app last handed to `<a download>`, with its bytes read
 * back out of the Blob the object URL points at — the real Blob the app built.
 */
async function savedAudioFile(harness) {
  const download = harness.downloads[harness.downloads.length - 1];
  if (!download) throw new Error("Nothing was downloaded");
  const entry = harness.objectUrls.find((o) => o.url === download.href);
  if (!entry) throw new Error(`No object URL matches ${download.href}`);
  return {
    name: download.download,
    type: entry.blob.type,
    revoked: entry.revoked,
    bytes: await blobBytes(harness, entry.blob),
  };
}
```

```js
module.exports = {
  loadApp,
  // …
  savedScaleFile,
  savedAudioFile,
  blobBytes,
  // …
};
```

- [ ] **Step 2: Write the failing test**

Append to `test/integration/audio-export.test.js`:

First, extend the require at the top of the file rather than adding a second
one halfway down:

```js
const {
  loadApp,
  buildRelativeScale,
  selectOption,
  fireClick,
  typeInto,
  savedAudioFile,
} = require("../helpers/harness.js");
```

Then append:

```js
/** Clicks Save ▸ Save Audio As WAV, the way a user reaches it. */
async function saveAudio(h) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById("save-audio"));
  // Two ticks, not one. saveAudioFile() suspends on the offline render, so the
  // timer below is registered *before* downloadAudioFile() registers its own
  // setTimeout(revoke, 0) — and timers fire in registration order. One tick
  // reaches the download; the second reaches the revoke.
  await new Promise((resolve) => h.window.setTimeout(resolve, 0));
  await new Promise((resolve) => h.window.setTimeout(resolve, 0));
}

function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

test("saving the audio", async (t) => {
  await t.test("downloads a WAV named after the scale", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");

    await saveAudio(h);

    const file = await savedAudioFile(h);
    assert.equal(file.name, "hicaz-humayun.wav", "the slug rule the .musp.json save uses");
    assert.equal(file.type, "audio/wav");
    assert.equal(wavHeader(file.bytes).chunkId, "RIFF", "the bytes really are a WAV");
    assert.equal(wavHeader(file.bytes).sampleRate, 44100);
  });

  await t.test("falls back to scale.wav for an unnamed scale", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal((await savedAudioFile(h)).name, "scale.wav");
  });

  await t.test("closes the menu, the way the other save items do", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal(
      h.document.getElementById("save-menu-panel").classList.contains("open"),
      false
    );
  });

  await t.test("revokes the object URL, but not before the click", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveAudio(h);
    // Revoking synchronously can cancel the download the click just started,
    // so it happens on the next macrotask — by which time it has happened.
    assert.equal(h.objectUrls.length, 1);
    assert.equal(h.objectUrls[0].revoked, true);
    assert.equal(h.downloads[0].href, h.objectUrls[0].url, "the click used the live URL");
  });

  await t.test("writes through the file picker where the browser has one", async () => {
    const h = loadApp({ fileSystemAccess: true });
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Rast");

    await saveAudio(h);

    assert.equal(h.filePickerCalls.length, 1);
    assert.equal(h.filePickerCalls[0].picker, "save");
    assert.equal(h.filePickerCalls[0].options.suggestedName, "rast.wav");
    assert.deepEqual(h.filePickerCalls[0].options.types, [
      { description: "WAV audio", accept: { "audio/wav": [".wav"] } },
    ]);
    assert.equal(h.downloads.length, 0, "no anchor fallback when a picker exists");
    assert.equal(wavHeader(h.writtenFiles[0].data).chunkId, "RIFF");
  });

  await t.test("says nothing when the dialog is cancelled", async () => {
    const h = loadApp({ fileSystemAccess: { saveAborts: true } });
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal(messageText(h), "", "the user chose not to save");
  });

  await t.test("reports a dialog that genuinely failed", async () => {
    const h = loadApp({ fileSystemAccess: { saveFails: true } });
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal(messageText(h), "Could not save the audio file.");
  });

  await t.test("refuses a scale with an unreadable interval", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    await saveAudio(h);

    assert.equal(h.downloads.length, 0, "nothing may be handed out");
    assert.equal(h.offlineContexts.length, 0, "and nothing is even rendered");
    assert.equal(messageText(h), "Cannot play: interval 2 is not a valid ratio."); // reworded in review; see note 1
  });
});
```

Add one item-list assertion to `test/integration/toolbar.test.js`, in `"holds the two save items, the PNG one moved from the Chart panel"` — rename the test to `"holds the three save items: the scale file, the chart and the audio"` and update it:

```js
    assert.deepEqual(
      [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ["Save As Music Scale Plot file", "Save Chart As PNG", "Save Audio As WAV"]
    );
    assert.equal(h.document.getElementById("save-png").closest("#save-menu-panel"), panel);
    assert.equal(h.document.getElementById("save-audio").closest("#save-menu-panel"), panel);
    assert.equal(h.el(".chart-toolbar #save-png"), null, "it no longer sits in the Chart panel");
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/integration/audio-export.test.js test/integration/toolbar.test.js`
Expected: FAIL — `#save-audio` does not exist, so the click throws and the menu list is one item short.

- [ ] **Step 4: Add the menu item**

In `index.html`, after the PNG item — no second `<hr>`; the existing separator divides the scale file from the two exports:

```html
          <button type="button" id="save-png">Save Chart As PNG</button>
          <button type="button" id="save-audio">Save Audio As WAV</button>
```

- [ ] **Step 5: Implement the save**

Append to `audio-ui.js`:

```js
const AUDIO_FILE_EXTENSION = ".wav";

const AUDIO_FILE_PICKER_TYPES = [
  { description: "WAV audio", accept: { "audio/wav": [".wav"] } },
];

/** Always Save-As, like the other two: no dirty tracking, no remembered handle. */
async function saveAudioFile() {
  closeSaveMenu();
  clearToolbarMessage();

  // A scale with a hole in it is not one the app should hand out in any format.
  const problem = invalidIntervalMessage();
  if (problem) {
    showToolbarMessage(problem, INVALID_SCALE_MESSAGE);
    return;
  }

  const bytes = await renderScaleWav();
  const fileName = suggestedFileName(scaleNameInput.value, AUDIO_FILE_EXTENSION);

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: AUDIO_FILE_PICKER_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      // A cancelled dialog is not an error to report: the user chose not to save.
      if (error && error.name === "AbortError") return;
      showToolbarMessage("Could not save the audio file.");
    }
    return;
  }

  downloadAudioFile(fileName, bytes);
}

/**
 * The fallback, for Firefox, Safari and every file:// page.
 *
 * A Blob and an object URL, not the data: URL the other two saves use: an
 * eight-degree scale is 882 KB, which base64 inflates to about 1.18 MB, and a
 * sixteen-degree one reaches 2.43 MB — past the point where data: downloads
 * are reliable.
 */
function downloadAudioFile(fileName, bytes) {
  const blob = new Blob([bytes], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  // On the next macrotask, after the click has been dispatched: revoking
  // synchronously can cancel the download.
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 0);
}

document.getElementById("save-audio").addEventListener("click", saveAudioFile);
```

- [ ] **Step 6: Run the tests**

Run: `node --test test/integration/audio-export.test.js test/integration/toolbar.test.js`
Expected: PASS.

Run: `npm test`
Expected: PASS — 0 failing.

- [ ] **Step 7: Commit**

```bash
git add index.html audio-ui.js test/helpers/harness.js \
        test/integration/audio-export.test.js test/integration/toolbar.test.js
git commit -m "$(cat <<'EOF'
[#17] Add "Save Audio As WAV" to the Save menu

Follows saveScaleFile()'s shape — close the menu, clear the bar, refuse an
unreadable scale — then takes the picker where a browser has one and an
<a download> everywhere else. The fallback uses a Blob and an object URL rather
than a data: URL, which a megabyte of audio would not survive; the URL is
revoked on the next macrotask, after the click.

The harness shims createObjectURL and reads the real Blob back through
FileReader, so the test asserts the bytes a browser would have written.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Task 11: The documentation sweep

The "seven scripts" wording is mechanical to change but easy to leave half-done. Sweep for it exhaustively.

**Files:**
- Modify: `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `CLAUDE.md`, `README.md`
- Test: none — documentation only. `npm test` must still pass unchanged.

**Interfaces:**
- Consumes: everything built in Tasks 1–10.
- Produces: nothing the code depends on.

- [ ] **Step 1: Find every occurrence**

Run:

```bash
grep -rn "seven\|five \.svg\|five icons\|five buttons\|five toolbar" \
  docs/ARCHITECTURE.md docs/TESTING.md CLAUDE.md README.md
```

Expected: 12 hits, at `docs/ARCHITECTURE.md:35,39,632,649`, `CLAUDE.md:54,59,60`, `README.md:9,59`, `docs/TESTING.md:4,37,439`. Two of them are false positives — `ARCHITECTURE.md:136` ("five accidentals plus seven naturals") and `TESTING.md:4` ("five thousand lines") — leave those alone; note `TESTING.md:4` also says "seven classic scripts" in the same sentence, which does change.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

1. **File Structure tree** — insert after the `persistence.js` line:

```
├── audio.js                 # The audio model: frequencies, the playback plan,
│                             # the node graph and the WAV encoder, no DOM
```

and after the `persistence-ui.js` line:

```
├── audio-ui.js              # The transport, the sounding-note highlight and the
│                             # WAV export; also the per-note play buttons
```

Change `app.js`'s comment from `chart rendering, audio, PNG export` to `chart rendering, PNG export` — audio has moved out.

2. **The prose under the tree** — "the seven scripts" becomes "the nine scripts"; the JavaScript bullet lists all nine in load order and says "split into nine classic `<script>` files".

3. **HTML Layout** — extend the toolbar sentence: after "**Add note** and **Remove last note**", add "a second `.toolbar-separator`, then **Play** and **Stop**"; and change the Save-menu parenthetical to "a menu with 'Save As Music Scale Plot file' and, below a separator, 'Save Chart As PNG' and 'Save Audio As WAV'".

4. **A new `## Audio` section**, placed between `## File Persistence` and `## Chart Rendering (Canvas)`. Add exactly this:

```markdown
## Audio

One `AudioContext`, one sounding voice, and two ways to reach it: a note row's
play button, which sounds that degree for as long as it is held, and the
toolbar's **Play**, which sounds the whole scale. Both live in `audio-ui.js` so
that one file owns the oscillator; the numbers behind them live in `audio.js`,
which touches no DOM.

### The sequence and the envelope

For a scale of N degrees the melody is degrees `1, 2, … N, N−1, … 1` — **2N−1
notes**, the top note sounding once, the way a scale is practised. Every note is
a quarter at 90 BPM (`QUARTER_SECONDS = 60 / 90`), so an eight-degree scale runs
ten seconds.

`scalePlaybackPlan()` produces that schedule **as data**: one entry per sounded
note, each with a start time relative to zero and the degree it belongs to — so
the sounding-note highlight needs no second mapping from time back to a row.

Each note reuses the timbre the per-note button already produces, so a played
scale sounds like the notes the reader has been auditioning by hand: a triangle
oscillator, a 20 ms attack to gain 0.3, a sustain, and a 50 ms release landing
exactly on the note boundary. The automation has **four** events, and the third
is load-bearing:

```js
gain.setValueAtTime(0, start)
gain.linearRampToValueAtTime(0.3, start + 0.02)
gain.setValueAtTime(0.3, end - 0.05)   // anchors the sustain
gain.linearRampToValueAtTime(0, end)
```

Without that third event the automation would ramp from the end of the attack
all the way to the end of the note — a slow decay, not a sustain with a release.
The release is also what articulates the melody: each note reaches silence
exactly where the next one's attack begins, so the scale is detached rather than
smeared.

### Nothing is driven by a timer

**Every note is scheduled up front against the audio clock**, in a single
synchronous pass. No `setTimeout` or `setInterval` takes any part in producing
sound, so playback cannot drift, cannot be delayed by a busy main thread and
cannot block the UI. `playScale()` schedules from `currentTime + 0.05` rather
than from `currentTime`: the lead absorbs the cost of building the graph, so the
first note is not clipped by its own scheduling.

`requestAnimationFrame` only *paints*. `updateSoundingNote()` reads the audio
clock and moves a `.sounding` class to the play button of whichever degree is
currently sounding — the pressed look, reusing an affordance the reader already
knows rather than inventing a second highlight. If the frame loop were throttled
to a stop the audio would still be correct.

The authoritative end of a scale is **`onended` on the last oscillator**, not the
frame loop, because `requestAnimationFrame` is throttled in a background tab and
the buttons must return to idle whether or not anyone is looking. `stopScale()`
clears that handler *before* stopping the nodes, so a deliberate stop does not
also run the natural-end path.

Two interaction rules follow from there being one voice: pressing a per-note
button stops a playing scale first, and **Stop** stops whichever of the two is
sounding. Editing the scale during playback deliberately does *not* interrupt
it — the plan was scheduled in full when Play was pressed, stopping on every
keystroke would make the editor unusable while listening, and re-scheduling
mid-melody has no musical meaning.

### WAV export

**Save Audio As WAV** renders the same melody through an `OfflineAudioContext`
and writes a mono, 16-bit, 44.1 kHz WAV. `scheduleScale()` is shared by live
playback and the render, the only difference being which context and destination
it is handed — so the exported file is what the reader heard by construction,
not because two implementations happen to agree. There is no scheduling lead
offline: nothing can be late in a render that is not realtime.

**The sample rate is fixed at 44100, not taken from the device's
`AudioContext`** — the same principle `savePNG()` follows in re-rendering at
`EXPORT_SCALE` rather than at `devicePixelRatio`. The same scale exported from a
Mac running its output at 48 kHz and from a machine at 44.1 kHz must produce the
same file, with nothing in it to tell the two apart.

`encodeWavMono16()` writes a canonical 44-byte RIFF/WAVE header and
little-endian PCM. Samples are clamped to [−1, 1] and scaled asymmetrically —
`s < 0 ? s * 0x8000 : s * 0x7fff` — which is the conversion that maps −1.0 and
+1.0 onto the full signed range without wrapping. Clipping should never occur in
practice (one voice at a time, peak gain 0.3, no overlap); the clamp is there
because an encoder that trusts its input produces a file that clicks.

The download uses a `Blob` and `URL.createObjectURL`, **not** the `data:` URL the
scale-file and PNG saves use: an eight-degree scale is 882 KB, which base64
inflates to about 1.18 MB, and a sixteen-degree one reaches 2.43 MB — past the
point where `data:` downloads are reliable. The object URL is revoked on the next
macrotask, after the click has been dispatched; revoking synchronously can cancel
the download. The file is named after the scale through `suggestedFileName()`, so
it shares its slug rule and diacritic folding with the `.musp.json` save.

### Why WAV, and not a compressed format

The project's own rule — no libraries, no build step — leaves only what a browser
can encode natively, and there the two requirements pull apart. Every current
browser can record WebM/Opus through `MediaRecorder`, but a `.webm` audio file
opens in neither QuickTime nor iOS; `.m4a` opens everywhere, but AAC encoding is
absent from Firefox on every platform, so the app would hand different browsers
different formats and the menu label would have to change per browser.

Compression also costs the non-blocking property. `MediaRecorder` has no offline
mode: it captures a stream in wall-clock time, so an eight-degree scale would
take the full ten seconds to export and would need progress and cancel UI.
`OfflineAudioContext` renders the same scale in milliseconds.

Against that, a mono 16-bit 44.1 kHz WAV of an eight-degree scale is 882 KB, and
705 kbps clears the ">128 kbps" the issue asked for by a wide margin. FLAC is the
one option that satisfies every stated requirement at once — compressed,
lossless, offline-renderable, natively playable everywhere — but it costs roughly
200 lines of fixed-predictor and Rice-coding bit packing that this app would then
own and test forever. Recorded here so a future reader knows the ground was
covered, not missed.
```

5. **Styling** — `#1a1814` "is written in five `.svg` files" becomes **seven**, and the list of files gains `icons/play.svg` and `icons/stop.svg`; "the toolbar's five icons" becomes "seven".

6. **Summary table** — the Export row becomes `canvas.toDataURL() + programmatic download for the chart; OfflineAudioContext + a hand-written WAV encoder for the audio`, and the Code organisation row lists nine scripts.

- [ ] **Step 3: Update `CLAUDE.md`**

1. **Files** list — add, in load order:

```markdown
- `audio.js` — the audio model, no DOM: the tempo and envelope constants, `scaleFrequencies`, `scalePlaybackPlan`, `scheduleScale` (shared by live playback and the offline export) and `encodeWavMono16`.
- `audio-ui.js` — the DOM half of audio: the Play/Stop transport and its button state, the sounding-note highlight, the WAV export flow, and the per-note press-and-hold playback that used to live in `app.js`.
```

Change `index.html`'s bullet to list all nine scripts in order, and `app.js`'s to drop "Web Audio playback".

2. **Architecture** — add an **Audio** bullet after **File persistence**:

```markdown
- **Audio**: one `AudioContext` and one sounding voice. A per-note button plays while held (`audio-ui.js`); **Play** sounds the whole scale — degrees 1…N then N−1…1, quarter notes at 90 BPM — by scheduling every note up front against the audio clock, so no timer takes part in producing sound. The sounding degree's own play button takes the pressed look, driven by `updateSoundingNote()` reading the clock. **Save Audio As WAV** renders the same `scheduleScale()` through an `OfflineAudioContext` at a fixed 44100 Hz and encodes mono 16-bit RIFF/WAVE by hand; see `docs/ARCHITECTURE.md`'s Audio section for why not a compressed format.
```

3. **Testing** and **Conventions** — every "seven scripts" becomes "nine scripts", and the Conventions block's load-order list gains `audio.js` (after `persistence.js`) and `audio-ui.js` (after `persistence-ui.js`).

4. **Files** — the `icons/` bullet: "five toolbar SVG icons (new, open, save, add-note, remove-note)" becomes "seven toolbar SVG icons (new, open, save, add-note, remove-note, play, stop)".

- [ ] **Step 4: Update `docs/TESTING.md`**

1. §1 "The dependency question" and §2's opening — the script lists gain `audio.js` and `audio-ui.js`; "seven classic scripts" becomes "nine".
2. §2 "How this is enforced" — the `paths:` list gains both files.
3. §4 layout tree — add:

```
│   ├── wav.js           reads a mono 16-bit RIFF/WAVE file back out of its bytes
…
│   ├── playback-plan.test.js       the degree sequence and the note schedule
│   ├── wav-encoding.test.js        every RIFF header field, the sample scaling
…
    ├── playback.test.js            the transport: scheduling, envelopes, button
    │                               state, the sounding-note highlight, the two
    │                               interaction rules and the Play guard
    ├── audio-export.test.js        the offline render, the WAV bytes, both save
    │                               paths, the filename and the guard
```

4. §5 stub table — three new rows:

| API | Stub | Why |
|---|---|---|
| `OfflineAudioContext` | `FakeOfflineAudioContext`, tracked on `h.offlineContexts` | `startRendering()` **interprets the automation; it does not synthesise audio** — each gain envelope as the piecewise-linear curve its events describe, the oscillator a constant `1.0`. The buffer therefore carries the envelope *schedule*, which is real app logic, and no fake DSP. |
| `URL.createObjectURL` / `revokeObjectURL` | records the real Blob and hands back a fake URL | jsdom implements neither. `savedAudioFile()` reads the Blob back through `FileReader` (jsdom's Blob has no `arrayBuffer()`), so a test asserts the bytes a browser would have written. |
| `AudioContext#state` / `#resume()` / `#advanceTo()` | on `FakeAudioContext` | A context may be suspended when Play is pressed, and `advanceTo(time)` fires `onended` for every oscillator whose stop time has passed — the transport's authoritative end of a scale, reachable without waiting ten real seconds. |

5. §5 harness-helper table — add `savedAudioFile(h)` and `blobBytes(h, blob)`.
6. §7 step 4 — "in whichever of the seven scripts" becomes "nine".
7. §8 Known limitations — add:

```markdown
- **The exported file's waveform is not asserted**, only its envelope and its
  container. There is no oscillator model in the harness, and adding one would
  mean tests asserting the stub's own arithmetic. Same line §8's text-measurement
  note already draws.
```

- [ ] **Step 5: Update `README.md`**

1. Line 9 — list all nine scripts in load order, and change "the toolbar's five buttons are `<img>`-loaded SVGs" to **seven**.
2. Usage step 3 — mention the transport and the new item:

```markdown
3. Use the toolbar's **New**, **Open** and **Save** to work with `.musp.json` scale files, its **Play** and **Stop** buttons to hear the scale, or its **Save** menu's **Save Chart As PNG** and **Save Audio As WAV** to export.
```

3. The third-party-assets note — "The five toolbar glyphs in `icons/`" becomes **seven**.

- [ ] **Step 6: Verify nothing was missed**

Run:

```bash
grep -rn "seven classic\|seven scripts\|seven own scripts\|seven of the\|five \.svg\|five toolbar\|five buttons\|five icons" \
  docs/ CLAUDE.md README.md .claude/
```

Expected: no output.

Run:

```bash
grep -c "audio.js" .claude/rules/testing.md
```

Expected: `2` — `audio.js` and `audio-ui.js` were added in Tasks 1 and 3.

Run: `npm test`
Expected: PASS — 0 failing, and exactly the same count as before this task: documentation only.

- [ ] **Step 7: Commit**

```bash
git add docs/ARCHITECTURE.md docs/TESTING.md CLAUDE.md README.md
git commit -m "$(cat <<'EOF'
[#17] Document the transport and the WAV export

ARCHITECTURE.md gains an Audio section — the sequence, the envelope, why
nothing is driven by a timer, and why the export is WAV rather than a
compressed format. Every "seven scripts" becomes nine, and the count of files
carrying the #1a1814 literal five becomes seven.

TESTING.md gains the three new stubs, the two helpers and the four new test
files, plus the note that the exported waveform is modelled rather than real.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CeD4SJLn7VKtJQtkjfJCGg
EOF
)"
```

---

## Final verification

- [ ] `npm test` — expected: 0 failing. The baseline was 965 tests; the four new files and the additions to three existing ones take it well past that.
- [ ] `npm run test:coverage` — `audio.js` and `audio-ui.js` should be near-fully covered. Coverage is a signal, not a target: do not add a test that fakes an unreachable state to chase a number.
- [ ] Manual verification in a real browser (encouraged, not committed — `docs/TESTING.md` §3). Open `index.html` from the filesystem and check, by eye and ear:
  - Play sounds the scale up and back down, detached rather than smeared, and the highlight moves note by note.
  - Stop silences it mid-melody and the buttons swap back; so does letting it finish.
  - Pressing a per-note button mid-melody takes over cleanly.
  - Save ▸ Save Audio As WAV downloads a file that opens in QuickTime / Windows Media Player and sounds like what was just played.
  - The two new icons sit level with the other five and dim when disabled.
- [ ] Confirm nothing that was not asked for came along: `scale.png` is still `scale.png` (design §7.3), no tempo or waveform control, and the chart is unchanged. (The keyboard shortcuts this line once also forbade were asked for after the plan was written and **are** shipped — see the amendment in design §11.)
