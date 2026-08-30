# `FTHORES_COMPATIBILITY` — investigation and proposed mapping

Companion to `MARTYRIA_COMPATIBILITY` in `byzantine.js`: which fthores belong on
which note of the ladder, and what the fthora picker should offer above its
separator.

Also settles the second gap raised with it: the **signs of alteration** are
missing from the fthora well and picker.

**Status:** research notes for implementation. Nothing here has been coded yet.

---

## 0. Sources

Everything below is checked against first-party sources, not from memory.

| Source | Pinned at |
|---|---|
| [`neanes/neanes`](https://github.com/neanes/neanes) — the scorewriter's own model | `799311c3300aab101505dcff1cca6b2738a3688e` (2026-08-27) |
| [`neanes/sbmufl`](https://github.com/neanes/sbmufl) — the font spec, glyph names, metadata | `a33ee82116d74519190b39c9cf793d8125ce1440` (2026-08-27) |
| `fonts/Neanes.woff2` in this repo | v1.0.9, commit `9519b83` — glyph coverage and advances verified directly with `fontTools` |

The files that carry the answers:

- `src/models/Neumes.ts` — the `Fthora` and `Accidental` enums.
- `src/services/NeumeMappingService.ts` — enum → SBMuFL glyph name.
- `src/services/LayoutService.ts` — `fthoraIsValid`, `getScaleFromFthora`,
  `getShift`, `getRootSign`, and the root-sign tables.
- `src/components/properties/PropertiesNeume.vue` — the **Fthora Note**
  dropdown, which is the closest thing that exists to a published
  fthora→note compatibility list.
- `src/services/audio/PlaybackService.ts` — how each scale is built
  (`constructTetrachordScale` vs `constructDiapasonScale`) and the moria values
  of the accidentals.
- `src/i18n/{en,el,ro}/model.json` — the display names, including the Romanian
  ones the proposal uses.

---

## 1. Three different names for the same sign

This is the first trap, and it is worth writing down before anything else,
because a reader who moves between the SBMuFL tables and the Neanes source will
otherwise conclude the two disagree.

| SBMuFL glyph name | Neanes `Fthora` member | Neanes UI label (en / el / ro) |
|---|---|---|
| `fthoraDiatonicDi` | `DiatonicThi` | Diatonic Di / Διατονικό Δι / Diatonic Di |
| `fthoraHardChromaticDi` | `HardChromaticThi` | Hard Chromatic Di |
| `fthoraSoftChromaticDi` | `SoftChromaticThi` | Soft Chromatic Di |
| **`fthoraSoftChromaticKe`** | **`SoftChromaticPa`** | **Soft Chromatic Ga** |
| `fthoraEnharmonic` | `Enharmonic` | Enharmonic / Εναρμόνιο / **Agem** |
| `chroaZygos` | `Zygos` | Zygos / Ζυγός / Muștar |
| `chroaKliton` | `Kliton` | Kliton / Κλιτόν / Nisabur |
| `chroaSpathi` | `Spathi` | Spathi / Σπάθη / Hisar |
| `diesisGenikiAbove` / `…Below` | `GeneralSharp_Top` / `_Bottom` | General Sharp / Γενική Δίεση / Diez general |
| `yfesisGenikiAbove` / `…Below` | `GeneralFlat_Top` / `_Bottom` | General Flat / Γενική Ύφεση / Ifes general |

Two things to take from this:

- **`Thi` is `Δι`.** A transliteration difference, nothing more.
- **The second soft-chromatic fthora is named after three different notes** —
  `Ke` by the font, `Pa` by the model, `Ga` by the UI. Not a bug in any of
  them: the sign is not "the fthora of one note", it is the fthora of one
  *phase* of the soft chromatic scale, and Πα, Γα, Κε and Νη′ are all in that
  phase (§3). The same holds for its martyria root sign, which Neanes calls
  `SoftChromaticPaRootSign` and maps to the glyph `martyriaSoftChromaticKe`.

  **Consequence for us:** the app's existing id `softChromaticKe` is fine and
  needs no rename, but a picker label reading only "Soft chromatic Κε" is
  misleading. See §7.

---

## 2. What Neanes actually enforces

Neanes has no single "compatibility table". The knowledge is spread over four
places, and together they *are* the answer.

### 2.1 Hard restrictions — `LayoutService.fthoraIsValid`

A fthora placed on a note that fails this check is ignored outright (unless the
score sets `noFthoraRestrictions`). Paraphrased:

| Fthora | May only be placed on |
|---|---|
| `Zygos` | Δι |
| `Kliton` | Δι |
| `Spathi` | Κε **or Γα** |
| `Enharmonic` (acem) | Ζω, Γα, Ζω′, **Βου**, Βου′ |
| `GeneralSharp` (diesis geniki) | Γα |
| `GeneralFlat` (yfesis geniki) | Κε |

Diatonic and chromatic fthores are **not** restricted here — placing one off
its own note is legitimate (it is a transposition; see `getShift`), so those
are governed by convention rather than by a rule.

`getScaleFromFthora` corroborates the enharmonic list: it resolves an
`Enharmonic` fthora to `EnharmonicGa`, `EnharmonicVou`, `EnharmonicVouHigh`,
`EnharmonicZo` or `EnharmonicZoHigh` depending on the note it sits on, and to
`SpathiGa` vs `Spathi` for the spathi chroa.

### 2.2 The Fthora Note dropdown — `PropertiesNeume.vue`

Neanes' own guide says: *"Chromatic fthoræ are sometimes ambiguous. Use the
`Fthora Note` dropdown in the Properties pane to specify the correct note."*
The dropdown enumerates the notes each chromatic fthora can stand for, which is
precisely the list we want:

| Fthora (glyph name) | Notes offered |
|---|---|
| `fthoraSoftChromaticDi` | Ζω′, Δι, Βου, Νη |
| `fthoraSoftChromaticKe` | Νη′, Κε, Γα, Πα |
| `fthoraHardChromaticDi` | Ζω′, Δι, Βου |
| `fthoraHardChromaticPa` | Νη′, Κε, Γα, Πα |

Read as note values (Πα = 0), those are `{-1, 1, 3, 5}` and `{0, 2, 4, 6}` —
the odd and the even degrees. **The proposal's instinct was right**: the two
chromatic fthores of a genus split the octave by parity, and the "Δι" one takes
Νη, Βου, Δι and Ζω′ while the "Κε"/"Πα" one takes Πα, Γα, Κε and Νη′.

The single exception: `fthoraHardChromaticDi` omits **Νη**. See §6.

### 2.3 Parity is the rule, and it is stated in the source

`LayoutService.getRootSign`:

```ts
} else if (currentScale === Scale.HardChromatic) {
  rootSign = currentScaleNote % 2 === 0 ? RootSign.Squiggle : RootSign.Tilt;
} else if (currentScale === Scale.SoftChromatic) {
  rootSign = currentScaleNote % 2 === 0
    ? RootSign.SoftChromaticPaRootSign
    : RootSign.SoftChromaticSquiggle;
}
```

with a comment on the table below it reading *"The chromatic scales derive
their base root sign separately in getRootSign via note parity."*
`Squiggle` → `martyriaHardChromaticPa`, `Tilt` → `martyriaHardChromaticDi`,
`SoftChromaticPaRootSign` → `martyriaSoftChromaticKe`,
`SoftChromaticSquiggle` → `martyriaSoftChromaticDi`.

**This is the same rule `MARTYRIA_COMPATIBILITY` already follows.** Check it:
map each of our note ids to a Neanes note value with `value = BYZ_NOTES index −
9` (so `midPa` = 0), and every single one of our 21 rows pairs the even values
with `softChromaticKe`/`hardChromaticPa` and the odd ones with
`softChromaticDi`/`hardChromaticDi`. `lowPa` (−7, odd) gets the Δι pair;
`highPa` (7, odd) gets the Δι pair; `midZo` (−2, even) gets the Κε pair. That
is not a coincidence to be preserved carefully — it is the rule, and the fthora
table should use it too so the two tables cannot drift apart.

### 2.4 Why parity, and why the octave does not help

`PlaybackService.constructScales`:

```ts
constructTetrachordScale(intervals) { return [...intervals, 12]; }   // 4 degrees
constructDiapasonScale(intervals)   { return [...intervals, 12, ...intervals]; } // 7 degrees
```

The chromatic scales are built **tetrachordally** — period 4 degrees
(`[6,20,4,12]` hard, `[8,14,8,12]` soft) — while the diatonic scale is a
diapason, period 7. So:

- **Diatonic fthores are octave-invariant.** Every Πα in the ladder takes
  `diatonicPa`, in every register.
- **Chromatic fthores are not.** Seven is odd, so an octave flips the parity;
  `lowPa` and `midPa` genuinely take different chromatic fthores. This is the
  well-known tetraphonic behaviour of the chromatic scales, not an artefact.

The chroa (zygos, kliton, spathi), the enharmonic fthora and the two *geniki*
are anchored to named notes (`scaleShiftAnchorMap`), so they are letter-based
and octave-invariant like the diatonic ones.

### 2.5 The eight diatonic fthores span exactly one octave

From `LayoutService.getShift`, the note each diatonic fthora denotes:

| Fthora | Note | Value |
|---|---|---|
| `fthoraDiatonicNiLow` | Νη | −1 |
| `fthoraDiatonicPa` | Πα | 0 |
| `fthoraDiatonicVou` | Βου | 1 |
| `fthoraDiatonicGa` | Γα | 2 |
| `fthoraDiatonicDi` | Δι | 3 |
| `fthoraDiatonicKe` | Κε | 4 |
| `fthoraDiatonicZo` | Ζω′ | 5 |
| `fthoraDiatonicNiHigh` | Νη′ | 6 |

Νη −1 … Νη′ 6 — one octave, with **Νη at both ends**, which is the only reason
there are two Νη fthores. In our ladder that span is `midNi` … `highNi`, so
`midZo` takes `diatonicZo` an octave down and `lowNi` takes `diatonicNiLow` an
octave down. The Νη case is the one real judgement call left; see §6.

---

## 3. The rules, stated for this app

Given a note id, with `value = BYZ_NOTES.findIndex(id) − 9`:

1. **Diatonic** — by letter, every register:
   Ζω→`diatonicZo`, Πα→`diatonicPa`, Βου→`diatonicVou`, Γα→`diatonicGa`,
   Δι→`diatonicDi`, Κε→`diatonicKe`;
   Νη→`diatonicNiLow` for `lowNi`/`midNi`, `diatonicNiHigh` for `highNi`.
2. **Chromatic** — by parity of `value`:
   even → `hardChromaticPa`, `softChromaticKe`;
   odd → `hardChromaticDi`, `softChromaticDi`.
3. **Enharmonic (acem)** — by letter: Βου, Γα, Ζω.
4. **Chroa** — by letter: `chroaZygos` and `chroaKliton` on Δι;
   `chroaSpathi` on Γα and Κε.
5. **Geniki** — by letter: `diesisGeniki` on Γα, `yfesisGeniki` on Κε.

Order within a row: **`BYZ_FTHORES` block order**, then the two geniki. There
is no modes table to derive a different order from, and block order keeps the
list stable when a row gains an entry. (Note that block order puts hard
chromatic before soft chromatic, the reverse of the order in the proposal.)

---

## 4. The table

All 21 ladder notes, mirroring `MARTYRIA_COMPATIBILITY`'s shape.

| Note id | value | Compatible fthores |
|---|---:|---|
| `lowZo`  | −9 | `diatonicZo`, `hardChromaticDi`, `softChromaticDi`, `enharmonic` |
| `lowNi`  | −8 | `diatonicNiLow`, `hardChromaticPa`, `softChromaticKe` |
| `lowPa`  | −7 | `diatonicPa`, `hardChromaticDi`, `softChromaticDi` |
| `lowVou` | −6 | `diatonicVou`, `hardChromaticPa`, `softChromaticKe`, `enharmonic` |
| `lowGa`  | −5 | `diatonicGa`, `hardChromaticDi`, `softChromaticDi`, `enharmonic`, `chroaSpathi`, `diesisGeniki` |
| `lowDi`  | −4 | `diatonicDi`, `hardChromaticPa`, `softChromaticKe`, `chroaZygos`, `chroaKliton` |
| `lowKe`  | −3 | `diatonicKe`, `hardChromaticDi`, `softChromaticDi`, `chroaSpathi`, `yfesisGeniki` |
| `midZo`  | −2 | `diatonicZo`, `hardChromaticPa`, `softChromaticKe`, `enharmonic` |
| `midNi`  | −1 | `diatonicNiLow`, `hardChromaticDi`, `softChromaticDi` |
| `midPa`  |  0 | `diatonicPa`, `hardChromaticPa`, `softChromaticKe` |
| `midVou` |  1 | `diatonicVou`, `hardChromaticDi`, `softChromaticDi`, `enharmonic` |
| `midGa`  |  2 | `diatonicGa`, `hardChromaticPa`, `softChromaticKe`, `enharmonic`, `chroaSpathi`, `diesisGeniki` |
| `midDi`  |  3 | `diatonicDi`, `hardChromaticDi`, `softChromaticDi`, `chroaZygos`, `chroaKliton` |
| `midKe`  |  4 | `diatonicKe`, `hardChromaticPa`, `softChromaticKe`, `chroaSpathi`, `yfesisGeniki` |
| `highZo` |  5 | `diatonicZo`, `hardChromaticDi`, `softChromaticDi`, `enharmonic` |
| `highNi` |  6 | `diatonicNiHigh`, `hardChromaticPa`, `softChromaticKe` |
| `highPa` |  7 | `diatonicPa`, `hardChromaticDi`, `softChromaticDi` |
| `highVou`|  8 | `diatonicVou`, `hardChromaticPa`, `softChromaticKe`, `enharmonic` |
| `highGa` |  9 | `diatonicGa`, `hardChromaticDi`, `softChromaticDi`, `enharmonic`, `chroaSpathi`, `diesisGeniki` |
| `highDi` | 10 | `diatonicDi`, `hardChromaticPa`, `softChromaticKe`, `chroaZygos`, `chroaKliton` |
| `highKe` | 11 | `diatonicKe`, `hardChromaticDi`, `softChromaticDi`, `chroaSpathi`, `yfesisGeniki` |

As a paste-ready literal in the shape `byzantine.js` already uses:

```js
const FTHORES_COMPATIBILITY = Object.freeze(
  Object.fromEntries(
    Object.entries({
      lowZo:   ["diatonicZo", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      lowNi:   ["diatonicNiLow", "hardChromaticPa", "softChromaticKe"],
      lowPa:   ["diatonicPa", "hardChromaticDi", "softChromaticDi"],
      lowVou:  ["diatonicVou", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      lowGa:   ["diatonicGa", "hardChromaticDi", "softChromaticDi", "enharmonic", "chroaSpathi", "diesisGeniki"],
      lowDi:   ["diatonicDi", "hardChromaticPa", "softChromaticKe", "chroaZygos", "chroaKliton"],
      lowKe:   ["diatonicKe", "hardChromaticDi", "softChromaticDi", "chroaSpathi", "yfesisGeniki"],
      midZo:   ["diatonicZo", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      midNi:   ["diatonicNiLow", "hardChromaticDi", "softChromaticDi"],
      midPa:   ["diatonicPa", "hardChromaticPa", "softChromaticKe"],
      midVou:  ["diatonicVou", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      midGa:   ["diatonicGa", "hardChromaticPa", "softChromaticKe", "enharmonic", "chroaSpathi", "diesisGeniki"],
      midDi:   ["diatonicDi", "hardChromaticDi", "softChromaticDi", "chroaZygos", "chroaKliton"],
      midKe:   ["diatonicKe", "hardChromaticPa", "softChromaticKe", "chroaSpathi", "yfesisGeniki"],
      highZo:  ["diatonicZo", "hardChromaticDi", "softChromaticDi", "enharmonic"],
      highNi:  ["diatonicNiHigh", "hardChromaticPa", "softChromaticKe"],
      highPa:  ["diatonicPa", "hardChromaticDi", "softChromaticDi"],
      highVou: ["diatonicVou", "hardChromaticPa", "softChromaticKe", "enharmonic"],
      highGa:  ["diatonicGa", "hardChromaticDi", "softChromaticDi", "enharmonic", "chroaSpathi", "diesisGeniki"],
      highDi:  ["diatonicDi", "hardChromaticPa", "softChromaticKe", "chroaZygos", "chroaKliton"],
      highKe:  ["diatonicKe", "hardChromaticDi", "softChromaticDi", "chroaSpathi", "yfesisGeniki"],
    }).map(([noteId, fthores]) => [noteId, Object.freeze(fthores)])
  )
);
```

Unlike `MARTYRIA_COMPATIBILITY`, this one is **derivable** from the five rules
in §3 — it is written out longhand only because the existing table is, and a
literal table is easier to eyeball and to diff than a generator. If it is
generated instead, keep the rules in one named function so a test can pin them.

---

## 5. Diff against the proposed mapping

The proposal covered Νη…Νη′ plus Πα′. **Every entry in it survives** — the
corrections are all additions, nine of them, plus the twelve ladder notes the
proposal did not reach.

### Confirmed exactly as proposed

`Πα`, `Δι`, `Κε` — all three match the derived table entry for entry, including
`chroaZygos`+`chroaKliton` on Δι, `chroaSpathi`+`yfesis geniki` on Κε and
`diesis geniki` on Γα. The `Πα′ → hard chromatic Δι` entry is right too, and it
is the entry that proves the parity rule extends past the base octave.

### Missing — should be added

| Note | Add | Why |
|---|---|---|
| Βου | `enharmonic` (acem) | `fthoraIsValid` admits Βου and Βου′; `getScaleFromFthora` has a whole `EnharmonicVou` scale for it |
| Βου | `hardChromaticDi` | listed in the Fthora Note dropdown for hard chromatic Δι |
| Γα | `chroaSpathi` | `fthoraIsValid` admits Κε **or Γα**; `Scale.SpathiGa` exists for it |
| Γα | `hardChromaticPa` | listed in the dropdown for hard chromatic Πα |
| Ζω′ | `hardChromaticDi` | listed in the dropdown |
| Νη′ | `hardChromaticPa` | listed in the dropdown |
| Νη | `hardChromaticDi` | parity — see the caveat in §6 |
| Πα′ | `diatonicPa`, `softChromaticDi` | the proposal listed only the hard chromatic sign for Πα′ |
| the other 12 ladder notes | — | the proposal covers one octave; the table has to cover all 21 |

### Nothing to drop — and the soft chromatic pairings are worth re-checking

The four soft-chromatic assignments that look most arbitrary in the proposal —
Βου and Ζω′ taking the Δι sign, Γα and Νη′ taking the Κε sign — are all
**correct**, matching Neanes' Fthora Note dropdown entry for entry.

Stating that explicitly because there is a plausible way to get it wrong: a
naive reading of `getShift`'s `shift %= 4` suggests the chromatic fthores group
mod 4, which would move Βου, Γα, Ζω′ and Νη′ to the other sign in each case.
That mod-4 line is only the *default anchor* used when no Fthora Note has been
chosen. The published compatibility is the dropdown, and the rule behind it is
`getRootSign`'s `% 2`. Both agree with the proposal.

---

## 6. Two judgement calls left open

**a. Which Νη fthora on which Νη.** The two Νη fthores are one octave apart
(−1 and 6), and our ladder has three Νη. The table above assumes the middle
register is the reference octave, giving `lowNi`/`midNi` → `diatonicNiLow` and
`highNi` → `diatonicNiHigh`. That is the faithful reading of Neanes' span, but
this app has no fixed base octave the way a score does — a scale can be written
anywhere on the ladder. The alternative is to list **both** Νη fthores on every
Νη, register-appropriate one first, on the grounds that either sign is a
legitimate way to write the note and the picker's job is only to order the
list. Both are defensible; the table above takes the stricter option, and
switching to the looser one is a one-line change per Νη row.

**b. `hardChromaticDi` on Νη.** Neanes' Fthora Note dropdown offers Ζω′, Δι and
Βου for hard chromatic Δι — three entries where the other three chromatic
fthores get four. Νη is the missing one. Parity says it belongs (Νη is −1,
odd), `getRootSign` puts the hard-chromatic-Δι *root sign* on Νη, and our own
`MARTYRIA_COMPATIBILITY` already lists `hardChromaticDi` for `midNi`. The table
above includes it for that internal consistency. Tracking Neanes' dropdown
exactly instead costs one entry: of the three Νη rows only `midNi` is odd, so
`hardChromaticDi` would come out of that row and nothing else changes.
Flagging it rather than deciding it — this is a musicological call, not a code
one.

---

## 7. Picker labels

The proposal asks for *acem* in parentheses. Recommended `BYZ_FTHORES` labels,
extending the current ones:

| id | Current label | Suggested |
|---|---|---|
| `enharmonic` | `Enharmonic` | `Enharmonic (acem)` |
| `softChromaticKe` | `Soft chromatic Κε` | `Soft chromatic Κε/Πα` |
| `chroaZygos` | `Zygos` | `Zygos (muștar)` |
| `chroaKliton` | `Kliton` | `Kliton (nișabur)` |
| `chroaSpathi` | `Spathi` | `Spathi (hisar)` |
| `diesisGeniki` | — (new) | `Diesis geniki (general sharp)` |
| `yfesisGeniki` | — (new) | `Yfesis geniki (general flat)` |

The `softChromaticKe` relabel is the one that earns its keep: the sign is the
soft chromatic fthora of Πα, Γα, Κε *and* Νη′ (§1), so a label naming only Κε
reads as a contradiction the moment the picker offers it on Πα. The chroa
makam names are optional — include them only if `modes-table.html`'s makam
column headings are considered part of the app's vocabulary.

---

## 8. The second gap: signs of alteration

Confirmed missing. SBMuFL's **Signs of Alteration** range is `U+E1F0`–`U+E20F`,
entirely absent from `BYZ_FTHORES` (which covers only `U+E1D0`–`U+E1DF`).

### 8.1 What is there

| Glyph | Codepoint | Meaning | In Neanes' model |
|---|---|---|---|
| `diesis2` | `U+E1F0` | sharp, +2 moria | `Accidental` |
| `diesis4` | `U+E1F1` | sharp, +4 moria | `Accidental` |
| `diesis6` | `U+E1F2` | sharp, +6 moria | `Accidental` |
| `diesis8` | `U+E1F3` | sharp, +8 moria | `Accidental` |
| `yfesis2` | `U+E200` | flat, −2 moria | `Accidental` |
| `yfesis4` | `U+E201` | flat, −4 moria | `Accidental` |
| `yfesis6` | `U+E202` | flat, −6 moria | `Accidental` |
| `yfesis8` | `U+E203` | flat, −8 moria | `Accidental` |
| `diesisGenikiAbove` / `…Below` | `U+E1F4` / `U+E1F5` | general sharp | **`Fthora`** |
| `yfesisGenikiAbove` / `…Below` | `U+E204` / `U+E205` | general flat | **`Fthora`** |

Moria values are from `PlaybackService`'s `alterationMoriaMap`; in Chrysanthine
mode they become multipliers `[0.5, 0.25, 0.75]` of the interval instead.

Note the classification split, which matters for where each sign goes in the
UI: SBMuFL files the two *geniki* under **alteration**, Neanes files them under
**`Fthora`**. Neanes is right for our purposes — they change the scale, they
carry the `fthoraTop`/`fthoraBottom` anchors, they are restricted per note
(Γα / Κε), and they belong in `FTHORES_COMPATIBILITY`. The numbered
diesis/yfesis are true accidentals: note-agnostic, so they have no place in the
compatibility table and should sit below the picker's separator on every note,
or in a section of their own.

The `Secondary`/`Tertiary` variants of every one of these exist too
(`U+E1F6`–`U+E1FF`, `U+E206`–`U+E20F`); like the fthores' `Secondary`/`Tertiary`
forms they are for stacking multiple signs on one neume and are not wanted here.

### 8.2 What implementing this will touch

Verified against `fonts/Neanes.woff2` (v1.0.9) directly — all sixteen glyphs are
present in the vendored file, so no font change is needed.

1. **There is no standalone form.** Unlike the fthores, which have a
   normal-advance block at `U+E1D0`, every alteration sign is a **zero-advance
   combining mark** (`hmtx` advance 0, negative left side bearing — the ink
   straddles the origin). Use the `Above` variants: `diesisGenikiAbove`
   `U+E1F4` and `yfesisGenikiAbove` `U+E204`. Their ink sits entirely above the
   baseline (0.808…1.23 em and 0.640…1.062 em), matching the existing fthores
   and the ink model's `FTHORA_*_RATIO` assumption. `yfesisGenikiBelow` does
   *not* — its ink crosses the baseline (−0.18…0.242 em) — so picking the
   `Below` variants would break that invariant.
2. **Zero advance is already handled.** `inkBox` measures the bounding box, not
   the advance, and `maxInkExtent` in `app.js` sizes the fthora gutter from ink.
   The genus marks are zero-advance too, so this path is exercised. No layout
   change expected — but it is worth a test that a scale whose only Byzantine
   sign is an alteration still reserves a gutter.
3. **`BYZ_FTHORA_BASE + index` arithmetic stops working.** The alteration
   glyphs are in two ranges neither contiguous with `U+E1D0` nor with each
   other. Either give `BYZ_FTHORES` rows an explicit codepoint/base field, or
   keep a second table with its own base and let `resolveFthoraGlyph` dispatch.
   The second option keeps §2 of `docs/BYZANTINE-SYMBOLS.md` honest ("none of
   the tables names a codepoint") and keeps fthores and accidentals separable,
   which the UI wants anyway.
4. **The picker becomes note-aware.** `buildFthoraPicker` currently ignores the
   row entirely and lists all 16 fthores flat. To use
   `FTHORES_COMPATIBILITY` it needs the row's note — `row.dataset.martyriaNote`
   — and a fallback for the rows that have no martyria yet (list everything in
   block order, no separator), mirroring how `buildGenusColumn` goes inert when
   the draft has no note.
5. **The test ink model needs the new ranges.** `test/helpers/canvas-stub.js`
   models `FTHORA_FIRST`–`FTHORA_LAST` = `0xE1D0`–`0xE1DF` only; anything
   outside falls through to the plain-text advance model. Add the alteration
   ranges as zero-advance, ink-above-baseline glyphs.
6. **One well or two?** In Neanes a note can carry a fthora *and* an
   accidental — different signs in different positions (accidentals beside the
   neume, fthores above or below it). Our row has a single fthora well. Folding
   both into one list makes them mutually exclusive, which is a real if minor
   loss of expressiveness; a second well is the faithful option and costs a
   third column of layout. Worth deciding before implementing, not after.

---

## 9. Downstream doc updates

When this is implemented:

- `docs/BYZANTINE-SYMBOLS.md` §2 — "The four tables" becomes five (or six with
  an alteration table), and the `BYZ_FTHORES` bullet's "16 standalone fthores
  (normal advance)" is no longer the whole story.
- `docs/BYZANTINE-SYMBOLS.md` §3 — currently says `MARTYRIA_COMPATIBILITY` is
  *the* hand-maintained table. `FTHORES_COMPATIBILITY` joins it, but with a
  different provenance worth recording: it is derived from rules (§3 here), not
  read off `modes-table.html`.
- `docs/BYZANTINE-SYMBOLS.md` §4 — the resolver section's claim that a font
  swap is "a second pair of these two functions" needs a third if the
  alteration signs get their own resolver.
- `docs/BYZANTINE-SYMBOLS.md` §10 / `docs/TESTING.md` — the stubbed
  `measureText` table should mention the alteration ranges once the stub models
  them.
