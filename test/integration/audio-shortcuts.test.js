"use strict";

// The keyboard's half of the transport: Space toggles Play/Stop, and 1…9 sound
// their degree for as long as they are held. Both are page-wide, so most of
// what is worth asserting is about *not* firing — the focus guard that keeps a
// digit out of an interval box and Space off a focused button.

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  buildRelativeScale,
  buildAbsoluteScale,
  selectOption,
  pressKey,
  releaseKey,
  noteRows,
  intervalRows,
  setNoteCount,
  openWell,
} = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

/** A press with nothing focused: jsdom's activeElement starts at <body>. */
function pressLoose(h, key, init) {
  return pressKey(h, h.document.body, key, init);
}

function releaseLoose(h, key) {
  return releaseKey(h, h.document.body, key);
}

/**
 * Focuses `element`, then presses `key` on it, the way a real user must.
 *
 * The focus check is `assert.ok` on an identity comparison rather than
 * `assert.equal`: a failed strict-equal on two DOM nodes sends Node's differ
 * into jsdom's object graph, which does not come back.
 */
function pressFocused(h, element, key, init) {
  element.focus();
  assert.ok(h.document.activeElement === element, "the element must really take focus");
  return pressKey(h, element, key, init);
}

/** The degree whose play button wears the pressed look, or null. */
function soundingDegree(h) {
  const button = h.el("#editor .play-note.sounding");
  return button ? Number(button.closest(".note-row").dataset.degree) : null;
}

/**
 * The oscillators the app has made, with a message worth reading when it has
 * made none — reaching straight for `h.audioContexts[0].oscillators` fails
 * with a TypeError that says nothing about what was expected.
 */
function voices(h) {
  assert.equal(h.audioContexts.length, 1, "the app should have made one AudioContext");
  return h.audioContexts[0].oscillators;
}

test("Space toggles the transport", async (t) => {
  await t.test("starts the scale when nothing is focused", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, " ");

    assert.equal(h.app.isScalePlaying(), true);
    assert.equal(h.audioContexts[0].oscillators.length, 3, "two degrees make three notes");
  });

  await t.test("stops a playing scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, " ");
    const ctx = h.audioContexts[0];
    ctx.currentTime = 0.5;
    pressLoose(h, " ");

    assert.equal(h.app.isScalePlaying(), false);
    for (const osc of ctx.oscillators) {
      closeTo(osc.stopped, 0.5 + h.app.RELEASE_SECONDS, 1e-12, "every note is released");
    }
  });

  await t.test("is taken off the page, so it cannot scroll it", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(pressLoose(h, " "), true, "the default must be prevented");
  });

  await t.test("does not re-toggle on every repeat of a held key", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, " ");
    const scheduled = h.audioContexts[0].oscillators.length;
    // A held Space that stopped what the first press started would make the
    // transport unusable from the keyboard. Exactly one repeat: an even number
    // of them toggles back to where it started and hides the bug.
    assert.equal(pressLoose(h, " ", { repeat: true }), true, "still off the page");

    assert.equal(h.app.isScalePlaying(), true, "the scale plays on");
    assert.equal(
      h.audioContexts[0].oscillators.length,
      scheduled,
      "and it is the same melody, not a second one"
    );
  });

  await t.test("stays out of an interval box", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    const input = intervalRows(h)[0].querySelector(".interval");
    assert.equal(pressFocused(h, input, " "), false, "a space must reach the box");
    assert.equal(h.app.isScalePlaying(), false);
  });

  await t.test("stays out of the scale-name box", () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = h.document.getElementById("scale-name");
    assert.equal(pressFocused(h, input, " "), false);
    assert.equal(h.app.isScalePlaying(), false);
  });

  await t.test("leaves a focused button to the browser's own click", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The browser turns Space on a focused button into a click. Handling it
    // here as well would run New *and* start the scale from one keystroke.
    const button = h.document.getElementById("new-file");
    assert.equal(pressFocused(h, button, " "), false);
    assert.equal(h.app.isScalePlaying(), false);
  });

  await t.test("still toggles when the focused button is disabled", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // A disabled button has no click for Space to conflict with, so nothing is
    // gained by standing aside — and standing aside costs the whole shortcut,
    // because a button that disables itself on click can keep the focus. See
    // the next test for the path a user actually takes there.
    const button = h.document.getElementById("stop-scale");
    button.disabled = false;
    button.focus();
    button.disabled = true;
    assert.ok(h.document.activeElement === button, "focus stays on the disabled button");

    assert.equal(pressKey(h, button, " "), true, "Space is ours again");
    assert.equal(h.app.isScalePlaying(), true);
  });

  await t.test("still starts the scale after Stop was clicked with the mouse", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // Firefox leaves the focus on a button that its own click disabled, which
    // is exactly what Stop does. Verified against all three engines: Chromium
    // and WebKit move focus to <body> here, Firefox does not — and jsdom
    // behaves as Firefox does, so this reproduces the browser that breaks.
    pressLoose(h, " ");
    const stop = h.document.getElementById("stop-scale");
    stop.focus();
    fireClick(h, stop);
    assert.equal(h.app.isScalePlaying(), false, "the click stopped it");
    assert.equal(stop.disabled, true, "and disabled the button under the focus");

    pressKey(h, stop, " ");
    assert.equal(h.app.isScalePlaying(), true, "Space starts it again");
  });

  await t.test("leaves a focused select alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    const select = h.document.getElementById("base-note");
    assert.equal(pressFocused(h, select, " "), false);
    assert.equal(h.app.isScalePlaying(), false);
  });

  await t.test("ignores a chord", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(pressLoose(h, " ", { ctrlKey: true }), false);
    assert.equal(pressLoose(h, " ", { metaKey: true }), false);
    assert.equal(pressLoose(h, " ", { altKey: true }), false);
    assert.equal(h.app.isScalePlaying(), false);
  });

  await t.test("refuses an unreadable scale, and says which box", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "oops"]);

    pressLoose(h, " ");

    assert.equal(h.app.isScalePlaying(), false, "nothing may play");
    assert.equal(
      h.document.getElementById("toolbar-message-text").textContent,
      "Cannot play: interval 2 is not a valid ratio.",
      "Space reaches Play, so the bar must say play, not save"
    );
  });
});

