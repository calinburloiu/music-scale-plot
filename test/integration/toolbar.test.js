"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  fireClick,
  typeInto,
  selectOption,
  buildRelativeScale,
  noteRows,
  intervalRows,
} = require("../helpers/harness.js");

function toolbar(h) {
  return h.document.getElementById("toolbar");
}

test("the toolbar", async (t) => {
  await t.test("sits before the page container so it can stick to the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bar = toolbar(h);
    assert.ok(bar, "there is no #toolbar");
    assert.equal(bar.parentElement, h.document.body, "it must be a direct child of body");
    assert.equal(
      bar.nextElementSibling,
      h.el(".container"),
      "the container follows it, so the toolbar is above the panels"
    );
  });

  await t.test("names every button, because none of them carries text", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The buttons are icons only, so aria-label is their whole accessible
    // name — function, not appearance.
    const labels = h.all("#toolbar .toolbar-btn").map((b) => b.getAttribute("aria-label"));
    assert.deepEqual(labels, ["New", "Open", "Save", "Add note", "Remove last note"]);
    for (const button of h.all("#toolbar .toolbar-btn")) {
      assert.ok(button.querySelector("img"), `${button.id} has no icon`);
      assert.equal(button.querySelector("img").alt, "", "the label is on the button, not the image");
    }
  });

  await t.test("holds the note buttons, which the Scale Editor no longer does", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.document.getElementById("add-note").closest("#toolbar"), toolbar(h));
    assert.equal(h.document.getElementById("remove-note").closest("#toolbar"), toolbar(h));
    assert.equal(h.el(".editor-controls"), null, "the old editor control strip is gone");
  });

  await t.test("adds and removes notes from its new home", () => {
    const h = loadApp();
    t.after(() => h.close());

    const addBtn = h.document.getElementById("add-note");
    const removeBtn = h.document.getElementById("remove-note");

    assert.equal(noteRows(h).length, 2);
    assert.equal(removeBtn.disabled, true, "two notes is the smallest legal scale");

    fireClick(h, addBtn);
    assert.equal(noteRows(h).length, 3);
    assert.equal(removeBtn.disabled, false);

    fireClick(h, removeBtn);
    assert.equal(noteRows(h).length, 2);
  });

  await t.test("keeps a message bar, empty and hidden until something goes wrong", () => {
    const h = loadApp();
    t.after(() => h.close());

    const message = h.document.getElementById("toolbar-message");
    assert.ok(message, "there is no #toolbar-message");
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
    assert.equal(message.getAttribute("role"), "alert");
  });
});

test("the Save menu", async (t) => {
  await t.test("opens under the Save button and says so", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = h.document.getElementById("save-menu");
    const panel = h.document.getElementById("save-menu-panel");
    assert.equal(button.getAttribute("aria-haspopup"), "menu");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.classList.contains("open"), false);

    fireClick(h, button);
    assert.equal(panel.classList.contains("open"), true);
    assert.equal(button.getAttribute("aria-expanded"), "true");
  });

  await t.test("closes on a second click of the button", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = h.document.getElementById("save-menu");
    fireClick(h, button);
    fireClick(h, button);
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
    assert.equal(button.getAttribute("aria-expanded"), "false");
  });

  await t.test("closes with every other transient overlay", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    // closeAllDropdowns() means "close every transient overlay" — the colour
    // dropdowns, the symbol pickers and now this.
    h.app.closeAllDropdowns();
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
  });

  await t.test("closes when a click lands outside it", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.body);
    assert.equal(h.document.getElementById("save-menu-panel").classList.contains("open"), false);
  });

  await t.test("holds the two save items, the PNG one moved from the Chart panel", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.document.getElementById("save-menu-panel");
    assert.deepEqual(
      [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ["Save As Music Scale Plot file", "Save As PNG"]
    );
    assert.equal(h.document.getElementById("save-png").closest("#save-menu-panel"), panel);
    assert.equal(h.el(".chart-toolbar #save-png"), null, "it no longer sits in the Chart panel");
  });

  await t.test("still exports a PNG from its new home", () => {
    const h = loadApp();
    t.after(() => h.close());

    fireClick(h, h.document.getElementById("save-menu"));
    fireClick(h, h.document.getElementById("save-png"));
    assert.equal(h.downloads.length, 1, "no PNG was exported");
    assert.equal(h.downloads[0].download, "scale.png");
  });
});

