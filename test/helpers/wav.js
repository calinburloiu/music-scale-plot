"use strict";

/**
 * Reads a mono 16-bit RIFF/WAVE file back out of its bytes.
 *
 * Deliberately literal: it decodes each field at its fixed offset rather than
 * walking the chunk list, so a field written to the wrong place shows up as a
 * wrong value instead of being quietly skipped over.
 *
 * The bytes come from the jsdom realm, so they are copied into a host-realm
 * array first — the same cross-realm care equalArray() takes in assertions.js.
 */
function viewOf(bytes) {
  const copy = Uint8Array.from(bytes);
  return { copy, view: new DataView(copy.buffer) };
}

function ascii(copy, offset, length) {
  return String.fromCharCode(...copy.slice(offset, offset + length));
}

function wavHeader(bytes) {
  const { copy, view } = viewOf(bytes);
  return {
    chunkId: ascii(copy, 0, 4),
    chunkSize: view.getUint32(4, true),
    format: ascii(copy, 8, 4),
    subchunk1Id: ascii(copy, 12, 4),
    subchunk1Size: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    numChannels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    subchunk2Id: ascii(copy, 36, 4),
    subchunk2Size: view.getUint32(40, true),
  };
}

function wavSamples(bytes) {
  const { view } = viewOf(bytes);
  const count = view.getUint32(40, true) / 2;
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++) samples[i] = view.getInt16(44 + i * 2, true);
  return samples;
}

module.exports = { wavHeader, wavSamples };
