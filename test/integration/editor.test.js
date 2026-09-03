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
  setNoteCount,
  buildRelativeScale,
  buildAbsoluteScale,
  pickColor,
  pressKey,
} = require("../helpers/harness.js");

function addBtn(h) {
  return h.document.getElementById("add-note");
}
function removeBtn(h) {
  return h.document.getElementById("remove-note");
}

test("adding notes", async (t) => {
  await t.test("appends an interval row and a note row", () => {
    const h = loadApp();
    t.after(() => h.close());
    fireClick(h, addBtn(h));

    assert.equal(noteRows(h).length, 3);
    assert.equal(intervalRows(h).length, 2);
  });

  await t.test("keeps rows alternating note / interval / note", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 5);

    const classes = h.all("#editor .row").map((r) => (r.classList.contains("note-row") ? "n" : "i"));
    assert.deepEqual(classes, ["n", "i", "n", "i", "n", "i", "n", "i", "n"]);
  });

  await t.test("numbers the new degree", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);

    assert.deepEqual(
      noteRows(h).map((r) => r.dataset.degree),
      ["1", "2", "3", "4"]
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector("label").textContent),
      ["Note 1", "Note 2", "Note 3", "Note 4"]
    );
  });

  await t.test("seeds the new interval with the type's default value", () => {
    const h = loadApp();
    t.after(() => h.close());
    fireClick(h, addBtn(h));
    assert.equal(intervalRows(h).at(-1).querySelector(".interval").value, "9/8");

    selectOption(h, "interval-type", "cents");
    fireClick(h, addBtn(h));
    assert.equal(intervalRows(h).at(-1).querySelector(".interval").value, "200");
  });

  await t.test("inherits the colour and label already used for that interval value", () => {
    const h = loadApp();
    t.after(() => h.close());
    pickColor(h, intervalRows(h)[0], "#FFCCCC");
    typeInto(h, intervalRows(h)[0].querySelector(".interval-label"), "major tone");

    fireClick(h, addBtn(h)); // the new row also defaults to 9/8

    const added = intervalRows(h).at(-1);
    assert.equal(added.querySelector(".color-swatch").dataset.color, "#FFCCCC");
    assert.equal(added.querySelector(".interval-label").value, "major tone");
  });

  await t.test("does not inherit anything when no other row uses that value", () => {
    const h = loadApp();
    t.after(() => h.close());
    pickColor(h, intervalRows(h)[0], "#FFCCCC");
    typeInto(h, intervalRows(h)[0].querySelector(".interval"), "10/9");

    fireClick(h, addBtn(h)); // new row is 9/8, nothing else is

    const added = intervalRows(h).at(-1);
    assert.equal(added.querySelector(".color-swatch").dataset.color, "#FFFFFF");
    assert.equal(added.querySelector(".interval-label").value, "");
  });

  await t.test("in absolute mode the new note stacks the default interval on the last one", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    fireClick(h, addBtn(h));

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["1/1", "9/8", "81/64"]
    );
  });

  await t.test("redraws the chart", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();
    fireClick(h, addBtn(h));
    assert.equal(h.ctx.callsOf("fillRect").length, 2, "both intervals are drawn");
  });
});

test("Enter in the scale editor", async (t) => {
  await t.test("adds a note from the interval box", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8"]);
    assert.equal(noteRows(h).length, 2, "the default scale should start at two notes");

    pressKey(h, intervalRows(h)[0].querySelector(".interval"), "Enter");

    assert.equal(noteRows(h).length, 3, "Enter should have appended a note");
  });

  await t.test("adds a note from the note name box", () => {
    const h = loadApp();
    t.after(() => h.close());

    pressKey(h, noteRows(h)[0].querySelector(".note-name"), "Enter");

    assert.equal(noteRows(h).length, 3);
  });

  await t.test("adds a note from the interval label box", () => {
    const h = loadApp();
    t.after(() => h.close());

    pressKey(h, intervalRows(h)[0].querySelector(".interval-label"), "Enter");

    assert.equal(noteRows(h).length, 3);
  });

  await t.test("adds a note from the absolute interval box", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    pressKey(h, noteRows(h)[1].querySelector(".absolute-interval"), "Enter");

    assert.equal(noteRows(h).length, 3);
  });

  await t.test("moves the cursor to the new note's interval box, ready to type", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The point of the shortcut: type a value, press Enter, type the next one.
    // Leaving focus behind would mean reaching for the mouse between every
    // note, which is the thing the shortcut exists to avoid.
    pressKey(h, intervalRows(h)[0].querySelector(".interval"), "Enter");

    const fresh = intervalRows(h)[1].querySelector(".interval");
    assert.equal(h.document.activeElement, fresh, "focus should sit in the new interval box");
    // Selected, not just focused. The box arrives carrying the default value,
    // so a cursor parked in it would make the reader clear it by hand before
    // typing — Enter, 3/2, Enter, 5/4 only flows if the next value replaces
    // what is there.
    assert.equal(fresh.selectionStart, 0, "the selection should start at the beginning");
    assert.equal(
      fresh.selectionEnd,
      fresh.value.length,
      "and run to the end, so the next thing typed replaces the default"
    );
  });

  await t.test("in absolute mode the cursor lands in the new note's own box", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Absolute mode has no value on the interval row: the number a user types
    // for the new note sits on the note row itself, so that is where the
    // cursor belongs.
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8"]);
    pressKey(h, noteRows(h)[1].querySelector(".absolute-interval"), "Enter");

    const fresh = noteRows(h)[2].querySelector(".absolute-interval");
    assert.equal(h.document.activeElement, fresh, "focus should sit in the new absolute box");
    assert.equal(fresh.selectionStart, 0, "selected here too");
    assert.equal(fresh.selectionEnd, fresh.value.length, "right to the end");
  });

  await t.test("takes the keypress off the page, so no browser default follows it", () => {
    const h = loadApp();
    t.after(() => h.close());

    const prevented = pressKey(h, intervalRows(h)[0].querySelector(".interval"), "Enter");

    assert.equal(prevented, true, "Enter must be consumed once it has added a note");
  });

  await t.test("ignores every other key", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const key of ["a", "Escape", "Tab", "ArrowDown"]) {
      pressKey(h, intervalRows(h)[0].querySelector(".interval"), key);
    }

    assert.equal(noteRows(h).length, 2, "only Enter adds a note");
  });

  await t.test("leaves the settings boxes above the editor alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    // #scale-name and #edo-divisions are in the Scale Editor panel but not in
    // #editor: they describe the whole scale rather than one note, so Enter
    // there is not "give me another note".
    selectOption(h, "interval-type", "edo");
    pressKey(h, h.document.getElementById("scale-name"), "Enter");
    pressKey(h, h.document.getElementById("edo-divisions"), "Enter");

    assert.equal(noteRows(h).length, 2, "neither box should have added a note");
  });
});