test("the Scale Editor's own settings", async (t) => {
  await t.test("holds Name, Interval Type, EDO Divisions and Mode, in that order", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Interval Type and Mode are the two axes that decide what an interval box
    // means, and changing either rebuilds the editor — so they are editor
    // operations, not settings. A name is a property of the scale.
    const panel = h.el(".editor-panel");
    assert.deepEqual(
      [...panel.querySelectorAll(".scale-name-row, .interval-type-row, .edo-settings-row, .scale-mode-row")]
        .map((row) => row.className),
      ["scale-name-row", "interval-type-row", "edo-settings-row", "scale-mode-row"]
    );
  });

  await t.test("leaves Settings with Notation and Base Note alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.el(".settings-panel");
    assert.equal(panel.querySelector(".interval-type-row"), null);
    assert.equal(panel.querySelector(".edo-settings-row"), null);
    assert.ok(panel.querySelector(".notation-row"));
    assert.ok(panel.querySelector(".base-note-row"));
  });

  await t.test("starts with an empty scale name", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.document.getElementById("scale-name").value, "");
  });
});

test("New", async (t) => {
  await t.test("puts the whole page back to its defaults", () => {
    const h = loadApp();
    t.after(() => h.close());

    selectOption(h, "interval-type", "edo");
    selectOption(h, "scale-mode", "absolute");
    selectOption(h, "notation", "byzantine");
    selectOption(h, "chart-style", "lines");
    typeInto(h, h.document.getElementById("scale-name"), "Hicaz");

    fireClick(h, h.document.getElementById("new-file"));

    const valueOf = (id) => h.document.getElementById(id).value;
    assert.equal(valueOf("scale-name"), "", "the name is part of the reset");
    assert.equal(valueOf("interval-type"), "ratio");
    assert.equal(valueOf("scale-mode"), "relative");
    assert.equal(valueOf("notation"), "generic");
    assert.equal(valueOf("chart-style"), "boxes");
    assert.equal(noteRows(h).length, 2);
    assert.deepEqual(intervalRows(h).map((r) => r.querySelector(".interval").value), ["9/8"]);
  });

  await t.test("dismisses whatever the toolbar was saying", () => {
    const h = loadApp();
    t.after(() => h.close());

    h.app.showToolbarMessage("Not a valid JSON file.");
    assert.equal(h.document.getElementById("toolbar-message").hidden, false);

    fireClick(h, h.document.getElementById("new-file"));
    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
  });

  await t.test("discards a scale that was built up", () => {
    const h = loadApp();
    t.after(() => h.close());

    buildRelativeScale(h, ["9/8", "10/9", "16/15"], { names: ["do", "re", "mi", "fa"] });
    fireClick(h, h.document.getElementById("new-file"));

    assert.equal(noteRows(h).length, 2);
    assert.deepEqual(noteRows(h).map((r) => r.querySelector(".note-name").value), ["", ""]);
  });
});

test("the toolbar message bar", async (t) => {
  await t.test("shows text and hides again when cleared", () => {
    const h = loadApp();
    t.after(() => h.close());

    const message = h.document.getElementById("toolbar-message");
    h.app.showToolbarMessage("settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12.");
    assert.equal(message.hidden, false);
    assert.equal(
      message.textContent,
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12."
    );

    h.app.clearToolbarMessage();
    assert.equal(message.hidden, true);
    assert.equal(message.textContent, "");
  });
});
