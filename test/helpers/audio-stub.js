"use strict";

/**
 * A recording stand-in for the Web Audio API.
 *
 * Only the surface `app.js` actually touches is implemented: `createOscillator`,
 * `createGain`, `currentTime`, `destination`, plus the AudioParam automation
 * methods used for the attack/release envelope. Every scheduled change is
 * recorded so tests can assert on pitch and envelope shape as data.
 */

class FakeAudioParam {
  constructor(name, value) {
    this.name = name;
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "setValueAtTime", value, time });
    return this;
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "linearRampToValueAtTime", value, time });
    return this;
  }

  cancelScheduledValues(time) {
    this.events.push({ type: "cancelScheduledValues", time });
    return this;
  }
}

class FakeAudioNode {
  constructor(context) {
    this.context = context;
    this.connectedTo = [];
  }

  connect(destination) {
    this.connectedTo.push(destination);
    return destination;
  }

  disconnect() {
    this.connectedTo.length = 0;
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  constructor(context) {
    super(context);
    this.type = "sine";
    this.frequency = new FakeAudioParam("frequency", 440);
    this.started = null;
    this.stopped = null;
    // The natural end of a note. FakeAudioContext#advanceTo() fires it, so a
    // test can reach the end of a scale without waiting ten real seconds.
    this.onended = null;
    this.ended = false;
  }

  start(time) {
    this.started = time;
  }

  stop(time) {
    this.stopped = time;
  }
}

class FakeGainNode extends FakeAudioNode {
  constructor(context) {
    super(context);
    this.gain = new FakeAudioParam("gain", 1);
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = { name: "destination" };
    this.oscillators = [];
    this.gains = [];
    // A context created earlier in the page's life may be suspended when Play
    // is pressed; the app resumes it first.
    this.state = "running";
    this.resumeCalls = 0;
  }

  createOscillator() {
    const osc = new FakeOscillatorNode(this);
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gain = new FakeGainNode(this);
    this.gains.push(gain);
    return gain;
  }

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
}


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

module.exports = {
  FakeAudioContext,
  FakeOfflineAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
  FakeAudioParam,
  envelopeValueAt,
};
