"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, selectOption, buildRelativeScale, intervalRows, typeInto } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

test("getFrequencyForDegree", async (t) => {
  await t.test("degree 1 is the base frequency", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["9/8", "10/9"]);
    closeTo(h.app.getFrequencyForDegree(1), 220);
  });

  await t.test("each degree multiplies the accumulated ratio", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);
    closeTo(h.app.getFrequencyForDegree(2), 220 * (9 / 8), 1e-9);
    closeTo(h.app.getFrequencyForDegree(3), 220 * (5 / 4), 1e-9, "9/8 * 10/9");
    closeTo(h.app.getFrequencyForDegree(4), 220 * (4 / 3), 1e-9, "9/8 * 10/9 * 16/15");
  });

  await t.test("follows the base note selector", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["3/2"]);
    selectOption(h, "base-note", "0"); // C, the default; three semitones above A
    const baseC = 220 * Math.pow(2, 3 / 12);
    closeTo(h.app.getFrequencyForDegree(1), baseC, 1e-9);
    closeTo(h.app.getFrequencyForDegree(2), baseC * 1.5, 1e-9);
  });

  await t.test("skips unparseable intervals rather than poisoning the pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["9/8", "oops", "10/9"]);
    closeTo(h.app.getFrequencyForDegree(2), 220 * (9 / 8), 1e-9);
    closeTo(h.app.getFrequencyForDegree(3), 220 * (9 / 8), 1e-9, "the broken interval contributes nothing");
    closeTo(h.app.getFrequencyForDegree(4), 220 * (5 / 4), 1e-9);
  });

  await t.test("falls back to the base frequency for a degree that does not exist", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["9/8"]);
    closeTo(h.app.getFrequencyForDegree(99), 220);
    closeTo(h.app.getFrequencyForDegree(0), 220);
  });

  await t.test("an octave of intervals doubles the frequency", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["9/8", "10/9", "16/15", "9/8", "10/9", "9/8", "16/15"]);
    closeTo(h.app.getFrequencyForDegree(8), 440, 1e-9, "just diatonic major spans an octave");
  });

  await t.test("works with the cents interval type too", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "1200");
    closeTo(h.app.getFrequencyForDegree(2), 440, 1e-9);
  });
});

test("audio playback", async (t) => {
  await t.test("pressing a note's play button starts a triangle tone at that pitch", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz — the default is C since #15
    buildRelativeScale(h, ["3/2"]);

    const playBtn = h.all("#editor .note-row")[1].querySelector(".play-note");
    playBtn.dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));

    assert.equal(h.audioContexts.length, 1, "one AudioContext is created lazily");
    const osc = h.audioContexts[0].oscillators[0];
    assert.equal(osc.type, "triangle");
    closeTo(osc.frequency.value, 330, 1e-9, "220 * 3/2");
    assert.equal(osc.started, 0, "starts immediately");
    assert.equal(osc.stopped, null, "keeps sounding until released");
  });

  await t.test("the tone fades in rather than clicking on", () => {
    const h = loadApp();
    t.after(() => h.close());
    const playBtn = h.el("#editor .note-row .play-note");
    playBtn.dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));

    const gain = h.audioContexts[0].gains[0];
    assert.deepEqual(
      gain.gain.events.map((e) => [e.type, e.value]),
      [
        ["setValueAtTime", 0],
        ["linearRampToValueAtTime", 0.3],
      ]
    );
    assert.ok(gain.connectedTo.length === 1, "gain is routed to the destination");
  });

  await t.test("releasing the pointer fades out and stops the oscillator", () => {
    const h = loadApp();
    t.after(() => h.close());
    const playBtn = h.el("#editor .note-row .play-note");
    playBtn.dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));
    h.document.dispatchEvent(new h.window.MouseEvent("mouseup", { bubbles: true }));

    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators[0].stopped, 0.05, "stops after the release ramp");
    const last = ctx.gains[0].gain.events.at(-1);
    assert.deepEqual([last.type, last.value], ["linearRampToValueAtTime", 0]);
  });

  await t.test("only one note sounds at a time", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["3/2"]);
    const [first, second] = h.all("#editor .note-row").map((r) => r.querySelector(".play-note"));

    first.dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));
    second.dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));

    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators.length, 2);
    assert.notEqual(ctx.oscillators[0].stopped, null, "the first tone was stopped");
    assert.equal(ctx.oscillators[1].stopped, null, "the second tone is still sounding");
  });

  await t.test("releasing without playing anything is harmless", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.document.dispatchEvent(new h.window.MouseEvent("mouseup", { bubbles: true }));
    assert.equal(h.audioContexts.length, 0, "no AudioContext is created just to stop nothing");
    assert.deepEqual(h.jsdomErrors, []);
  });

  await t.test("touch input plays a note as well", () => {
    const h = loadApp();
    t.after(() => h.close());
    const playBtn = h.el("#editor .note-row .play-note");
    playBtn.dispatchEvent(new h.window.Event("touchstart", { bubbles: true }));
    assert.equal(h.audioContexts[0].oscillators.length, 1);

    h.document.dispatchEvent(new h.window.Event("touchend", { bubbles: true }));
    assert.equal(h.audioContexts[0].oscillators[0].stopped, 0.05);
  });
});
