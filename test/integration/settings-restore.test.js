"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  noteRows,
  intervalRows,
  restoreFromHistory,
  selectOption,
  buildRelativeScale,
  buildAbsoluteScale,
} = require("../helpers/harness.js");
const { closeTo } = require("../helpers/assertions.js");

// A browser restores every <select> and <input> across a soft reload, but it
// restores nothing the app *derived* from them: the editor's row shape, the
// EDO settings row, the swatches' palette all come back at the markup default.
// So on a refresh the controls can say one thing while the model says another —
// the app misbehaving in ways the UI gives no hint of. Everything below boots
// with a control already carrying a restored value, the way a reload does.

function edoRow(h) {
  return h.document.getElementById("edo-settings");
}
function edoLabel(h) {
  return h.document.getElementById("edo-cents-label");
}
function swatchColors(h) {
  return intervalRows(h).map((r) => r.querySelector(".color-swatch").dataset.color);
}

test("a restored Absolute Intervals mode at startup", async (t) => {
  await t.test("builds the editor with absolute inputs, not relative ones", () => {
    const h = loadApp({ controls: { "scale-mode": "absolute" } });
    t.after(() => h.close());

    assert.equal(
      h.editor().querySelectorAll(".interval").length,
      0,
      "an absolute editor still holds relative interval inputs"
    );
    assert.equal(
      noteRows(h).filter((r) => r.querySelector(".absolute-interval")).length,
      noteRows(h).length,
      "not every note row got an absolute interval input"
    );
  });

  await t.test("carries the restored relative values over into absolute ones", () => {
    const h = loadApp({ controls: { "scale-mode": "absolute" } });
    t.after(() => h.close());

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["1/1", "9/8"],
      "the markup's 9/8 was dropped instead of being stacked on the unison"
    );
  });

  await t.test("reads a scale whose intervals still have their cents", () => {
    const h = loadApp({ controls: { "scale-mode": "absolute" } });
    t.after(() => h.close());

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    assert.equal(intervals.length, 1);
    closeTo(
      intervals[0].cents,
      203.91,
      0.01,
      "the model read NaN cents while the editor showed an interval"
    );
  });

  await t.test("draws the chart the editor describes", () => {
    const h = loadApp({ controls: { "scale-mode": "absolute" } });
    t.after(() => h.close());

    assert.ok(
      h.ctx.callsOf("fillRect").length > 0,
      "the chart came up blank beside a populated editor"
    );
  });
});

test("a restored EDO interval type at startup", async (t) => {
  await t.test("shows the EDO settings row", () => {
    const h = loadApp({ controls: { "interval-type": "edo" } });
    t.after(() => h.close());

    assert.notEqual(
      edoRow(h).style.display,
      "none",
      "the divisions input stayed hidden while the type said EDO"
    );
  });

  await t.test("fills in the cents-per-division label", () => {
    const h = loadApp({ controls: { "interval-type": "edo", "edo-divisions": "53" } });
    t.after(() => h.close());

    assert.match(edoLabel(h).textContent, /22\.64/, "the label never described the 53-EDO division");
  });

  await t.test("keeps the restored scale instead of resetting it", () => {
    const h = loadApp({ controls: { "interval-type": "edo" } });
    t.after(() => h.close());

    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".interval").value),
      ["9/8"],
      "startup threw away the interval the browser had just restored"
    );
  });
});

test("a restored Line chart style at startup", async (t) => {
  await t.test("remaps the swatches onto the dark palette", () => {
    const h = loadApp({ controls: { "chart-style": "lines" } });
    t.after(() => h.close());

    assert.deepEqual(
      swatchColors(h),
      ["#000000"],
      "a white line was drawn on a white ground"
    );
  });
});

test("restored settings that combine", async (t) => {
  await t.test("apply the chart style to the rebuilt absolute editor", () => {
    const h = loadApp({ controls: { "scale-mode": "absolute", "chart-style": "lines" } });
    t.after(() => h.close());

    assert.equal(h.editor().querySelectorAll(".interval").length, 0);
    assert.deepEqual(swatchColors(h), ["#000000"]);
  });
});

