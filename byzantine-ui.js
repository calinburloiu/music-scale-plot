// Byzantine notation: the editor UI.
//
// This file declares functions only. It loads before app.js, so it must not
// read app.js's top-level constants (editor, ctx, …) at load time — only from
// inside a function body, which runs after app.js has loaded.

/** The two symbol wells and their picker panels, for one note row. */
function makeSymbolWellsHTML() {
  return (
    '<div class="fthora-well-wrapper">' +
      '<button type="button" class="fthora-well is-empty" title="Fthora"></button>' +
      '<div class="fthora-picker"></div>' +
    "</div>" +
    '<div class="martyria-well-wrapper">' +
      '<button type="button" class="martyria-well is-empty" title="Martyria"></button>' +
      '<div class="martyria-picker"></div>' +
    "</div>"
  );
}
