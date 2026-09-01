"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp } = require("../helpers/harness.js");
const {
  pngFixture,
  pngChunkTypes,
  pngChunkData,
  bytesFromDataUrl,
} = require("../helpers/canvas-stub.js");

function bytes(text) {
  return Uint8Array.from([...text].map((c) => c.charCodeAt(0)));
}

function dataUrlOf(png) {
  return "data:image/png;base64," + Buffer.from(png).toString("base64");
}

test("PNG print metadata", async (t) => {
  await t.test("crc32 matches the published check value", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The check value every CRC-32 (ISO-HDLC) implementation is measured against.
    assert.equal(h.app.crc32(bytes("123456789")), 0xcbf43926);
  });

  await t.test("crc32 of an empty IEND chunk is the constant every PNG ends with", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.app.crc32(bytes("IEND")), 0xae426082);
  });

  await t.test("declares the print resolution in a pHYs chunk", () => {
    const h = loadApp();
    t.after(() => h.close());

    const png = bytesFromDataUrl(h.app.withPrintMetadata(dataUrlOf(pngFixture(100, 200))));
    const phys = pngChunkData(png, "pHYs");

    assert.ok(phys, "no pHYs chunk: the file would place at the 72ppi default");
    const view = new DataView(phys.buffer, phys.byteOffset, phys.byteLength);
    // 720ppi, in the pixels per metre pHYs stores.
    assert.equal(view.getUint32(0), 28346, "horizontal resolution");
    assert.equal(view.getUint32(4), 28346, "vertical resolution");
    assert.equal(view.getUint8(8), 1, "unit specifier must be metres, not 'unknown'");
  });

  await t.test("tags the pixels as sRGB, with the intent for flat-colour graphics", () => {
    const h = loadApp();
    t.after(() => h.close());

    const png = bytesFromDataUrl(h.app.withPrintMetadata(dataUrlOf(pngFixture(100, 200))));
    const srgb = pngChunkData(png, "sRGB");

    assert.ok(srgb, "no sRGB chunk: a layout app has to guess what the numbers mean");
    assert.equal(srgb[0], 1, "rendering intent must be relative colorimetric");
  });

  await t.test("places both chunks after IHDR and before the pixels", () => {
    const h = loadApp();
    t.after(() => h.close());

    const png = bytesFromDataUrl(h.app.withPrintMetadata(dataUrlOf(pngFixture(100, 200))));

    assert.deepEqual(pngChunkTypes(png), ["IHDR", "sRGB", "pHYs", "IDAT", "IEND"]);
  });

  await t.test("leaves the image itself untouched", () => {
    const h = loadApp();
    t.after(() => h.close());
    const original = pngFixture(100, 200);

    const png = bytesFromDataUrl(h.app.withPrintMetadata(dataUrlOf(original)));

    assert.deepEqual(
      Array.from(pngChunkData(png, "IHDR")),
      Array.from(pngChunkData(original, "IHDR")),
      "the header, and so the pixel dimensions, must survive"
    );
    assert.deepEqual(
      Array.from(pngChunkData(png, "IDAT")),
      Array.from(pngChunkData(original, "IDAT")),
      "the pixels must survive"
    );
  });
});
