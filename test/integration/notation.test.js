"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadApp,
  setNotation,
  noteRows,
  typeInto,
  setNoteCount,
  selectOption,
  openWell,
} = require("../helpers/harness.js");

test("the Notation setting", async (t) => {
  await t.test("starts as Generic, so nothing changes until the user opts in", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.equal(h.document.getElementById("notation").value, "generic");
    assert.equal(h.app.getNotation(), "generic");
  });

  await t.test("offers exactly Generic and Byzantine", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      [...h.document.getElementById("notation").options].map((o) => o.value),
      ["generic", "byzantine"]
    );
  });

  await t.test("sits in Settings, above Base Note", () => {
    const h = loadApp();
    t.after(() => h.close());

    const panel = h.el(".settings-panel");
    const rows = [...panel.querySelectorAll(".notation-row, .base-note-row")];
    assert.ok(rows[0].classList.contains("notation-row"), "Notation must come first");
  });

  await t.test("marks the editor when Byzantine is chosen, and unmarks it again", () => {
    const h = loadApp();
    t.after(() => h.close());

    setNotation(h, "byzantine");
    assert.ok(h.editor().classList.contains("notation-byzantine"));

    setNotation(h, "generic");
    assert.ok(!h.editor().classList.contains("notation-byzantine"));
  });

  await t.test("redraws the chart when the notation changes", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.ctx.reset();

    setNotation(h, "byzantine");
    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart was never redrawn");
  });

  // A browser restores a <select>'s value across a soft reload, so the control
  // can already say "byzantine" before a single listener has run — while
  // #editor comes back as the markup's Generic rows. The page starts from the
  // markup's defaults rather than following the restored control, so the two
  // can never disagree. See startup-reset.test.js for the rest of the reset.
  await t.test("goes back to Generic at startup when the control was restored to Byzantine", () => {
    const h = loadApp({ restored: { "#notation": "byzantine" } });
    t.after(() => h.close());

    assert.equal(h.document.getElementById("notation").value, "generic");
    assert.equal(h.app.getNotation(), "generic");
    assert.ok(
      !h.editor().classList.contains("notation-byzantine"),
      "the editor stayed marked Byzantine after the setting was reset to Generic"
    );
  });

  await t.test("leaves the editor unmarked at startup for the default notation", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.ok(!h.editor().classList.contains("notation-byzantine"));
  });
});

test("the symbol wells on a note row", async (t) => {
  await t.test("gives every note row an alteration, a fthora and a martyria well", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 4);

    for (const row of noteRows(h)) {
      for (const kind of ["alteration", "fthora", "martyria"]) {
        assert.ok(row.querySelector(`.${kind}-well`), `no ${kind} well`);
        assert.ok(row.querySelector(`.${kind}-picker`), `no ${kind} picker panel`);
      }
    }
  });

  await t.test("orders the wells alteration, fthora, martyria — the chart's draw order", () => {
    const h = loadApp();
    t.after(() => h.close());

    const row = noteRows(h)[0];
    const wells = [
      ...row.querySelectorAll(".alteration-well-wrapper, .fthora-well-wrapper, .martyria-well-wrapper"),
    ];
    assert.deepEqual(
      wells.map((w) => w.className),
      ["alteration-well-wrapper", "fthora-well-wrapper", "martyria-well-wrapper"]
    );
  });

  await t.test("keeps the name input on the row in both notations, so nothing is discarded", () => {
    const h = loadApp();
    t.after(() => h.close());

    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    setNotation(h, "byzantine");
    setNotation(h, "generic");

    assert.equal(noteRows(h)[0].querySelector(".note-name").value, "Pa", "the typed name was lost");
  });

  await t.test("gives a new note the wells too", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    setNoteCount(h, 3);

    const last = noteRows(h).at(-1);
    assert.ok(last.querySelector(".alteration-well"));
    assert.ok(last.querySelector(".fthora-well"));
    assert.ok(last.querySelector(".martyria-well"));
  });

  await t.test("keeps the wells when the scale mode changes and the rows are rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    for (const row of noteRows(h)) {
      assert.ok(row.querySelector(".martyria-well"), "the rebuild dropped the wells");
    }
  });
});