test("removing notes", async (t) => {
  await t.test("drops the last note row and the interval below it", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);
    fireClick(h, removeBtn(h));

    assert.equal(noteRows(h).length, 3);
    assert.equal(intervalRows(h).length, 2);
    assert.equal(h.all("#editor .row").at(-1).classList.contains("note-row"), true);
  });

  await t.test("refuses to go below two notes, the smallest plottable scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(noteRows(h).length, 2);

    h.app.removeLastNote();
    assert.equal(noteRows(h).length, 2, "a two-note scale must survive");
  });

  await t.test("disables the remove button at two notes", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(removeBtn(h).disabled, true);

    fireClick(h, addBtn(h));
    assert.equal(removeBtn(h).disabled, false);

    fireClick(h, removeBtn(h));
    assert.equal(removeBtn(h).disabled, true);
  });

  await t.test("keeps the remaining notes' values", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"], { names: ["C", "D", "E", "F"] });
    fireClick(h, removeBtn(h));

    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".interval").value),
      ["9/8", "10/9"]
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      ["C", "D", "E"]
    );
  });
});

test("resetScaleToDefault", async (t) => {
  await t.test("rebuilds the two-note default scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"], { names: ["C", "D", "E", "F"] });

    h.app.resetScaleToDefault();

    assert.equal(noteRows(h).length, 2);
    assert.equal(intervalRows(h).length, 1);
    assert.equal(intervalRows(h)[0].querySelector(".interval").value, "9/8");
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      ["", ""],
      "names are discarded with the old scale"
    );
    assert.equal(removeBtn(h).disabled, true);
  });

  await t.test("in absolute mode the second note sits at the default interval", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    h.app.resetScaleToDefault();

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["1/1", "9/8"]
    );
  });

  await t.test("leaves the chart showing the default scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();

    h.app.resetScaleToDefault();
    assert.equal(h.ctx.callsOf("fillRect").length, 1);
  });
});

test("the interval row's right-hand cluster", async (t) => {
  await t.test("puts the colour swatch before the label, under the well above it", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const row of intervalRows(h)) {
      const cluster = row.querySelector(".interval-label-cluster");
      assert.deepEqual(
        [...cluster.children].map((el) => el.className),
        ["color-picker-wrapper", "interval-label"],
        "the swatch sits under the leftmost well of the note row above it"
      );
    }
  });

  await t.test("keeps that order on a row the editor builds itself", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 3);

    const cluster = intervalRows(h).at(-1).querySelector(".interval-label-cluster");
    assert.deepEqual(
      [...cluster.children].map((el) => el.className),
      ["color-picker-wrapper", "interval-label"]
    );
  });

  await t.test("keeps that order after a scale-mode rebuild", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");

    const cluster = intervalRows(h)[0].querySelector(".interval-label-cluster");
    assert.deepEqual(
      [...cluster.children].map((el) => el.className),
      ["color-picker-wrapper", "interval-label"]
    );
  });

  await t.test("still opens the colour dropdown from its new place", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = intervalRows(h)[0];

    pickColor(h, row, h.app.getActivePalette()[3]);

    assert.equal(row.querySelector(".color-swatch").dataset.color, h.app.getActivePalette()[3]);
  });
});
