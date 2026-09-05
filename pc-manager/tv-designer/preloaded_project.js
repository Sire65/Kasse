/* The editable Designer and the TV player deliberately share one canonical project. */
window.FS_PRELOADED_PROJECT = window.KC_DESIGNER_MARKET_PRESENTATION
  ? JSON.parse(JSON.stringify(window.KC_DESIGNER_MARKET_PRESENTATION))
  : null;
