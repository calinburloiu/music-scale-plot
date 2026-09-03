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
  // One transport and one voice: a held note taking over from a playing scale
  // is the only reading that does not produce two melodies at once.
  // stopScale() stops the held note too, so stopTone() is not called twice.
  stopScale();
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
  // Before the early return, so the look a held number key put on a button
  // always ends with the voice it belongs to — whoever ended it, and whether
  // or not there was still an oscillator to silence.
  releaseKeyboardDegree();
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

// --- the keyboard ----------------------------------------------------------
//
// Space toggles the transport, and 1…9 sound their degree for as long as they
// are held. Both listen on the document, so both have to decide whether the
// keystroke was meant for them or for whatever has focus. Two different
// answers, because the two keys conflict with different things: a digit is
// only ever eaten by something you can type into, while Space is *also* the
// browser's click on a focused button.

/** Anything a keystroke can be typed into: the key belongs to it, not to us. */
function isTextEntryElement(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  // SELECT is here because it eats both keys this file claims: a digit is
  // option typeahead, and Space opens the list.
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Anything the browser turns a Space into a click on. */
function isSpaceActivatedElement(element) {
  if (!element) return false;
  const tag = element.tagName;
  return tag === "BUTTON" || tag === "SUMMARY" || (tag === "A" && element.hasAttribute("href"));
}

/** `key` as a scale degree; 0 for every other key, "0" included. */
function numberKeyDegree(key) {
  return typeof key === "string" && key.length === 1 && key >= "1" && key <= "9"
    ? Number(key)
    : 0;
}

/**
 * The degree a held number key is sounding, or null.
 *
 * A mouse press gets the pressed look from `:active` on the button it is held
 * over. A key never touches the button, so the look is put on and taken off by
 * hand — and remembering *which* degree owns it is also what stops a stale
 * keyup, from a key released after another one took the voice, cutting the
 * note that is actually sounding.
 */
let keyboardDegree = null;

function releaseKeyboardDegree() {
  if (keyboardDegree === null) return;
  keyboardDegree = null;
  setSoundingDegree(null);
}

function playKeyboardDegree(degree) {
  // startTone() runs stopScale(), which runs stopTone(), which clears whatever
  // the last key left — so the two lines below are the whole handover.
  startTone(getFrequencyForDegree(degree));
  keyboardDegree = degree;
  setSoundingDegree(degree);
}

function handleAudioKeyDown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const focused = document.activeElement;
  if (isTextEntryElement(focused)) return;

  if (event.key === " ") {
    if (isSpaceActivatedElement(focused)) return;
    // Off the page on every keydown, repeats included, or a held Space scrolls
    // it. Act only on the first: toggling on every repeat would make the
    // transport unusable from the keyboard.
    event.preventDefault();
    if (event.repeat) return;
    if (isScalePlaying()) stopScale();
    else playScale();
    return;
  }

  const degree = numberKeyDegree(event.key);
  if (degree === 0 || event.repeat) return;
  // A degree the scale does not have sounds nothing, rather than taking
  // getFrequencyForDegree()'s fall back to the base frequency: from the
  // keyboard that would be a note with no button to show where it came from.
  if (!audioEditor.querySelector('.note-row[data-degree="' + degree + '"]')) return;
  playKeyboardDegree(degree);
}

function handleAudioKeyUp(event) {
  if (keyboardDegree === null) return;
  if (numberKeyDegree(event.key) !== keyboardDegree) return;
  stopTone();
}

/** Focus can leave mid-hold, and then the keyup never arrives. */
function handleWindowBlur() {
  if (keyboardDegree !== null) stopTone();
}

document.addEventListener("keydown", handleAudioKeyDown);
document.addEventListener("keyup", handleAudioKeyUp);
window.addEventListener("blur", handleWindowBlur);

/**
 * The current scale as a playback plan, in the reader's chosen base note —
 * shared by playScale() and renderScaleWav() so both start from exactly the
 * same schedule.
 */
function currentPlaybackPlan() {
  return scalePlaybackPlan(scaleFrequencies(readScaleData(), getBaseFrequency()));
}

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

  // A scale with a hole in it is not one the app should play, any more than it
  // is one it should hand out — the same guard, message and self-clearing
  // behaviour the two saves use.
  const problem = invalidIntervalMessage();
  if (problem) {
    showToolbarMessage(problem, INVALID_SCALE_MESSAGE);
    return;
  }

  const plan = currentPlaybackPlan();
  if (plan.length === 0) return;

  // The third rule that follows from there being one voice, and the one the
  // keyboard makes easy to reach: hold a number key, then press Space. After
  // the guards, so a Play that does not happen silences nothing.
  stopTone();

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
  playback.frameId = requestAnimationFrame(tickSoundingNote);
}

/** The natural end: the nodes have finished, so there is nothing to silence. */
function handleScaleEnded() {
  if (!playback) return;
  cancelAnimationFrame(playback.frameId);
  playback = null;
  setSoundingDegree(null);
  updateTransportButtons();
}

function stopScale() {
  // Stop is one control over one voice: a held note is the other thing that
  // could be sounding, and it stops too.
  stopTone();
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
  cancelAnimationFrame(playback.frameId);
  playback = null;
  setSoundingDegree(null);
  updateTransportButtons();
}

playScaleBtn.addEventListener("click", playScale);
stopScaleBtn.addEventListener("click", stopScale);

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
  const plan = currentPlaybackPlan();
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

// --- saving the audio -------------------------------------------------------

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

  // The render sits inside the same try/catch as the dialog: a rejection here
  // (an OfflineAudioContext that fails to render) must report exactly the
  // same message as a failed dialog, not slip out as an unhandled rejection.
  // It never raises AbortError itself, so that branch still means only what
  // it always has — the user cancelled the dialog.
  try {
    const bytes = await renderScaleWav();
    const fileName = suggestedFileName(scaleNameInput.value, AUDIO_FILE_EXTENSION);

    if (typeof window.showSaveFilePicker === "function") {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: AUDIO_FILE_PICKER_TYPES,
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    }

    downloadAudioFile(fileName, bytes);
  } catch (error) {
    // A cancelled dialog is not an error to report: the user chose not to save.
    if (error && error.name === "AbortError") return;
    showToolbarMessage("Could not save the audio file.");
  }
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
