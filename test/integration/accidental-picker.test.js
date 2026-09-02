"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  noteRows,
  openWell,
  pickAccidental,
  searchPicker,
  dismissPicker,
  fireClick,
  setNotation,
  typeInto,
} = require("../helpers/harness.js");

/** Every option that a filter has left visible, excluding the always-on None. */
function visibleOptions(panel) {
  return [...panel.querySelectorAll(".accidental-option[data-group-of]:not([hidden])")];
}

function visibleCategories(panel) {
  return [
    ...new Set(visibleOptions(panel).map((option) => option.dataset.groupOf)),
  ];
}

test("the accidentals picker", async (t) => {
  await t.test("opens when the well is clicked and closes when it is clicked again", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "accidental");
    assert.ok(panel.classList.contains("open"));

    fireClick(h, row.querySelector(".accidental-well"));
    assert.ok(!panel.classList.contains("open"));
  });

  await t.test("lists None first, then all 505 entries under 28 headings", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = openWell(h, noteRows(h)[0], "accidental");
    const options = [...panel.querySelectorAll(".accidental-option")];

    assert.equal(options[0].dataset.accidental, "", "None must be the first row");
    assert.equal(options.length, 506, "None plus the whole catalogue");
    assert.deepEqual(
      [...panel.querySelectorAll(".sym-group-title")].map((el) => el.textContent),
      Array.from(h.app.SMUFL_ACCIDENTAL_CATEGORIES, (c) => c.title),
      "every category gets a heading, in the catalogue's order"
    );
  });

  await t.test("shows each accidental's glyphs and its category's own label", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = openWell(h, noteRows(h)[0], "accidental");
    const option = panel.querySelector('.accidental-option[data-accidental="sagittalEvoPlus4"]');

    assert.equal(
      option.querySelector(".sym-glyph .glyph-ink").textContent,
      String.fromCharCode(0xe305, 0x0020, 0xe262),
      "a composed accidental previews whole, spacer included"
    );
    assert.equal(option.querySelector(".sym-label").textContent, "+4");

    // The same codepoint, a different category, a different label.
    assert.equal(
      panel.querySelector('.accidental-option[data-accidental="accidentalSharp"] .sym-label')
        .textContent,
      "Sharp"
    );
  });

  await t.test("writes the pick to the row and closes the panel in one click", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    pickAccidental(h, row, "raileanuMinusTwoThirdsTone");

    assert.equal(row.dataset.accidental, "raileanuMinusTwoThirdsTone");
    assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
  });

  await t.test("redraws the chart when an accidental is picked", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    pickAccidental(h, noteRows(h)[0], "accidentalSharp");

    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  await t.test("re-opens on the entry that was chosen, not on the first that draws it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    // U+E262 is an entry in three categories. Storing the entry id rather than
    // the glyph is what lets the picker know which one the user meant.
    pickAccidental(h, row, "sagittalEvoPlus6");
    const panel = openWell(h, row, "accidental");

    const selected = [...panel.querySelectorAll(".accidental-option.is-selected")];
    assert.deepEqual(
      selected.map((option) => option.dataset.accidental),
      ["sagittalEvoPlus6"]
    );
  });

  await t.test("clears the well when None is picked", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    pickAccidental(h, row, "accidentalSharp");
    pickAccidental(h, row, "");

    assert.equal(row.dataset.accidental, undefined);
    assert.ok(row.querySelector(".accidental-well").classList.contains("is-empty"));
  });

  for (const how of ["outside", "well"]) {
    await t.test(`commits nothing when the panel is dismissed by an ${how} click`, () => {
      const h = loadApp();
      t.after(() => h.close());
      const row = noteRows(h)[0];

      pickAccidental(h, row, "accidentalSharp");
      openWell(h, row, "accidental");
      dismissPicker(h, row, how, "accidental");

      assert.equal(row.dataset.accidental, "accidentalSharp", "a dismissal must change nothing");
      assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
    });
  }

  await t.test("keeps only one picker open at a time, across both notations", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    openWell(h, row, "accidental");
    setNotation(h, "byzantine");
    openWell(h, row, "fthora");

    assert.ok(!row.querySelector(".accidental-picker").classList.contains("open"));
    assert.ok(row.querySelector(".fthora-picker").classList.contains("open"));
  });
});

