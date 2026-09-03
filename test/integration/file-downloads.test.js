"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  buildRelativeScale,
  savedFile,
} = require("../helpers/harness.js");

/**
 * How a saved file reaches the browser, for all three saves at once.
 *
 * Every one of them hands over a Blob behind an object URL, and none of them
 * may use a `data:` URL. On an iPhone a `data:` URL is not a slower path or a
 * worse one, it is no path at all: the anchor's `download` attribute is enough
 * to raise Safari's "Do you want to download…?" sheet, so the page looks like
 * it is working, and then the download manager never fetches the URL and
 * nothing is written. A `blob:` URL it fetches.
 *
 * That is the whole difference between the WAV export, which used a Blob from
 * the start and has always worked on an iPhone, and the PNG and scale saves,
 * which used `data:` URLs and never did.
 */

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** One macrotask, the way the app's own `setTimeout(revoke, 0)` is scheduled. */
function tick(h) {
  return new Promise((resolve) => h.window.setTimeout(resolve, 0));
}

/** The href the app last handed `<a download>`, before anything decodes it. */
function lastHref(h) {
  const download = h.downloads[h.downloads.length - 1];
  assert.ok(download, "nothing was downloaded at all");
  return download.href;
}

function assertObjectUrl(h) {
  const href = lastHref(h);
  assert.ok(
    href.startsWith("blob:"),
    `expected an object URL, got ${href.slice(0, 48)}… — ` +
      "an iPhone's download manager will not fetch a data: URL"
  );
}

test("every save hands the browser a Blob, never a data: URL", async (t) => {
  await t.test("Save as PNG", async () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-png"));
    assertObjectUrl(h);

    const file = await savedFile(h);
    assert.equal(file.name, "scale.png");
    assert.equal(file.type, "image/png", "the Blob must declare what it holds");
    assert.deepEqual(
      Array.from(file.bytes.subarray(0, 8)),
      PNG_SIGNATURE,
      "the Blob's bytes are not a PNG"
    );
  });

  await t.test("Save Scale", async () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");
    buildRelativeScale(h, ["9/8"]);

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-scale"));
    await tick(h);
    assertObjectUrl(h);

    const file = await savedFile(h);
    assert.equal(file.name, "hicaz.musp.json");
    assert.match(file.type, /^application\/json/, "the Blob must declare what it holds");
    assert.equal(JSON.parse(file.text).name, "Hicaz", "the Blob's bytes are not the document");
  });

  await t.test("Save Audio As WAV — the one that already worked", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-audio"));
    await tick(h);
    await tick(h);
    assertObjectUrl(h);

    const file = await savedFile(h);
    assert.equal(file.name, "scale.wav");
    assert.equal(file.type, "audio/wav");
  });
});

test("every save releases its object URL once the click is away", async (t) => {
  // Both halves matter. Revoking before the click has been dispatched cancels
  // the download; never revoking holds the Blob — megabytes, for a chart — for
  // the lifetime of the document. So the state is read synchronously, straight
  // off the recorder: awaiting anything first would step over the very moment
  // the first assertion is about.
  await t.test("Save as PNG", async () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-png"));

    const entry = h.objectUrls[h.objectUrls.length - 1];
    assert.ok(entry, "the PNG never reached an object URL at all");
    assert.equal(entry.revoked, false, "revoking inside the click cancels the download");

    await tick(h);
    assert.equal(entry.revoked, true, "a live object URL holds its Blob for the document's life");
  });

  await t.test("Save Scale", async () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-scale"));

    const entry = h.objectUrls[h.objectUrls.length - 1];
    assert.ok(entry, "the scale document never reached an object URL at all");
    assert.equal(entry.revoked, false, "revoking inside the click cancels the download");

    await tick(h);
    assert.equal(entry.revoked, true, "a live object URL holds its Blob for the document's life");
  });
});