test("the number keys sound their degree", async (t) => {
  await t.test("plays the pitch the degree's own button plays", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9"); // A, 220 Hz
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressLoose(h, "2");

    const sounding = voices(h);
    assert.equal(sounding.length, 1, "one key, one voice");
    assert.equal(sounding[0].type, "triangle");
    closeTo(sounding[0].frequency.value, 220 * (9 / 8), 1e-9);
  });

  await t.test("holds the note until the key is released", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, "1");
    const ctx = h.audioContexts[0];
    assert.equal(voices(h)[0].stopped, null, "still held");

    ctx.currentTime = 0.4;
    releaseLoose(h, "1");
    closeTo(ctx.oscillators[0].stopped, 0.4 + h.app.RELEASE_SECONDS, 1e-12);
  });

  await t.test("puts the pressed look on that degree's button, and takes it off", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);

    pressLoose(h, "3");
    assert.equal(soundingDegree(h), 3);
    assert.equal(h.all("#editor .play-note.sounding").length, 1, "exactly one at a time");

    releaseLoose(h, "3");
    assert.equal(soundingDegree(h), null);
  });

  await t.test("works in absolute mode too", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "base-note", "9");
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "3/2"]);

    pressLoose(h, "2");

    closeTo(voices(h)[0].frequency.value, 330, 1e-9);
  });

  await t.test("does nothing for a degree the scale does not have", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]); // two degrees

    pressLoose(h, "7");

    // getFrequencyForDegree() falls back to the base frequency for a degree
    // that does not exist. From the keyboard that would be a note with no
    // button to show it, so nothing sounds at all.
    assert.equal(h.audioContexts.length, 0, "not even an AudioContext");
    assert.equal(soundingDegree(h), null);
  });

  await t.test("ignores 0, which is no degree", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    assert.equal(pressLoose(h, "0"), false);
    assert.equal(h.audioContexts.length, 0);
  });

  await t.test("does not restrike the note on a repeat", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, "1");
    pressLoose(h, "1", { repeat: true });
    pressLoose(h, "1", { repeat: true });

    assert.equal(voices(h).length, 1, "one press, one voice");
  });

  await t.test("ignores a chord", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    assert.equal(pressLoose(h, "1", { ctrlKey: true }), false);
    assert.equal(pressLoose(h, "1", { metaKey: true }), false);
    assert.equal(pressLoose(h, "1", { altKey: true }), false);
    assert.equal(h.audioContexts.length, 0);
  });
});

