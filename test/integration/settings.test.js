"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  selectOption,
  typeInto,
  buildRelativeScale,
  noteRows,
  intervalRows,
} = require("../helpers/harness.js");

function edoRow(h) {
  return h.document.getElementById("edo-settings");
}
function edoDivisions(h) {
  return h.document.getElementById("edo-divisions");
}
function edoLabel(h) {
  return h.document.getElementById("edo-cents-label");
}

test("switching the interval type", async (t) => {
  await t.test("shows the EDO settings only for the edo type", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(edoRow(h).style.display, "none", "hidden for ratios");

    selectOption(h, "interval-type", "edo");
    assert.notEqual(edoRow(h).style.display, "none");

    selectOption(h, "interval-type", "cents");
    assert.equal(edoRow(h).style.display, "none");
  });

  await t.test("resets the scale, because intervals are not converted between types", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9", "16/15"], { names: ["C", "D", "E", "F"] });

    selectOption(h, "interval-type", "cents");

    assert.equal(noteRows(h).length, 2, "back to the default two-note scale");
    assert.equal(intervalRows(h)[0].querySelector(".interval").value, "200");
    assert.deepEqual(
      noteRows(h).map((r) => r.querySelector(".note-name").value),
      ["", ""]
    );
  });

  await t.test("re-labels the interval inputs with the new unit", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(h.el(".interval").placeholder, "ratio");

    selectOption(h, "interval-type", "edo");
    assert.equal(h.el(".interval").placeholder, "steps");

    selectOption(h, "interval-type", "cents");
    assert.equal(h.el(".interval").placeholder, "cents");
  });

  await t.test("keeps the chart in sync with the reset scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    buildRelativeScale(h, ["9/8", "10/9"]);
    h.ctx.reset();

    selectOption(h, "interval-type", "cents");
    const rects = h.ctx.callsOf("fillRect");
    assert.equal(rects.length, 1);
    assert.equal(rects[0].args[3], 200, "the 200-cent default is 200px tall");
  });
});

test("changing the EDO divisions", async (t) => {
  await t.test("reports the size of one division", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    assert.equal(edoLabel(h).textContent, "100.00 ￠ for each division");

    typeInto(h, edoDivisions(h), "53");
    assert.equal(edoLabel(h).textContent, "22.64 ￠ for each division");
  });

  await t.test("resets the scale, since step counts mean something different now", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    buildRelativeScale(h, ["2", "2", "1"]);

    typeInto(h, edoDivisions(h), "53");

    assert.equal(noteRows(h).length, 2);
    assert.equal(intervalRows(h)[0].querySelector(".interval").value, "9", "the new ~200 cent default");
  });

  await t.test("falls back to 12 divisions for an unusable value", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "interval-type", "edo");
    typeInto(h, edoDivisions(h), "");

    assert.equal(edoLabel(h).textContent, "100.00 ￠ for each division");
    assert.deepEqual(h.jsdomErrors, []);
  });
});

test("the zoom control", async (t) => {
  await t.test("scales the canvas for display only", () => {
    const h = loadApp();
    t.after(() => h.close());
    const canvasWidthBefore = h.canvas().width;
    const zoom = h.document.getElementById("zoom");

    typeInto(h, zoom, "50");

    assert.equal(h.app.displayZoom, 0.5);
    assert.equal(h.canvas().style.transform, "scale(0.5)");
    assert.equal(
      h.canvas().width,
      canvasWidthBefore,
      "the backing store must not change, so PNG export stays full resolution"
    );
  });

  await t.test("reports the current zoom as a percentage", () => {
    const h = loadApp();
    t.after(() => h.close());
    const zoom = h.document.getElementById("zoom");
    assert.equal(h.document.getElementById("zoom-value").textContent, "100%");

    typeInto(h, zoom, "35");
    assert.equal(h.document.getElementById("zoom-value").textContent, "35%");
  });
});

test("PNG export", async (t) => {
  await t.test("downloads the canvas as scale.png", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.document.getElementById("save-png").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));

    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0].download, "scale.png");
    assert.equal(h.dataUrls.length, 1);
    assert.equal(h.dataUrls[0].type, "image/png");
  });

  await t.test("exports at the full backing-store resolution, whatever the zoom", () => {
    const h = loadApp({ devicePixelRatio: 2 });
    t.after(() => h.close());
    typeInto(h, h.document.getElementById("zoom"), "20");

    h.document.getElementById("save-png").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));

    assert.equal(h.dataUrls[0].width, h.canvas().width);
    assert.equal(h.dataUrls[0].height, h.canvas().height);
    assert.ok(h.dataUrls[0].height > 400, "still the full-size image, not the 20% preview");
  });
});
