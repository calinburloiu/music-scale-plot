"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, noteRows, intervalRows } = require("../helpers/harness.js");

// The harness loads app.js as-is and re-exports its top-level declarations.
// If that mechanism silently breaks, every other test would pass vacuously, so
// it is checked here explicitly.
test("the test harness", async (t) => {
  await t.test("boots the real page without errors", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.deepEqual(h.jsdomErrors, [], "app.js threw or used an unimplemented API");
  });

  await t.test("re-exports app.js's top-level functions", () => {
    const h = loadApp();
    t.after(() => h.close());
    for (const name of ["readScaleData", "render", "intervalToCents", "addNote", "getIntervalType"]) {
      assert.equal(typeof h.app[name], "function", `${name} is not exported`);
    }
  });

  await t.test("exposes live bindings, not load-time snapshots", () => {
    const h = loadApp();
    t.after(() => h.close());
    const zoom = h.document.getElementById("zoom");
    assert.equal(h.app.displayZoom, 1);

    zoom.value = "40";
    zoom.dispatchEvent(new h.window.Event("input", { bubbles: true }));
    assert.equal(h.app.displayZoom, 0.4, "harness must observe the updated value");
  });

  await t.test("starts from the markup in index.html", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.equal(noteRows(h).length, 2);
    assert.equal(intervalRows(h).length, 1);
    assert.equal(intervalRows(h)[0].querySelector(".interval").value, "9/8");
    assert.equal(h.document.getElementById("interval-type").value, "ratio");
    assert.equal(h.document.getElementById("scale-mode").value, "relative");
  });

  await t.test("gives each test an isolated window", () => {
    const a = loadApp();
    const b = loadApp();
    t.after(() => {
      a.close();
      b.close();
    });
    a.el(".interval").value = "3/2";
    assert.equal(b.el(".interval").value, "9/8", "state leaked between harnesses");
  });

  await t.test("wires the app up on load, without a manual render() call", () => {
    const h = loadApp();
    t.after(() => h.close());
    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the initial scale was never drawn");
    assert.equal(h.el(".cents-label").textContent, "203.91￠", "labels were never filled in");
  });
});
