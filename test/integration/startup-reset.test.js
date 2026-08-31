"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, restoreFormState, noteRows, intervalRows } = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

/**
 * A browser restores form-control state across a soft reload: the selects, the
 * number and range inputs and every text box in the editor come back carrying
 * the values the user left them at, while `#editor`'s structure comes back as
 * the markup's own two rows. The app keeps no state of its own to restore, so
 * the control and the DOM-as-data-model disagree — a `#scale-mode` reading
 * "absolute" over rows that hold relative inputs, an EDO interval type with the
 * EDO settings hidden.
 *
 * The page therefore starts from the markup's defaults, whatever the browser
 * put in the controls.
 */
const RESTORED = {
  "#notation": "byzantine",
  "#base-note": "3",
  "#interval-type": "edo",
  "#edo-divisions": "53",
  "#scale-mode": "absolute",
  "#chart-style": "lines",
  "#orientation": "horizontal",
  "#zoom": "50",
  "#editor .interval": "7/6",
  "#editor .note-name": "Pa",
  "#editor .interval-label": "restored label",
};

/**
 * The two moments a browser writes restored values, and both must be caught:
 * Firefox restores while parsing, so the values are already in the controls
 * when the deferred scripts run; Chromium restores only *after* `load`, once
 * every script has run against the markup's defaults, and announces it with
 * `pageshow`.
 */
const RESTORE_POINTS = {
  "before the scripts run, as Firefox does": (options) => loadApp({ restored: options }),
  "after load, as Chromium does": (options) => {
    const h = loadApp();
    restoreFormState(h, options);
    return h;
  },
};

for (const [when, boot] of Object.entries(RESTORE_POINTS)) {
  test(`startup when a browser restored the form state ${when}`, async (t) => {
    const loadRestored = () => boot(RESTORED);
    await t.test("puts every setting back to its markup default", () => {
      const h = loadRestored();
      t.after(() => h.close());

      const valueOf = (id) => h.document.getElementById(id).value;
      assert.equal(valueOf("notation"), "generic");
      assert.equal(valueOf("base-note"), "0");
      assert.equal(valueOf("interval-type"), "ratio");
      assert.equal(valueOf("edo-divisions"), "12");
      assert.equal(valueOf("scale-mode"), "relative");
      assert.equal(valueOf("chart-style"), "boxes");
      assert.equal(valueOf("orientation"), "vertical");
      assert.equal(valueOf("zoom"), "100");
    });

    await t.test("rebuilds the default two-note scale, discarding restored text", () => {
      const h = loadRestored();
      t.after(() => h.close());

      assert.equal(noteRows(h).length, 2);
      assert.equal(intervalRows(h).length, 1);
      assert.deepEqual(
        intervalRows(h).map((r) => r.querySelector(".interval").value),
        ["9/8"],
        "a restored interval value survived the reset"
      );
      assert.deepEqual(
        noteRows(h).map((r) => r.querySelector(".note-name").value),
        ["", ""],
        "a restored note name survived the reset"
      );
      assert.deepEqual(
        intervalRows(h).map((r) => r.querySelector(".interval-label").value),
        [""],
        "a restored interval label survived the reset"
      );
    });

    await t.test("reads the default scale back out of the editor", () => {
      const h = loadRestored();
      t.after(() => h.close());

      const data = h.app.readScaleData();
      const intervals = data.filter((item) => item.type === "interval");
      assert.equal(intervals.length, 1);
      closeTo(intervals[0].cents, 203.91, 0.01, "the whole tone did not parse as a ratio");
      assert.equal(intervals[0].displayInterval, "9/8");
    });

    await t.test("leaves the derived settings UI in step with the reset controls", () => {
      const h = loadRestored();
      t.after(() => h.close());

      assert.equal(
        h.document.getElementById("edo-settings").style.display,
        "none",
        "the EDO settings row showed for the default Ratios type"
      );
      assert.equal(h.document.getElementById("zoom-value").textContent, "100%");
      closeTo(h.app.displayZoom, 1, 1e-9);
      assert.ok(
        !h.editor().classList.contains("notation-byzantine"),
        "a restored Byzantine setting marked the editor"
      );
      assert.deepEqual(
        intervalRows(h).map((r) => r.querySelector(".interval").placeholder),
        ["ratio"],
        "the interval placeholder did not follow the reset interval type"
      );
    });

    await t.test("draws the default scale instead of an empty chart", () => {
      const h = loadRestored();
      t.after(() => h.close());

      assert.ok(h.canvas().width > 0 && h.canvas().height > 0, "the canvas has no size");
      assert.ok(h.ctx.callsOf("fillRect").length > 0, "nothing was drawn");
    });
  });
}
