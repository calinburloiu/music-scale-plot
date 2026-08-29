const BORDER_WIDTH = 3;
const PX_PER_CENT = 1;
const RECT_WIDTH = 200;
const TEXT_MARGIN = 12;
const CANVAS_PADDING = 20;
const DPR = window.devicePixelRatio || 2;

const PALETTE_LIGHT = [
  "#FFFFFF", "#E8E8E8", "#D0D0D0", "#B8B8B8", "#A0A0A0", "#F0E0CC",
  "#FFCCCC", "#FFE0C0", "#FFFFCC", "#E0FFCC", "#CCFFCC", "#CCFFE6",
  "#CCFFFF", "#CCE5FF", "#CCCCFF", "#E5CCFF", "#FFCCFF", "#FFCCE5"
];

const PALETTE_DARK = [
  "#000000", "#333333", "#555555", "#777777", "#888888", "#8B5300",
  "#CC0000", "#CC5500", "#AA8800", "#4A7700", "#006600", "#006644",
  "#007799", "#0055AA", "#3300CC", "#7700AA", "#AA0099", "#CC0055"
];

const editor = document.getElementById("editor");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const addBtn = document.getElementById("add-note");
const removeBtn = document.getElementById("remove-note");
const saveBtn = document.getElementById("save-png");
const zoomSlider = document.getElementById("zoom");
const zoomValue = document.getElementById("zoom-value");
const baseNoteSelect = document.getElementById("base-note");
const intervalTypeSelect = document.getElementById("interval-type");
const edoSettingsRow = document.getElementById("edo-settings");
const edoDivisionsInput = document.getElementById("edo-divisions");
const edoCentsLabel = document.getElementById("edo-cents-label");
const orientationSelect = document.getElementById("orientation");
const styleSelect = document.getElementById("chart-style");
const scaleModeSelect = document.getElementById("scale-mode");
const notationSelect = document.getElementById("notation");

const LINE_STYLE_WIDTH = 3;
const TICK_LENGTH = 28;
const TICK_WIDTH = 2;
// The band the horizontal charts reserve for the note text.
const NOTE_TEXT_HEIGHT = 28;

let displayZoom = 1;
let audioCtx = null;
let byzFontReady = false;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function getBaseFrequency() {
  const semitones = parseInt(baseNoteSelect.value, 10);
  return 220 * Math.pow(2, semitones / 12);
}

function getScaleMode() {
  return scaleModeSelect.value;
}

function getNotation() {
  return notationSelect.value;
}

function onNotationChange() {
  editor.classList.toggle("notation-byzantine", getNotation() === "byzantine");
  render();
}

function getFrequencyForDegree(degree) {
  const data = readScaleData();
  let cents = 0;
  let notesSeen = 0;
  for (const item of data) {
    if (item.type === "note") {
      notesSeen++;
      if (notesSeen === degree) return getBaseFrequency() * Math.pow(2, cents / 1200);
    } else if (item.type === "interval" && !isNaN(item.cents)) {
      cents += item.cents;
    }
  }
  return getBaseFrequency();
}

let activeOsc = null;
let activeGain = null;

function startTone(frequency) {
  stopTone();
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  activeOsc = osc;
  activeGain = gain;
}

function stopTone() {
  if (!activeOsc) return;
  const ctx = getAudioContext();
  activeGain.gain.cancelScheduledValues(ctx.currentTime);
  activeGain.gain.setValueAtTime(activeGain.gain.value, ctx.currentTime);
  activeGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
  activeOsc.stop(ctx.currentTime + 0.05);
  activeOsc = null;
  activeGain = null;
}

function updateZoom() {
  displayZoom = parseInt(zoomSlider.value, 10) / 100;
  zoomValue.textContent = zoomSlider.value + "%";
  canvas.style.transform = "scale(" + displayZoom + ")";
}

function getDegreeCount() {
  return editor.querySelectorAll(".note-row").length;
}

function updateRemoveBtn() {
  removeBtn.disabled = getDegreeCount() <= 2;
}

function getDefaultIntervalValue() {
  const type = getIntervalType();
  if (type === "ratio") return "9/8";
  if (type === "edo") return String(Math.round(200 / getCentsPerEdoDivision()));
  return "200";
}

function getIntervalPlaceholder() {
  const type = getIntervalType();
  if (type === "ratio") return "ratio";
  if (type === "edo") return "steps";
  return "cents";
}

