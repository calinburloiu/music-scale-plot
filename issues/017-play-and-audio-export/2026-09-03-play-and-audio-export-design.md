# Scale playback and audio export — design

Design for [issue #17, *Add play and audio export*](https://github.com/calinburloiu/music-scale-plot/issues/17).

Sources this design rests on, and does not restate:

- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — the DOM-as-data-model, the editor's rows, the toolbar, PNG export.
- [`docs/TESTING.md`](../../docs/TESTING.md) — the mandatory TDD loop, the harness and its stubs.
- [`issues/015-file-persistence/2026-09-03-file-persistence-design.md`](../015-file-persistence/2026-09-03-file-persistence-design.md) — the toolbar and Save menu this feature extends, and the two save paths it reuses.

---

## 1. What is being built

The app gains a **transport**: the whole scale plays as a melody rather than one note
at a time under a held mouse button, and that same melody can be **exported as a WAV
file** through the Save menu.

Three visible additions:

- Two toolbar buttons, **Play** and **Stop**, in a new group after Add/Remove note.
- A new Save-menu item, **Save Audio As WAV**, below the PNG item.
- The existing PNG item is renamed **Save Chart As PNG**, so the menu says which of the
  two representations each item writes.

While the scale plays, the note currently sounding shows it: **that degree's own play
button takes the pressed look**, as though the user were holding it down. This reuses
the affordance the reader already knows rather than inventing a second highlight.

Two new scripts carry the feature — `audio.js` (no DOM) and `audio-ui.js` — and the
per-note press-and-hold playback that lives in `app.js` today moves into `audio-ui.js`
with them (§4.3).

Nothing about the chart, the symbol model, the interval maths or the `.musp.json`
format changes.

---

## 2. Decisions taken

| Question | Decision | Why |
|---|---|---|
| Audio format | **WAV**, mono, 16-bit, 44.1 kHz | §3.1 — the only format this app can write that is both dependency-free and playable everywhere. |
| Sequence | **Up then back down**, top note not repeated | The way a scale is practised. N degrees → 2N−1 notes. |
| Tempo | Quarter notes at **90 BPM** → 0.6̅ s per note | From the issue. |
| Visual feedback | The sounding degree's `.play-note` button takes the pressed look | Reuses an existing affordance; no second visual vocabulary. |
| Code layout | New `audio.js` + `audio-ui.js`; per-note playback moves too | §4 — mirrors `persistence.js` / `persistence-ui.js`, and keeps one owner for the oscillator. |
| Toolbar order | `New Open Save▾ │ Add Remove │ Play Stop` | File actions, then editing, then transport. |
| Export rendering | `OfflineAudioContext` at a **fixed** 44100 Hz | §3.2 — faster than realtime, and the file does not vary by machine. |
| Download mechanism | `Blob` + `URL.createObjectURL` | §7.2 — a WAV is too large for the `data:` URL the other two saves use. |

### 2.1 Why WAV, and not a compressed format

The issue asks for "a compressed file format widely available on Mac, Windows and
mobile … Mono and more than 128 kbps". The project's own rule — no libraries, no build
step — rules out `lamejs` and `ffmpeg.wasm`, so the candidates are only what a browser
can encode natively:

| Route | Format | Encoding time | Mac / Win / iOS / Android |
|---|---|---|---|
| `OfflineAudioContext` + hand-written RIFF header | WAV | faster than realtime | ✅ ✅ ✅ ✅ |
| `MediaRecorder` | WebM/Opus | **realtime only** | ❌ ~ ❌ ✅ |
| `MediaRecorder` | MP4/AAC — Safari and Chrome, not Firefox | realtime only | ✅ ✅ ✅ ✅ |
| WebCodecs `AudioEncoder` | Opus/AAC packets, **no container** — hand-written muxer | fast | depends |
| Hand-written FLAC encoder | FLAC | fast | ✅ ✅ ✅ ✅ |

Two facts decide it.

**The format that is universally producible is not universally playable, and vice
versa.** Every current browser can record WebM/Opus, but a `.webm` audio file opens in
neither QuickTime nor iOS. `.m4a` opens everywhere, but AAC encoding is absent from
Firefox on every platform, so the app would hand different browsers different formats
and the menu label would have to change per browser.

**Compression costs the non-blocking property the feature is required to have.**
`MediaRecorder` has no offline mode: it captures a `MediaStreamAudioDestinationNode` in
wall-clock time, so an 8-degree scale takes the full 10 s to export and needs progress
and cancel UI. `OfflineAudioContext` renders the same scale in milliseconds.

Against that, what compression would buy is small: a mono 16-bit 44.1 kHz WAV of an
8-degree scale is **882 KB**, and 705 kbps clears the ">128 kbps" bar by a wide margin.
The saving is a few hundred kilobytes on a file nobody streams, paid for with a
realtime export, a per-browser format, and a filename extension that depends on who
opened the app.

FLAC is the one option that satisfies every stated requirement at once — compressed,
lossless, offline-renderable, natively playable on all four platforms — but it costs
roughly 200 lines of fixed-predictor and Rice-coding bit packing that this app would
then own and test forever. That is not a trade this feature is worth. It stays
documented here so a future reader knows it was considered, not missed.

---

## 3. The playback model

### 3.1 The sequence

For a scale of **N** degrees the melody is degrees `1, 2, … N, N−1, … 1` — **2N−1
notes**, the top note sounding once. Every note is a quarter at 90 BPM:

```
QUARTER_SECONDS = 60 / 90 = 0.66666…
```

| Degrees | Notes | Duration |
|---|---|---|
| 2 (the smallest legal scale) | 3 | 2.00 s |
| 8 | 15 | 10.00 s |
| 16 | 31 | 20.67 s |

### 3.2 The envelope

Each note reuses the timbre and envelope the per-note button already produces, so a
played scale sounds like the notes the reader has been auditioning by hand: a
**triangle** oscillator, a 20 ms linear attack to gain **0.3**, a sustain, and a 50 ms
linear release landing exactly on the note boundary.

```
gain.setValueAtTime(0, start)
gain.linearRampToValueAtTime(0.3, start + 0.02)
gain.setValueAtTime(0.3, start + duration - 0.05)   // anchors the sustain
gain.linearRampToValueAtTime(0, start + duration)
osc.start(start)
osc.stop(start + duration)
```

The third line is load-bearing. Without it the automation would ramp linearly from the
end of the attack all the way to the end of the note — a slow decay, not a sustain with
a release. The release also gives consecutive notes their articulation: each ends at
silence exactly where the next one's attack begins, so the scale is detached rather
than smeared.

One oscillator and one gain node per note, all created and scheduled in a single
synchronous pass. A 31-note scale is 62 nodes, which is nothing.

### 3.3 Nothing is driven by a timer

**Every note is scheduled up front against the audio clock.** No `setTimeout` or
`setInterval` participates in producing sound, so playback cannot drift, cannot be
delayed by a busy main thread, and cannot block the UI. The animation loop of §5.3
only paints; if it were throttled to a stop the audio would still be correct.

`playScale()` schedules from `ctx.currentTime + 0.05` rather than from `currentTime`.
The 50 ms lead absorbs the cost of building the graph, so the first note is not clipped
by its own scheduling.

The context is resumed first (`if (ctx.state === "suspended") ctx.resume()`). Play is
always reached from a user gesture, so the autoplay policy permits it, but a context
created earlier in the page's life may still be suspended.

---

## 4. Code layout

### 4.1 `audio.js` — the model. No DOM.

Loads first among the two, before `symbols-ui.js`. Pure functions over numbers; it
never touches the document and never reads a control.

```js
const QUARTER_SECONDS = 60 / 90;
const EXPORT_SAMPLE_RATE = 44100;
const NOTE_PEAK_GAIN = 0.3;
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.05;

function scaleFrequencies(data, baseFrequency)   // readScaleData() output -> [Hz] per degree
function scalePlaybackPlan(frequencies)          // -> [{degree, frequency, start, duration}]
function scheduleScale(ctx, plan, destination, t0)  // -> the nodes it created
function encodeWavMono16(samples, sampleRate)    // Float32Array -> Uint8Array (RIFF/WAVE)
```

`scaleFrequencies()` walks the scale data **once**, accumulating cents and emitting a
frequency per note row. Today's `getFrequencyForDegree(degree)` re-reads the whole
editor on every call, which the transport would turn into O(N²); it is re-expressed on
top of `scaleFrequencies()` and keeps its signature, so its existing callers and tests
are untouched.

`scalePlaybackPlan()` produces the schedule **as data** — start times relative to zero,
one entry per sounded note, each carrying the `degree` it belongs to so the highlight of
§5.3 needs no second mapping. This is the function the plan's arithmetic is asserted on.

`scheduleScale()` is used by **both** live playback and the export, with the only
difference being which context and destination it is handed. The exported file is
therefore what the reader heard by construction, not by two implementations agreeing.

### 4.2 `audio-ui.js` — the DOM half.

Loads after `audio.js` and before `app.js`. Like `persistence-ui.js`, it only *defines*
functions and *wires* listeners at its top level: it resolves `app.js`'s globals
(`readScaleData`, `invalidIntervalMessage`, `showToolbarMessage`) at click time, long
after `app.js` has run.

```js
function getAudioContext()          // moved from app.js
function startTone(frequency)       // moved from app.js
function stopTone()                 // moved from app.js
function handlePlayStart(event)     // moved from app.js
function playScale()                // the Play button
function stopScale()                // the Stop button, and the end of a scale
function isScalePlaying()
function updateTransportButtons()
function updateSoundingNote()       // one frame of the pressed-state highlight
function setSoundingDegree(degree)  // moves the .sounding class; null clears it
function saveAudioFile()            // the "Save Audio As WAV" menu item
function renderScaleWav()           // offline render -> Uint8Array of WAV bytes
function downloadAudioFile(name, bytes)
```

### 4.3 What moves out of `app.js`, and why

`getAudioContext`, `startTone`, `stopTone` and `handlePlayStart` move to
`audio-ui.js`, together with the four listener registrations that drive them
(`editor` mousedown/touchstart, `document` mouseup/touchend).

The transport and the per-note button now share two things: a pressed visual state, and
the question of who owns the sounding oscillator. Leaving them in separate files is
precisely the tangle. This is a lift of already-tested code with **no behaviour
change** — the existing suite proves the move, and no test needs editing, because the
harness exports every top-level function from every script into one namespace.

`getBaseFrequency()` and `getFrequencyForDegree()` stay in `app.js`: they read
`#base-note` and call `readScaleData()`, which is `app.js`'s own model layer.

### 4.4 Load order

`index.html` grows from seven scripts to nine:

```
byzantine.js  smufl.js  persistence.js  audio.js
symbols-ui.js  byzantine-ui.js  persistence-ui.js  audio-ui.js  app.js
```

`audio.js` joins the no-DOM group and `audio-ui.js` the UI group, each keeping the
established rule that a model file loads before the UI built on it, and that `app.js`
runs last because it executes at load time.

The classic-script constraint stands: **no top-level name may be declared twice across
the nine files**, or the page throws a `SyntaxError` before anything runs. The names
above were checked against the existing eight.

---

## 5. The transport UI

### 5.1 Markup

Two buttons in a third toolbar group, after the note-editing pair:

```html
<span class="toolbar-separator"></span>
<button type="button" id="play-scale" class="toolbar-btn" aria-label="Play scale" title="Play scale">
  <img src="icons/play.svg" alt="">
</button>
<button type="button" id="stop-scale" class="toolbar-btn" aria-label="Stop playing" title="Stop playing" disabled>
  <img src="icons/stop.svg" alt="">
</button>
```

Giving the transport its own group after Add/Remove reads as file actions, then
editing, then playback.

Two new icons, `icons/play.svg` and `icons/stop.svg`, drawn to match the existing five
and with `#1a1814` **baked in**: an SVG loaded through `<img>` renders in an isolated
document that no page CSS reaches, so `currentColor` never resolves. ARCHITECTURE.md's
note that `#1a1814` is written in five `.svg` files becomes **seven**.

### 5.2 Button state

```js
function updateTransportButtons() {
  playBtn.disabled = isScalePlaying();
  stopBtn.disabled = !isScalePlaying();
}
```

Play is disabled while a scale plays rather than restarting it, so a double-click
cannot stack two melodies on top of each other. Stop is disabled when idle.

### 5.3 The pressed state

`style.css` gains one rule, reproducing what a real press looks like — the hover fill
*and* the active geometry, since a mouse press on a desktop is also a hover:

```css
.play-note.sounding {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--paper);
  transform: scale(0.95);
  box-shadow: 0 1px 3px -1px rgba(138, 46, 26, 0.35);
}
```

The class is moved by `updateSoundingNote()`, which reads the audio clock rather than
counting frames:

```js
function updateSoundingNote() {
  if (!playback) return;
  const elapsed = getAudioContext().currentTime - playback.t0;
  const index = Math.floor(elapsed / QUARTER_SECONDS);
  const entry = elapsed < 0 ? null : playback.plan[index];
  const degree = entry ? entry.degree : null;
  if (degree === playback.degree) return;   // only touch the DOM on a boundary
  setSoundingDegree(degree);
  playback.degree = degree;
}
```

It is a **named top-level function**, so a test advances the fake context's
`currentTime` and calls it directly, instead of racing a real 16 ms animation frame.
`requestAnimationFrame` merely calls it in the running app.

### 5.4 Playback state, and how it ends

```js
let playback = null;  // { plan, t0, nodes, frameId, degree } while playing
```

The authoritative end of a scale is **`onended` on the last oscillator**, not the
animation loop: `requestAnimationFrame` is throttled in a background tab, and the
buttons must return to idle whether or not anyone is looking.

`stopScale()` clears that handler *before* stopping the oscillators, so a deliberate
stop does not also run the natural-end path. It then ramps each live gain to zero over
50 ms, stops the nodes, cancels the pending frame, clears the `.sounding` class and
resets the buttons.

### 5.5 Two interaction rules

**Pressing a per-note play button stops the scale first.** There is one transport and
one sounding voice; a held note taking over from a playing scale is the only reading
that does not produce two melodies at once. `startTone()` therefore calls `stopScale()`
as its first act, and Stop stops both a playing scale and a held note.

**Editing the scale during playback does not interrupt it.** The plan was scheduled in
full when Play was pressed and plays out as scheduled; the chart re-renders on every
keystroke as it always has. Stopping on each keystroke would make the editor unusable
while listening, and re-scheduling mid-melody has no musical meaning.

---

## 6. The WAV encoder

`encodeWavMono16(samples, sampleRate)` writes a 44-byte canonical RIFF/WAVE header
followed by little-endian 16-bit PCM, and returns a `Uint8Array`.

| Offset | Field | Value |
|---|---|---|
| 0 | ChunkID | `"RIFF"` |
| 4 | ChunkSize | `36 + dataSize` |
| 8 | Format | `"WAVE"` |
| 12 | Subchunk1ID | `"fmt "` |
| 16 | Subchunk1Size | `16` |
| 20 | AudioFormat | `1` (PCM) |
| 22 | NumChannels | `1` |
| 24 | SampleRate | `44100` |
| 28 | ByteRate | `sampleRate × 2` |
| 32 | BlockAlign | `2` |
| 34 | BitsPerSample | `16` |
| 36 | Subchunk2ID | `"data"` |
| 40 | Subchunk2Size | `samples.length × 2` |

Samples are clamped to `[-1, 1]` and scaled asymmetrically — `s < 0 ? s * 0x8000 : s *
0x7fff` — which is the conversion that maps −1.0 and +1.0 onto the full signed range
without wrapping. Clipping should never occur in practice: one voice at a time, peak
gain 0.3, no overlap. The clamp is there because an encoder that trusts its input
produces a file that clicks.

---

## 7. Export

### 7.1 Rendering

```js
async function renderScaleWav() {
  const plan = scalePlaybackPlan(scaleFrequencies(readScaleData(), getBaseFrequency()));
  const total = plan.length * QUARTER_SECONDS;
  const offline = new OfflineAudioContext(1, Math.ceil(total * EXPORT_SAMPLE_RATE), EXPORT_SAMPLE_RATE);
  scheduleScale(offline, plan, offline.destination, 0);
  const buffer = await offline.startRendering();
  return encodeWavMono16(buffer.getChannelData(0), EXPORT_SAMPLE_RATE);
}
```

No lead time offline — nothing can be late in a render that is not realtime. The last
note's release reaches zero exactly at `total`, so nothing is cut off.

**The sample rate is fixed at 44100, not taken from the device's `AudioContext`.** This
is the same principle `savePNG()` follows in re-rendering at `EXPORT_SCALE` rather than
at `devicePixelRatio`: the same scale exported from a Mac running its output at 48 kHz
and from a machine at 44.1 kHz must produce the same file, with nothing in it to tell
the two apart.

### 7.2 Saving

`saveAudioFile()` follows `saveScaleFile()`'s shape exactly — close the menu, clear the
message bar, run the invalid-interval guard, then take one of two paths:

```js
const AUDIO_FILE_PICKER_TYPES = [
  { description: "WAV audio", accept: { "audio/wav": [".wav"] } },
];
```

`showSaveFilePicker` where it exists; otherwise `<a download>`, for Firefox, Safari and
every `file://` page.

**The fallback uses a `Blob` and `URL.createObjectURL`, not the `data:` URL the other
two saves use.** An 8-degree scale is 882 KB, which base64 inflates to about 1.18 MB,
and a 16-degree scale reaches 2.43 MB — past the point where `data:` downloads are
reliable.
The object URL is revoked on the next macrotask, after the click has been dispatched;
revoking synchronously can cancel the download.

### 7.3 The filename

`suggestedFileName()` gains a second parameter:

```js
function suggestedFileName(name, extension = SCALE_FILE_EXTENSION)
```

The default preserves every existing call and test, and the audio path passes `".wav"`
— so a scale named "Hicaz Hümayun" exports `hicaz-humayun.wav`, sharing the slug rule
(and its diacritic folding) with the `.musp.json` save.

This leaves PNG export on its hardcoded `scale.png`. Bringing it in line would be a
genuine improvement, but it is a behaviour change with a test attached and issue #17
does not ask for it. Noted here as a follow-up, not done.

---

## 8. Guards and errors

**Both Play and Save Audio refuse a scale with an unreadable interval**, through the
existing `invalidIntervalMessage()` check and the `INVALID_SCALE_MESSAGE` kind — the
same guard, the same message and the same self-clearing behaviour that `savePNG()` and
`saveScaleFile()` already use. A scale with a hole in it is not one the app should play
or hand out, in any format.

A cancelled save dialog (`AbortError`) reports nothing: the user chose not to save. A
dialog that genuinely fails reports "Could not save the audio file." through the
message bar, matching the existing wording pattern.

---

## 9. Testing

Everything below follows the mandatory red/green/refactor loop of `docs/TESTING.md`:
each behaviour gets its failing test first.

### 9.1 New harness stubs

| Stub | Shape |
|---|---|
| `OfflineAudioContext` | Extends `FakeAudioContext` with `length`, `sampleRate`, `numberOfChannels` and `startRendering()`. Recorded like the online one, and tracked on the harness so a test can inspect what was scheduled. |
| `URL.createObjectURL` / `revokeObjectURL` | jsdom implements neither. The shim records each Blob's bytes and hands back a fake URL, so a test reads the **real WAV back** and asserts its header — better than decoding base64 out of a `data:` URL. |

`requestAnimationFrame` needs no stub: jsdom provides it under `pretendToBeVisual`,
which the harness already sets. Tests drive the highlight through
`updateSoundingNote()` directly.

**`startRendering()` interprets the automation, it does not synthesise audio.** It
renders each scheduled gain envelope as the piecewise-linear curve its
`setValueAtTime`/`linearRampToValueAtTime` events describe, with the oscillator modelled
as a constant `1.0`. So the rendered buffer carries the *envelope schedule* — real app
logic — and carries no fake DSP. This is the same choice `canvas-stub.js` makes in
recording draw calls rather than rasterising, and the same line TESTING.md already draws
for the chart: **assert the numbers handed to the API, never the resulting media.**

### 9.2 New test files

- **`test/unit/playback-plan.test.js`** — `scaleFrequencies()` and
  `scalePlaybackPlan()`: the degree sequence folds at the top without repeating it,
  start times are consecutive multiples of the quarter, total length is 2N−1, and each
  entry names its degree. Boundaries: the two-note minimum, a descending interval, a
  zero-cent interval, an unparseable interval.
- **`test/unit/wav-encoding.test.js`** — every header field of §6 read back off the
  bytes, `dataSize` against the sample count, the asymmetric sample scaling, and
  clamping above +1.0 and below −1.0.
- **`test/integration/playback.test.js`** — Play schedules 2N−1 oscillators with the
  planned frequencies and envelopes; button enablement flips both ways; the pressed
  class follows the clock across note boundaries and clears at the end; Stop mid-scale
  silences every live node and clears the class; a per-note press stops a playing
  scale; the invalid-interval guard blocks Play and posts the message.
- **`test/integration/audio-export.test.js`** — the menu item renders and downloads;
  the file name follows the scale's name; the downloaded bytes are a valid mono
  44.1 kHz 16-bit WAV of the expected length; both save paths (picker and fallback); a
  cancelled picker stays silent; a failed one reports; the guard blocks the export.

### 9.3 Existing files that change

- **`test/integration/toolbar.test.js`** — the renamed "Save Chart As PNG", the new
  "Save Audio As WAV" item, and the two new toolbar buttons in their group.
- **`test/unit/scale-file-format.test.js`** — one added case for
  `suggestedFileName(name, extension)`; the existing single-argument cases must keep
  passing unchanged, which is the point of the default.

No existing test should need editing beyond those two additions. If one goes red, the
move of §4.3 was not behaviour-preserving and the cause is a real defect, not a test to
update.

### 9.4 Known limitation

The exported file's **waveform** is not asserted, only its envelope and its container.
There is no oscillator model in the harness, and adding one would mean tests asserting
the stub's own arithmetic. This sits alongside TESTING.md §8's existing note that text
measurement is modelled rather than real.

---

## 10. Documentation to update

- **`docs/ARCHITECTURE.md`** — a new **Audio** section (there is none today) covering
  the transport, the schedule, the envelope and the WAV export; the File Structure
  listing; the `#1a1814` note (five `.svg` files → seven); the Summary table's Export
  row.
- **`CLAUDE.md`** — the file list, the Conventions block, and every "seven classic
  scripts" phrase, which occurs several times.
- **`docs/TESTING.md`** — the script lists in §2 and §5, the layout tree in §4, the
  stub table in §5, and the dependency note.
- **`README.md`** — line 9 enumerates all seven scripts in load order *and* says "the
  toolbar's five buttons are `<img>`-loaded SVGs". Both change: nine scripts, seven
  buttons.

The "seven scripts" wording is mechanical to change but easy to leave half-done; it must
be swept for exhaustively.

---

## 11. Out of scope

- **Any compressed format.** §2.1 records why, including the FLAC option, so a future
  reader knows the ground already covered.
- **Tempo, note-duration or waveform controls.** The issue fixes a quarter at 90 BPM,
  and the constants are named in `audio.js` for whoever adds settings later.
- **A keyboard shortcut for Play/Stop.** Space and Enter both already mean something on
  a focused control and in the editor's note-entry flow.
- **Highlighting the sounding degree in the chart.** The pressed play button is the
  agreed feedback; a canvas re-render on every note boundary is not.
- **Renaming `scale.png`** to follow the scale's name (§7.3).
- **Looping, or playing a selected range.**
