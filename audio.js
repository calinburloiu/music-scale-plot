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

// Beside the format it names, the way persistence.js holds
// SCALE_FILE_EXTENSION. The picker's file-type list stays in audio-ui.js,
// where the dialog that uses it lives.
const AUDIO_FILE_EXTENSION = ".wav";

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
