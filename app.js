const BORDER_WIDTH = 3;
const PX_PER_CENT = 1;
const RECT_WIDTH = 200;
const TEXT_MARGIN = 12;
const CANVAS_PADDING = 20;
const DPR = window.devicePixelRatio || 2;

const editor = document.getElementById("editor");
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const addBtn = document.getElementById("add-note");
const removeBtn = document.getElementById("remove-note");
const saveBtn = document.getElementById("save-png");
const zoomSlider = document.getElementById("zoom");
const zoomValue = document.getElementById("zoom-value");
const baseNoteSelect = document.getElementById("base-note");

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
      const ratioStr = row.querySelector(".interval-ratio").value.trim();
      const ratio = parseRatio(ratioStr);
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

function addNote() {
  const degree = getDegreeCount() + 1;

  const intervalRow = document.createElement("div");
  intervalRow.className = "row interval-row";
  intervalRow.innerHTML =
    '<input type="text" class="interval-ratio" placeholder="ratio" value="9/8">' +
    '<span class="cents-label"></span>' +
    '<input type="text" class="interval-label" placeholder="label">';

  const noteRow = document.createElement("div");
  noteRow.className = "row note-row";
  noteRow.dataset.degree = degree;
  noteRow.innerHTML =
    "<label>Note " + degree + "</label>" +
    '<input type="text" class="note-name" placeholder="name">' +
    '<button class="play-note" title="Play note">&#9654;</button>';

  editor.appendChild(intervalRow);
  editor.appendChild(noteRow);
  updateRemoveBtn();
  updateCentsLabels();
  render();
}

function removeLastNote() {
  if (getDegreeCount() <= 2) return;
  const rows = editor.children;
  editor.removeChild(rows[rows.length - 1]);
  editor.removeChild(rows[rows.length - 1]);
  updateRemoveBtn();
  updateCentsLabels();
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
      data.push({
        type: "interval",
        ratio: ratioStr,
        label: row.querySelector(".interval-label").value.trim(),
      });
    }
  }
  return data;
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

      const ratio = parseRatio(interval.ratio);
      if (isNaN(ratio) || ratio <= 0) {
        i++;
        continue;
      }

      const cents = ratioToCents(ratio);
      intervals.push({
        cents: cents,
        label: interval.label,
        ratio: interval.ratio,
        noteBelow: note.name,
        noteAbove: nextNote ? nextNote.name : "",
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
  const stackHeight = totalCents * PX_PER_CENT;

  const font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
  const monoFont = '21px "SF Mono", "Fira Code", Consolas, monospace';

  ctx.font = font;
  let maxTextWidth = 0;
  for (const iv of intervals) {
    const parts = [];
    if (iv.noteBelow) parts.push(iv.noteBelow);
    if (iv.noteAbove) parts.push(iv.noteAbove);
    if (iv.label) parts.push(iv.label);
    if (iv.ratio) parts.push(iv.ratio);
    for (const t of parts) {
      const w = ctx.measureText(t).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }
  }

  const textAreaWidth = maxTextWidth + TEXT_MARGIN * 2;
  const displayWidth = CANVAS_PADDING + RECT_WIDTH + TEXT_MARGIN + textAreaWidth + CANVAS_PADDING;
  const displayHeight = CANVAS_PADDING * 2 + stackHeight;

  canvas.width = Math.round(displayWidth * DPR);
  canvas.height = Math.round(displayHeight * DPR);
  canvas.style.width = displayWidth + "px";
  canvas.style.height = displayHeight + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const baseX = CANVAS_PADDING;
  const baseY = CANVAS_PADDING + stackHeight;

  let y = baseY;

  for (let j = 0; j < intervals.length; j++) {
    const iv = intervals[j];
    const h = iv.cents * PX_PER_CENT;
    const rectY = y - h;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(baseX, rectY, RECT_WIDTH, h);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = BORDER_WIDTH;
    ctx.strokeRect(baseX, rectY, RECT_WIDTH, h);

    const textX = baseX + RECT_WIDTH + TEXT_MARGIN;

    ctx.fillStyle = "#000";
    ctx.textBaseline = "middle";

    if (iv.label || iv.ratio) {
      const midY = rectY + h / 2;
      const centerX = baseX + RECT_WIDTH / 2;
      ctx.textAlign = "center";
      const labelText = iv.label || "";
      const ratioText = iv.ratio || "";
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

function updateCentsLabels() {
  const rows = editor.querySelectorAll(".interval-row");
  for (const row of rows) {
    const ratioStr = row.querySelector(".interval-ratio").value.trim();
    const span = row.querySelector(".cents-label");
    const ratio = parseRatio(ratioStr);
    if (isNaN(ratio) || ratio <= 0) {
      span.textContent = "";
    } else {
      const cents = ratioToCents(ratio);
      span.textContent = cents.toFixed(2) + "￠";
    }
  }
}

function savePNG() {
  const link = document.createElement("a");
  link.download = "scale.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

editor.addEventListener("input", function () {
  updateCentsLabels();
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

updateRemoveBtn();
updateZoom();
updateCentsLabels();
render();
