const BORDER_WIDTH = 3;
const PX_PER_CENT = 1;
const RECT_WIDTH = 200;
const TEXT_MARGIN = 12;
const CANVAS_PADDING = 20;
const DPR = window.devicePixelRatio || 2;

const PALETTE = [
  "#FFFFFF", "#E8E8E8", "#D0D0D0", "#B8B8B8", "#A0A0A0", "#F0E0CC",
  "#FFCCCC", "#FFE0C0", "#FFFFCC", "#E0FFCC", "#CCFFCC", "#CCFFE6",
  "#CCFFFF", "#CCE5FF", "#CCCCFF", "#E5CCFF", "#FFCCFF", "#FFCCE5"
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

let displayZoom = 1;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function getBaseFrequency() {
  const semitones = parseInt(baseNoteSelect.value, 10);
  return 220 * Math.pow(2, semitones / 12);
}

function getFrequencyForDegree(degree) {
  const rows = Array.from(editor.querySelectorAll(".row"));
  let freq = getBaseFrequency();
  let notesSeen = 0;
  for (const row of rows) {
    if (row.classList.contains("note-row")) {
      notesSeen++;
      if (notesSeen === degree) return freq;
    } else if (row.classList.contains("interval-row")) {
      const valStr = row.querySelector(".interval-ratio").value;
      const ratio = intervalToRatio(valStr);
      if (!isNaN(ratio) && ratio > 0) freq *= ratio;
    }
  }
  return freq;
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

function makeIntervalRowHTML(value) {
  return '<input type="text" class="interval-ratio" placeholder="' +
    getIntervalPlaceholder() + '" value="' + value + '">' +
    '<span class="cents-label"></span>' +
    '<div class="color-picker-wrapper">' +
      '<button type="button" class="color-swatch" data-color="#FFFFFF" style="background:#FFFFFF;"></button>' +
      '<div class="color-dropdown"></div>' +
    '</div>' +
    '<input type="text" class="interval-label" placeholder="label">';
}

function addNote() {
  const degree = getDegreeCount() + 1;
  const defaultVal = getDefaultIntervalValue();

  const intervalRow = document.createElement("div");
  intervalRow.className = "row interval-row";
  intervalRow.innerHTML = makeIntervalRowHTML(defaultVal);

  const noteRow = document.createElement("div");
  noteRow.className = "row note-row";
  noteRow.dataset.degree = degree;
  noteRow.innerHTML =
    '<button class="play-note" title="Play note">&#9654;</button>' +
    "<label>Note " + degree + "</label>" +
    '<input type="text" class="note-name" placeholder="name">' +
    '<span class="cumulative-cents"></span>';

  editor.appendChild(intervalRow);
  editor.appendChild(noteRow);

  const existingColor = findColorForValue(defaultVal, intervalRow);
  if (existingColor) {
    const sw = intervalRow.querySelector(".color-swatch");
    if (sw) setSwatchColor(sw, existingColor);
  }

  updateRemoveBtn();
  updateCentsLabels();
  updateCumulativeCents();
  render();
}

function removeLastNote() {
  if (getDegreeCount() <= 2) return;
  const rows = editor.children;
  editor.removeChild(rows[rows.length - 1]);
  editor.removeChild(rows[rows.length - 1]);
  updateRemoveBtn();
  updateCentsLabels();
  updateCumulativeCents();
  render();
}

function readScaleData() {
  const rows = editor.querySelectorAll(".row");
  const data = [];
  let degree = 0;
  for (const row of rows) {
    if (row.classList.contains("note-row")) {
      degree++;
      data.push({
        type: "note",
        degree: degree,
        name: row.querySelector(".note-name").value.trim(),
      });
    } else {
      const ratioStr = row.querySelector(".interval-ratio").value.trim();
      const swatch = row.querySelector(".color-swatch");
      data.push({
        type: "interval",
        ratio: ratioStr,
        label: row.querySelector(".interval-label").value.trim(),
        color: swatch ? swatch.dataset.color : "#FFFFFF",
      });
    }
  }
  return data;
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

function parseRatio(str) {
  const parts = str.split("/");
  if (parts.length !== 2) return NaN;
  const p = parseFloat(parts[0]);
  const q = parseFloat(parts[1]);
  if (!q || q === 0) return NaN;
  return p / q;
}

function ratioToCents(r) {
  return 1200 * Math.log2(r);
}

function intervalToCents(str) {
  const type = getIntervalType();
  const trimmed = str.trim();
  if (type === "ratio") {
    const r = parseRatio(trimmed);
    return (isNaN(r) || r <= 0) ? NaN : ratioToCents(r);
  } else if (type === "edo") {
    const steps = parseInt(trimmed, 10);
    return isNaN(steps) ? NaN : steps * getCentsPerEdoDivision();
  } else {
    const c = parseFloat(trimmed);
    return isNaN(c) ? NaN : c;
  }
}

function intervalToRatio(str) {
  const cents = intervalToCents(str);
  if (isNaN(cents)) return NaN;
  return Math.pow(2, cents / 1200);
}

function intervalToDisplayString(str) {
  const type = getIntervalType();
  const trimmed = str.trim();
  if (type === "ratio") return trimmed;
  if (type === "edo") return trimmed + " steps";
  return trimmed + "￠";
}

function render() {
  const data = readScaleData();

  const intervals = [];
  const notesBefore = [];
  const notesAfter = [];

  let i = 0;
  while (i < data.length) {
    if (data[i].type === "note" && i + 1 < data.length && data[i + 1].type === "interval") {
      const note = data[i];
      const interval = data[i + 1];
      const nextNote = i + 2 < data.length && data[i + 2].type === "note" ? data[i + 2] : null;

      const cents = intervalToCents(interval.ratio);
      if (isNaN(cents) || cents <= 0) {
        i++;
        continue;
      }

      intervals.push({
        cents: cents,
        label: interval.label,
        displayInterval: intervalToDisplayString(interval.ratio),
        noteBelow: note.name,
        noteAbove: nextNote ? nextNote.name : "",
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

  ctx.font = font;
  let maxTextWidth = 0;
  for (const iv of intervals) {
    const parts = [];
    if (iv.noteBelow) parts.push(iv.noteBelow);
    if (iv.noteAbove) parts.push(iv.noteAbove);
    if (iv.label) parts.push(iv.label);
    if (iv.displayInterval) parts.push(iv.displayInterval);
    for (const t of parts) {
      const w = ctx.measureText(t).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }
  }

  const orientation = orientationSelect.value;
  const isHorizontal = orientation === "horizontal";

  let displayWidth, displayHeight;
  if (isHorizontal) {
    const textAreaHeight = 28 + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING * 2 + stackLength + maxTextWidth;
    displayHeight = CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + textAreaHeight + CANVAS_PADDING;
  } else {
    const textAreaWidth = maxTextWidth + TEXT_MARGIN * 2;
    displayWidth = CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + textAreaWidth + CANVAS_PADDING;
    displayHeight = CANVAS_PADDING * 2 + stackLength;
  }

  canvas.width = Math.round(displayWidth * DPR);
  canvas.height = Math.round(displayHeight * DPR);
  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  if (isHorizontal) {
    const baseX = CANVAS_PADDING;
    const baseY = CANVAS_PADDING;
    const textY = baseY + RECT_WIDTH + TEXT_MARGIN;

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

      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      if (j === 0 && iv.noteBelow) {
        ctx.fillText(iv.noteBelow, x, textY);
      }

      if (iv.noteAbove) {
        ctx.fillText(iv.noteAbove, x + w, textY);
      }

      x += w;
    }
  } else {
    const baseX = CANVAS_PADDING;
    const baseY = CANVAS_PADDING + stackLength;

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

      if (j === 0 && iv.noteBelow) {
        ctx.font = font;
        ctx.textBaseline = "middle";
        ctx.fillText(iv.noteBelow, textX, y);
      }

      if (iv.noteAbove) {
        ctx.font = font;
        ctx.textBaseline = "middle";
        ctx.fillText(iv.noteAbove, textX, rectY);
      }

      y = rectY;
    }
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
      const valStr = row.querySelector(".interval-ratio").value;
      const cents = intervalToCents(valStr);
      if (!isNaN(cents)) cumulative += cents;
    }
  }
}

function updateCentsLabels() {
  const rows = editor.querySelectorAll(".interval-row");
  for (const row of rows) {
    const valStr = row.querySelector(".interval-ratio").value;
    const span = row.querySelector(".cents-label");
    const cents = intervalToCents(valStr);
    if (isNaN(cents)) {
      span.textContent = "";
    } else {
      span.textContent = cents.toFixed(2) + "￠";
    }
  }
}

function resetScaleToDefault() {
  const defaultVal = getDefaultIntervalValue();

  editor.innerHTML = "";

  const noteRow1 = document.createElement("div");
  noteRow1.className = "row note-row";
  noteRow1.dataset.degree = 1;
  noteRow1.innerHTML =
    '<button class="play-note" title="Play note">&#9654;</button>' +
    "<label>Note 1</label>" +
    '<input type="text" class="note-name" placeholder="name">' +
    '<span class="cumulative-cents"></span>';

  const intervalRow = document.createElement("div");
  intervalRow.className = "row interval-row";
  intervalRow.innerHTML = makeIntervalRowHTML(defaultVal);

  const noteRow2 = document.createElement("div");
  noteRow2.className = "row note-row";
  noteRow2.dataset.degree = 2;
  noteRow2.innerHTML =
    '<button class="play-note" title="Play note">&#9654;</button>' +
    "<label>Note 2</label>" +
    '<input type="text" class="note-name" placeholder="name">' +
    '<span class="cumulative-cents"></span>';

  editor.appendChild(noteRow1);
  editor.appendChild(intervalRow);
  editor.appendChild(noteRow2);

  updateRemoveBtn();
  updateCentsLabels();
  updateCumulativeCents();
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

function savePNG() {
  const link = document.createElement("a");
  link.download = "scale.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function populateDropdown(dropdown) {
  if (dropdown.children.length > 0) return;
  for (const hex of PALETTE) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-option";
    btn.style.background = hex;
    btn.dataset.color = hex;
    dropdown.appendChild(btn);
  }
}

function closeAllDropdowns() {
  const openDropdowns = editor.querySelectorAll(".color-dropdown.open");
  for (const dd of openDropdowns) {
    dd.classList.remove("open");
    const row = dd.closest(".interval-row");
    if (row) row.classList.remove("dropdown-open");
  }
}

function setSwatchColor(swatch, hex) {
  swatch.dataset.color = hex;
  swatch.style.background = hex;
}

function findColorForValue(value, excludeRow) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === excludeRow) continue;
    if (row.querySelector(".interval-ratio").value.trim() === trimmed) {
      const sw = row.querySelector(".color-swatch");
      if (sw && sw.dataset.color && sw.dataset.color !== "#FFFFFF") return sw.dataset.color;
    }
  }
  return null;
}

function syncIntervalColors(sourceRow) {
  const sourceValue = sourceRow.querySelector(".interval-ratio").value.trim();
  const sourceSwatch = sourceRow.querySelector(".color-swatch");
  if (!sourceSwatch || !sourceValue) return;
  const hex = sourceSwatch.dataset.color;
  const allRows = editor.querySelectorAll(".interval-row");
  for (const row of allRows) {
    if (row === sourceRow) continue;
    if (row.querySelector(".interval-ratio").value.trim() === sourceValue) {
      const sw = row.querySelector(".color-swatch");
      if (sw) setSwatchColor(sw, hex);
    }
  }
}

editor.addEventListener("click", function (e) {
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
  if (e.target.classList.contains("interval-ratio")) {
    const row = e.target.closest(".interval-row");
    if (row) {
      const existingColor = findColorForValue(e.target.value, row);
      if (existingColor) {
        const sw = row.querySelector(".color-swatch");
        if (sw) setSwatchColor(sw, existingColor);
      }
    }
  }
  updateCentsLabels();
  updateCumulativeCents();
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
edoDivisionsInput.addEventListener("input", onEdoDivisionsChange);

updateRemoveBtn();
updateZoom();
updateCentsLabels();
updateCumulativeCents();
render();