test("the number keys and the focus guard", async (t) => {
  await t.test("stay out of an interval box", () => {
    const h = loadApp();
    t.after(() => h.close());
    // Three degrees, so that 3 and 2 are both degrees this scale really has:
    // a digit past the end of the scale is refused for its own reason, and
    // would leave the focus guard untested.
    buildRelativeScale(h, ["9/8", "10/9"]);

    // The whole point of the guard: typing 3/2 must not play degrees 3 and 2.
    const input = intervalRows(h)[0].querySelector(".interval");
    assert.equal(pressFocused(h, input, "3"), false, "the digit must reach the box");
    pressKey(h, input, "2");
    assert.equal(h.audioContexts.length, 0, "neither digit sounded");
    assert.equal(soundingDegree(h), null);
  });

  await t.test("stay out of the EDO divisions box", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");

    // "2", a degree the default scale has, so the guard is what refuses it.
    const input = h.document.getElementById("edo-divisions");
    assert.equal(pressFocused(h, input, "2"), false);
    assert.equal(h.audioContexts.length, 0);
  });

  await t.test("stay out of a note-name box", () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = noteRows(h)[0].querySelector(".note-name");
    assert.equal(pressFocused(h, input, "1"), false);
    assert.equal(h.audioContexts.length, 0);
  });

  await t.test("stay out of a select, where a digit is typeahead", () => {
    const h = loadApp();
    t.after(() => h.close());

    const select = h.document.getElementById("base-note");
    assert.equal(pressFocused(h, select, "1"), false);
    assert.equal(h.audioContexts.length, 0);
  });

  await t.test("stay out of a picker's search field", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Opening a picker focuses its search field, so this is the state a reader
    // is actually in while searching for a symbol.
    const panel = openWell(h, noteRows(h)[0], "accidental");
    const search = panel.querySelector(".sym-search");
    assert.ok(h.document.activeElement === search, "the picker focuses its search field");
    assert.equal(pressKey(h, search, "2"), false);
    assert.equal(h.audioContexts.length, 0);
  });

  await t.test("still play while a button has focus", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // A digit means nothing to a focused button, so there is nothing to
    // conflict with — unlike Space, which the browser turns into a click.
    const button = h.document.getElementById("add-note");
    button.focus();
    pressKey(h, button, "1");

    assert.equal(voices(h).length, 1, "the digit still reaches the transport");
  });
});

test("the number keys are discoverable", async (t) => {
  await t.test("each play button names its own key", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);

    const buttons = noteRows(h).map((r) => r.querySelector(".play-note"));
    assert.deepEqual(
      buttons.map((b) => b.getAttribute("title")),
      ["Play note 1 (key 1)", "Play note 2 (key 2)", "Play note 3 (key 3)", "Play note 4 (key 4)"]
    );
    assert.deepEqual(
      buttons.map((b) => b.getAttribute("aria-keyshortcuts")),
      ["1", "2", "3", "4"]
    );
  });

  await t.test("names the button, because its ▶ is no accessible name", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The button's whole text content is U+25B6, which a screen reader reads
    // as the character rather than as what pressing it does.
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".play-note").getAttribute("aria-label")),
      ["Play note 1", "Play note 2"]
    );
  });

  await t.test("claims no key past the ninth degree, because there is none", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 10);

    const tenth = noteRows(h)[9].querySelector(".play-note");
    assert.equal(tenth.getAttribute("title"), "Play note 10");
    assert.equal(tenth.getAttribute("aria-keyshortcuts"), null, "no key reaches degree 10");
    assert.equal(tenth.getAttribute("aria-label"), "Play note 10", "but it is still named");
  });

  await t.test("keeps the hints right after the editor is rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 3);

    // Switching mode rebuilds every row through the other branch of the row
    // builder, which is where a second copy of the markup would drift.
    selectOption(h, "scale-mode", "absolute");

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".play-note").getAttribute("title")),
      ["Play note 1 (key 1)", "Play note 2 (key 2)", "Play note 3 (key 3)"]
    );
  });
});

