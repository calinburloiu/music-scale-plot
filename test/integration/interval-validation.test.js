"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  selectOption,
  noteRows,
  intervalRows,
  buildRelativeScale,
  buildAbsoluteScale,
  pickScaleFile,
  savedScaleFile,
} = require("../helpers/harness.js");

function intervalBox(h, index) {
  return intervalRows(h)[index].querySelector(".interval");
}

function absoluteBox(h, degree) {
  return noteRows(h)[degree - 1].querySelector(".absolute-interval");
}

function isMarked(input) {
  return input.classList.contains("is-invalid");
}

test("marking an interval the app cannot read", async (t) => {
  await t.test("marks a box whose value does not parse", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "9.5/8");

    assert.equal(isMarked(intervalBox(h, 0)), true, "an unreadable ratio must be marked");
  });

  await t.test("leaves a box the app can read alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "10/9");

    assert.equal(isMarked(intervalBox(h, 0)), false);
  });

  await t.test("clears the mark as soon as the value is fixed", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "9.5/8");
    assert.equal(isMarked(intervalBox(h, 0)), true, "should be marked to start");

    typeInto(h, intervalBox(h, 0), "9/8");

    assert.equal(isMarked(intervalBox(h, 0)), false, "fixing it must clear the mark");
  });

  await t.test("marks an empty box, which names no interval at all", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, intervalBox(h, 0), "");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("marks only the offending row", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "nonsense", "16/15"]);

    assert.deepEqual(
      intervalRows(h).map((row) => isMarked(row.querySelector(".interval"))),
      [false, true, false]
    );
  });

  await t.test("marks a step count that is not whole, in EDO", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    typeInto(h, intervalBox(h, 0), "7.5");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("accepts a negative step count, which is a descending interval", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    typeInto(h, intervalBox(h, 0), "-7");

    assert.equal(isMarked(intervalBox(h, 0)), false, "descending is legal, not invalid");
  });

  await t.test("marks a cents value with anything trailing it", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "cents");
    typeInto(h, intervalBox(h, 0), "203.91c");

    assert.equal(isMarked(intervalBox(h, 0)), true);
  });

  await t.test("marks the box on a note row in absolute mode", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    typeInto(h, absoluteBox(h, 2), "9.5/8");

    assert.equal(isMarked(absoluteBox(h, 2)), true);
  });

  await t.test("never marks Note 1, whose unison the editor pins for it", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Its input is disabled and always holds getUnisonValue(); there is nothing
    // the user could have got wrong there.
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    typeInto(h, absoluteBox(h, 2), "nonsense");

    assert.equal(isMarked(absoluteBox(h, 1)), false, "Note 1 must never be marked");
  });

  await t.test("gives a freshly added note a clean box", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("add-note"));

    assert.equal(isMarked(intervalBox(h, 1)), false, "the seeded default must not flash red");
  });

  await t.test("cannot be introduced by a file, which is refused instead", async () => {
    const h = loadApp();
    t.after(() => h.close());

    // Save refuses to write one, so a file carrying one was hand-edited or
    // crafted. Opening it would put a value in the editor the app cannot plot,
    // cannot play, and would refuse to save again — so the reader turns it away
    // at the boundary and the editor keeps the scale it had.
    buildRelativeScale(h, ["10/9"]);
    await pickScaleFile(
      h,
      JSON.stringify({
        formatVersion: 1,
        settings: { notation: "generic", baseNote: 0 },
        scaleEditor: {
          mode: "relativeIntervals",
          intervalType: { type: "ratio" },
          intervals: ["9.5/8"],
          noteProperties: [{}, {}],
          intervalProperties: [{ color: "#FFFFFF" }],
        },
        chart: { style: "boxes", orientation: "vertical", zoom: 100 },
      })
    );

    assert.equal(
      h.document.getElementById("toolbar-message-text").textContent,
      'scaleEditor.intervals[0] must be a valid ratio, got "9.5/8".'
    );
    assert.equal(intervalBox(h, 0).value, "10/9", "the editor must keep the scale it had");
    assert.equal(h.el(".interval.is-invalid"), null, "and nothing should be marked");
  });
});