test("symbol state on a note row", async (t) => {
  await t.test("reads nothing from a fresh row", () => {
    const h = loadApp();
    t.after(() => h.close());

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.fthora, "");
    assert.equal(symbols.martyria, null);
  });

  await t.test("stores a martyria as data attributes and reads it back", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);

    assert.equal(row.dataset.martyriaNote, "midPa");
    assert.equal(row.dataset.martyriaGenus, "alpha");
    assert.equal(row.dataset.martyriaTicks, "0");
    assert.deepEqual({ ...h.app.readNoteSymbols(row).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 0,
    });
  });

  await t.test("defaults a martyria written with no genus to the 'none' sentinel", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "", 0);

    assert.equal(h.app.readNoteSymbols(row).martyria.genus, h.app.GENUS_NONE);
  });

  await t.test("clears a martyria completely, leaving no stale attributes", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 1);
    h.app.clearMartyria(row);

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(row.dataset.martyriaNote, undefined);
    assert.equal(row.dataset.martyriaGenus, undefined);
    assert.equal(row.dataset.martyriaTicks, undefined);
  });

  await t.test("treats writing an empty note as clearing the martyria", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 1);
    h.app.writeMartyria(row, "", "alpha", 1);

    assert.equal(h.app.readNoteSymbols(row).martyria, null);
    assert.equal(
      row.dataset.martyriaNote,
      undefined,
      "an empty note id must leave no attribute behind, not an empty one"
    );
    assert.equal(row.dataset.martyriaGenus, undefined);
    assert.equal(row.dataset.martyriaTicks, undefined);
  });

  await t.test("stores and clears an alteration independently of the other two wells", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const row = noteRows(h)[0];
    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");

    h.app.writeAlteration(row, "yfesis8");
    assert.equal(h.app.readNoteSymbols(row).alteration, "yfesis8");

    h.app.writeAlteration(row, "");
    assert.equal(h.app.readNoteSymbols(row).alteration, "");
    assert.equal(row.dataset.alteration, undefined);
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa", "the fthora must survive");
    assert.ok(h.app.readNoteSymbols(row).martyria, "and so must the martyria");
  });

  await t.test("stores and clears a fthora independently of the martyria", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");
    assert.equal(h.app.readNoteSymbols(row).fthora, "diatonicPa");

    h.app.writeFthora(row, "");
    assert.equal(h.app.readNoteSymbols(row).fthora, "");
    assert.equal(row.dataset.fthora, undefined);
    assert.ok(h.app.readNoteSymbols(row).martyria, "clearing the fthora must not touch the martyria");
  });
});

