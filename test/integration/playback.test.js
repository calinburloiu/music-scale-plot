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
