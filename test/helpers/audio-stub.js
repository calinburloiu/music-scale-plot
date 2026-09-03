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

module.exports = {
  FakeAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
  FakeAudioParam,
};