function getUnisonValue() {
  return getIntervalType() === "ratio" ? "1/1" : "0";
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

function parseRatioPair(str) {
  const parts = str.split("/");
  if (parts.length !== 2) return null;
  const p = parseInt(parts[0], 10);
  const q = parseInt(parts[1], 10);
  if (!p || !q || isNaN(p) || isNaN(q)) return null;
  return [p, q];
}

function simplifyRatio(p, q) {
  const g = gcd(p, q);
  return [p / g, q / g];
}

function multiplyRatios(r1, r2) {
  return simplifyRatio(r1[0] * r2[0], r1[1] * r2[1]);
}

function divideRatios(r1, r2) {
  return simplifyRatio(r1[0] * r2[1], r1[1] * r2[0]);
}

function computeRelativeDisplay(prevAbsStr, nextAbsStr) {
  const type = getIntervalType();
  if (type === "ratio") {
    const a = parseRatioPair(prevAbsStr);
    const b = parseRatioPair(nextAbsStr);
    if (!a || !b) return "";
    const r = divideRatios(b, a);
    return r[0] + "/" + r[1];
  } else if (type === "edo") {
    const a = parseInt(prevAbsStr, 10);
    const b = parseInt(nextAbsStr, 10);
    if (isNaN(a) || isNaN(b)) return "";
    return String(b - a) + " steps";
  } else {
    const a = parseFloat(prevAbsStr);
    const b = parseFloat(nextAbsStr);
    if (isNaN(a) || isNaN(b)) return "";
    return (b - a).toFixed(2) + "￠";
  }
}

function makeNoteRowHTML(degree, mode, absoluteValue) {
  const playBtn = '<button class="play-note" title="Play note">&#9654;</button>';
  const labelHtml = "<label>Note " + degree + "</label>";
  const nameInput = '<input type="text" class="note-name" placeholder="name">';
  if (mode === "absolute") {
    const isFirst = degree === 1;
    const val = isFirst ? getUnisonValue() : (absoluteValue !== undefined ? absoluteValue : "");
    const absInput = '<input type="text" class="absolute-interval" placeholder="' +
      getIntervalPlaceholder() + '" value="' + val + '"' + (isFirst ? " disabled" : "") + ">";
    return playBtn + labelHtml + absInput + '<span class="abs-cents-label"></span>' +
      nameInput + makeSymbolWellsHTML();
  }
  return playBtn + labelHtml + '<span class="cumulative-cents"></span>' +
    nameInput + makeSymbolWellsHTML();
}

function makeIntervalRowHTML(value, mode) {
  const defaultColor = getActivePalette()[0];
  const labelCluster =
    '<div class="interval-label-cluster">' +
      '<input type="text" class="interval-label" placeholder="label">' +
      '<div class="color-picker-wrapper">' +
        '<button type="button" class="color-swatch" data-color="' + defaultColor + '" style="background:' + defaultColor + ';"></button>' +
        '<div class="color-dropdown"></div>' +
      '</div>' +
    '</div>';
  if (mode === "absolute") {
    return '<span class="relative-cents-display"></span>' + labelCluster;
  }
  return '<input type="text" class="interval" placeholder="' +
    getIntervalPlaceholder() + '" value="' + value + '">' +
    '<span class="cents-label"></span>' +
    labelCluster;
}

function getDefaultAbsoluteForNewNote() {
  const noteRows = editor.querySelectorAll(".note-row");
  const type = getIntervalType();
  const defaultRel = getDefaultIntervalValue();
  if (noteRows.length === 0) return getUnisonValue();
  const lastInp = noteRows[noteRows.length - 1].querySelector(".absolute-interval");
  const lastVal = lastInp ? lastInp.value : getUnisonValue();
  if (type === "ratio") {
    const a = parseRatioPair(lastVal) || [1, 1];
    const b = parseRatioPair(defaultRel) || [9, 8];
    const r = multiplyRatios(a, b);
    return r[0] + "/" + r[1];
  } else if (type === "edo") {
    return String((parseInt(lastVal, 10) || 0) + (parseInt(defaultRel, 10) || 0));
  } else {
    return ((parseFloat(lastVal) || 0) + (parseFloat(defaultRel) || 0)).toFixed(2);
  }
}

function addNote() {
  const mode = getScaleMode();
  const degree = getDegreeCount() + 1;
  const defaultVal = getDefaultIntervalValue();
  const prevNoteRow = editor.querySelector(".note-row:last-of-type");

  const intervalRow = document.createElement("div");
  intervalRow.className = "row interval-row";
  intervalRow.innerHTML = makeIntervalRowHTML(defaultVal, mode);

  const noteRow = document.createElement("div");
  noteRow.className = "row note-row";
  noteRow.dataset.degree = degree;
  const absVal = mode === "absolute" ? getDefaultAbsoluteForNewNote() : undefined;
  noteRow.innerHTML = makeNoteRowHTML(degree, mode, absVal);
  refreshNoteRowWells(noteRow);

  editor.appendChild(intervalRow);
  editor.appendChild(noteRow);

  if (getNotation() === "byzantine") continueLadderOnNewNote(prevNoteRow, noteRow);

  const key = getIntervalRowKey(intervalRow);
  const existingColor = findColorForKey(key, intervalRow);
  if (existingColor) {
    const sw = intervalRow.querySelector(".color-swatch");
    if (sw) setSwatchColor(sw, existingColor);
  }
  const existingLabel = findLabelForKey(key, intervalRow);
  if (existingLabel !== null) {
    const lab = intervalRow.querySelector(".interval-label");
    if (lab) lab.value = existingLabel;
  }

  updateRemoveBtn();
  updateAllLabels();
  render();
}

function removeLastNote() {
  if (getDegreeCount() <= 2) return;
  const rows = editor.children;
  editor.removeChild(rows[rows.length - 1]);
  editor.removeChild(rows[rows.length - 1]);
  updateRemoveBtn();
  updateAllLabels();
  render();
}

function readScaleData() {
  const rows = editor.querySelectorAll(".row");
  const mode = getScaleMode();
  const items = [];
  const raw = [];

  let degree = 0;
  for (const row of rows) {
    if (row.classList.contains("note-row")) {
      degree++;
      const absInp = row.querySelector(".absolute-interval");
      const nameEl = row.querySelector(".note-name");
      const symbols = readNoteSymbols(row);
      raw.push({
        type: "note",
        absVal: absInp ? absInp.value.trim() : "",
      });
      items.push({
        type: "note",
        degree: degree,
        name: nameEl ? nameEl.value.trim() : "",
        fthora: symbols.fthora,
        martyria: symbols.martyria,
      });
    } else {
      const intInp = row.querySelector(".interval");
      const swatch = row.querySelector(".color-swatch");
      const labelInp = row.querySelector(".interval-label");
      const relVal = intInp ? intInp.value.trim() : "";
      raw.push({ type: "interval", relVal: relVal });

      let cents = NaN, displayInterval = "", rawValue = "";
      if (mode === "relative") {
        cents = intervalToCents(relVal);
        if (!isNaN(cents)) {
          displayInterval = intervalToDisplayString(relVal);
          rawValue = relVal;
        }
      }
      items.push({
        type: "interval",
        cents: cents,
        displayInterval: displayInterval,
        rawValue: rawValue,
        label: labelInp ? labelInp.value.trim() : "",
        color: swatch ? swatch.dataset.color : "#FFFFFF",
      });
    }
  }

  if (mode === "absolute") {
    let lastNoteIdx = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i].type === "note") {
        lastNoteIdx = i;
      } else if (raw[i].type === "interval") {
        const nextIdx = i + 1 < raw.length && raw[i + 1].type === "note" ? i + 1 : -1;
        if (lastNoteIdx >= 0 && nextIdx >= 0) {
          const prevC = intervalToCents(raw[lastNoteIdx].absVal);
          const nextC = intervalToCents(raw[nextIdx].absVal);
          const cents = (!isNaN(prevC) && !isNaN(nextC)) ? (nextC - prevC) : NaN;
          items[i].cents = cents;
          items[i].displayInterval = isNaN(cents) ? "" : computeRelativeDisplay(raw[lastNoteIdx].absVal, raw[nextIdx].absVal);
          items[i].rawValue = isNaN(cents) ? "" : cents.toFixed(2);
        }
      }
    }
  }
  return items;
}