test("one voice, from the keyboard too", async (t) => {
  await t.test("a digit stops a playing scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, " ");
    const ctx = h.audioContexts[0];
    const scheduled = ctx.oscillators.length;
    ctx.currentTime = 0.5;
    pressLoose(h, "1");

    assert.equal(h.app.isScalePlaying(), false, "the scale gives way to the held note");
    assert.equal(ctx.oscillators.length, scheduled + 1, "the held note is sounding");
    assert.equal(ctx.oscillators.at(-1).stopped, null, "and is still held");
  });

  await t.test("Space takes the voice from a key being held", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // The sequence the third one-voice rule exists for, and the one the
    // keyboard makes easy to reach: hold a number key, then press Space.
    pressLoose(h, "1");
    const ctx = h.audioContexts[0];
    ctx.currentTime = 0.2;
    pressLoose(h, " ");

    closeTo(ctx.oscillators[0].stopped, 0.2 + h.app.RELEASE_SECONDS, 1e-12, "the held note ends");
    assert.equal(h.app.isScalePlaying(), true, "and the scale takes the voice");
    assert.equal(soundingDegree(h), null, "the held note's look goes with it");
  });

  await t.test("a second digit takes the voice from the first", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, "1");
    const ctx = h.audioContexts[0];
    ctx.currentTime = 0.2;
    pressLoose(h, "2");

    closeTo(ctx.oscillators[0].stopped, 0.2 + h.app.RELEASE_SECONDS, 1e-12, "the first is let go");
    assert.equal(ctx.oscillators[1].stopped, null, "the second is held");
    assert.equal(soundingDegree(h), 2, "and the look moves with it");
  });

  await t.test("releasing the first key does not silence the second", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    // Rolling one finger onto the next key without lifting the first: the
    // stale keyup must not take the note that is actually sounding.
    pressLoose(h, "1");
    pressLoose(h, "2");
    releaseLoose(h, "1");

    const ctx = h.audioContexts[0];
    assert.equal(ctx.oscillators[1].stopped, null, "degree 2 plays on");
    assert.equal(soundingDegree(h), 2, "and keeps the pressed look");

    releaseLoose(h, "2");
    assert.notEqual(ctx.oscillators[1].stopped, null, "its own key still releases it");
    assert.equal(soundingDegree(h), null);
  });

  await t.test("a keyup for a key that was never held does nothing", () => {
    const h = loadApp();
    t.after(() => h.close());

    releaseLoose(h, "1");
    assert.equal(h.audioContexts.length, 0, "no context is made just to stop nothing");
    assert.deepEqual(h.jsdomErrors, []);
  });

  await t.test("a note held while the window loses focus is let go", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, "1");
    const ctx = h.audioContexts[0];
    ctx.currentTime = 0.3;
    // The keyup never arrives when focus leaves mid-hold — without this the
    // note would sound forever. The mouse path has document mouseup for the
    // same reason.
    h.window.dispatchEvent(new h.window.Event("blur"));

    closeTo(ctx.oscillators[0].stopped, 0.3 + h.app.RELEASE_SECONDS, 1e-12);
    assert.equal(soundingDegree(h), null);
  });

  await t.test("a mouse press takes over a keyboard-held note", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8"]);

    pressLoose(h, "1");
    const ctx = h.audioContexts[0];
    ctx.currentTime = 0.2;
    noteRows(h)[1]
      .querySelector(".play-note")
      .dispatchEvent(new h.window.MouseEvent("mousedown", { bubbles: true }));

    closeTo(ctx.oscillators[0].stopped, 0.2 + h.app.RELEASE_SECONDS, 1e-12, "the key's note ends");

    // And the stale keyup must not cut the note the mouse is holding.
    releaseLoose(h, "1");
    assert.equal(ctx.oscillators[1].stopped, null, "the mouse still holds its note");
  });
});
