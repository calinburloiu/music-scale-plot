# How a martyria is composed — a beginner's guide

Companion to `martyria-demo.html`. That page draws every martyria the Neanes font can make;
this file explains *why it works*, starting from zero. No prior typography knowledge assumed.

---

## 1. What we are trying to draw

A **martyria** (Greek μαρτυρία, "witness"; Romanian *mărturie*) is the little signpost in a
psaltic score that tells the singer which degree of the scale they are on and which genus
(diatonic, chromatic, enharmonic) that degree currently sits in. The Romanian textbook
*Cursuri de Teoria Muzicii Psaltice* (p. 80) defines it exactly this way:

> A martyria is conceived as a graphic symbol made of two superposed signs:
> — one above, representing the initial of a particular note on the musical scale;
> — the other below, representing the placement of that note in one of the nodes of a genus
> (diatonic, chromatic or enharmonic).

So a martyria is **two marks, one stacked on the other**:

```
        Π          ← the note letter   (Πα / Pa, a stylised Greek initial)
        ᶃ          ← the genus sign    (here: the diatonic sign for Pa)
```

The obvious way to draw that on a computer is to place two images by hand: measure the first,
compute an offset, draw the second. That is fiddly, it has to be redone for every font, and it
breaks the moment anyone changes the type size.

The much better way is to let **the font itself** do the stacking. That is what this document is
about.

---

## 2. Vocabulary you need first

**Codepoint.** A number that identifies a character. `U+0041` is the letter `A`. Text is a
sequence of codepoints.

**Glyph.** The actual drawing a font supplies for a codepoint. `A`, *A*, **A** are three glyphs
for one codepoint.

**Private Use Area (PUA).** A block of codepoints — `U+E000` to `U+F8FF` — that Unicode
deliberately leaves undefined, so private agreements can use them. Nobody outside that agreement
knows what they mean. SBMuFL is such an agreement: it says "`U+E139` is `martyriaNotePa`". Paste
`U+E139` into a document using an ordinary font and you get a blank box, because the character
means nothing on its own — it only means something *together with* an SBMuFL font.

**Advance width.** How far the drawing cursor moves right after a glyph is painted. Normal
letters have a positive advance. A glyph with an advance of **zero** paints and then leaves the
cursor exactly where it was — so whatever comes next lands on top of it. This is how accents work
in ordinary text, and it is the first half of our trick.

**Base and mark.** A **base glyph** is a normal, space-occupying glyph (a letter). A **mark
glyph** is a zero-advance decoration meant to be attached to a base (an accent, a dot, a
cedilla). In our case: the note letter is the base, the genus sign is the mark.

**Shaping.** Turning a string of codepoints into a list of positioned glyphs. The engine that does
this in every modern browser is **HarfBuzz**. Shaping is where the font's own layout rules get
applied — which brings us to the interesting part.

---

## 3. OpenType layout in one paragraph

An OpenType font is not just outlines; it also carries *rules*. They live in two tables:

- **`GSUB`** — glyph **substitution**. "Replace `f` + `i` with the ligature `ﬁ`."
- **`GPOS`** — glyph **positioning**. "Move this glyph 40 units left and 200 up relative to that
  one."

Each table holds a list of **lookups**, and each lookup has a **type number** that says what kind
of rule it is. `GPOS` has nine types. Type 1 is single adjustment, type 2 is kerning
(pair adjustment), and **type 4 is the one we care about**.

---

## 4. GPOS Lookup Type 4 — Mark-to-Base Attachment

### The problem it solves

Suppose a font wants to put an acute accent on a lowercase `a` to make `á`. The accent must sit
centred over the bowl of the `a`. Now do the same on `A` — the accent has to be higher and
slightly further right. And on `i`, `o`, `w`… Every base needs a different position, and a
type-1 "shift by a fixed amount" rule cannot express that.

### The idea: anchors

Mark-to-base positioning inverts the problem. Instead of storing offsets, the font stores an
**anchor point** — a single (x, y) coordinate — on each glyph:

- Each **base** glyph gets an anchor saying *"if you are attaching a mark here, put it at this
  point."*
- Each **mark** glyph gets an anchor saying *"this is the point on me that should land on the
  base's point."*

The shaper then does one subtraction. It translates the mark so that the mark's anchor coincides
with the base's anchor. That's the whole mechanism. Two points, one alignment.

```
   base "a"                mark "´"              result
   with anchor ●           with anchor ○

     ___                        ○                    ´
    / _ |                      /                    ___
   | (_||          +          /          =         / _ |
    \__,|                                         | (_||
       ●                                           \__,|
```

Because each base carries its *own* anchor, the accent automatically sits higher on `A` than on
`a`, with no per-pair rules.

### What the subtable actually contains

A Mark-to-Base subtable (`GPOS` lookup type 4, `MarkBasePos`) has four parts:

| Part | What it holds |
|---|---|
| **Mark coverage** | The set of mark glyphs this subtable handles. |
| **Base coverage** | The set of base glyphs this subtable handles. |
| **Mark array** | For each mark: its anchor point, plus a **mark class** number. |
| **Base array** | For each base: **one anchor per mark class**. |