test("searching the accidentals picker", async (t) => {
  await t.test("shows the ten Sagittal categories entire for `sagittal`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "sagittal");
    const categories = visibleCategories(panel);

    assert.equal(categories.length, 10, `expected the ten Sagittal categories, got ${categories}`);
    for (const id of categories) {
      const declared = h.app.SMUFL_ACCIDENTAL_CATEGORIES.find((c) => c.id === id);
      assert.match(declared.title, /Sagittal/, `${id} has no Sagittal in its title`);
      assert.equal(
        panel.querySelectorAll(`.accidental-option[data-group-of="${id}"]:not([hidden])`).length,
        declared.accidentals.length,
        `a title match must show all of ${id}, not just some`
      );
    }
  });

  await t.test("shows the flats of every category that has one for `flat`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "flat");
    const visible = visibleOptions(panel);

    assert.equal(visible.length, 156, "every option whose label says flat, and no other");
    assert.equal(visibleCategories(panel).length, 18, "each under its own category heading");
    for (const option of visible) {
      assert.match(option.querySelector(".sym-label").textContent, /flat/i);
    }
    // The known, accepted consequence of labelling Răileanu by interval rather
    // than by SMuFL's description: the word "flat" never appears there.
    assert.equal(
      panel.querySelectorAll('.accidental-option[data-group-of="raileanuAccidentals"]:not([hidden])')
        .length,
      0
    );
  });

  await t.test("narrows to the quarter-tone flats for `quarter flat`", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "quarter flat");
    const visible = visibleOptions(panel);

    assert.equal(visible.length, 21, "both words must match, so this is a strict subset of `flat`");
    for (const option of visible) {
      const label = option.querySelector(".sym-label").textContent.toLowerCase();
      assert.ok(label.includes("quarter") && label.includes("flat"), label);
    }
  });

  await t.test("folds diacritics, so `ţurkish` reaches the Turkish category", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "ţurkish");

    assert.deepEqual(visibleCategories(panel), ["turkishFolkMusicAccidentals"]);
    assert.equal(visibleOptions(panel).length, 8, "a title match shows the category entire");
  });

  await t.test("finds Răileanu from ASCII, and by an interval name", () => {
    const h = loadApp();
    t.after(() => h.close());

    const byName = searchPicker(h, noteRows(h)[0], "accidental", "raileanu");
    assert.deepEqual(visibleCategories(byName), ["raileanuAccidentals"]);
    assert.equal(visibleOptions(byName).length, 11);

    // The interval names are the only labels Răileanu has, so this is the only
    // way into that category — and the same words reach three other categories
    // that happen to say the same thing in their own vocabulary, which is the
    // point of matching labels rather than ids.
    const byInterval = searchPicker(h, noteRows(h)[1], "accidental", "2/3 tone");
    assert.deepEqual(
      visibleOptions(byInterval)
        .filter((option) => option.dataset.groupOf === "raileanuAccidentals")
        .map((option) => option.dataset.accidental),
      ["raileanuMinusTwoThirdsTone", "raileanuPlusTwoThirdsTone"]
    );
    assert.equal(visibleOptions(byInterval).length, 6);
    assert.deepEqual(visibleCategories(byInterval).sort(), [
      "raileanuAccidentals",
      "spartanSagittalMultiShaftAccidentals",
      "wyschnegradskyAccidentals72Edo",
    ].sort());
  });

  await t.test("says No matches when nothing survives", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "zzz");

    assert.equal(visibleOptions(panel).length, 0);
    assert.equal(panel.querySelector(".sym-empty").hidden, false);
    assert.equal(
      panel.querySelectorAll('.accidental-option[data-accidental=""]:not([hidden])').length,
      1,
      "None survives every filter — it is the only way to clear the well"
    );
  });

  await t.test("shows the whole catalogue again when the query is cleared", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = searchPicker(h, noteRows(h)[0], "accidental", "sagittal");
    typeInto(h, panel.querySelector(".sym-search"), "");

    assert.equal(visibleOptions(panel).length, 505);
    assert.equal(panel.querySelector(".sym-empty").hidden, true);
  });

  await t.test("commits the row that is clicked after a filter, not the one above it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    const panel = searchPicker(h, row, "accidental", "koron");
    const option = visibleOptions(panel)[0];
    fireClick(h, option);

    assert.equal(row.dataset.accidental, "accidentalKoron");
  });
});