function getIntervalType() {
  return intervalTypeSelect.value;
}

function getEdoDivisions() {
  const v = parseInt(edoDivisionsInput.value, 10);
  return (isNaN(v) || v < 1) ? 12 : v;
}

function getCentsPerEdoDivision() {
  return 1200 / getEdoDivisions();
}

function ratioToCents(r) {
  return 1200 * Math.log2(r);
}

function intervalToCents(str) {
  const type = getIntervalType();
  const trimmed = str.trim();
  if (type === "ratio") {
    const r = parseRatioPair(trimmed);
    if (!r) return NaN;
    const v = r[0] / r[1];
    return (v <= 0) ? NaN : ratioToCents(v);
  } else if (type === "edo") {
    const steps = parseInt(trimmed, 10);
    return isNaN(steps) ? NaN : steps * getCentsPerEdoDivision();
  } else {
    const c = parseFloat(trimmed);
    return isNaN(c) ? NaN : c;
  }
}

function intervalToDisplayString(str) {
  const type = getIntervalType();
  const trimmed = str.trim();
  if (type === "ratio") return trimmed;
  if (type === "edo") return trimmed;
  return trimmed + "￠";
}

function martyriaTextOf(noteItem) {
  const m = noteItem.martyria;
  return m ? resolveMartyriaGlyphs(m.note, m.genus, m.ticks) : "";
}

function fthoraTextOf(noteItem) {
  return noteItem.fthora ? resolveFthoraGlyph(noteItem.fthora) : "";
}

/** The widest and tallest ink among `texts`, ignoring the empty ones. */
function maxInkExtent(texts, font) {
  let width = 0;
  let height = 0;
  for (const text of texts) {
    if (!text) continue;
    const box = inkBox(ctx, text, font);
    width = Math.max(width, box.right - box.left);
    height = Math.max(height, box.bottom - box.top);
  }
  return { width: width, height: height };
}

/**
 * The band a chart reserves for its note text in Byzantine notation. A
 * martyria shorter than the generic name band still gets that whole band; a
 * scale with no martyria at all gets no band, so the canvas does not grow for
 * signs it never draws.
 */
function byzantineNoteBandHeight(maxMartyriaInkHeight) {
  if (maxMartyriaInkHeight <= 0) return 0;
  return Math.max(maxMartyriaInkHeight, NOTE_TEXT_HEIGHT);
}

function drawByzantineMark(text, x, y, align, vAlign) {
  if (!text) return;
  ctx.font = byzantineFont(BYZ_FONT_SIZE);
  ctx.fillStyle = "#000";
  drawGlyphs(ctx, text, x, y, { align: align, vAlign: vAlign });
}

/**
 * Draws a note's label: a typed name in Generic notation, a martyria in
 * Byzantine. `spec` carries both anchorings so each chart path states its own.
 */
function drawNoteLabel(text, x, y, spec) {
  if (!text) return;
  if (spec.byzantine) {
    drawByzantineMark(text, x, y, spec.align, spec.vAlign);
    return;
  }
  ctx.font = spec.font;
  ctx.fillStyle = "#000";
  ctx.textAlign = spec.textAlign;
  ctx.textBaseline = spec.textBaseline;
  ctx.fillText(text, x, y);
}

function drawLinesHorizontal(intervals, stackLength, maxNoteWidth, intervalTextBlockH, font, monoFont, byz) {
  const halfNote = maxNoteWidth / 2;
  const axisCenterY = CANVAS_PADDING + byz.gutter + intervalTextBlockH + TEXT_MARGIN + TICK_LENGTH / 2;
  const tickTop = axisCenterY - TICK_LENGTH / 2;
  const tickBottom = axisCenterY + TICK_LENGTH / 2;
  const startX = CANVAS_PADDING + halfNote;
  const noteTextY = tickBottom + TEXT_MARGIN;
  const intervalTextCenterY = CANVAS_PADDING + byz.gutter + intervalTextBlockH / 2;

  let x = startX;
  for (const iv of intervals) {
    const w = iv.cents * PX_PER_CENT;
    ctx.strokeStyle = iv.color;
    ctx.lineWidth = LINE_STYLE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, axisCenterY);
    ctx.lineTo(x + w, axisCenterY);
    ctx.stroke();
    x += w;
  }

  ctx.strokeStyle = "#000";
  ctx.lineWidth = TICK_WIDTH;
  let tx = startX;
  for (let j = 0; j <= intervals.length; j++) {
    ctx.beginPath();
    ctx.moveTo(tx, tickTop);
    ctx.lineTo(tx, tickBottom);
    ctx.stroke();
    if (j < intervals.length) tx += intervals[j].cents * PX_PER_CENT;
  }

  const noteSpec = {
    byzantine: byz.on,
    font: font,
    align: "center",
    vAlign: "top",
    textAlign: "center",
    textBaseline: "top",
  };

  let lx = startX;
  for (let j = 0; j < intervals.length; j++) {
    const iv = intervals[j];
    const w = iv.cents * PX_PER_CENT;
    const cx = lx + w / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (iv.label && iv.displayInterval) {
      ctx.font = font;
      ctx.fillStyle = "#000";
      ctx.fillText(iv.label, cx, intervalTextCenterY - 14);
      ctx.font = monoFont;
      ctx.fillStyle = "#666";
      ctx.fillText(iv.displayInterval, cx, intervalTextCenterY + 14);
    } else if (iv.label) {
      ctx.font = font;
      ctx.fillStyle = "#000";
      ctx.fillText(iv.label, cx, intervalTextCenterY);
    } else if (iv.displayInterval) {
      ctx.font = monoFont;
      ctx.fillStyle = "#666";
      ctx.fillText(iv.displayInterval, cx, intervalTextCenterY);
    }

    if (j === 0) {
      drawNoteLabel(iv.noteBelow, lx, noteTextY, noteSpec);
      if (byz.on) drawByzantineMark(iv.fthoraBelow, lx, byz.anchor, "center", "bottom");
    }
    drawNoteLabel(iv.noteAbove, lx + w, noteTextY, noteSpec);
    if (byz.on) drawByzantineMark(iv.fthoraAbove, lx + w, byz.anchor, "center", "bottom");
    lx += w;
  }
}