**Mark classes** are the reason a base can have more than one attachment point. A Latin font
typically has a class for "goes above" and a class for "goes below", so `c` can hold an anchor at
the top for the circumflex and another at the bottom for the cedilla. A base entry is therefore a
*row* of anchors, one per class, and the mark's class selects which one is used.

Two rules govern when it fires:

1. The mark must be **classified as a mark** in the font's `GDEF` table. Marks are also normally
   given zero advance, so the base's own width is what the line-layout uses.
2. Attachment happens between a mark and **the closest preceding base glyph**. That is why the
   order in the string matters: **base first, then mark.**

If a mark and a base are both in coverage but the base has no anchor for that mark's class, no
attachment occurs — the mark just paints at the current pen position, which (with zero advance)
means right on top of the base. You will see that failure mode deliberately reproduced in
section 2 of the demo page.

> Sibling lookup types worth knowing: **type 5** is mark-to-ligature (attaching to one component
> of a ligature) and **type 6** is mark-to-mark (stacking a second accent on the first). SBMuFL
> fonts ship both `mark` (types 4/5) and `mkmk` (type 6) features.

### Further reading

- [Microsoft OpenType spec — GPOS, Lookup Type 4: MarkBasePos](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-4-mark-to-base-attachment-positioning-subtable)
  — the normative definition, including the binary layout of every table above.
