(function (global) {
  'use strict';
  const VERSION = '1.1.0';
  const release = global.KC_CENTRAL_RELEASE_MANIFEST?.releaseVersion || 'unknown';
  const KEY = `kc_runtime_diagnostics_${String(release).replace(/[^0-9a-z]+/gi, '_')}`;
  const MAX = 80;
  const sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const sessionStartedAt = new Date().toISOString();
  let lastBeat = performance.now(), lastLongTask = 0, mutationWindow = [];
  function loadAll() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
  function currentSession() { return loadAll().filter(x => x.sessionId === sessionId); }
  function record(type, detail, severity = 'error', extra = {}) {
    const list = loadAll();
    const item = { id: crypto.randomUUID?.() || String(Date.now()), time: new Date().toISOString(), sessionId, release, type, severity, detail: String(detail || ''), url: location.href, ...extra };
    list.unshift(item); localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    global.dispatchEvent(new CustomEvent('kc-runtime-incident', { detail: item })); return item;
  }
  global.addEventListener('error', e => record('javascript-error', e.message || 'Unbekannter JavaScript-Fehler', 'error', { file: e.filename, line: e.lineno, column: e.colno, stack: e.error?.stack || '' }), true);
  global.addEventListener('unhandledrejection', e => record('unhandled-promise', e.reason?.message || String(e.reason || 'Unbehandelte Promise-Ablehnung'), 'error', { stack: e.reason?.stack || '' }));
  try { new PerformanceObserver(list => { for (const x of list.getEntries()) { lastLongTask = Date.now(); record('long-task', `Hauptthread ${Math.round(x.duration)} ms blockiert`, 'warning', { duration: Math.round(x.duration) }); } }).observe({ entryTypes: ['longtask'] }); } catch {}
  setInterval(() => { const now = performance.now(), delay = now - lastBeat - 1000; lastBeat = now; if (delay > 1800) record('event-loop-stall', `Oberfläche reagierte etwa ${Math.round(delay)} ms nicht`, 'warning', { delay: Math.round(delay), lastLongTask }); }, 1000);
  function monitorMutations(root) {
    if (!root) return;
    new MutationObserver(ms => { const n = ms.reduce((a, m) => a + m.addedNodes.length + m.removedNodes.length, 0), now = Date.now(); mutationWindow.push([now, n]); mutationWindow = mutationWindow.filter(x => now - x[0] < 2000); const sum = mutationWindow.reduce((a, x) => a + x[1], 0); if (sum > 700) { record('mutation-storm', `${sum} DOM-Änderungen in 2 Sekunden`, 'warning', { mutations: sum, target: root.id || root.className }); mutationWindow = []; } }).observe(root, { childList: true, subtree: true });
  }
  document.addEventListener('DOMContentLoaded', () => { monitorMutations(document.getElementById('tvPreviewScreen')); monitorMutations(document.getElementById('tvContextEditor')); });
  function clear() { const keep = loadAll().filter(x => x.sessionId !== sessionId); if (keep.length) localStorage.setItem(KEY, JSON.stringify(keep)); else localStorage.removeItem(KEY); global.dispatchEvent(new CustomEvent('kc-runtime-cleared')); }
  function environment() { const xs = currentSession(); return { runtimeIncidents: xs, runtimeErrorCount: xs.filter(x => x.severity === 'error').length, runtimeWarningCount: xs.filter(x => x.severity === 'warning').length, lastRuntimeIncident: xs[0] || null, runtimeSessionId: sessionId, runtimeSessionStartedAt: sessionStartedAt, runtimeRelease: release }; }
  global.KCRuntimeStability = { version: VERSION, record, incidents: currentSession, history: loadAll, clear, environment };
})(window);
