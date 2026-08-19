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
}

module.exports = {
  FakeAudioContext,
  FakeGainNode,
  FakeOscillatorNode,
  FakeAudioParam,
};
