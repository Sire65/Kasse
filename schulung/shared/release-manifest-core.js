(function (global) {
  'use strict';
  const CORE_VERSION = '1.0.0';
  const state = { status: 'LOADING', manifest: null, error: null, components: Object.create(null), checkedAt: null };
  const cleanVersion = value => String(value || '').trim().replace(/^v/i, '');
  function register(id, version) { if (id) state.components[id] = cleanVersion(version); if (state.manifest) validate(); return api; }
  function validate() {
    const issues = [], manifest = state.manifest;
    if (!manifest) issues.push({ level: 'error', code: 'REL-001', title: 'Zentrales Release-Manifest fehlt', detail: state.error || 'Das Manifest wurde noch nicht geladen.' });
    else {
      if (manifest.schema !== 'KC_CENTRAL_RELEASE_MANIFEST_V2') issues.push({ level: 'error', code: 'REL-002', title: 'Unbekanntes Manifest-Schema', detail: String(manifest.schema || 'nicht angegeben') });
      if (!manifest.releaseVersion || !manifest.displayVersion) issues.push({ level: 'error', code: 'REL-003', title: 'Release-Version unvollständig', detail: 'releaseVersion und displayVersion müssen gesetzt sein.' });
      Object.entries(manifest.components || {}).forEach(([id, requirement]) => {
        if (requirement.runtimeRequired === false) return;
        const actual = state.components[id], expected = cleanVersion(requirement.requiredVersion);
        if (!actual) issues.push({ level: 'error', code: 'REL-004', title: 'Komponente nicht registriert', detail: `${requirement.label || id}: erwartet ${expected}.`, component: id });
        else if (actual !== expected) issues.push({ level: 'error', code: 'REL-005', title: 'Komponentenversion weicht ab', detail: `${requirement.label || id}: geladen ${actual}, erwartet ${expected}.`, component: id });
      });
      if (manifest.releaseGate?.requirePracticalVisualCheck && manifest.verification?.practicalVisualCheck !== 'PASS') issues.push({ level: 'warning', code: 'REL-006', title: 'Praktische Sichtprüfung offen', detail: 'Der TV-Präsentationsbereich benötigt vor der Freigabe einen Browser- und Bildschirm-Rundlauf.' });
    }
    state.checkedAt = new Date().toISOString(); state.status = issues.some(x => x.level === 'error') ? 'BLOCKED' : issues.some(x => x.level === 'warning') ? 'CONDITIONAL' : 'PASS';
    return { schema: 'KC_RELEASE_GATE_REPORT_V1', coreVersion: CORE_VERSION, status: state.status, checkedAt: state.checkedAt, releaseVersion: manifest?.releaseVersion || null, displayVersion: manifest?.displayVersion || null, issues, components: { ...state.components } };
  }
  async function load() {
    try { if (!global.KC_CENTRAL_RELEASE_MANIFEST) throw new Error('Manifest-Skript ist nicht geladen.'); state.manifest = global.KC_CENTRAL_RELEASE_MANIFEST; state.error = null; }
    catch (error) { state.manifest = null; state.error = `Manifest konnte nicht geladen werden: ${error?.message || error}`; }
    const report = validate(); global.dispatchEvent(new CustomEvent('kc-release-manifest-ready', { detail: { manifest: state.manifest, report } })); return state.manifest;
  }
  const api = global.KCReleaseManifest = { VERSION: CORE_VERSION, state, register, validate, load, ready: null };
  api.ready = load();
})(window);