function drawLinesVertical(intervals, stackLength, maxIntervalTextWidth, font, monoFont, byz) {
  const axisCenterX = CANVAS_PADDING + byz.gutter + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH / 2;
  const tickLeft = axisCenterX - TICK_LENGTH / 2;
  const tickRight = axisCenterX + TICK_LENGTH / 2;
  const noteTextX = tickRight + TEXT_MARGIN;
  const intervalTextRightX = tickLeft - TEXT_MARGIN;
  const baseY = CANVAS_PADDING + byz.overhang + stackLength;

  let y = baseY;
  for (const iv of intervals) {
    const h = iv.cents * PX_PER_CENT;
    const segTopY = y - h;
    ctx.strokeStyle = iv.color;
    ctx.lineWidth = LINE_STYLE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(axisCenterX, y);
    ctx.lineTo(axisCenterX, segTopY);
    ctx.stroke();
    y = segTopY;
  }

  ctx.strokeStyle = "#000";
  ctx.lineWidth = TICK_WIDTH;
  let ty = baseY;
  for (let j = 0; j <= intervals.length; j++) {
    ctx.beginPath();
    ctx.moveTo(tickLeft, ty);
    ctx.lineTo(tickRight, ty);
    ctx.stroke();
    if (j < intervals.length) ty -= intervals[j].cents * PX_PER_CENT;
  }

  const noteSpec = {
    byzantine: byz.on,
    font: font,
    align: "left",
    vAlign: "middle",
    textAlign: "left",
    textBaseline: "middle",
  };

  let ly = baseY;
  for (let j = 0; j < intervals.length; j++) {
    const iv = intervals[j];
    const h = iv.cents * PX_PER_CENT;
    const segTopY = ly - h;
    const midY = segTopY + h / 2;

    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    if (iv.label && iv.displayInterval) {
      ctx.font = font;
      ctx.fillStyle = "#000";
      ctx.fillText(iv.label, intervalTextRightX, midY - 14);
      ctx.font = monoFont;
      ctx.fillStyle = "#666";
      ctx.fillText(iv.displayInterval, intervalTextRightX, midY + 14);
    } else if (iv.label) {
      ctx.font = font;
      ctx.fillStyle = "#000";
      ctx.fillText(iv.label, intervalTextRightX, midY);
    } else if (iv.displayInterval) {
      ctx.font = monoFont;
      ctx.fillStyle = "#666";
      ctx.fillText(iv.displayInterval, intervalTextRightX, midY);
    }

    if (j === 0) {
      drawNoteLabel(iv.noteBelow, noteTextX, ly, noteSpec);
      if (byz.on) drawByzantineMark(iv.fthoraBelow, byz.anchor, ly, "right", "middle");
    }
    drawNoteLabel(iv.noteAbove, noteTextX, segTopY, noteSpec);
    if (byz.on) drawByzantineMark(iv.fthoraAbove, byz.anchor, segTopY, "right", "middle");
    ly = segTopY;
  }
}