- [Microsoft OpenType spec — GDEF](https://learn.microsoft.com/en-us/typography/opentype/spec/gdef)
  — where a glyph is declared to *be* a mark.
- [HarfBuzz — "What is shaping?"](https://harfbuzz.github.io/what-is-harfbuzz.html)
  — the engine that applies these rules in your browser.
- [OpenType Cookbook — positioning](https://opentypecookbook.com/positioning/)
  — the same ideas in plain language, from the font designer's side.

---

## 5. How SBMuFL uses this for martyries

[SBMuFL](https://neanes.github.io/sbmufl/) — *Standard Byzantine Music Font Layout* — is the
Byzantine analogue of SMuFL. It assigns ~387 Byzantine glyphs to fixed PUA codepoints so that any
compliant font is interchangeable with any other. Its own README states the intent:

> All characters would be mapped into the Private Use Area of the Unicode Basic Multilingual Plane
> and characters would be positioned using features of modern font technologies such as
> **mark-to-base positioning**.

For martyries it defines exactly the base/mark split described above.

### The bases — note letters

Twenty-one glyphs: seven degrees × three octave registers. Normal advance width.

| Degree | Low octave | Middle | High |
|---|---|---|---|
| Ζω (Zo) | `U+E130` | `U+E137` | `U+E13E` |
| Νη (Ni) | `U+E131` | `U+E138` | `U+E13F` |
| Πα (Pa) | `U+E132` | `U+E139` | `U+E140` |
| Βου (Vou) | `U+E133` | `U+E13A` | `U+E141` |
| Γα (Ga) | `U+E134` | `U+E13B` | `U+E142` |
| Δι (Di) | `U+E135` | `U+E13C` | `U+E143` |
| Κε (Ke) | `U+E136` | `U+E13D` | `U+E144` |

The three blocks are contiguous and in the same degree order, so a codepoint is just
`blockBase + degreeIndex`.

### The marks — genus (ichos) signs

Twelve signs, supplied in **two parallel sets** — one drawn to sit above the letter, one below.
Both sets are zero-advance marks.

| Sign | `…Below` | `…Above` |
|---|---|---|
| Zo (diatonic Ζω) | `U+E150` | `U+E170` |
| Δ delta (tetartos) | `U+E151` | `U+E171` |
| Α alpha (protos) | `U+E152` | `U+E172` |
| legetos | `U+E153` | `U+E173` |
| nana (tritos / enharmonic) | `U+E154` | `U+E174` |
| Δ dotted | `U+E155` | `U+E175` |
| Α dotted | `U+E156` | `U+E176` |
| hard chromatic Πα | `U+E157` | `U+E177` |
| hard chromatic Δι | `U+E158` | `U+E178` |
| soft chromatic Δι | `U+E159` | `U+E179` |
| soft chromatic Κε | `U+E15A` | `U+E17A` |
| zygos | `U+E15B` | `U+E17B` |

Same order in both blocks, so `above = below + 0x20`.

Note that the **first seven signs are in the same order as the seven degrees**. That is not a
coincidence: each degree's own diatonic sign is the one at the matching index — Zo→Zo, Ni→delta,
Pa→alpha, Vou→legetos, Ga→nana, Di→delta-dotted, Ke→alpha-dotted. That is precisely the diatonic
list the textbook prints on p. 80.

### The anchor names

SBMuFL's per-font metadata (`fonts/neanes.metadata.json`) publishes every anchor. The two that
concern us are called `martyriaTop` and `martyriaBottom`. Sampled from Neanes:

```json
"martyriaNotePa":     { "martyriaBottom": [0.520, -0.047], "...": "..." },
"martyriaNoteZoLow":  { "martyriaTop":    [0.547, -0.040], "...": "..." },
"martyriaAlphaBelow": { "martyriaBottom": [0.002,  0.328] },
"martyriaAlphaAbove": { "martyriaTop":    [0.002, -0.192] }
```

(Coordinates are in **em** units — fractions of the type size — which is why nothing here depends
on the font size you render at.)

Read it as: `martyriaNotePa` offers an attachment point at its bottom edge; `martyriaAlphaBelow`
declares the point on itself that should land there. Align the two and the alpha sits centred
under the Pa. That is the type-4 lookup at work.

### The rule that decides top vs. bottom

The issue notes that the note letter may appear either above or below the genus sign. In SBMuFL
that is **not a free choice per martyria** — each base glyph carries only *one* of the two
anchors, and which one depends on the octave register:

| Register | Anchor on the letter | Mark set it accepts | Result |
|---|---|---|---|
| **Low** (`…Low`, `U+E130`) | `martyriaTop` | `…Above` (`U+E170`) | sign on top, **letter underneath** |
| **Middle** (`U+E137`) | `martyriaBottom` | `…Below` (`U+E150`) | **letter on top**, sign underneath |
| **High** (`…High`, `U+E13E`) | `martyriaBottom` | `…Below` (`U+E150`) | **letter on top**, sign underneath |

This lines up with the textbook exactly. Its p. 83 table gives Zo and Ni two forms each,
"*de jos*" (lower) and "*de sus*" (upper) — and the lower ones are drawn with the letter
underneath, which is the low-register `martyriaTop` case.

Pair a middle-octave letter with an `…Above` mark and nothing attaches: the base has no
`martyriaTop` anchor for that mark class, so the mark falls at the pen position and collides.
The demo page shows both pairings side by side so you can see the rule rather than take it on
trust.

---

## 6. Actually drawing one

Because the font does the work, composing a martyria is **string concatenation**:

```js
const paDiatonic = "\uE139\uE152";   // martyriaNotePa + martyriaAlphaBelow
const zoLowNana  = "\uE130\uE174";   // martyriaNoteZoLow + martyriaNanaAbove
```

Base first, mark second — see §4. Then render it as one run:

```html
<span style="font-family: Neanes">&#xE139;&#xE152;</span>
```

```js
ctx.font = '48px "Neanes"';
ctx.fillText(paDiatonic, x, y);          // one call; GPOS stacks and centres
```

`<canvas>` text goes through the same HarfBuzz shaping path as HTML, so this works identically
there — which matters for this project, since the chart is drawn on a canvas.

Three practical points:

1. **Wait for the font.** Webfonts load asynchronously, and PUA codepoints have *no* fallback
   glyph. Draw before the face arrives and you get blank boxes, silently. Use
   `await document.fonts.load('48px "Neanes"')` (or `document.fonts.ready`) and re-render.
2. **Do not hard-code vertical offsets.** The metrics differ between faces — in Almouzios the
   Pa letter sits *below* the baseline, in Neanes *above* it. Measure with `ctx.measureText()`
   and place from `actualBoundingBoxAscent` / `actualBoundingBoxDescent` instead. Then swapping
   face is a one-line change.
3. **There is a fallback path.** If you ever render somewhere without OpenType shaping, SBMuFL's
   per-font metadata publishes the same anchor coordinates as plain JSON (§5), so you can do the
   subtraction yourself. Nice to know it exists; you will not need it in a browser.

Optional extra: `U+E145` `martyriaTick` is the small vertical tick conventionally set before a
martyria. It is an ordinary spacing glyph, not a mark, so just prepend it:
`"\uE145\uE139\uE152"`. The demo page has a checkbox for it.

---

## 7. Try it

Open `martyria-demo.html` in a browser (it fetches the fonts from jsDelivr, so it needs a network
connection the first time). It shows:

1. the two halves separately — 21 note letters, 12 + 12 genus signs;
2. the top/bottom rule, with the mismatched pairings marked in pink;
3. the textbook's martyries from pp. 80 and 83;
4. all 21 × 12 = **252** combinations, each with its glyph names and codepoints.

A font selector switches between Neanes, NeanesEngraving, NeanesStathisSeries and Almouzios — all
four are SBMuFL-compliant, so the same strings render in all of them with no remapping. That is
the entire point of the standard.

---

## Sources

- [SBMuFL specification](https://neanes.github.io/sbmufl/) ·
  [glyphnames.json](https://github.com/neanes/sbmufl/blob/master/metadata/glyphnames.json) ·
  [font-specific metadata (anchors)](https://neanes.github.io/sbmufl/#/font-metadata)
- [OpenType GPOS — Lookup Type 4](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-4-mark-to-base-attachment-positioning-subtable)
- [HarfBuzz documentation](https://harfbuzz.github.io/)
- [OpenType Cookbook](https://opentypecookbook.com/)
- *Cursuri de Teoria Muzicii Psaltice* (Romanian psaltic theory course), pp. 80 and 83 —
  the scanned pages supplied with issue #2.
- `FONTS.md` in this directory — font choice for issue #2, and the comparison behind it;
  `SBMUFL-FONTS.md` next to it for the SBMuFL codepoints, licensing and hosting.
