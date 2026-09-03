"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");
const { wavHeader, wavSamples } = require("../helpers/wav.js");

/** Encodes `values` at 44.1 kHz through the app and hands back the bytes. */
function encode(h, values, sampleRate = 44100) {
  return h.app.encodeWavMono16(Float32Array.from(values), sampleRate);
}

test("encodeWavMono16", async (t) => {
  await t.test("writes a canonical 44-byte mono 16-bit header", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bytes = encode(h, [0, 0, 0, 0]);
    assert.equal(bytes.length, 44 + 8, "44 header bytes plus two per sample");

    assert.deepEqual(wavHeader(bytes), {
      chunkId: "RIFF",
      chunkSize: 36 + 8,
      format: "WAVE",
      subchunk1Id: "fmt ",
      subchunk1Size: 16,
      audioFormat: 1, // PCM
      numChannels: 1,
      sampleRate: 44100,
      byteRate: 44100 * 2,
      blockAlign: 2,
      bitsPerSample: 16,
      subchunk2Id: "data",
      subchunk2Size: 8,
    });
  });

  await t.test("declares the sample rate it was given, not a fixed one", () => {
    const h = loadApp();
    t.after(() => h.close());

    const header = wavHeader(encode(h, [0], 48000));
    assert.equal(header.sampleRate, 48000);
    assert.equal(header.byteRate, 96000, "the byte rate follows the sample rate");
  });

  await t.test("scales the two ends of the range asymmetrically", () => {
    const h = loadApp();
    t.after(() => h.close());

    // -1.0 and +1.0 must reach the full signed range without wrapping, which
    // takes 0x8000 below zero and 0x7fff above it. The fractional cases pin
    // the truncation DataView.setInt16 applies, so a later switch to rounding
    // cannot slip in unnoticed.
    assert.deepEqual(
      Array.from(wavSamples(encode(h, [0, 1, -1, 0.5, -0.5]))),
      [0, 32767, -32768, 16383, -16384]
    );
  });

  await t.test("clamps rather than wrapping, so an over-driven sample cannot click", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Clipping should never occur in practice — one voice at a time, peak gain
    // 0.3, no overlap. The clamp is here because an encoder that trusts its
    // input produces a file that clicks.
    assert.deepEqual(
      Array.from(wavSamples(encode(h, [2, -2, 1.0001, -1.0001]))),
      [32767, -32768, 32767, -32768]
    );
  });

  await t.test("an empty buffer is still a valid, empty file", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bytes = encode(h, []);
    assert.equal(bytes.length, 44);
    const header = wavHeader(bytes);
    assert.equal(header.subchunk2Size, 0);
    assert.equal(header.chunkSize, 36, "the RIFF size still counts the header");
  });
});