/** Clicks Save ▸ Save As Music Scale Plot file, the way a user reaches it. */
async function saveScale(h) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById("save-scale"));
  await new Promise((resolve) => h.window.setTimeout(resolve, 0));
}

/** Clicks Save ▸ Save As PNG. */
function savePNG(h) {
  fireClick(h, h.document.getElementById("save-menu"));
  fireClick(h, h.document.getElementById("save-png"));
}

function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

test("refusing to save an invalid scale", async (t) => {
  await t.test("will not write a scale file while a box is unreadable", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "9.5/8"]);
    await saveScale(h);

    assert.equal(h.downloads.length, 0, "nothing should have been written");
    assert.equal(messageText(h), "Cannot save: interval 2 is not a valid ratio.");
  });

  await t.test("will not export a PNG either", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The PNG is a picture of the scale, and a scale with a hole in it is not
    // one the app should be handing out in any format.
    buildRelativeScale(h, ["9/8", "9.5/8"]);
    savePNG(h);

    assert.equal(h.downloads.length, 0, "no PNG should have been exported");
    assert.equal(messageText(h), "Cannot save: interval 2 is not a valid ratio.");
  });

  await t.test("refuses the Ctrl+S chord for the same reason", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "9.5/8"]);
    h.document.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })
    );
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    assert.equal(h.downloads.length, 0);
    assert.equal(messageText(h), "Cannot save: interval 2 is not a valid ratio.");
  });

  await t.test("saves once the value is fixed", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "9.5/8"]);
    await saveScale(h);
    assert.equal(h.downloads.length, 0, "should be refused to start");

    typeInto(h, intervalBox(h, 1), "10/9");
    await saveScale(h);

    assert.equal(h.downloads.length, 1, "the fixed scale must save");
    assert.match(savedScaleFile(h).text, /10\/9/);
  });

  await t.test("names the note rather than the interval in absolute mode", async () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);
    typeInto(h, absoluteBox(h, 3), "nonsense");
    await saveScale(h);

    assert.equal(messageText(h), "Cannot save: note 3 is not a valid ratio.");
  });

  await t.test("lists every offending row when there is more than one", async () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["nonsense", "9/8", "", "16/15", "9.5/8"]);
    await saveScale(h);

    // Three of them, so the list needs both the comma and the "and".
    assert.equal(messageText(h), "Cannot save: intervals 1, 3 and 5 are not valid ratios.");
  });

  await t.test("names the interval type the user is actually working in", async () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    typeInto(h, intervalBox(h, 0), "7.5");
    await saveScale(h);

    assert.equal(messageText(h), "Cannot save: interval 1 is not a valid EDO step count.");
  });

  await t.test("takes its own message down once the last box is fixed", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The message is about a state the editor is in, so it stops being true the
    // moment that state does. Leaving it up would have the bar contradicting
    // the boxes it is describing.
    buildRelativeScale(h, ["9.5/8"]);
    savePNG(h);
    assert.notEqual(messageText(h), "", "should be complaining to start");

    typeInto(h, intervalBox(h, 0), "9/8");

    assert.equal(messageText(h), "", "fixing the scale must clear the complaint");
    assert.equal(h.document.getElementById("toolbar-message").hidden, true);
  });

  await t.test("leaves a message about something else alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Only the invalid-scale complaint clears itself. A file that failed to
    // open is still a thing that happened, and fixing an interval says nothing
    // about it.
    buildRelativeScale(h, ["9.5/8"]);
    h.app.showToolbarMessage("Not a valid JSON file.");

    typeInto(h, intervalBox(h, 0), "9/8");

    assert.equal(messageText(h), "Not a valid JSON file.");
  });
});
