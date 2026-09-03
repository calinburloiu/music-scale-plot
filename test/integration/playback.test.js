"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  buildRelativeScale,
  selectOption,
  typeInto,
  intervalRows,
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

/** The degree whose play button currently wears the pressed look, or null. */
function soundingDegree(h) {
  const button = h.el("#editor .play-note.sounding");
  return button ? Number(button.closest(".note-row").dataset.degree) : null;
}

test("the sounding note", async (t) => {
  await t.test("follows the audio clock across the note boundaries", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    const quarter = h.app.QUARTER_SECONDS;
    const t0 = h.app.PLAYBACK_LEAD_SECONDS;

    // Driven through updateSoundingNote() rather than by racing a real 16ms
    // animation frame: the function reads the clock, so the clock is the input.
    const seen = [];
    for (const step of [0, 1, 2, 3, 4]) {
      ctx.currentTime = t0 + step * quarter + quarter / 2;
      h.app.updateSoundingNote();
      seen.push(soundingDegree(h));
    }
    assert.deepEqual(seen, [1, 2, 3, 2, 1], "up and back down");
  });

  await t.test("shows nothing before the first note and after the last", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];

    ctx.currentTime = 0; // still inside the scheduling lead
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), null, "nothing sounds during the lead");

    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + h.app.QUARTER_SECONDS / 2;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1);

    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + 99;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), null, "past the end of the plan");
  });

  await t.test("marks exactly one button at a time", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + h.app.QUARTER_SECONDS * 1.5;
    h.app.updateSoundingNote();

    assert.equal(h.all("#editor .play-note.sounding").length, 1);
  });

  await t.test("clears when the scale is stopped", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    h.audioContexts[0].currentTime = h.app.PLAYBACK_LEAD_SECONDS + 0.1;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1, "something must be lit before clearing means anything");

    pressStop(h);
    assert.equal(soundingDegree(h), null);
  });

  await t.test("clears when the scale ends on its own", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    ctx.currentTime = h.app.PLAYBACK_LEAD_SECONDS + 0.1;
    h.app.updateSoundingNote();
    assert.equal(soundingDegree(h), 1);

    ctx.advanceTo(h.app.PLAYBACK_LEAD_SECONDS + 3 * h.app.QUARTER_SECONDS);
    assert.equal(soundingDegree(h), null);
  });

  await t.test("does nothing at all once playback is over", () => {
    const h = loadApp();
    t.after(() => h.close());

    // No context, no playback: the frame callback must be a no-op rather than
    // reaching for a clock that does not exist.
    h.app.updateSoundingNote();
    assert.equal(h.audioContexts.length, 0);
    assert.deepEqual(h.jsdomErrors, []);
  });
});

function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

function pressNote(h, index) {
  h.all("#editor .note-row")[index]
    .querySelector(".play-note")
    .dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));
}

test("one transport, one voice", async (t) => {
  await t.test("a per-note press stops a playing scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const ctx = h.audioContexts[0];
    const scheduled = ctx.oscillators.length;
    ctx.currentTime = 0.5;
    pressNote(h, 0);

    assert.equal(h.app.isScalePlaying(), false, "the scale gives way to the held note");
    assert.equal(soundingDegree(h), null, "and its highlight goes with it");
    for (const osc of ctx.oscillators.slice(0, scheduled)) {
      closeTo(osc.stopped, 0.5 + h.app.RELEASE_SECONDS, 1e-12);
    }
    assert.equal(ctx.oscillators.length, scheduled + 1, "the held note is sounding");
    assert.equal(ctx.oscillators.at(-1).stopped, null, "and is still held");
  });

  await t.test("Stop silences a held note too", () => {
    const h = loadApp();
    t.after(() => h.close());

    pressNote(h, 0);
    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators[0].stopped, null, "the note is held to start with");

    pressStop(h);
    closeTo(ctx.oscillators[0].stopped, h.app.RELEASE_SECONDS, 1e-12);
  });

  await t.test("editing the scale mid-melody does not interrupt it", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressPlay(h);
    const scheduled = h.audioContexts[0].oscillators.length;
    // Re-scheduling mid-melody has no musical meaning, and stopping on every
    // keystroke would make the editor unusable while listening.
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "3/2");

    assert.equal(h.app.isScalePlaying(), true, "the scale plays out as scheduled");
    assert.equal(h.audioContexts[0].oscillators.length, scheduled, "and nothing is re-scheduled");
  });
});

test("refusing to play an invalid scale", async (t) => {
  await t.test("will not play while a box is unreadable, and says which", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    pressPlay(h);

    assert.equal(h.app.isScalePlaying(), false, "nothing may play");
    assert.equal(h.audioContexts.length, 0, "not even an AudioContext");
    assert.equal(messageText(h), "Cannot save: interval 2 is not a valid ratio.");
  });

  await t.test("the complaint takes itself down when the box is fixed", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["oops"]);

    pressPlay(h);
    assert.notEqual(messageText(h), "", "the bar should be saying something");

    // The same self-clearing INVALID_SCALE_MESSAGE kind the save guards use:
    // the complaint describes a state the editor is in, so it stops being true
    // the moment that state does.
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "9/8");
    assert.equal(messageText(h), "");

    pressPlay(h);
    assert.equal(h.app.isScalePlaying(), true);
  });
});
