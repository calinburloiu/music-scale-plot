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