test("where a well puts its glyph", async (t) => {
  // Flexbox centres a glyph's line box and advance; the ink sits in neither's
  // middle. The well measures the face and offsets by what it finds, so these
  // tests are about that offset existing and tracking the glyph — not about
  // any particular number, which belongs to the font.
  const shiftOf = (well) => {
    const glyph = well.querySelector(".glyph-ink");
    return glyph ? parseFloat(glyph.style.getPropertyValue("--ink-dy")) : null;
  };

  await t.test("pushes a fthora down, because its ink sits above the baseline", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeFthora(row, "diatonicPa");

    const dy = shiftOf(row.querySelector(".fthora-well"));
    assert.ok(dy > 0, "a fthora floats high in its box unless pushed down; got dy=" + dy);
  });

  await t.test("offsets a fthora and a martyria differently", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeFthora(row, "diatonicPa");
    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);

    const fthora = shiftOf(row.querySelector(".fthora-well"));
    const martyria = shiftOf(row.querySelector(".martyria-well"));
    // Offsets are in em, so a quarter of one is a difference nobody could miss.
    assert.ok(
      Math.abs(fthora - martyria) > 0.25,
      "the two signs sit at different heights in the face, so one offset cannot " +
        "serve both; got " + fthora + "em and " + martyria + "em"
    );
  });

  await t.test("holds the letter still when a genus mark is hung under it", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);
    const bare = shiftOf(well);

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    const marked = shiftOf(well);

    assert.equal(
      marked, bare,
      "every martyria shares one baseline, so adding a mark must move the mark " +
        "into view without dragging the letter with it; got " + bare + " then " + marked
    );
  });

  await t.test("gives a low letter and its middle-octave twin the same offset", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    h.app.writeMartyria(row, "lowPa", h.app.GENUS_NONE, 0);
    const low = shiftOf(well);
    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);
    const mid = shiftOf(well);

    // The two letters are the same outline drawn at two heights. Centring each
    // on its own ink would put both in the middle of the well and make them
    // identical on screen; one shared offset is what lets the face's own
    // difference through, which is how a reader tells the registers apart.
    assert.equal(
      low, mid,
      "the register is the font's to show, not the well's to normalise away; got " +
        low + " and " + mid
    );
  });

  await t.test("states the offset in em, so it does not depend on the box's size", () => {
    // The offset used to be measured in pixels against `getComputedStyle`,
    // which reports nothing for a box that is not in the document yet — so a
    // well filled during a rebuild (the scale-mode switch does exactly that)
    // was measured against the wrong font and sat visibly wrong. In em there is
    // no size to get wrong: CSS resolves it against the box's real font size.
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeFthora(row, "diatonicPa");
    h.app.writeMartyria(row, "midPa", "alpha", 0);

    for (const selector of [".fthora-well", ".martyria-well"]) {
      const ink = row.querySelector(selector + " .glyph-ink");
      for (const property of ["--ink-dx", "--ink-dy"]) {
        assert.match(
          ink.style.getPropertyValue(property),
          /em$/,
          selector + " " + property + " should be an em offset, not a pixel one"
        );
      }
    }
  });

  await t.test("keeps both wells' offsets across a scale-mode switch and back", () => {
    // The reported bug: switching to Absolute rebuilt every note row and filled
    // its wells while the row was still detached, so the signs came back
    // misaligned — and stayed wrong on the way back.
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const offsets = () =>
      noteRows(h).map((row) =>
        [".fthora-well", ".martyria-well"].map((s) => {
          const ink = row.querySelector(s + " .glyph-ink");
          return ink ? ink.style.getPropertyValue("--ink-dy") : null;
        }).join("|")
      );

    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeMartyria(noteRows(h)[0], "lowPa", "alpha", 0);
    const before = offsets();

    selectOption(h, "scale-mode", "absolute");
    const inAbsolute = offsets();
    selectOption(h, "scale-mode", "relative");

    assert.deepEqual(inAbsolute, before, "switching to Absolute must not move the signs");
    assert.deepEqual(offsets(), before, "and switching back must not either");
  });

  await t.test("leaves an empty well with nothing to offset", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.clearMartyria(row);

    assert.equal(well.querySelector(".glyph-ink"), null, "a cleared well holds no glyph");
    assert.equal(well.textContent, "", "and shows nothing");
  });
});

test("what a well shows", async (t) => {
  await t.test("paints the resolved glyphs into the well button", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    h.app.writeFthora(row, "diatonicPa");

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0)
    );
    assert.equal(
      row.querySelector(".fthora-well").textContent,
      h.app.resolveFthoraGlyph("diatonicPa")
    );
  });

  await t.test("marks a well empty when it holds nothing, and filled when it does", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];
    const well = row.querySelector(".martyria-well");

    assert.ok(well.classList.contains("is-empty"), "a fresh well is empty");

    h.app.writeMartyria(row, "midPa", "alpha", 0);
    assert.ok(!well.classList.contains("is-empty"), "a written well is not empty");

    h.app.clearMartyria(row);
    assert.ok(well.classList.contains("is-empty"), "a cleared well is empty again");
    assert.equal(well.textContent, "", "a cleared well shows nothing");
  });

  await t.test("shows the letter alone when the genus is none", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeMartyria(row, "midPa", h.app.GENUS_NONE, 0);

    assert.equal(
      row.querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", h.app.GENUS_NONE, 0),
      "the well shows the bare letter"
    );
  });
});

