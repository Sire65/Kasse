/* KC-RT-PROGRAMME (11.10.2026): direkte Leitung für PC-Manager (Muster wie Club-App KC-CLUB-REALTIME).
   Geprüft mit nachgebautem WebSocket (kein Netz nötig):
   1. Ohne Kanal (nicht angemeldet / keine Berechtigung) wird KEINE Leitung aufgebaut – Manager fragt wie bisher nach.
   2. Mit Kanal: phx_join auf "realtime:<kanal>" mit öffentlichem Schlüssel, nach "ok" steht die Leitung, einmal nachholen.
   3. Signale: geld/zaehlung → Geld abholen, einstellungen → Messwerte holen, dienstplan → Sollplan holen (je einmal).
   4. Leitung bricht ab → steht() false, Neuverbinden nach kurzer Pause.
   5. Geld-Abholung: bei stehender Leitung nur noch jede Minute, ohne Leitung wie bisher alle 15 s.
   6. Manager und Schulungs-Manager haben dieselben Dateien und binden sie ein; das Signal enthält nie Inhalte. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let fehler = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function baueUmgebung({ kanal = 'kc-rt-test', angemeldet = true } = {}) {
  const sockets = [], aufrufe = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.gesendet = []; sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 5); }
    send(t) { this.gesendet.push(JSON.parse(t)); }
    close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose(), 1); }
    antworte(d) { this.onmessage && this.onmessage({ data: JSON.stringify(d) }); }
  }
  const led = { dataset: {}, attr: {}, getAttribute(k) { return this.attr[k] || null; }, setAttribute(k, v) { this.attr[k] = v; } };
  const win = {
    WebSocket: FakeWS, addEventListener() {},
    KCSupabase: { istAngemeldet: () => angemeldet, rufeFunktionAuf: async (name, arg) => { aufrufe.push(['rpc', name, arg.p_bereich]); return kanal; } },
    KCMoneyButlerCloudIntake: { poll: () => aufrufe.push(['geld']) },
    KCFinanceUebergaben: { listeLaden: (m) => aufrufe.push(['eingangsliste', m]) },
    KCCashMeasureCentralSync: { pull: (o) => aufrufe.push(['einstellungen', !!(o && o.publish)]) },
    KCDienstplanManager: { holeUndVeroeffentliche: () => aufrufe.push(['dienstplan']) },
  };
  const ctx = { window: win, globalThis: win, document: { addEventListener() {}, hidden: false, querySelector: () => led },
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, JSON, Date, String, Object, Math, encodeURIComponent, console };
  vm.createContext(ctx);
  vm.runInContext(lies('shared/kc-direkte-leitung.js').replace("startNachMs != null ? o.startNachMs : 3000", "startNachMs != null ? o.startNachMs : 0"), ctx);
  vm.runInContext(lies('pc-manager/kc-direkte-leitung-manager.js'), ctx);
  return { win, sockets, aufrufe, led };
}

(async () => {
  // 1. ohne Anmeldung
  { const u = baueUmgebung({ angemeldet: false }); await warte(60);
    pr('Ohne Supabase-Anmeldung keine Leitung (Manager fragt wie bisher nach)', u.sockets.length === 0 && !u.win.KCDirekteLeitungManager.steht()); }
  // 1b. angemeldet, aber nicht berechtigt (Datenbank liefert null)
  { const u = baueUmgebung({ kanal: null }); await warte(60);
    pr('Ohne Berechtigung (Kanal null) keine Leitung', u.sockets.length === 0 && u.aufrufe.some((a) => a[0] === 'rpc'), JSON.stringify(u.aufrufe)); }
  // 2.–4.
  const u = baueUmgebung(); await warte(60);
  const ws = u.sockets[0];
  pr('Kanal wird für Bereich "manager" bei der Datenbank erfragt', u.aufrufe.some((a) => a[0] === 'rpc' && a[1] === 'kc_rt_programm_kanal' && a[2] === 'manager'));
  pr('Verbindung mit öffentlichem Schlüssel, Protokoll 1.0.0', !!ws && /realtime\/v1\/websocket\?apikey=sb_publishable_[^&]+&vsn=1\.0\.0$/.test(ws.url), ws && ws.url);
  const join = ws && ws.gesendet.find((m) => m.event === 'phx_join');
  pr('Anmeldung am eigenen Kanal (Broadcast, öffentlich, ohne Echo)', !!join && join.topic === 'realtime:kc-rt-test' && join.payload.config.broadcast.self === false && join.payload.config.private === false, JSON.stringify(join));
  pr('Vor der Bestätigung steht die Leitung noch nicht', !u.win.KCDirekteLeitungManager.steht());
  ws.antworte({ event: 'phx_reply', topic: 'realtime:kc-rt-test', payload: { status: 'ok' } });
  pr('Nach "ok" steht die Leitung', u.win.KCDirekteLeitungManager.steht());
  pr('LED-Hinweis "Direkte Leitung: steht"', u.led.dataset.direkteLeitung === 'steht' && /Direkte Leitung: steht/.test(u.led.attr.title || ''), u.led.attr.title);
  await warte(2300);
  pr('Nach dem Verbinden einmal nachgeholt (Geld und Dienstplan)', u.aufrufe.filter((a) => a[0] === 'geld').length === 1 && u.aufrufe.filter((a) => a[0] === 'dienstplan').length === 1, JSON.stringify(u.aufrufe));
  u.aufrufe.length = 0;
  const signal = (art) => ws.antworte({ event: 'broadcast', topic: 'realtime:kc-rt-test', payload: { event: 'neu', payload: { art } } });
  signal('geld'); signal('zaehlung'); signal('geld'); await warte(900);
  pr('Drei Geld-Signale kurz hintereinander → einmal abholen', u.aufrufe.filter((a) => a[0] === 'geld').length === 1, JSON.stringify(u.aufrufe));
  pr('Geld-Signal lädt auch die Eingangsliste im Bereich Money Butler neu (einmal)', u.aufrufe.filter((a) => a[0] === 'eingangsliste' && a[1] === false).length === 1, JSON.stringify(u.aufrufe));
  signal('einstellungen'); await warte(900);
  pr('Signal "einstellungen" → Messwerte-Einstellungen holen', u.aufrufe.some((a) => a[0] === 'einstellungen' && a[1] === true));
  signal('dienstplan'); await warte(1600);
  pr('Signal "dienstplan" → Sollplan holen', u.aufrufe.some((a) => a[0] === 'dienstplan'));
  u.aufrufe.length = 0; signal('irgendwas'); await warte(900);
  pr('Unbekanntes Signal löst nichts aus', u.aufrufe.length === 0, JSON.stringify(u.aufrufe));
  ws.close(); await warte(30);
  pr('Abbruch: Leitung steht nicht mehr, LED zeigt "aus"', !u.win.KCDirekteLeitungManager.steht() && u.led.dataset.direkteLeitung === 'aus');
  await warte(1300);
  pr('Nach kurzer Pause wird neu verbunden', u.sockets.length === 2, String(u.sockets.length));
  u.win.KCDirekteLeitungManager.zustand && pr('Zustand zählt Signale und Verbindungen', u.win.KCDirekteLeitungManager.zustand().signale === 6 && u.win.KCDirekteLeitungManager.zustand().verbindungen === 1, JSON.stringify(u.win.KCDirekteLeitungManager.zustand()));

  // 5. Geld-Abholung im Takt
  for (const steht of [false, true]) {
    let polls = 0; const timer = [];
    const win = { KCDirekteLeitungManager: { steht: () => steht }, KCCommunicationClient: function () {}, localStorage: { getItem: () => '{"token":"x"}', setItem() {}, removeItem() {} } };
    const ctx = { window: win, globalThis: win, localStorage: win.localStorage, document: { getElementById: () => null }, JSON, Date, Number, String, Array, console,
      setInterval: (f, ms) => { timer.push([f, ms]); return 1; }, setTimeout: () => 1 };
    vm.createContext(ctx);
    vm.runInContext(lies('pc-manager/kc-money-butler-cloud-intake.js'), ctx);
    win.KCMoneyButlerCloudIntake.poll = win.KCMoneyButlerCloudIntake.poll; // Abholen per Signal
    const [takt, ms] = timer.find((t) => t[1] === 15000) || [];
    const echtesPoll = ctx.window.KCMoneyButlerCloudIntake.poll;
    // Zählt, wie oft der 15-s-Takt tatsächlich abfragt (client() liefert hier null → poll kehrt sofort zurück)
    const vorher = Date.now; let jetzt = 1e12; Date.now = () => jetzt;
    let gefragt = 0; const orig = win.KCCommunicationClient; win.KCCommunicationClient = function () { gefragt++; return { _request: async () => ({ items: [] }) }; };
    for (let i = 0; i < 8; i++) { takt(); jetzt += 15000; await warte(5); }
    Date.now = vorher; win.KCCommunicationClient = orig;
    pr(`Geld-Abholung ${steht ? 'MIT' : 'OHNE'} Leitung: ${steht ? 'höchstens jede Minute' : 'alle 15 s'}`, ms === 15000 && (steht ? gefragt <= 2 : gefragt === 8), `${gefragt} Abfragen in 2 Minuten`);
    void echtesPoll;
  }

  // 6. Einbindung und Gleichstand
  for (const b of ['pc-manager', 'schulung/pc-manager']) {
    const h = lies(`${b}/index.html`);
    pr(`${b}: Baustein und Anschluss eingebunden (nach der Supabase-Anmeldung)`, h.indexOf('kc-direkte-leitung.js?build=1.0.0') > h.indexOf('kc-manager-supabase-status.js') && h.includes('kc-direkte-leitung-manager.js?build=1.1.0'));
  }
  pr('Manager und Schulungs-Manager gleich', lies('pc-manager/kc-direkte-leitung-manager.js') === lies('schulung/pc-manager/kc-direkte-leitung-manager.js') && lies('shared/kc-direkte-leitung.js') === lies('schulung/shared/kc-direkte-leitung.js') && lies('pc-manager/kc-money-butler-cloud-intake.js') === lies('schulung/pc-manager/kc-money-butler-cloud-intake.js'));
  const quelle = lies('shared/kc-direkte-leitung.js');
  pr('Kein geheimer Schlüssel im Baustein', !/sb_secret_|service_role/.test(quelle));
  const sql = lies('supabase/migrations/20261011_kc_rt_programme.sql');
  pr('Datenbank sendet nur die Art des Signals', /realtime\.send\(jsonb_build_object\('art', p_art\)/.test(sql) && !/realtime\.send\([^)]*(amount|total|payload|name)/i.test(sql));
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles OK'); process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
