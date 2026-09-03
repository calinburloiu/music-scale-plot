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
