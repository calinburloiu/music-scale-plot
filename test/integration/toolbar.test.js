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

/** What the toolbar's message bar currently says, without the dismiss button. */
function messageText(h) {
  return h.document.getElementById("toolbar-message-text").textContent;
}

test("the toolbar", async (t) => {
  await t.test("sits before the page container so it can stick to the top", () => {
    const h = loadApp();
    t.after(() => h.close());

    const bar = toolbar(h);
    assert.ok(bar, "there is no #toolbar");
    // The element that sticks is #toolbar-bar, which wraps the toolbar and the
    // message bar together; see the sticky-header test below for why the pair
    // travels as one. #toolbar-message sits between the two (Fix 3, issue #15):
    // a role="alert" live region does not belong inside role="toolbar"'s
    // accessible subtree, so it is a sibling immediately after #toolbar.
    const header = h.document.getElementById("toolbar-bar");
    assert.equal(header.parentElement, h.document.body, "the header must be a direct child of body");
    assert.equal(
      bar.nextElementSibling,
      h.document.getElementById("toolbar-message"),
      "the message bar follows the toolbar"
    );
    assert.equal(
      header.nextElementSibling,
      h.el(".container"),
      "the container follows the header, so both are above the panels"
    );
  });

  await t.test("names every button, because none of them carries text", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The buttons are icons only, so aria-label is their whole accessible
    // name — function, not appearance.
    const labels = h.all("#toolbar .toolbar-btn").map((b) => b.getAttribute("aria-label"));
    assert.deepEqual(labels, [
      "New", "Open", "Save", "Add note", "Remove last note", "Play scale", "Stop playing",
    ]);
    for (const button of h.all("#toolbar .toolbar-btn")) {
      assert.ok(button.querySelector("img"), `${button.id} has no icon`);
      assert.equal(button.querySelector("img").alt, "", "the label is on the button, not the image");
    }
  });

  await t.test("declares each shortcut on the control it works, and nowhere else", () => {
    const h = loadApp();
    t.after(() => h.close());

    // aria-keyshortcuts is the machine-readable half; the title is the half a
    // sighted reader sees. A control with no shortcut must claim none — the
    // browser owns Ctrl+N, so New has nothing to say.
    const declared = {};
    for (const button of h.all("#toolbar button, .save-menu-panel button")) {
      const keys = button.getAttribute("aria-keyshortcuts");
      if (keys) declared[button.id] = keys;
    }
    assert.deepEqual(declared, {
      "open-file": "Control+O Meta+O",
      "save-scale": "Control+S Meta+S",
      "play-scale": "Space",
      "stop-scale": "Space",
    });
  });

  await t.test("spells the shortcut out in the tooltip too", () => {
    const h = loadApp();
    t.after(() => h.close());

    const title = (id) => h.document.getElementById(id).getAttribute("title");
    assert.equal(title("play-scale"), "Play scale (Space)");
    assert.equal(title("stop-scale"), "Stop playing (Space)");
    assert.equal(title("open-file"), "Open (Ctrl+O)");
    assert.equal(title("save-scale"), "Save As Music Scale Plot file (Ctrl+S)");
    assert.equal(title("new-file"), "New", "a control with no shortcut says nothing");
  });

  await t.test("writes the chord in the notation of the machine it is running on", () => {
    const h = loadApp({ platform: "MacIntel" });
    t.after(() => h.close());

    // The handler takes either modifier, so the tooltip has to pick the one
    // the reader's own keyboard has. aria-keyshortcuts keeps naming both.
    const title = (id) => h.document.getElementById(id).getAttribute("title");
    assert.equal(title("open-file"), "Open (⌘O)");
    assert.equal(title("save-scale"), "Save As Music Scale Plot file (⌘S)");
    assert.equal(
      h.document.getElementById("open-file").getAttribute("aria-keyshortcuts"),
      "Control+O Meta+O",
      "both chords stay declared whatever the platform"
    );
    assert.equal(title("play-scale"), "Play scale (Space)", "Space is Space everywhere");
  });

  await t.test("believes userAgentData over the deprecated navigator.platform", () => {
    const h = loadApp({ platform: "MacIntel", uaDataPlatform: "Windows" });
    t.after(() => h.close());

    // Chromium reports both, and navigator.platform is the deprecated one —
    // it is the field a browser may eventually freeze or lie about, so where
    // the modern answer exists it wins.
    assert.equal(h.document.getElementById("open-file").getAttribute("title"), "Open (Ctrl+O)");
  });

  await t.test("leaves the accessible name alone while adding the hint", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The hint belongs in the tooltip, not in the name a screen reader reads
    // out — aria-keyshortcuts is how the shortcut reaches assistive tech.
    const labels = h.all("#toolbar .toolbar-btn").map((b) => b.getAttribute("aria-label"));
    assert.deepEqual(labels, [
      "New", "Open", "Save", "Add note", "Remove last note", "Play scale", "Stop playing",
    ]);
  });

  await t.test("puts the transport in its own group after the note buttons", () => {
    const h = loadApp();
    t.after(() => h.close());

    // File actions, then editing, then playback — each pair behind its own
    // separator.
    const ids = h.all("#toolbar > *").map((el) => el.id || el.className);
    assert.deepEqual(ids.slice(-4), [
      "toolbar-separator", "play-scale", "stop-scale", "open-file-input",
    ]);
    assert.equal(h.document.getElementById("stop-scale").disabled, true, "Stop is idle at rest");
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
    assert.equal(messageText(h), "");
    assert.equal(message.getAttribute("role"), "alert");
  });

  await t.test("keeps the alert bar out of the toolbar's own accessible subtree", () => {
    const h = loadApp();
    t.after(() => h.close());

    // A role="toolbar" accessible subtree is meant to hold widgets, not a
    // role="alert" live region — so the message bar sits immediately after
    // #toolbar, not inside it, though it stays where it visually was.
    const bar = toolbar(h);
    const message = h.document.getElementById("toolbar-message");
    assert.equal(bar.contains(message), false, "#toolbar-message must not be a descendant of #toolbar");
    assert.equal(bar.nextElementSibling, message, "it must sit immediately after #toolbar");
  });

  await t.test("keeps the alert bar inside the sticky header, so it cannot scroll away", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The message bar is the only channel the file flows report through: a
    // rejected file never reaches the editor, so there is nothing else on
    // screen to say what went wrong. Ctrl/Cmd+O works from anywhere on the
    // page, and a long scale scrolls well past the fold — so the bar has to
    // ride in the same sticky header the toolbar does, or a user who opens a
    // bad file while scrolled down gets no feedback at all. #toolbar-bar is
    // what carries `position: sticky`; the toolbar and the alert are both its
    // children, which keeps the alert out of role="toolbar" (the test above)
    // while keeping it on screen. Whether it *renders* stuck is CSS and stays
    // out of scope; that both live in the sticky element is the contract.
    const header = h.document.getElementById("toolbar-bar");
    const bar = toolbar(h);
    const message = h.document.getElementById("toolbar-message");
    assert.ok(header, "there is no #toolbar-bar sticky header");
    assert.equal(bar.parentElement, header, "#toolbar must be a child of #toolbar-bar");
    assert.equal(message.parentElement, header, "#toolbar-message must be a child of #toolbar-bar");
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

  await t.test("does not claim a menu role it does not implement", () => {
    const h = loadApp();
    t.after(() => h.close());

    // aria-haspopup="menu" + aria-expanded is what design §5.2 asked for. A
    // role="menu"/"menuitem" pair is a contract for arrow keys, Home/End and
    // Escape that this panel never implements, so it must not claim it.
    const button = h.document.getElementById("save-menu");
    const panel = h.document.getElementById("save-menu-panel");
    assert.equal(button.getAttribute("aria-haspopup"), "menu");
    assert.equal(panel.hasAttribute("role"), false);
    for (const item of panel.querySelectorAll("button")) {
      assert.equal(item.hasAttribute("role"), false, `${item.id} must not claim role="menuitem"`);
    }
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

  await t.test("holds the three save items: the scale file, the chart and the audio", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.document.getElementById("save-menu-panel");
    assert.deepEqual(
      [...panel.querySelectorAll("button")].map((b) => b.textContent.trim()),
      ["Save As Music Scale Plot file", "Save Chart As PNG", "Save Audio As WAV"]
    );
    assert.equal(h.document.getElementById("save-png").closest("#save-menu-panel"), panel);
    assert.equal(h.document.getElementById("save-audio").closest("#save-menu-panel"), panel);
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

  await t.test("closes on Escape and hands focus back to the Save button", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = h.document.getElementById("save-menu");
    const panel = h.document.getElementById("save-menu-panel");
    fireClick(h, button);
    assert.equal(panel.classList.contains("open"), true, "the menu should be open to start");

    h.document.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
    );

    // aria-haspopup="menu" sets the expectation even though the panel is a
    // plain group of buttons rather than a role="menu" (022b1a5 dropped the
    // roles it could not back): a reader who opens it from the keyboard has to
    // be able to leave it the same way, and land back where they started.
    assert.equal(panel.classList.contains("open"), false, "Escape must close the menu");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(h.document.activeElement, button, "focus must return to the Save button");
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
    assert.equal(messageText(h), "");
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

test("dismissing the toolbar message", async (t) => {
  function dismissBtn(h) {
    return h.document.getElementById("toolbar-message-dismiss");
  }

  await t.test("offers a dismiss button, named for a reader who cannot see the glyph", () => {
    const h = loadApp();
    t.after(() => h.close());

    const button = dismissBtn(h);
    assert.ok(button, "there is no #toolbar-message-dismiss");
    assert.equal(button.tagName, "BUTTON");
    assert.equal(button.getAttribute("type"), "button", "it must not submit anything");
    assert.ok(
      button.getAttribute("aria-label"),
      "the × is drawn in CSS, so the accessible name has to come from aria-label"
    );
  });

  await t.test("hides the bar when the button is clicked", () => {
    const h = loadApp();
    t.after(() => h.close());

    h.app.showToolbarMessage("Not a valid JSON file.");
    assert.equal(h.document.getElementById("toolbar-message").hidden, false);

    fireClick(h, dismissBtn(h));

    const message = h.document.getElementById("toolbar-message");
    assert.equal(message.hidden, true, "the button must hide the bar");
    assert.equal(messageText(h), "", "and empty it");
  });

  await t.test("keeps the button through a clear, so the bar can be dismissed twice", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The button lives inside #toolbar-message. Clearing by writing the
    // container's textContent would delete it along with the text, and the
    // second message would have no way out.
    h.app.showToolbarMessage("Not a valid JSON file.");
    fireClick(h, dismissBtn(h));

    h.app.showToolbarMessage("Could not open the file.");
    assert.equal(h.document.getElementById("toolbar-message").hidden, false);
    assert.ok(dismissBtn(h), "the dismiss button must survive a clear");

    fireClick(h, dismissBtn(h));
    assert.equal(h.document.getElementById("toolbar-message").hidden, true);
  });

  await t.test("contributes no text of its own to the alert", () => {
    const h = loadApp();
    t.after(() => h.close());

    // The glyph is a CSS ::before, so what a screen reader announces when the
    // live region changes is the message and nothing else.
    h.app.showToolbarMessage("settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12.");
    assert.equal(
      messageText(h),
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12."
    );
    assert.equal(dismissBtn(h).textContent, "", "the button must carry no text node");
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
      messageText(h),
      "settings.baseNote must be a whole number from 0 to 11 (0 = C), got 12."
    );

    h.app.clearToolbarMessage();
    assert.equal(message.hidden, true);
    assert.equal(messageText(h), "");
  });
});

test("the file keyboard shortcuts", async (t) => {
  function press(h, key, init = { ctrlKey: true }) {
    const event = new h.window.KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    h.document.dispatchEvent(event);
    return event;
  }

  await t.test("Ctrl+S saves, taking the browser's Save dialog off the page", async () => {
    const h = loadApp();
    t.after(() => h.close());

    const event = press(h, "s");
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(event.defaultPrevented, true, "the browser must not save the page instead");
    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0].download, "scale.musp.json");
  });

  await t.test("Cmd+S saves too, for the Mac", async () => {
    const h = loadApp();
    t.after(() => h.close());

    press(h, "s", { metaKey: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(h.downloads.length, 1);
  });

  await t.test("acts once when the chord is held, but still keeps the key off the page", async () => {
    const h = loadApp();
    t.after(() => h.close());

    press(h, "s");
    const repeat = press(h, "s", { ctrlKey: true, repeat: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    // Holding the chord sends a keydown per repeat. Each one must still be
    // taken off the page, or a repeat reaches the browser's own Save-page
    // dialog — but only the first may act, or one held key stacks up a queue
    // of file dialogs.
    assert.equal(h.downloads.length, 1, "a held Ctrl+S must not save again");
    assert.equal(repeat.defaultPrevented, true, "the browser must still not save the page");
  });

  await t.test("Ctrl+O opens", () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = h.document.getElementById("open-file-input");
    let clicks = 0;
    input.click = () => { clicks++; };

    const event = press(h, "o");
    assert.equal(event.defaultPrevented, true);
    assert.equal(clicks, 1);
  });

  await t.test("leaves the plain and the alt-modified keys alone", async () => {
    const h = loadApp();
    t.after(() => h.close());

    press(h, "s", {});
    press(h, "o", {});
    press(h, "s", { ctrlKey: true, altKey: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));
    assert.equal(h.downloads.length, 0);
  });

  await t.test("leaves the shift-modified keys alone too, since the app owns only the unshifted chords", async () => {
    const h = loadApp();
    t.after(() => h.close());

    const input = h.document.getElementById("open-file-input");
    let clicks = 0;
    input.click = () => { clicks++; };

    const saveEvent = press(h, "s", { ctrlKey: true, shiftKey: true });
    const openEvent = press(h, "o", { ctrlKey: true, shiftKey: true });
    await new Promise((resolve) => h.window.setTimeout(resolve, 0));

    assert.equal(saveEvent.defaultPrevented, false, "the browser must keep Ctrl+Shift+S");
    assert.equal(openEvent.defaultPrevented, false, "the browser must keep Ctrl+Shift+O");
    assert.equal(h.downloads.length, 0);
    assert.equal(clicks, 0);
  });
});
