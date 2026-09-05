(function (global) {
  'use strict';
  const VERSION = '0.1.1';
  const SCHEMA = 'KC_EVENT_PROGRAM_PACKAGE_V1';
  const ALLOWED_KEYS = Object.freeze(['schema', 'version', 'createdAt', 'selection', 'program', 'weather', 'staffing', 'checksum']);
  const FORBIDDEN_KEYS = Object.freeze(['articles', 'articleGroups', 'prices', 'receipts', 'transactions', 'cashState', 'users', 'permissions']);
  const CONTRACT = Object.freeze({
    coreId: 'EventProgramExchangeCore', runtimeId: 'shared.event-program.exchange', version: VERSION,
    apiVersion: '0.1.0', schema: SCHEMA, behaviorOwner: 'central-core-runtime',
    allowedScopes: Object.freeze(['program', 'rating', 'weather-hint', 'staffing-hint']),
    forbiddenScopes: Object.freeze(['articles', 'prices', 'receipts', 'transactions', 'cash-state', 'users', 'permissions']),
    releaseGate: 'YELLOW_REAL_DEVICE_EVIDENCE_OPEN'
  });
  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function checksum(value) { const source = stable(value); let hash = 2166136261; for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619); return (hash >>> 0).toString(16).padStart(8, '0'); }
  function label(value) { return ({ low: 'schwach', normal: 'mittel', high: 'gut', 'very-high': 'sehr gut' })[value] || 'mittel'; }
  function color(value) { return ({ low: 'gray', normal: 'yellow', high: 'lightgreen', 'very-high': 'green' })[value] || 'yellow'; }
  function create(data, selection = { program: true, rating: true, weather: false, staffing: false }) {
    const safeSelection = { program: true, rating: selection.rating !== false, weather: selection.weather === true, staffing: selection.staffing === true };
    const body = {
      schema: SCHEMA, version: VERSION, createdAt: new Date().toISOString(), selection: safeSelection,
      program: (data.program || []).map(item => ({ id: item.id || '', date: item.date || '', time: item.time || '', endTime: item.endTime || '', title: item.title || '', place: item.place || '', active: item.active !== false, impact: safeSelection.rating ? (item.impact || 'normal') : 'normal', weatherIndependent: !!item.weatherIndependent })),
      weather: safeSelection.weather ? (data.weather || null) : null,
      staffing: safeSelection.staffing ? (data.staffing || null) : null
    };
    return { ...body, checksum: checksum(body) };
  }
  function verify(pkg) {
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return { ok: false, error: 'Programmdatei ist ungültig.' };
    if (pkg.schema !== SCHEMA) return { ok: false, error: 'Unbekanntes Programmformat.' };
    const forbidden = FORBIDDEN_KEYS.filter(key => Object.prototype.hasOwnProperty.call(pkg, key));
    if (forbidden.length) return { ok: false, error: 'Unzulässige Kassendaten im Programmpaket: ' + forbidden.join(', ') + '.' };
    const unknown = Object.keys(pkg).filter(key => !ALLOWED_KEYS.includes(key));
    if (unknown.length) return { ok: false, error: 'Unbekannte Felder im Programmpaket: ' + unknown.join(', ') + '.' };
    if (!Array.isArray(pkg.program)) return { ok: false, error: 'Programmliste fehlt.' };
    if (pkg.selection?.program !== true) return { ok: false, error: 'Programmbereich muss aktiv sein.' };
    if (pkg.program.some(item => !['low', 'normal', 'high', 'very-high'].includes(item?.impact))) return { ok: false, error: 'Ungültige Programmbewertung.' };
    const body = { ...pkg }; delete body.checksum;
    if (checksum(body) !== pkg.checksum) return { ok: false, error: 'Prüfsumme stimmt nicht.' };
    return { ok: true, package: pkg };
  }
  const api = Object.freeze({ version: VERSION, schema: SCHEMA, contract: CONTRACT, create, verify, label, color, checksum });
  global.KCEventProgramExchangeContract = CONTRACT;
  global.KCEventProgramExchangeCore = api;
  global.KCReleaseManifest?.register?.('eventProgramExchange', VERSION)?.register?.('eventProgramStudioCatalog', '1.0.0')?.register?.('eventProgramTuvRules', '1.0.0');
})(window);
