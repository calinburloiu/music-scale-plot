"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  buildRelativeScale,
  savedFile,
  pickScaleFile,
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

// --- the name every save proposes -------------------------------------------

/** Clicks Save ▸ one of the three items, the way a user reaches it. */
async function saveThrough(h, itemId) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById(itemId));
  // Two, because the audio export awaits its offline render before the save.
  await tick(h);
  await tick(h);
}

function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

test("every save proposes a file name slugged from the scale name", async (t) => {
  // One slug rule, one mechanism, three files. A chart saved beside its scale
  // and its audio should land as three files with one name and three
  // extensions — not two named for the scale and a third called "scale.png".
  await t.test("Save Chart As PNG", async () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");

    await saveThrough(h, "save-png");

    assert.equal((await savedFile(h)).name, "hicaz-humayun.png");
  });

  await t.test("Save As Music Scale Plot file", async () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");

    await saveThrough(h, "save-scale");

    assert.equal((await savedFile(h)).name, "hicaz-humayun.musp.json");
  });

  await t.test("Save Audio As WAV", async () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");

    await saveThrough(h, "save-audio");

    assert.equal((await savedFile(h)).name, "hicaz-humayun.wav");
  });

  await t.test("an unnamed scale still falls back to the default stem", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveThrough(h, "save-png");

    assert.equal((await savedFile(h)).name, "scale.png");
  });
});

test("the PNG save goes through the same file picker as the other two", async (t) => {
  await t.test("offers the proposed name to the browser's own Save dialog", async () => {
    const h = loadApp({ fileSystemAccess: true });
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Rast");

    await saveThrough(h, "save-png");

    assert.equal(h.filePickerCalls.length, 1);
    assert.equal(h.filePickerCalls[0].picker, "save");
    assert.equal(h.filePickerCalls[0].options.suggestedName, "rast.png");
    // JSON round-trip strips the jsdom realm's prototypes, which assert/strict's
    // deepEqual otherwise rejects (docs/TESTING.md §5, "Cross-realm gotcha").
    assert.deepEqual(JSON.parse(JSON.stringify(h.filePickerCalls[0].options.types)), [
      { description: "PNG image", accept: { "image/png": [".png"] } },
    ]);
    assert.equal(h.downloads.length, 0, "no anchor fallback when a picker exists");
    assert.deepEqual(
      Array.from(h.writtenFiles[0].data.subarray(0, 8)),
      PNG_SIGNATURE,
      "the bytes written through the picker are not a PNG"
    );
  });

  await t.test("says nothing when the dialog is cancelled", async () => {
    const h = loadApp({ fileSystemAccess: { saveAborts: true } });
    t.after(() => h.close());

    await saveThrough(h, "save-png");

    assert.equal(h.writtenFiles.length, 0);
    assert.equal(messageText(h), "", "choosing not to save is not an error to report");
  });

  await t.test("reports a dialog that genuinely failed", async () => {
    const h = loadApp({ fileSystemAccess: { saveFails: true } });
    t.after(() => h.close());

    await saveThrough(h, "save-png");

    assert.equal(h.writtenFiles.length, 0);
    assert.equal(messageText(h), "Could not save the image.");
  });
});

test("the PNG save takes down a stale message, as the other two do", async (t) => {
  await t.test("a complaint from an earlier action does not outlive the save", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // The bar describes what just happened, so a save has to clear it before it
    // starts — otherwise a chart saved after a bad file leaves the reader with
    // a message about the file, sitting over a save that went perfectly well.
    await pickScaleFile(h, "this is not a scale document");
    assert.notEqual(messageText(h), "", "sanity: the bad file complained about something");

    await saveThrough(h, "save-png");

    assert.equal(messageText(h), "");
    assert.equal(h.document.getElementById("toolbar-message").hidden, true);
  });
});
