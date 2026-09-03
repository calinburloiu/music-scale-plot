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