function render() {
  const data = readScaleData();

  const notation = getNotation();
  const isByzantine = notation === "byzantine";
  const byzFont = byzantineFont(BYZ_FONT_SIZE);

  const intervals = [];

  let i = 0;
  while (i < data.length) {
    if (data[i].type === "note" && i + 1 < data.length && data[i + 1].type === "interval") {
      const note = data[i];
      const interval = data[i + 1];
      const nextNote = i + 2 < data.length && data[i + 2].type === "note" ? data[i + 2] : null;

      const cents = interval.cents;
      if (isNaN(cents) || cents <= 0) {
        i++;
        continue;
      }

      intervals.push({
        cents: cents,
        label: interval.label,
        displayInterval: interval.displayInterval,
        noteBelow: isByzantine ? martyriaTextOf(note) : note.name,
        noteAbove: nextNote ? (isByzantine ? martyriaTextOf(nextNote) : nextNote.name) : "",
        fthoraBelow: isByzantine ? fthoraTextOf(note) : "",
        fthoraAbove: nextNote && isByzantine ? fthoraTextOf(nextNote) : "",
        color: interval.color || "#FFFFFF",
      });
      i += 2;
    } else {
      i++;
    }
  }

  if (intervals.length === 0) {
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = "0";
    canvas.style.height = "0";
    return;
  }

  const totalCents = intervals.reduce((sum, iv) => sum + iv.cents, 0);
  const stackLength = totalCents * PX_PER_CENT;

  const font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
  const monoFont = '21px "SF Mono", "Fira Code", Consolas, monospace';

  let maxNoteWidth = 0;
  // The tallest martyria's ink, and 0 when no degree carries one.
  let maxNoteHeight = 0;
  let maxFthoraWidth = 0;
  let maxFthoraHeight = 0;

  if (isByzantine) {
    // Measured every render: no measurement taken before the Neanes face
    // resolves is ever cached.
    const notes = maxInkExtent(
      intervals.flatMap((iv) => [iv.noteBelow, iv.noteAbove]),
      byzFont
    );
    maxNoteWidth = notes.width;
    maxNoteHeight = notes.height;

    const fthores = maxInkExtent(
      intervals.flatMap((iv) => [iv.fthoraBelow, iv.fthoraAbove]),
      byzFont
    );
    maxFthoraWidth = fthores.width;
    maxFthoraHeight = fthores.height;
  } else {
    ctx.font = font;
    for (const iv of intervals) {
      if (iv.noteBelow) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteBelow).width);
      if (iv.noteAbove) maxNoteWidth = Math.max(maxNoteWidth, ctx.measureText(iv.noteAbove).width);
    }
  }

  ctx.font = font;
  let maxLabelWidth = 0;
  for (const iv of intervals) {
    if (iv.label) {
      const w = ctx.measureText(iv.label).width;
      if (w > maxLabelWidth) maxLabelWidth = w;
    }
  }
  ctx.font = monoFont;
  let maxRatioWidth = 0;
  for (const iv of intervals) {
    if (iv.displayInterval) {
      const w = ctx.measureText(iv.displayInterval).width;
      if (w > maxRatioWidth) maxRatioWidth = w;
    }
  }
  const maxIntervalTextWidth = Math.max(maxLabelWidth, maxRatioWidth);
  const maxTextWidth = Math.max(maxNoteWidth, maxIntervalTextWidth);

  const orientation = orientationSelect.value;
  const isHorizontal = orientation === "horizontal";
  const chartStyle = styleSelect.value;
  const isLines = chartStyle === "lines";

  const fthoraGutter = !isByzantine
    ? 0
    : isHorizontal
      ? (maxFthoraHeight > 0 ? maxFthoraHeight + TEXT_MARGIN : 0)
      : (maxFthoraWidth > 0 ? maxFthoraWidth + TEXT_MARGIN : 0);
  // The gutter is a band of its own along the left (vertical) or top
  // (horizontal) edge of the canvas. The fthora's ink is right- or
  // bottom-aligned at the band's far edge, one text margin clear of whatever
  // the chart lays out after it — the boxes, or the line chart's interval text.
  const fthoraAnchor = CANVAS_PADDING + fthoraGutter - TEXT_MARGIN;
  // Both signs are ink-centred on a separator, and the extreme separators sit
  // one CANVAS_PADDING from the edge: reserve whatever ink overflows that, at
  // both ends of the stack, so the first and last sign are never clipped. The
  // stack runs along x when horizontal, so there it is the ink's width that
  // overflows the padding, and its height when vertical.
  const signExtent = isHorizontal
    ? Math.max(maxNoteWidth, maxFthoraWidth)
    : Math.max(maxNoteHeight, maxFthoraHeight);
  const signOverhang = isByzantine ? Math.max(0, signExtent / 2 - CANVAS_PADDING) : 0;
  const noteBandH = isByzantine ? byzantineNoteBandHeight(maxNoteHeight) : NOTE_TEXT_HEIGHT;
  const byz = {
    on: isByzantine,
    font: byzFont,
    gutter: fthoraGutter,
    anchor: fthoraAnchor,
    overhang: signOverhang,
  };

  const hasBothIntervalLines = maxLabelWidth > 0 && maxRatioWidth > 0;
  const intervalTextBlockH = hasBothIntervalLines ? 56 : 28;

  let displayWidth, displayHeight;
  if (isLines && isHorizontal) {
    // The half-note padding at each end already clears the martyria's ink, so
    // this chart reserves no overhang of its own.
    const halfNote = maxNoteWidth / 2;
    displayWidth = CANVAS_PADDING + halfNote + stackLength + halfNote + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING + fthoraGutter + intervalTextBlockH + TEXT_MARGIN + TICK_LENGTH + TEXT_MARGIN + noteBandH + CANVAS_PADDING;
  } else if (isLines && !isHorizontal) {
    displayWidth = CANVAS_PADDING + fthoraGutter + maxIntervalTextWidth + TEXT_MARGIN + TICK_LENGTH + TEXT_MARGIN + maxNoteWidth + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING * 2 + signOverhang * 2 + stackLength;
  } else if (isHorizontal) {
    const textAreaHeight = noteBandH + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING * 2 + signOverhang * 2 + stackLength + maxTextWidth;
    displayHeight = CANVAS_PADDING + fthoraGutter + RECT_WIDTH + TEXT_MARGIN + textAreaHeight + CANVAS_PADDING;
  } else {
    const textAreaWidth = maxTextWidth + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING + fthoraGutter + RECT_WIDTH + TEXT_MARGIN + textAreaWidth + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING * 2 + signOverhang * 2 + stackLength;
  }

  canvas.width = Math.round(displayWidth * DPR);
  canvas.height = Math.round(displayHeight * DPR);
  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  if (isLines && isHorizontal) {
    drawLinesHorizontal(intervals, stackLength, maxNoteWidth, intervalTextBlockH, font, monoFont, byz);
  } else if (isLines && !isHorizontal) {
    drawLinesVertical(intervals, stackLength, maxIntervalTextWidth, font, monoFont, byz);
  } else if (isHorizontal) {
    const baseX = CANVAS_PADDING + signOverhang;
    const baseY = CANVAS_PADDING + fthoraGutter;
    const textY = baseY + RECT_WIDTH + TEXT_MARGIN;
    const noteSpec = {
      byzantine: isByzantine,
      font: font,
      align: "center",
      vAlign: "top",
      textAlign: "center",
      textBaseline: "top",
    };

    let x = baseX;

    for (let j = 0; j < intervals.length; j++) {
      const iv = intervals[j];
      const w = iv.cents * PX_PER_CENT;

      ctx.fillStyle = iv.color;
      ctx.fillRect(x, baseY, w, RECT_WIDTH);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = BORDER_WIDTH;
      ctx.strokeRect(x, baseY, w, RECT_WIDTH);

      ctx.fillStyle = "#000";

      if (iv.label || iv.displayInterval) {
        const centerX = x + w / 2;
        const midY = baseY + RECT_WIDTH / 2;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelText = iv.label || "";
        const ratioText = iv.displayInterval || "";
        if (labelText && ratioText) {
          ctx.font = font;
          ctx.fillText(labelText, centerX, midY - 12);
          ctx.font = monoFont;
          ctx.fillStyle = "#666";
          ctx.fillText(ratioText, centerX, midY + 12);
          ctx.fillStyle = "#000";
        } else if (labelText) {
          ctx.font = font;
          ctx.fillText(labelText, centerX, midY);
        } else {
          ctx.font = monoFont;
          ctx.fillStyle = "#666";
          ctx.fillText(ratioText, centerX, midY);
          ctx.fillStyle = "#000";
        }
      }

      if (j === 0) {
        drawNoteLabel(iv.noteBelow, x, textY, noteSpec);
        if (isByzantine) drawByzantineMark(iv.fthoraBelow, x, fthoraAnchor, "center", "bottom");
      }

      drawNoteLabel(iv.noteAbove, x + w, textY, noteSpec);
      if (isByzantine) drawByzantineMark(iv.fthoraAbove, x + w, fthoraAnchor, "center", "bottom");

      x += w;
    }
  } else {
    const baseX = CANVAS_PADDING + fthoraGutter;
    const baseY = CANVAS_PADDING + signOverhang + stackLength;
    const noteSpec = {
      byzantine: isByzantine,
      font: font,
      align: "left",
      vAlign: "middle",
      textAlign: "left",
      textBaseline: "middle",
    };

    let y = baseY;

    for (let j = 0; j < intervals.length; j++) {
      const iv = intervals[j];
      const h = iv.cents * PX_PER_CENT;
      const rectY = y - h;

      ctx.fillStyle = iv.color;
      ctx.fillRect(baseX, rectY, RECT_WIDTH, h);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = BORDER_WIDTH;
      ctx.strokeRect(baseX, rectY, RECT_WIDTH, h);

      const textX = baseX + RECT_WIDTH + TEXT_MARGIN;

      ctx.fillStyle = "#000";
      ctx.textBaseline = "middle";

      if (iv.label || iv.displayInterval) {
        const midY = rectY + h / 2;
        const centerX = baseX + RECT_WIDTH / 2;
        ctx.textAlign = "center";
        const labelText = iv.label || "";
        const ratioText = iv.displayInterval || "";
        if (labelText && ratioText) {
          ctx.font = font;
          ctx.fillText(labelText, centerX, midY - 12);
          ctx.font = monoFont;
          ctx.fillStyle = "#666";
          ctx.fillText(ratioText, centerX, midY + 12);
          ctx.fillStyle = "#000";
        } else if (labelText) {
          ctx.font = font;
          ctx.fillText(labelText, centerX, midY);
        } else {
          ctx.font = monoFont;
          ctx.fillStyle = "#666";
          ctx.fillText(ratioText, centerX, midY);
          ctx.fillStyle = "#000";
        }
        ctx.textAlign = "left";
      }

      if (j === 0) {
        drawNoteLabel(iv.noteBelow, textX, y, noteSpec);
        if (isByzantine) drawByzantineMark(iv.fthoraBelow, fthoraAnchor, y, "right", "middle");
      }

      drawNoteLabel(iv.noteAbove, textX, rectY, noteSpec);
      if (isByzantine) drawByzantineMark(iv.fthoraAbove, fthoraAnchor, rectY, "right", "middle");

      y = rectY;
    }
  }
}

