// Prueft die Farb-Klassifizierung der neuen Anwesenheits-Ampel (kc-team-praesenz.js) OHNE
// Browser - laedt das Modul in einer minimalen vm-Sandbox mit gefaelschtem fetch/localStorage,
// genau wie tests/time-clock-core.test.cjs es fuer den Core selbst schon macht.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function ladeModul({ fetchImpl, localStorageEvents = [] } = {}) {
  const store = { kc_time_clock_events_v1: JSON.stringify(localStorageEvents) };
  const context = {
    window: {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
    },
    fetch: fetchImpl,
    CustomEvent: class CustomEvent { constructor(name) { this.name = name; } },
    Date,
    setTimeout: () => {}, // die eigene, automatische 2s-/20s-Wiederholung ist hier nicht Testgegenstand -
    setInterval: () => {}, // der Test ruft aktualisieren() gezielt selbst auf
  };
  context.window.KCSyncConnection = { buildUrl: () => 'http://127.0.0.1:47391/kc-sync-team-status' };
  context.window.normalizeOperatorProfiles = () => [
    { id: 'team', name: 'Team' },
    { id: 'kc-0007', name: 'Einhorn' },
    { id: 'kc-0003', name: 'Puhbär' },
    { id: 'kc-0009', name: 'Tigger' },
  ];
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(root, 'cores/time-clock-core/time-clock-core.js'), 'utf8'),
    context
  );
  vm.runInContext(fs.readFileSync(path.join(root, 'pos/kc-team-praesenz.js'), 'utf8'), context);
  return context;
}

const stunden = (n) => new Date(Date.now() - n * 3600000).toISOString();

async function testZentraleQuelle() {
  // Manager antwortet: Einhorn ist gerade eingecheckt (1h), Puhbär ist schon lange offen (11h,
  // vermutlich vergessenes Auschecken), Tigger ist bereits wieder ausgecheckt.
  const events = [
    { id: 'e1', personId: 'kc-0007', kind: 'in', effectiveAt: stunden(1), voidedAt: null },
    { id: 'e2', personId: 'kc-0003', kind: 'in', effectiveAt: stunden(11), voidedAt: null },
    { id: 'e3', personId: 'kc-0009', kind: 'in', effectiveAt: stunden(5), voidedAt: null },
    { id: 'e4', personId: 'kc-0009', kind: 'out', effectiveAt: stunden(2), voidedAt: null },
  ];
  const ctx = ladeModul({
    fetchImpl: async () => ({ ok: true, json: async () => ({ ereignisse: events }) }),
  });
  await ctx.window.KCTeamPraesenz.aktualisieren();
  assert.equal(ctx.window.KCTeamPraesenz.quelle(), 'zentral', 'Quelle sollte "zentral" sein, wenn der Manager antwortet');
  assert.equal(ctx.window.KCTeamPraesenz.farbe('kc-0007'), 'gruen', 'Einhorn (1h eingecheckt) sollte gruen sein');
  assert.equal(ctx.window.KCTeamPraesenz.farbe('kc-0003'), 'gelb', 'Puhbär (11h eingecheckt) sollte gelb sein');
  assert.equal(ctx.window.KCTeamPraesenz.farbe('kc-0009'), 'rot', 'Tigger (ausgecheckt) sollte rot sein');
  assert.equal(ctx.window.KCTeamPraesenz.farbe('kc-0099'), 'rot', 'Unbekannte Person sollte rot (nicht anwesend) sein, nicht abstuerzen');
}

async function testLokalerRueckfall() {
  // Manager NICHT erreichbar (Netzwerkfehler) - Ampel muss auf die eigenen, lokal
  // gespeicherten Stempel-Ereignisse dieser Kasse zurueckfallen, nicht leer/abstuerzen.
  const lokaleEvents = [
    { id: 'l1', personId: 'kc-0007', kind: 'in', effectiveAt: stunden(0.5), voidedAt: null },
  ];
  const ctx = ladeModul({
    fetchImpl: async () => { throw new Error('Companion nicht erreichbar (simuliert)'); },
    localStorageEvents: lokaleEvents,
  });
  await ctx.window.KCTeamPraesenz.aktualisieren();
  assert.equal(ctx.window.KCTeamPraesenz.quelle(), 'lokal', 'Quelle sollte bei Netzwerkfehler auf "lokal" zurueckfallen');
  assert.equal(ctx.window.KCTeamPraesenz.farbe('kc-0007'), 'gruen', 'Einhorn sollte auch aus den lokalen Daten korrekt gruen sein');
}

async function testTeamHatKeineFarbe() {
  // "Team" ist kein echter Mensch - core.summarize() liefert dafuer ohnehin keine Zeile,
  // farbe('team') muss also den sicheren Rot-Standard liefern, nicht abstuerzen. Die
  // eigentliche Entscheidung, fuer "team" GAR KEINE LED anzuzeigen, trifft app.js selbst.
  const ctx = ladeModul({ fetchImpl: async () => ({ ok: true, json: async () => ({ ereignisse: [] }) }) });
  await ctx.window.KCTeamPraesenz.aktualisieren();
  assert.equal(ctx.window.KCTeamPraesenz.farbe('team'), 'rot');
}

(async () => {
  await testZentraleQuelle();
  await testLokalerRueckfall();
  await testTeamHatKeineFarbe();
  console.log('kc-team-praesenz.test.cjs: OK (zentrale Quelle, lokaler Rueckfall, Team-Sonderfall)');
})().catch((err) => { console.error('FEHLER:', err.message); process.exit(1); });
