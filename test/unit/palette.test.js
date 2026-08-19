"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { loadApp, selectOption } = require("../helpers/harness.js");

const HEX = /^#[0-9A-F]{6}$/;

test("colour palettes", async (t) => {
  const h = loadApp();
  t.after(() => h.close());
  const { PALETTE_LIGHT, PALETTE_DARK } = h.app;

  await t.test("both palettes hold the same number of colours", () => {
    assert.equal(
      PALETTE_LIGHT.length,
      PALETTE_DARK.length,
      "remapping between palettes is index-based, so they must stay parallel"
    );
    assert.ok(PALETTE_LIGHT.length > 0);
  });

  await t.test("every entry is an uppercase six-digit hex colour", () => {
    for (const hex of [...PALETTE_LIGHT, ...PALETTE_DARK]) {
      assert.match(hex, HEX, `${hex} is not a canonical hex colour`);
    }
  });

  await t.test("colours are unique within each palette", () => {
    assert.equal(new Set(PALETTE_LIGHT).size, PALETTE_LIGHT.length, "light palette has duplicates");
    assert.equal(new Set(PALETTE_DARK).size, PALETTE_DARK.length, "dark palette has duplicates");
  });

  await t.test("the first entry of each palette is the neutral default", () => {
    assert.equal(PALETTE_LIGHT[0], "#FFFFFF", "boxes default to an unfilled look");
    assert.equal(PALETTE_DARK[0], "#000000", "lines default to plain black");
  });
});

test("getActivePalette follows the chart style", async (t) => {
  const h = loadApp();
  t.after(() => h.close());

  await t.test("boxes use the light palette", () => {
    selectOption(h, "chart-style", "boxes");
    assert.equal(h.app.getActivePalette()[0], h.app.PALETTE_LIGHT[0]);
    assert.equal(h.app.getActivePalette().length, h.app.PALETTE_LIGHT.length);
  });

  await t.test("lines use the dark palette, which reads on a white background", () => {
    selectOption(h, "chart-style", "lines");
    assert.equal(h.app.getActivePalette()[0], h.app.PALETTE_DARK[0]);
  });
});

test("the colour dropdown offers the active palette", async (t) => {
  await t.test("opening a swatch populates it with every palette colour", () => {
    const h = loadApp();
    t.after(() => h.close());
    const swatch = h.el(".color-swatch");
    swatch.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));

    const options = h.all(".color-dropdown .color-option");
    assert.equal(options.length, h.app.PALETTE_LIGHT.length);
    assert.deepEqual(
      options.map((o) => o.dataset.color),
      [...h.app.PALETTE_LIGHT]
    );
  });

  await t.test("it offers the dark palette once the chart style is lines", () => {
    const h = loadApp();
    t.after(() => h.close());
    selectOption(h, "chart-style", "lines");
    h.el(".color-swatch").dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));

    assert.deepEqual(
      h.all(".color-dropdown .color-option").map((o) => o.dataset.color),
      [...h.app.PALETTE_DARK]
    );
  });

  await t.test("clicking elsewhere closes the dropdown", () => {
    const h = loadApp();
    t.after(() => h.close());
    const swatch = h.el(".color-swatch");
    swatch.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    assert.equal(h.all(".color-dropdown.open").length, 1);

    h.document.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    assert.equal(h.all(".color-dropdown.open").length, 0);
  });

  await t.test("clicking the same swatch twice toggles the dropdown shut", () => {
    const h = loadApp();
    t.after(() => h.close());
    const swatch = h.el(".color-swatch");
    swatch.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    swatch.dispatchEvent(new h.window.MouseEvent("click", { bubbles: true }));
    assert.equal(h.all(".color-dropdown.open").length, 0);
  });
});