function updateAllLabels() {
  const mode = getScaleMode();
  if (mode === "relative") {
    updateCentsLabels();
    updateCumulativeCents();
  } else {
    updateAbsCentsLabels();
    updateRelativeCentsDisplays();
  }
}

function updateCumulativeCents() {
  const rows = Array.from(editor.querySelectorAll(".row"));
  let cumulative = 0;
  for (const row of rows) {
    if (row.classList.contains("note-row")) {
      const span = row.querySelector(".cumulative-cents");
      if (span) span.textContent = cumulative.toFixed(2) + "￠";
    } else if (row.classList.contains("interval-row")) {
      const inp = row.querySelector(".interval");
      if (!inp) continue;
      const cents = intervalToCents(inp.value);
      if (!isNaN(cents)) cumulative += cents;
    }
  }
}

function updateCentsLabels() {
  const rows = editor.querySelectorAll(".interval-row");
  for (const row of rows) {
    const inp = row.querySelector(".interval");
    const span = row.querySelector(".cents-label");
    if (!inp || !span) continue;
    const cents = intervalToCents(inp.value);
    span.textContent = isNaN(cents) ? "" : cents.toFixed(2) + "￠";
  }
}

function updateAbsCentsLabels() {
  const rows = editor.querySelectorAll(".note-row");
  for (const row of rows) {
    const inp = row.querySelector(".absolute-interval");
    const span = row.querySelector(".abs-cents-label");
    if (!inp || !span) continue;
    const cents = intervalToCents(inp.value);
    span.textContent = isNaN(cents) ? "" : cents.toFixed(2) + "￠";
  }
}

function updateRelativeCentsDisplays() {
  const intervalRows = editor.querySelectorAll(".interval-row");
  for (const row of intervalRows) {
    const span = row.querySelector(".relative-cents-display");
    if (!span) continue;
    const prev = row.previousElementSibling;
    const next = row.nextElementSibling;
    if (!prev || !next) { span.textContent = ""; continue; }
    const prevInp = prev.querySelector(".absolute-interval");
    const nextInp = next.querySelector(".absolute-interval");
    if (!prevInp || !nextInp) { span.textContent = ""; continue; }
    const prevC = intervalToCents(prevInp.value);
    const nextC = intervalToCents(nextInp.value);
    if (isNaN(prevC) || isNaN(nextC)) { span.textContent = ""; continue; }
    span.textContent = (nextC - prevC).toFixed(2) + "￠";
  }
}

function resetScaleToDefault() {
  const mode = getScaleMode();
  const defaultVal = getDefaultIntervalValue();

  editor.innerHTML = "";

  const noteRow1 = document.createElement("div");
  noteRow1.className = "row note-row";
  noteRow1.dataset.degree = 1;
  noteRow1.innerHTML = makeNoteRowHTML(1, mode);
  refreshNoteRowWells(noteRow1);

  const intervalRow = document.createElement("div");
  intervalRow.className = "row interval-row";
  intervalRow.innerHTML = makeIntervalRowHTML(defaultVal, mode);

  const noteRow2 = document.createElement("div");
  noteRow2.className = "row note-row";
  noteRow2.dataset.degree = 2;
  // In absolute mode, Note 2's absolute = the relative default (stacked on unison)
  noteRow2.innerHTML = makeNoteRowHTML(2, mode, defaultVal);
  refreshNoteRowWells(noteRow2);

  editor.appendChild(noteRow1);
  editor.appendChild(intervalRow);
  editor.appendChild(noteRow2);

  updateRemoveBtn();
  updateAllLabels();
  render();
}

function updateEdoCentsLabel() {
  const centsPerDiv = getCentsPerEdoDivision();
  edoCentsLabel.textContent = centsPerDiv.toFixed(2) + " ￠ for each division";
}

function onIntervalTypeChange() {
  const type = getIntervalType();
  edoSettingsRow.style.display = type === "edo" ? "" : "none";
  if (type === "edo") updateEdoCentsLabel();
  resetScaleToDefault();
}

function onEdoDivisionsChange() {
  updateEdoCentsLabel();
  resetScaleToDefault();
}

