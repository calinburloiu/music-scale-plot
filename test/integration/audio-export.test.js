"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  buildRelativeScale,
  selectOption,
  fireClick,
  typeInto,
  savedAudioFile,
} = require("../helpers/harness.js");
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

  await t.test("reaches Safari's prefixed constructor, like the online one does", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // getAudioContext() already falls back to webkitAudioContext; the two
    // constructors went unprefixed in the same Safari release, so a browser
    // that needs one needs the other. Standing this one up on the prefix alone
    // is the only way to tell a resolved constructor from a bare reference.
    const prefixed = h.window.OfflineAudioContext;
    delete h.window.OfflineAudioContext;
    h.window.webkitOfflineAudioContext = prefixed;

    const bytes = await h.app.renderScaleWav();

    assert.equal(h.offlineContexts.length, 1, "the render still happened");
    assert.ok(bytes.length > 44, "and produced a file, not just a header");
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

/** Clicks Save ▸ Save Audio As WAV, the way a user reaches it. */
/** One macrotask, which is the boundary the revoke is deferred across. */
function tick(h) {
  return new Promise((resolve) => h.window.setTimeout(resolve, 0));
}

async function saveAudio(h) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById("save-audio"));
  // Two ticks, not one. saveAudioFile() suspends on the offline render, so the
  // timer below is registered *before* downloadBlob() registers its own
  // setTimeout(revoke, 0) — and timers fire in registration order. One tick
  // reaches the download; the second reaches the revoke.
  await tick(h);
  await tick(h);
}

function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

test("saving the audio", async (t) => {
  await t.test("downloads a WAV named after the scale", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz Hümayun");

    await saveAudio(h);

    const file = await savedAudioFile(h);
    assert.equal(file.name, "hicaz-humayun.wav", "the slug rule the .musp.json save uses");
    assert.equal(file.type, "audio/wav");
    assert.equal(wavHeader(file.bytes).chunkId, "RIFF", "the bytes really are a WAV");
    assert.equal(wavHeader(file.bytes).sampleRate, 44100);
  });

  await t.test("falls back to scale.wav for an unnamed scale", async () => {
    const h = loadApp();
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal((await savedAudioFile(h)).name, "scale.wav");
  });

  await t.test("closes the menu, the way the other save items do", async () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    const panel = h.document.getElementById("save-menu-panel");
    assert.equal(panel.classList.contains("open"), true, "sanity: the menu is open");

    // Called rather than clicked, on purpose. A click on the item bubbles to
    // app.js's document-level closeAllDropdowns(), which shuts the panel on its
    // own — so driving this through the UI would pass with saveAudioFile()'s
    // own closeSaveMenu() deleted, and prove nothing about this function.
    await h.app.saveAudioFile();
    assert.equal(panel.classList.contains("open"), false, "and it closed it itself");
    await tick(h);
  });

  await t.test("revokes the object URL, but not before the click", async () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-audio"));

    // Stop between the two ticks, because the end state cannot tell a deferred
    // revoke from a synchronous one — both look revoked once the dust settles.
    // The first tick reaches the download; a revoke that ran straight after the
    // click would already have fired by here, and a browser cancels a download
    // whose object URL is dead.
    await tick(h);
    assert.equal(h.objectUrls.length, 1);
    assert.equal(h.downloads.length, 1, "the click has happened");
    assert.equal(h.objectUrls[0].revoked, false, "and the URL it used is still live");

    await tick(h);
    assert.equal(h.objectUrls[0].revoked, true, "revoked on the next macrotask");
    assert.equal(h.downloads[0].href, h.objectUrls[0].url, "the click used that URL");
  });

  await t.test("writes through the file picker where the browser has one", async () => {
    const h = loadApp({ fileSystemAccess: true });
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("scale-name"), "Rast");

    await saveAudio(h);

    assert.equal(h.filePickerCalls.length, 1);
    assert.equal(h.filePickerCalls[0].picker, "save");
    assert.equal(h.filePickerCalls[0].options.suggestedName, "rast.wav");
    // JSON round-trip strips the jsdom realm's Array/Object prototypes, which
    // assert/strict's deepEqual otherwise rejects as "not reference-equal"
    // (docs/TESTING.md §5, "Cross-realm gotcha").
    assert.deepEqual(JSON.parse(JSON.stringify(h.filePickerCalls[0].options.types)), [
      { description: "WAV audio", accept: { "audio/wav": [".wav"] } },
    ]);
    assert.equal(h.downloads.length, 0, "no anchor fallback when a picker exists");
    assert.equal(wavHeader(h.writtenFiles[0].data).chunkId, "RIFF");
  });

  await t.test("says nothing when the dialog is cancelled", async () => {
    const h = loadApp({ fileSystemAccess: { saveAborts: true } });
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal(messageText(h), "", "the user chose not to save");
  });

  await t.test("reports a dialog that genuinely failed", async () => {
    const h = loadApp({ fileSystemAccess: { saveFails: true } });
    t.after(() => h.close());

    await saveAudio(h);
    assert.equal(messageText(h), "Could not save the audio file.");
  });

  await t.test("reports a render that fails, not just a failed dialog", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);
    // Simulates an OfflineAudioContext render that rejects — nothing to do
    // with the save dialog, which is never even reached.
    h.window.OfflineAudioContext.prototype.startRendering = () =>
      Promise.reject(new Error("render failed"));

    await saveAudio(h);

    assert.equal(messageText(h), "Could not save the audio file.");
    assert.equal(h.downloads.length, 0, "nothing was handed out");
  });

  await t.test("refuses a scale with an unreadable interval", async () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    await saveAudio(h);

    assert.equal(h.downloads.length, 0, "nothing may be handed out");
    assert.equal(h.offlineContexts.length, 0, "and nothing is even rendered");
    assert.equal(messageText(h), "Cannot save: interval 2 is not a valid ratio.");
  });
});