test("symbols across an editor rebuild", async (t) => {
  await t.test("survive a notation switch, because nothing is rebuilt", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeAlteration(noteRows(h)[0], "yfesis4");

    setNotation(h, "generic");
    setNotation(h, "byzantine");

    const symbols = h.app.readNoteSymbols(noteRows(h)[0]);
    assert.equal(symbols.martyria.note, "midPa");
    assert.equal(symbols.fthora, "diatonicPa");
    assert.equal(symbols.alteration, "yfesis4");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 0),
      "the well was not repainted"
    );
  });

  await t.test("survive a scale-mode change, which rebuilds the rows but keeps names", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 1);
    h.app.writeFthora(noteRows(h)[1], "diatonicVou");
    h.app.writeAlteration(noteRows(h)[1], "diesis6");

    h.document.getElementById("scale-mode").value = "absolute";
    h.document.getElementById("scale-mode").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.deepEqual({ ...h.app.readNoteSymbols(noteRows(h)[0]).martyria }, {
      note: "midPa",
      genus: "alpha",
      ticks: 1,
    });
    assert.equal(h.app.readNoteSymbols(noteRows(h)[1]).fthora, "diatonicVou");
    assert.equal(h.app.readNoteSymbols(noteRows(h)[1]).alteration, "diesis6");
    assert.equal(
      noteRows(h)[0].querySelector(".martyria-well").textContent,
      h.app.resolveMartyriaGlyphs("midPa", "alpha", 1),
      "the rebuilt well was not repainted"
    );
    assert.equal(
      noteRows(h)[1].querySelector(".alteration-well").textContent,
      h.app.BYZ_DOM_GLYPH_CARRIER + h.app.resolveAlterationGlyph("diesis6"),
      "the rebuilt alteration well was not repainted"
    );
  });

  await t.test("are dropped by an interval-type change, which resets the scale", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    h.document.getElementById("interval-type").value = "cents";
    h.document.getElementById("interval-type").dispatchEvent(
      new h.window.Event("change", { bubbles: true })
    );

    assert.equal(
      h.app.readNoteSymbols(noteRows(h)[0]).martyria,
      null,
      "resetScaleToDefault drops symbols, exactly as it already drops names"
    );
  });
});

test("readScaleData and the note symbols", async (t) => {
  await t.test("reports no symbols for a row that has none", () => {
    const h = loadApp();
    t.after(() => h.close());

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "");
    assert.equal(notes[0].alteration, "");
    assert.equal(notes[0].martyria, null);
  });

  await t.test("reports the symbols each note row holds", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");
    h.app.writeAlteration(noteRows(h)[0], "diesis2");
    h.app.writeMartyria(noteRows(h)[1], "midVou", h.app.GENUS_NONE, 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].fthora, "diatonicPa");
    assert.equal(notes[0].alteration, "diesis2");
    assert.deepEqual({ ...notes[0].martyria }, { note: "midPa", genus: "alpha", ticks: 0 });
    assert.equal(notes[1].fthora, "");
    assert.equal(notes[1].alteration, "");
    assert.deepEqual({ ...notes[1].martyria }, { note: "midVou", genus: "none", ticks: 0 });
  });

  await t.test("keeps reporting the name alongside the symbols", () => {
    const h = loadApp();
    t.after(() => h.close());
    typeInto(h, noteRows(h)[0].querySelector(".note-name"), "Pa");
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].name, "Pa", "the name is still part of the reading");
    assert.equal(notes[0].martyria.note, "midPa");
  });

  await t.test("reports the same symbols in either notation", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeMartyria(noteRows(h)[0], "midPa", "alpha", 0);
    h.app.writeFthora(noteRows(h)[0], "diatonicPa");

    const generic = h.app.readScaleData().filter((item) => item.type === "note")[0];
    setNotation(h, "byzantine");
    const byzantine = h.app.readScaleData().filter((item) => item.type === "note")[0];

    assert.deepEqual({ ...byzantine.martyria }, { ...generic.martyria });
    assert.equal(
      byzantine.fthora,
      generic.fthora,
      "the fthora is read off the row too, so the notation must not change it either"
    );
    assert.equal(generic.fthora, "diatonicPa", "and it is the fthora that was actually set");
  });
});