function relativeToAbsoluteStrings(relValues) {
  // Returns absolute values for n+1 notes given n relative interval strings
  const type = getIntervalType();
  const out = [getUnisonValue()];
  if (type === "ratio") {
    let cur = [1, 1];
    for (const v of relValues) {
      const r = parseRatioPair(v) || [1, 1];
      cur = multiplyRatios(cur, r);
      out.push(cur[0] + "/" + cur[1]);
    }
  } else if (type === "edo") {
    let s = 0;
    for (const v of relValues) {
      s += (parseInt(v, 10) || 0);
      out.push(String(s));
    }
  } else {
    let c = 0;
    for (const v of relValues) {
      c += (parseFloat(v) || 0);
      out.push(c.toFixed(2));
    }
  }
  return out;
}

function absoluteToRelativeStrings(absValues) {
  const type = getIntervalType();
  const out = [];
  if (type === "ratio") {
    for (let i = 1; i < absValues.length; i++) {
      const a = parseRatioPair(absValues[i - 1]) || [1, 1];
      const b = parseRatioPair(absValues[i]) || [1, 1];
      const r = divideRatios(b, a);
      out.push(r[0] + "/" + r[1]);
    }
  } else if (type === "edo") {
    for (let i = 1; i < absValues.length; i++) {
      const a = parseInt(absValues[i - 1], 10) || 0;
      const b = parseInt(absValues[i], 10) || 0;
      out.push(String(b - a));
    }
  } else {
    for (let i = 1; i < absValues.length; i++) {
      const a = parseFloat(absValues[i - 1]) || 0;
      const b = parseFloat(absValues[i]) || 0;
      out.push((b - a).toFixed(2));
    }
  }
  return out;
}

function onScaleModeChange() {
  const newMode = getScaleMode();

  const rows = Array.from(editor.children);
  const noteData = [];
  const intervalData = [];
  for (const row of rows) {
    if (row.classList.contains("note-row")) {
      const nameInp = row.querySelector(".note-name");
      const absInp = row.querySelector(".absolute-interval");
      noteData.push({
        name: nameInp ? nameInp.value : "",
        absolute: absInp ? absInp.value : "",
        symbols: noteSymbolAttrs(row),
      });
    } else {
      const intInp = row.querySelector(".interval");
      const labelInp = row.querySelector(".interval-label");
      const sw = row.querySelector(".color-swatch");
      intervalData.push({
        value: intInp ? intInp.value : "",
        label: labelInp ? labelInp.value : "",
        color: sw ? sw.dataset.color : "#FFFFFF",
      });
    }
  }

  let absoluteValues = null;
  let relativeValues = null;
  if (newMode === "absolute") {
    relativeValues = intervalData.map(i => i.value);
    absoluteValues = relativeToAbsoluteStrings(relativeValues);
  } else {
    const absolutes = noteData.map(n => n.absolute);
    relativeValues = absoluteToRelativeStrings(absolutes);
  }

  editor.innerHTML = "";
  for (let i = 0; i < noteData.length; i++) {
    const noteRow = document.createElement("div");
    noteRow.className = "row note-row";
    noteRow.dataset.degree = i + 1;
    const absVal = newMode === "absolute" ? absoluteValues[i] : undefined;
    noteRow.innerHTML = makeNoteRowHTML(i + 1, newMode, absVal);
    const nameInp = noteRow.querySelector(".note-name");
    if (nameInp) nameInp.value = noteData[i].name;
    applyNoteSymbolAttrs(noteRow, noteData[i].symbols);
    editor.appendChild(noteRow);

    if (i < intervalData.length) {
      const ivRow = document.createElement("div");
      ivRow.className = "row interval-row";
      const relValStr = newMode === "relative"
        ? (relativeValues[i] !== undefined ? relativeValues[i] : intervalData[i].value)
        : intervalData[i].value;
      ivRow.innerHTML = makeIntervalRowHTML(relValStr, newMode);
      const labelInp = ivRow.querySelector(".interval-label");
      if (labelInp) labelInp.value = intervalData[i].label;
      const sw = ivRow.querySelector(".color-swatch");
      if (sw) setSwatchColor(sw, intervalData[i].color);
      editor.appendChild(ivRow);
    }
  }

  updateRemoveBtn();
  updateAllLabels();
  render();
}

/**
 * Asks for the Neanes face and redraws once it resolves.
 *
 * PUA codepoints have no fallback glyph, so a chart drawn before the face
 * arrives shows blank boxes and measures with fallback metrics. Guarded,
 * because jsdom (and old browsers) have no FontFaceSet.
 */
function loadByzantineFont() {
  const fonts = document.fonts;
  if (!fonts || typeof fonts.load !== "function") return null;
  return fonts
    .load(BYZ_FONT_SIZE + 'px "Neanes"')
    .then(function () {
      return fonts.ready;
    })
    .then(function () {
      byzFontReady = true;
      render();
    })
    .catch(function () {
      // The face never arrived. The chart keeps drawing with fallback
      // metrics rather than failing; nothing was cached from it.
    });
}

function savePNG() {
  const link = document.createElement("a");
  link.download = "scale.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getActivePalette() {
  return styleSelect.value === "lines" ? PALETTE_DARK : PALETTE_LIGHT;
}

function populateDropdown(dropdown) {
  dropdown.innerHTML = "";
  for (const hex of getActivePalette()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-option";
    btn.style.background = hex;
    btn.dataset.color = hex;
    dropdown.appendChild(btn);
  }
}

function remapSwatchColors(fromPalette, toPalette) {
  const swatches = editor.querySelectorAll(".color-swatch");
  for (const sw of swatches) {
    const idx = fromPalette.indexOf(sw.dataset.color);
    if (idx !== -1) setSwatchColor(sw, toPalette[idx]);
  }
}

function onChartStyleChange() {
  const newStyle = styleSelect.value;
  const fromPalette = newStyle === "lines" ? PALETTE_LIGHT : PALETTE_DARK;
  const toPalette = newStyle === "lines" ? PALETTE_DARK : PALETTE_LIGHT;
  remapSwatchColors(fromPalette, toPalette);
  render();
}

function closeAllDropdowns() {
  const openDropdowns = editor.querySelectorAll(".color-dropdown.open");
  for (const dd of openDropdowns) {
    dd.classList.remove("open");
    const row = dd.closest(".interval-row");
    if (row) row.classList.remove("dropdown-open");
  }
  closeByzantinePickers();
}