test("a cold load, where every control still holds its markup default", async (t) => {
  await t.test("leaves the editor, the EDO row and the swatches alone", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.editor().querySelectorAll(".absolute-interval").length, 0);
    assert.deepEqual(
      intervalRows(h).map((r) => r.querySelector(".interval").value),
      ["9/8"]
    );
    assert.equal(edoRow(h).style.display, "none");
    assert.deepEqual(swatchColors(h), ["#FFFFFF"]);
  });
});

// Chromium hands the restored values over *after* `load`, once the deferred
// scripts have already initialised the app against index.html's defaults, and
// it fires no `change` for them. `pageshow` is the app's only notice. Without
// it a refresh leaves every control saying one thing and the model another.

test("a soft reload, where the browser restores the controls after load", async (t) => {
  await t.test("rebuilds the editor when the restored mode is Absolute Intervals", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { "scale-mode": "absolute" });

    assert.equal(
      h.editor().querySelectorAll(".interval").length,
      0,
      "the editor kept its relative rows under an Absolute Intervals control"
    );
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["1/1", "9/8"]
    );
  });

  await t.test("reads a scale whose intervals still have their cents", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { "scale-mode": "absolute" });

    const intervals = h.app.readScaleData().filter((i) => i.type === "interval");
    closeTo(intervals[0].cents, 203.91, 0.01, "the model read NaN cents after the reload");
  });

  await t.test("redraws the chart, which the reload had left blank", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    restoreFromHistory(h, { "scale-mode": "absolute" });

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("shows the EDO settings for a restored EDO type", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { "interval-type": "edo", "edo-divisions": "53" });

    assert.notEqual(edoRow(h).style.display, "none");
    assert.match(edoLabel(h).textContent, /22\.64/);
  });

  await t.test("keeps the restored scale rather than resetting it to the default", () => {
    const h = loadApp();
    t.after(() => h.close());
    // The browser restores the interval's text too, and fires no `input` for it.
    h.el(".interval").value = "7";

    restoreFromHistory(h, { "interval-type": "edo" });

    assert.equal(h.el(".interval").value, "7", "the reload threw the restored interval away");
  });

  await t.test("recomputes the cents labels from the restored interval values", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.el(".interval").value = "5/4";

    restoreFromHistory(h);

    assert.deepEqual(
      h.all(".cents-label").map((e) => e.textContent),
      ["386.31￠"],
      "the label still described the interval the markup shipped, not the restored one"
    );
  });

  await t.test("remaps the swatches for a restored Line style", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { "chart-style": "lines" });

    assert.deepEqual(swatchColors(h), ["#000000"]);
  });

  await t.test("marks the editor for a restored Byzantine notation", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { notation: "byzantine" });

    assert.ok(h.editor().classList.contains("notation-byzantine"));
  });

  await t.test("follows a restored zoom", () => {
    const h = loadApp();
    t.after(() => h.close());

    restoreFromHistory(h, { zoom: "50" });

    assert.equal(h.document.getElementById("zoom-value").textContent, "50%");
    closeTo(h.app.displayZoom, 0.5, 1e-9, "the canvas was scaled to the markup's zoom");
  });
});

test("a reload that changed nothing", async (t) => {
  await t.test("leaves a relative scale exactly as it was", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"], { names: ["do", "re", "mi"] });
    const before = h.app.readScaleData();

    restoreFromHistory(h);

    assert.deepEqual(JSON.parse(JSON.stringify(h.app.readScaleData())), JSON.parse(JSON.stringify(before)));
  });

  await t.test("leaves an absolute scale exactly as it was, rather than rebuilding it", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "scale-mode", "absolute");
    buildAbsoluteScale(h, ["1/1", "9/8", "5/4"]);
    const before = h.app.readScaleData();

    restoreFromHistory(h, {}, { persisted: true });

    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".absolute-interval").value),
      ["1/1", "9/8", "5/4"],
      "a back/forward-cache restore blanked the scale it was handed intact"
    );
    assert.deepEqual(JSON.parse(JSON.stringify(h.app.readScaleData())), JSON.parse(JSON.stringify(before)));
  });
});
