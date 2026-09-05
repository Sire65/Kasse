/* SelectionCore V0.2.0 – single selection source for the TV editor */
(function (w) {
  'use strict';
  const listeners = new Set();
  let current = Object.freeze({ key: 'slide', node: null, slideId: null });
  function emit(type) { const event = { type, current }; listeners.forEach(fn => { try { fn(event); } catch (error) { console.error('SelectionCore listener', error); } }); }
  function select(key, node, detail = {}) { current = Object.freeze({ key: key || 'slide', node: node || null, slideId: detail.slideId || null }); emit('select'); return current; }
  function clear() { current = Object.freeze({ key: 'slide', node: null, slideId: null }); emit('clear'); return current; }
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function get() { return current; }
  w.KCSelectionCore = { version: '0.2.0', select, clear, on, get };
})(window);