test("waiting for the symbol faces", async (t) => {
  await t.test("preloads both faces the app draws symbols with", () => {
    const h = loadApp();
    t.after(() => h.close());

    assert.deepEqual(
      h.fontLoads.slice().sort(),
      [h.app.byzantineFont(h.app.BYZ_FONT_SIZE), h.app.smuflFont(h.app.SMUFL_FONT_SIZE)].sort(),
      "the faces preloaded must be the ones the chart draws with, or a font swap " +
        "preloads the wrong family and the first paint is blank boxes"
    );
  });

  await t.test("redraws once, not once per face, when both have settled", async () => {
    const h = loadApp();
    t.after(() => h.close());
    const before = h.ctx.callsOf("fillRect").length;

    await new Promise((resolve) => setImmediate(resolve));

    const drawn = h.ctx.callsOf("fillRect").length - before;
    assert.ok(drawn > 0, "the fallback-metrics paint was never replaced");
    assert.equal(
      drawn,
      1,
      `two faces settling must repaint once, not once each; the default scale is one box and ${drawn} were drawn`
    );
  });

  await t.test("boots without a FontFaceSet, because jsdom and old browsers have none", () => {
    const h = loadApp({ fonts: false });
    t.after(() => h.close());

    assert.deepEqual(h.jsdomErrors, [], "app.js threw when document.fonts was missing");
    assert.equal(h.app.loadSymbolFonts(), null);
  });

  // A vendored font file can go missing or arrive corrupt. The chart then
  // measures and draws with fallback metrics, which is wrong in both content
  // and layout — so it must at least keep working, and it must say so.
  await t.test("keeps drawing when the face fails to load", async () => {
    const h = loadApp({ fonts: "reject" });
    t.after(() => h.close());
    setNotation(h, "byzantine");

    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(h.jsdomErrors, [], "the rejection escaped as an unhandled error");
    assert.ok(h.ctx.callsOf("fillRect").length > 0, "the chart must still be drawn");
  });

  // Switching notation hides one half of every note row. A picker left open in
  // the half that just went away is still open, still marked on its row, and
  // comes back on screen the moment the reader switches back.
  await t.test("closes an open picker, whose well the switch just hid", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "accidental");
    assert.equal(panel.classList.contains("open"), true, "the picker never opened");

    setNotation(h, "byzantine");

    assert.equal(panel.classList.contains("open"), false, "the panel outlived the well it belongs to");
    assert.equal(row.classList.contains("picker-open"), false, "the row still says a picker is open");
  });

  await t.test("closes a Byzantine picker on the way back to Generic", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    const row = noteRows(h)[0];

    const panel = openWell(h, row, "fthora");
    assert.equal(panel.classList.contains("open"), true, "the picker never opened");

    setNotation(h, "generic");

    assert.equal(panel.classList.contains("open"), false, "the panel outlived the well it belongs to");
  });

  // The faces can load and the repaint still fail — a FontFaceSet whose `ready`
  // rejects is the plainest way in. Nothing awaits loadSymbolFonts() at the call
  // site, so without a handler of its own the failure is an unhandled rejection
  // and the reader is told nothing at all.
  await t.test("warns when the repaint after the fonts settle fails", async () => {
    const h = loadApp({ fonts: "ready-reject" });
    t.after(() => h.close());

    await new Promise((resolve) => setImmediate(resolve));

    assert.ok(
      h.consoleWarnings.some((w) => /repaint/i.test(w)),
      `the tail of the font chain must not fail silently, got ${JSON.stringify(h.consoleWarnings)}`
    );
  });

  await t.test("warns once per face that fails, naming it", async () => {
    const h = loadApp({ fonts: "reject" });
    t.after(() => h.close());

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(h.consoleWarnings.length, 2, "a silent failure leaves no way to find the cause");
    assert.ok(
      h.consoleWarnings.some((w) => /Neanes/.test(w)) &&
        h.consoleWarnings.some((w) => /Bravura Text/.test(w)),
      `each warning must name its own face, got ${h.consoleWarnings}`
    );
  });

  await t.test("re-measures on every render, so no pre-font measurement survives", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNotation(h, "byzantine");
    h.app.writeMartyria(noteRows(h)[0], "midPa", h.app.GENUS_NONE, 0);
    h.app.render();
    const narrow = parseFloat(h.canvas().style.width);

    h.app.writeMartyria(noteRows(h)[0], "highKe", "softChromaticDi", 1);
    h.app.render();

    assert.ok(
      parseFloat(h.canvas().style.width) > narrow,
      "a cached measurement would have kept the canvas at its old width"
    );
  });
});

