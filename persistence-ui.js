// ---------------------------------------------------------------------------
// The toolbar, and the file flows behind it.
//
// This file only *defines* functions and *wires* listeners at its top level: it
// loads before app.js, which runs at load time, so it must never call into
// app.js here. Its handlers resolve app.js's globals at click time, which is
// long afterwards.
// ---------------------------------------------------------------------------

const newBtn = document.getElementById("new-file");
const openBtn = document.getElementById("open-file");
const saveMenuBtn = document.getElementById("save-menu");
const saveMenuPanel = document.getElementById("save-menu-panel");
const saveScaleItem = document.getElementById("save-scale");
const toolbarMessage = document.getElementById("toolbar-message");
const openFileInput = document.getElementById("open-file-input");

// --- the Save menu ---------------------------------------------------------

/** Opens or closes the Save menu; omit `open` to flip it. */
function toggleSaveMenu(open) {
  const show = open === undefined ? !saveMenuPanel.classList.contains("open") : Boolean(open);
  saveMenuPanel.classList.toggle("open", show);
  saveMenuBtn.setAttribute("aria-expanded", String(show));
}

/** Called by app.js's closeAllDropdowns(), which closes every transient overlay. */
function closeSaveMenu() {
  toggleSaveMenu(false);
}

saveMenuBtn.addEventListener("click", function (event) {
  // Read the state first: closeAllDropdowns() closes this menu too, so asking
  // afterwards would always say "closed" and the button would never toggle off.
  const wasOpen = saveMenuPanel.classList.contains("open");
  event.stopPropagation();
  closeAllDropdowns();
  toggleSaveMenu(!wasOpen);
});
