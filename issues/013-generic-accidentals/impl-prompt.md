Your task is to resolve issue #13; read it.

Use the already shipped Bravura Text font and make sure the licensing rules are followed. Read `issues/013-generic-accidentals/2026-09-01-smufl-accidentals-research.md` and `issues/013-generic-accidentals/accidentals-demo.html` for more information on how the font should be used and how mixed symbols are composed. Use ½ staff space between two glyphs as documented in the HTML in section "2 · Composing an Evo pair: the spacing question".

The new Accidental well should use a flat and a sharp as icon for an empty slot.

The new Accidentals picker should use be similar with the Alterations and Fthores pickers from the Byzantine Notation mode. Make sure they also use the same infrastructure in the code to respect the DRY principle. Add a search in the picker that matches both symbols from the list and their category: searching for "sagittal" will show all Sagittal categories; searching for "flat" will show all flats from all categories. When displaying search results, also show matching categories along with list elements. Since Accidentals, Alterations and Fthores pickers all use the same infrastructure, all will benefit from the new search out of the box. The Martyries picker does not have a search.

The Accidentals categories mainly contain the categories from the SMuFL documentation. Follow the links from this page to see the accidentals from SMuFL fonts and their Unicode code points: https://smufl.formats.music/latest/tables/index.html . But I would like a few special extra categories:
- "Răileanu accidentals" category: with the special accidentals used by my client for this app which are used for Byzantine and Near/Middle Eastern (Maqam) music. The accidentals mostly borrow Arel-Ezgi-Uzdilek accidentals with a few extra additions as follows:
    * -1/4 tone: U+E443
    * -2/4 tone: U+E442
    * -3/4 tone: U+E440
    * -1/3 tone: U+E441
    * -2/3 tone: U+E2F5
    * +1/4 tone: U+E444
    * +2/4 tone: U+E445
    * +3/4 tone: U+E446
    * +1/3 tone: U+E274
    * +2/3 tone: U+E283
- "Mixed-symbol Sagittal accidentals (72-EDO)": Sagital Evo(lutionary) or mixed-symbol flavor retains existing sharp and flat symbols and uses only the new single-shaft Sagittal symbols in combination with these. Here are the number of divisions (72-EDO) and their code point sequence:
    * -6: U+E260
    * -5: U+E302, U+0020, U+E260
    * -4: U+E304, U+0020, U+E260
    * -3: U+E30B
    * -2: U+E305
    * -1: U+E303
    * +1: U+E302
    * +2: U+E304
    * +3: U+E30A
    * +4: U+E305, U+0020, U+E262
    * +5: U+E303, U+0020, U+E262
    * +6: U+E262

The order in which the categories appear match that from the SMuFL web site with a few promoted categories to appear at the beginning of the list including new special categories:
- Standard accidentals (12-EDO)
- Răileanu accidentals
- Arel-Ezgi-Uzdilek (AEU) accidentals
- Turkish folk music accidentals
- Arabic accidentals
- Persian accidentals
- Mixed-symbol Sagittal accidentals (72-EDO)
- Spartan Sagittal single-shaft accidentals
- Spartan Sagittal multi-shaft accidentals
- Athenian Sagittal extension (medium precision) accidentals
- Trojan Sagittal extension (12-EDO relative) accidentals
- Promethean Sagittal extension (high precision) single-shaft accidentals
- Promethean Sagittal extension (high precision) multi-shaft accidentals
- Herculean Sagittal extension (very high precision) accidental diacritics
- Olympian Sagittal extension (extreme precision) accidental diacritics
- Magrathean Sagittal extension (insane precision) accidental diacritics
- Gould arrow quartertone accidentals (24-EDO)
- Extended Stein-Zimmermann accidentals
- Sims accidentals (72-EDO)
- Johnston accidentals (just intonation)
- Extended Helmholtz-Ellis accidentals (just intonation)
- Extended Helmholtz-Ellis accidentals (just intonation) supplement
- Wyschnegradsky accidentals (72-EDO)
- Medieval and Renaissance accidentals
- Stockhausen accidentals (24-EDO)
- Other accidentals
- Other accidentals supplement

Also improve the UI alignment by swapping the order of `interval-label` and `color-swatch`, `color-swatch` on the left and `interval-label` on the right. Make `color-swatch` the same size as a well to align vertically with the well above. `interval-label` will align exactly with two wells (Fhtores and Martyria) in Byzantine Notation and with the `note-name` text box in Generic Notation mode.