test("the accidental well", async (t) => {
  await t.test("sits on every note row, before the note name", () => {
    const h = loadApp();
    t.after(() => h.close());

    for (const row of noteRows(h)) {
      const wrapper = row.querySelector(".accidental-well-wrapper");
      assert.ok(wrapper, "a note row with no accidental well");
      assert.ok(wrapper.querySelector(".accidental-well"), "the wrapper holds no well");
      assert.ok(wrapper.querySelector(".accidental-picker"), "the wrapper holds no panel");
      assert.equal(
        wrapper.compareDocumentPosition(row.querySelector(".note-name")) &
          h.window.Node.DOCUMENT_POSITION_FOLLOWING,
        h.window.Node.DOCUMENT_POSITION_FOLLOWING,
        "the accidental is drawn left of the name, so it is emitted before it"
      );
    }
  });

  await t.test("orders the row accidental, name, then the Byzantine three", () => {
    const h = loadApp();
    t.after(() => h.close());

    const row = noteRows(h)[0];
    const marks = [
      ...row.querySelectorAll(
        ".accidental-well-wrapper, .note-name, .alteration-well-wrapper," +
          " .fthora-well-wrapper, .martyria-well-wrapper"
      ),
    ];
    assert.deepEqual(
      marks.map((el) => el.className),
      [
        "accidental-well-wrapper",
        "note-name",
        "alteration-well-wrapper",
        "fthora-well-wrapper",
        "martyria-well-wrapper",
      ],
      "every row carries both notations' controls always; CSS decides which half shows"
    );
  });

  await t.test("gives a new note the accidental well too", () => {
    const h = loadApp();
    t.after(() => h.close());
    setNoteCount(h, 3);

    assert.ok(noteRows(h).at(-1).querySelector(".accidental-well"));
  });

  await t.test("stores an accidental as a data attribute and reads it back", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "raileanuPlusOneQuarterTone");

    assert.equal(row.dataset.accidental, "raileanuPlusOneQuarterTone");
    assert.equal(h.app.readNoteSymbols(row).accidental, "raileanuPlusOneQuarterTone");
  });

  await t.test("clears the well without disturbing the Byzantine three", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    h.app.writeAlteration(row, "diesis2");
    h.app.writeNoteSign(row, "accidental", "");

    assert.equal(row.dataset.accidental, undefined, "a stale attribute would be read back as set");
    assert.equal(row.dataset.alteration, "diesis2", "clearing one well must not touch another");
  });

  await t.test("survives a notation switch, so nothing is discarded", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    setNotation(h, "byzantine");
    setNotation(h, "generic");

    assert.equal(row.dataset.accidental, "accidentalSharp");
  });

  await t.test("survives the rebuild a scale-mode change causes", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    selectOption(h, "scale-mode", "absolute");

    assert.equal(noteRows(h)[0].dataset.accidental, "accidentalSharp");
  });

  await t.test("draws the accidental's glyphs in the well", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "sagittalEvoPlus4");

    const well = row.querySelector(".accidental-well");
    assert.equal(
      well.querySelector(".glyph-ink").textContent,
      String.fromCharCode(0xe305, 0x0020, 0xe262),
      "a composed accidental goes into the DOM whole, spacer included"
    );
    assert.ok(!well.classList.contains("is-empty"));
  });

  await t.test("marks the well empty again when it is cleared", () => {
    const h = loadApp();
    t.after(() => h.close());
    const row = noteRows(h)[0];

    h.app.writeNoteSign(row, "accidental", "accidentalSharp");
    h.app.writeNoteSign(row, "accidental", "");

    assert.ok(row.querySelector(".accidental-well").classList.contains("is-empty"));
  });

  // The well measures its glyph against the face it is drawn in. On an engine
  // whose measureText unions the ink with the advance rect, inkBox falls back
  // to drawing the sign on a scratch canvas and scanning it — and that draw
  // records the font, which is the one place the descriptor's face is visible
  // from a test.
  await t.test("measures its glyph in Bravura Text, not in Neanes", () => {
    const h = loadApp({ inkMetrics: "union" });
    t.after(() => h.close());

    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    const scanned = h.app.inkScanCanvas.getContext("2d").callsOf("fillText");
    assert.ok(scanned.length > 0, "the ink was never scanned, so nothing was measured");
    assert.equal(scanned.at(-1).state.font, h.app.smuflFont());
  });

  await t.test("carries the accidental on the note item readScaleData produces", () => {
    const h = loadApp();
    t.after(() => h.close());
    h.app.writeNoteSign(noteRows(h)[0], "accidental", "accidentalSharp");

    const notes = h.app.readScaleData().filter((item) => item.type === "note");
    assert.equal(notes[0].accidental, "accidentalSharp");
    assert.equal(notes[1].accidental, "", "an empty well reads back as the empty string");
  });
});

test("the notation classes on the editor", async (t) => {
  await t.test("marks the editor Generic by default, and swaps the class on a switch", () => {
    const h = loadApp();
    t.after(() => h.close());

    // Both classes exist because both halves of the row need one: Generic shows
    // the accidental well and the name box, Byzantine the other three.
    assert.ok(h.editor().classList.contains("notation-generic"));
    assert.ok(!h.editor().classList.contains("notation-byzantine"));

    setNotation(h, "byzantine");
    assert.ok(h.editor().classList.contains("notation-byzantine"));
    assert.ok(!h.editor().classList.contains("notation-generic"));
  });
});
