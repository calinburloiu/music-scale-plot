"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  noteRows,
  intervalRows,
  openWell,
  fireClick,
  setNotation,
} = require("../helpers/harness.js");

// ---------------------------------------------------------------------------
// Dismissing a transient overlay by clicking away from it.
//
// Every overlay in the app — the colour dropdown, the four symbol pickers and
// the Save menu — is taken down by one listener, which calls
// closeAllDropdowns() on a click that reached the top of the page without a
// trigger having stopped it.
//
// Where that listener sits is the whole subject of this file, because Safari on
// iOS does not deliver the click as far as a desktop engine does. Apple's own
// Safari Web Content Guide is blunt about it — "if the user taps a nonclickable
// element, no events are generated" — and the escape is that the tap *does*
// generate one when the element it hit, or any of its ancestors, carries a
// mouse handler. `document` is not an ancestor: it is not an element at all, so
// a listener there leaves the whole page nonclickable and the tap is swallowed.
// A listener on the root element is in the chain, so every tap on the page
// reaches it.
//
// jsdom bubbles a click all the way to `document` like a desktop browser, so
// the iOS condition has to be modelled: cut the event off at the root element
// and assert the overlay still goes away. `stopPropagation` — not
// `stopImmediatePropagation` — leaves the app's own listener on that same node
// running, which is exactly iOS's shape: the root element sees the click, and
// `document` never does.
// ---------------------------------------------------------------------------

/** Models iOS: a click reaches <html>, and nothing above it. */
function cutClicksAboveRootElement(h) {
  h.document.documentElement.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

/** A plain, non-interactive element — what a reader taps to mean "never mind". */
function plainElement(h) {
  return h.document.querySelector(".settings-panel h2");
}

test("an overlay is dismissed by a tap that never reaches `document`", async (t) => {
  await t.test("the colour dropdown", () => {
    const h = loadApp();
    t.after(() => h.close());
    cutClicksAboveRootElement(h);

    const row = intervalRows(h)[0];
    fireClick(h, row.querySelector(".color-swatch"));
    const dropdown = row.querySelector(".color-dropdown");
    assert.ok(dropdown.classList.contains("open"), "the dropdown should have opened");

    fireClick(h, plainElement(h));
    assert.equal(
      dropdown.classList.contains("open"),
      false,
      "a tap away from the dropdown must close it, though the click stops at <html>"
    );
  });

  await t.test("the Save menu", () => {
    const h = loadApp();
    t.after(() => h.close());
    cutClicksAboveRootElement(h);

    const panel = h.document.getElementById("save-menu-panel");
    fireClick(h, h.document.getElementById("save-menu"));
    assert.ok(panel.classList.contains("open"), "the menu should have opened");

    fireClick(h, plainElement(h));
    assert.equal(
      panel.classList.contains("open"),
      false,
      "a tap away from the Save menu must close it, though the click stops at <html>"
    );
  });

  for (const kind of ["accidental", "alteration", "fthora", "martyria"]) {
    await t.test(`the ${kind} picker`, () => {
      const h = loadApp();
      t.after(() => h.close());
      if (kind !== "accidental") setNotation(h, "byzantine");
      cutClicksAboveRootElement(h);

      const panel = openWell(h, noteRows(h)[0], kind);
      assert.ok(panel.classList.contains("open"), "the picker should have opened");

      fireClick(h, plainElement(h));
      assert.equal(
        panel.classList.contains("open"),
        false,
        `a tap away from the ${kind} picker must close it, though the click stops at <html>`
      );
    });
  }
});
