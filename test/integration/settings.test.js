"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { pngChunkData, bytesFromDataUrl } = require("../helpers/canvas-stub.js");
const { closeTo } = require("../helpers/assertions.js");
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
function savePng(h) {
  h.document.getElementById("save-png").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
}
function cssSize(h) {
  return {
    width: parseFloat(h.canvas().style.width),
    height: parseFloat(h.canvas().style.height),
  };
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
    savePng(h);

    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0].download, "scale.png");
    assert.equal(h.dataUrls.length, 1);
    assert.equal(h.dataUrls[0].type, "image/png");
  });

  await t.test("exports at the full export resolution, whatever the zoom", () => {
    const h = loadApp({ devicePixelRatio: 2 });
    t.after(() => h.close());
    const css = cssSize(h);
    typeInto(h, h.document.getElementById("zoom"), "20");

    savePng(h);

    assert.equal(h.dataUrls[0].width, Math.round(css.width * h.app.EXPORT_SCALE));
    assert.equal(h.dataUrls[0].height, Math.round(css.height * h.app.EXPORT_SCALE));
    assert.ok(h.dataUrls[0].height > 400, "still the full-size image, not the 20% preview");
  });

  await t.test("exports the same bitmap whatever the display's pixel ratio", () => {
    const lowDpi = loadApp({ devicePixelRatio: 1 });
    const highDpi = loadApp({ devicePixelRatio: 3 });
    t.after(() => {
      lowDpi.close();
      highDpi.close();
    });
    buildRelativeScale(lowDpi, ["9/8", "10/9"]);
    buildRelativeScale(highDpi, ["9/8", "10/9"]);

    savePng(lowDpi);
    savePng(highDpi);

    assert.deepEqual(
      { width: lowDpi.dataUrls[0].width, height: lowDpi.dataUrls[0].height },
      { width: highDpi.dataUrls[0].width, height: highDpi.dataUrls[0].height },
      "a print-quality export must not depend on the monitor it was made on"
    );
  });

  await t.test("leaves the on-screen canvas at the display's resolution", () => {
    const h = loadApp({ devicePixelRatio: 2 });
    t.after(() => h.close());
    const css = cssSize(h);

    savePng(h);

    assert.equal(h.canvas().width, Math.round(css.width * 2));
    assert.equal(h.canvas().height, Math.round(css.height * 2));
  });

  await t.test("the downloaded file declares the size it should print at", () => {
    const h = loadApp({ devicePixelRatio: 1 });
    t.after(() => h.close());
    // A just-intonation octave: the chart a page of the book would carry.
    buildRelativeScale(h, ["9/8", "10/9", "16/15", "9/8", "10/9", "9/8", "16/15"]);
    const css = cssSize(h);

    savePng(h);

    const physical = pngChunkData(bytesFromDataUrl(h.downloads[0].href), "pHYs");
    assert.ok(physical, "no pHYs chunk: the file would place at a viewer's 72ppi default");
    const view = new DataView(physical.buffer, physical.byteOffset, physical.byteLength);
    const inchesTall = h.dataUrls[0].height / (view.getUint32(4) * 0.0254);

    closeTo(
      inchesTall,
      css.height / h.app.CSS_PX_PER_INCH,
      0.01,
      "the declared resolution and the export scale must agree on the printed size"
    );
    closeTo(inchesTall, 6.9, 0.05, "an octave should place as a full-page figure");
  });

  await t.test("the downloaded file says what its colours mean", () => {
    const h = loadApp();
    t.after(() => h.close());

    savePng(h);

    assert.ok(
      pngChunkData(bytesFromDataUrl(h.downloads[0].href), "sRGB"),
      "no sRGB chunk: a print workflow has to guess how to separate the colours"
    );
  });

  await t.test("caps a huge chart's export at the canvas-area limit", () => {
    const h = loadApp({ devicePixelRatio: 2 });
    t.after(() => h.close());
    // Three octaves: 3600 cents of stack, big enough that a flat 4x export
    // would ask for a bitmap Safari refuses to allocate.
    buildRelativeScale(h, ["2/1", "2/1", "2/1"]);

    savePng(h);

    const area = h.dataUrls[0].width * h.dataUrls[0].height;
    assert.ok(
      area <= h.app.MAX_CANVAS_AREA,
      `exported ${h.dataUrls[0].width}x${h.dataUrls[0].height} = ${area}px, over the ${h.app.MAX_CANVAS_AREA}px cap`
    );
    assert.ok(
      h.dataUrls[0].height > h.canvas().height,
      "the cap must not drop the export below the on-screen resolution"
    );
  });
});