function setSwatchColor(swatch, hex) {
  swatch.dataset.color = hex;
  swatch.style.background = hex;
}

function getIntervalRowKey(row) {
  if (getScaleMode() === "relative") {
    const inp = row.querySelector(".interval");
    return inp ? inp.value.trim() : "";
  }
  const prev = row.previousElementSibling;
  const next = row.nextElementSibling;
  if (!prev || !next) return "";
  const prevInp = prev.querySelector(".absolute-interval");
  const nextInp = next.querySelector(".absolute-interval");
  if (!prevInp || !nextInp) return "";
  const prevC = intervalToCents(prevInp.value);
  const nextC = intervalToCents(nextInp.value);
  if (isNaN(prevC) || isNaN(nextC)) return "";
  return (nextC - prevC).toFixed(2);
}

function findColorForKey(key, excludeRow) {
  if (!key) return null;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === excludeRow) continue;
    if (getIntervalRowKey(row) === key) {
      const sw = row.querySelector(".color-swatch");
      if (sw && sw.dataset.color && sw.dataset.color !== getActivePalette()[0]) return sw.dataset.color;
    }
  }
  return null;
}

function findLabelForKey(key, excludeRow) {
  if (!key) return null;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === excludeRow) continue;
    if (getIntervalRowKey(row) === key) {
      const lab = row.querySelector(".interval-label");
      if (lab && lab.value.trim() !== "") return lab.value;
    }
  }
  return null;
}

function syncIntervalLabels(sourceRow) {
  const sourceKey = getIntervalRowKey(sourceRow);
  const sourceLabel = sourceRow.querySelector(".interval-label");
  if (!sourceLabel || !sourceKey) return;
  const text = sourceLabel.value;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === sourceRow) continue;
    if (getIntervalRowKey(row) === sourceKey) {
      const lab = row.querySelector(".interval-label");
      if (lab) lab.value = text;
    }
  }
}

function syncIntervalColors(sourceRow) {
  const sourceKey = getIntervalRowKey(sourceRow);
  const sourceSwatch = sourceRow.querySelector(".color-swatch");
  if (!sourceSwatch || !sourceKey) return;
  const hex = sourceSwatch.dataset.color;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === sourceRow) continue;
    if (getIntervalRowKey(row) === sourceKey) {
      const sw = row.querySelector(".color-swatch");
      if (sw) setSwatchColor(sw, hex);
    }
  }
}

editor.addEventListener("click", function (e) {
  if (handleByzantineClick(e)) return;

  const swatch = e.target.closest(".color-swatch");
  if (swatch) {
    e.stopPropagation();
    const dropdown = swatch.nextElementSibling;
    const wasOpen = dropdown.classList.contains("open");
    closeAllDropdowns();
    if (!wasOpen) {
      populateDropdown(dropdown);
      dropdown.classList.add("open");
      const row = swatch.closest(".interval-row");
      if (row) row.classList.add("dropdown-open");
    }
    return;
  }

  const option = e.target.closest(".color-option");
  if (option) {
    e.stopPropagation();
    const hex = option.dataset.color;
    const wrapper = option.closest(".color-picker-wrapper");
    const sw = wrapper.querySelector(".color-swatch");
    setSwatchColor(sw, hex);
    closeAllDropdowns();
    const intervalRow = wrapper.closest(".interval-row");
    syncIntervalColors(intervalRow);
    render();
    return;
  }
});

document.addEventListener("click", function () {
  closeAllDropdowns();
});

editor.addEventListener("input", function (e) {
  if (e.target.classList.contains("interval")) {
    const row = e.target.closest(".interval-row");
    if (row) {
      const key = getIntervalRowKey(row);
      const existingColor = findColorForKey(key, row);
      if (existingColor) {
        const sw = row.querySelector(".color-swatch");
        if (sw) setSwatchColor(sw, existingColor);
      }
      const existingLabel = findLabelForKey(key, row);
      if (existingLabel !== null) {
        const lab = row.querySelector(".interval-label");
        if (lab) lab.value = existingLabel;
      }
    }
  } else if (e.target.classList.contains("absolute-interval")) {
    // Recompute labels first so keys reflect new value
    updateAbsCentsLabels();
    updateRelativeCentsDisplays();
    const noteRow = e.target.closest(".note-row");
    if (noteRow) {
      const adjacent = [noteRow.previousElementSibling, noteRow.nextElementSibling];
      for (const adj of adjacent) {
        if (adj && adj.classList.contains("interval-row")) {
          const key = getIntervalRowKey(adj);
          const existingColor = findColorForKey(key, adj);
          if (existingColor) {
            const sw = adj.querySelector(".color-swatch");
            if (sw) setSwatchColor(sw, existingColor);
          }
          const existingLabel = findLabelForKey(key, adj);
          if (existingLabel !== null) {
            const lab = adj.querySelector(".interval-label");
            if (lab) lab.value = existingLabel;
          }
        }
      }
    }
  } else if (e.target.classList.contains("interval-label")) {
    const row = e.target.closest(".interval-row");
    if (row) syncIntervalLabels(row);
  }
  updateAllLabels();
  render();
});

function handlePlayStart(e) {
  const btn = e.target.closest(".play-note");
  if (!btn) return;
  e.preventDefault();
  const noteRow = btn.closest(".note-row");
  if (!noteRow) return;
  const degree = parseInt(noteRow.dataset.degree, 10);
  startTone(getFrequencyForDegree(degree));
}

editor.addEventListener("mousedown", handlePlayStart);
editor.addEventListener("touchstart", handlePlayStart);
document.addEventListener("mouseup", stopTone);
document.addEventListener("touchend", stopTone);
addBtn.addEventListener("click", addNote);
removeBtn.addEventListener("click", removeLastNote);
saveBtn.addEventListener("click", savePNG);
zoomSlider.addEventListener("input", updateZoom);
intervalTypeSelect.addEventListener("change", onIntervalTypeChange);
orientationSelect.addEventListener("change", render);
styleSelect.addEventListener("change", onChartStyleChange);
edoDivisionsInput.addEventListener("input", onEdoDivisionsChange);
scaleModeSelect.addEventListener("change", onScaleModeChange);
notationSelect.addEventListener("change", onNotationChange);

updateRemoveBtn();
updateZoom();
updateAllLabels();
render();
loadByzantineFont();
