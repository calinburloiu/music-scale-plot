"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, buildRelativeScale, selectOption } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");
const { wavHeader, wavSamples } = require("../helpers/wav.js");

/** The rendered value at `seconds`, from the offline context's buffer. */
function sampleAt(data, seconds, sampleRate) {
  return data[Math.round(seconds * sampleRate)];
}

test("rendering the scale offline", async (t) => {
  await t.test("renders mono at a fixed 44.1 kHz, long enough for every note", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();

    assert.equal(h.offlineContexts.length, 1, "one render per export");
    const offline = h.offlineContexts[0];
    assert.equal(offline.numberOfChannels, 1, "mono");
    // Fixed, not the device's: the same scale exported from a machine running
    // its output at 48 kHz must produce the same file.
    assert.equal(offline.sampleRate, 44100);
    assert.equal(offline.length, Math.ceil(3 * h.app.QUARTER_SECONDS * 44100));
  });

  await t.test("starts at zero offline — nothing can be late in a render", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();

    const first = h.offlineContexts[0].oscillators[0];
    assert.equal(first.started, 0, "no scheduling lead offline");
  });

  await t.test("carries each note's envelope, and lands on silence at the end", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    await h.app.renderScaleWav();
    const offline = h.offlineContexts[0];
    // The stub's render is a pure function of what was scheduled, so it can be
    // asked again for the buffer the export already consumed.
    const data = (await offline.startRendering()).getChannelData(0);
    const rate = offline.sampleRate;
    const quarter = h.app.QUARTER_SECONDS;

    closeTo(sampleAt(data, 0, rate), 0, 1e-4, "the first note fades in rather than clicking on");
    closeTo(sampleAt(data, h.app.ATTACK_SECONDS, rate), 0.3, 1e-3, "attack reaches the peak");
    closeTo(sampleAt(data, quarter / 2, rate), 0.3, 1e-3, "and sustains there");
    closeTo(sampleAt(data, quarter - 0.0005, rate), 0, 1e-2, "release reaches silence");
    closeTo(sampleAt(data, quarter, rate), 0, 1e-3, "and the next note starts from it");
    closeTo(data[data.length - 1], 0, 1e-2, "the last note's release is not cut off");
  });

  await t.test("never clips, so the encoder's clamp is never reached in practice", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    await h.app.renderScaleWav();
    const data = (await h.offlineContexts[0].startRendering()).getChannelData(0);

    let peak = 0;
    for (const value of data) peak = Math.max(peak, Math.abs(value));
    assert.ok(peak <= 0.3 + 1e-6, `one voice at a time peaks at 0.3, got ${peak}`);
  });

  await t.test("hands back a valid WAV of the rendered length", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    const bytes = await h.app.renderScaleWav();
    const header = wavHeader(bytes);

    assert.equal(header.chunkId, "RIFF");
    assert.equal(header.format, "WAVE");
    assert.equal(header.audioFormat, 1);
    assert.equal(header.numChannels, 1);
    assert.equal(header.sampleRate, 44100);
    assert.equal(header.bitsPerSample, 16);
    assert.equal(header.subchunk2Size, h.offlineContexts[0].length * 2);
    assert.equal(wavSamples(bytes).length, h.offlineContexts[0].length);
  });

  await t.test("a longer scale renders a longer file", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"]);

    await h.app.renderScaleWav();
    // Four degrees make seven notes, not four.
    assert.equal(h.offlineContexts[0].length, Math.ceil(7 * h.app.QUARTER_SECONDS * 44100));
    assert.equal(h.offlineContexts[0].oscillators.length, 7);
  });

  await t.test("follows the base note, like everything else that sounds", async () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz
    buildRelativeScale(h, ["3/2"]);

    await h.app.renderScaleWav();
    const frequencies = h.offlineContexts[0].oscillators.map((o) => o.frequency.value);
    closeTo(frequencies[0], 220, 1e-9);
    closeTo(frequencies[1], 330, 1e-9);
    closeTo(frequencies[2], 220, 1e-9);
  });
});
