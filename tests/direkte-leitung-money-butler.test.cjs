/* KC-RT-PROGRAMME (11.10.2026): Money Butler an der direkten Leitung.
   1. Ohne Anmeldung keine Leitung (Money Butler arbeitet wie bisher).
   2. Kanal wird mit dem eigenen Anmelde-Token für Bereich "money-butler" erfragt.
   3. Nach "Über KC Communicator senden" + Signal "geld": Rückmeldung "✓ … übernommen und an die Kasse weitergegeben".
   4. Fremde Übergaben (andere Transfer-ID) lösen KEINE Rückmeldung aus.
   5. Zählung: Signal "zaehlung" → "✓ Zählung … übernommen".
   6. Signal "einstellungen" → gemeinsame Messwerte neu laden.
   7. Eingebunden nach der Communicator-Brücke; nur im echten Money Butler (Schulung hat keine Anmeldung). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const W = path.join(__dirname, '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
let fehler = 0; const pr = (n, b, z = '') => { console.log(`${b ? '  OK  ' : 'FEHLER'}  ${n}${z ? '  [' + z + ']' : ''}`); if (!b) fehler++; };
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

function umgebung({ token = 'tok-123', listen = {} } = {}) {
  const sockets = [], log = [], elemente = {};
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.gesendet = []; sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 5); }
    send(t) { this.gesendet.push(JSON.parse(t)); }
    close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose(), 1); }
    antworte(d) { this.onmessage && this.onmessage({ data: JSON.stringify(d) }); }
  }
  function element(id) {
    return elemente[id] || (elemente[id] = { id, textContent: '', hidden: false, style: {}, insertAdjacentElement(_w, e) { elemente[e.id] = e; } });
  }
  element('commSendStatus');
  let klickHoerer = null, aktuell = { kind: 'transfer', payload: { transferId: 'T-1', total: 50 } };
  const win = {
    WebSocket: FakeWS, addEventListener() {},
    KCMoneyButlerAuth: { getAccessToken: async () => token },
    KCMoneyButlerCommunicator: { payloadLesen: () => aktuell },
    KCCommunicationClient: function () { return { _request: async (fn, a) => { log.push(['liste', a.action]); return { items: listen[a.action] || [] }; } }; },
    pullCashMeasureSettings: () => { log.push(['messwerte']); return Promise.resolve(true); },
  };
  const fetchMock = async (url, opt) => { log.push(['fetch', url.split('/rest/v1/')[1], JSON.parse(opt.body).p_bereich, opt.headers.Authorization]); return { ok: true, json: async () => 'kc-rt-mb-test' }; };
  const ctx = { window: win, globalThis: win, fetch: fetchMock, AbortSignal,
    document: { addEventListener: (t, f) => { if (t === 'click') klickHoerer = f; }, hidden: false, getElementById: (id) => elemente[id] || null,
      createElement: () => ({ id: '', textContent: '', hidden: false, style: {}, className: '' }) },
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, JSON, Date, String, Object, Math, Number, Array, encodeURIComponent, console };
  vm.createContext(ctx);
  vm.runInContext(lies('shared/kc-direkte-leitung.js').replace('startNachMs != null ? o.startNachMs : 3000', 'startNachMs != null ? o.startNachMs : 0'), ctx);
  vm.runInContext(lies('money-butler/kc-direkte-leitung-mb.js'), ctx);
  return { win, sockets, log, elemente, klick: () => klickHoerer && klickHoerer({ target: { id: 'commSend' } }), setze: (a) => { aktuell = a; } };
}
const bestaetigt = (u) => (u.elemente.commSendBestaetigt || {}).textContent || '';

(async () => {
  { const u = umgebung({ token: '' }); await warte(60);
    pr('Ohne Anmeldung keine Leitung', u.sockets.length === 0 && !u.win.KCDirekteLeitungMoneyButler.steht()); }

  const u = umgebung({ listen: { cash_transfer_list: [
    { status: 'handed_to_register', payload: { cashPayload: { transferId: 'FREMD-9', total: 10 } } },
  ] } });
  await warte(60);
  const f = u.log.find((x) => x[0] === 'fetch');
  pr('Kanal mit eigenem Token für Bereich "money-butler" erfragt', !!f && f[1] === 'rpc/kc_rt_programm_kanal' && f[2] === 'money-butler' && f[3] === 'Bearer tok-123', JSON.stringify(f));
  const ws = u.sockets[0];
  ws.antworte({ event: 'phx_reply', topic: 'realtime:kc-rt-mb-test', payload: { status: 'ok' } });
  pr('Leitung steht nach "ok"', u.win.KCDirekteLeitungMoneyButler.steht());
  const signal = (art) => ws.antworte({ event: 'broadcast', topic: 'realtime:kc-rt-mb-test', payload: { event: 'neu', payload: { art } } });

  u.klick(); signal('geld'); await warte(900);
  pr('Fremde Übergabe → keine Rückmeldung', bestaetigt(u) === '', bestaetigt(u));

  // jetzt ist "unsere" Übergabe T-1 beim Manager angekommen und an die Kasse weitergegeben
  const u2 = umgebung({ listen: { cash_transfer_list: [
    { status: 'manager_received', payload: { cashPayload: { transferId: 'FREMD-9', total: 10 } } },
    { status: 'handed_to_register', payload: { cashPayload: { transferId: 'T-1', total: 50 } } },
  ], cash_count_list: [{ status: 'manager_received', payload: { countId: 'Z-7', total: 812.4 } }] } });
  await warte(60);
  const ws2 = u2.sockets[0];
  ws2.antworte({ event: 'phx_reply', topic: 'realtime:kc-rt-mb-test', payload: { status: 'ok' } });
  const signal2 = (art) => ws2.antworte({ event: 'broadcast', topic: 'realtime:kc-rt-mb-test', payload: { event: 'neu', payload: { art } } });
  await warte(700); // nachholen vor dem Senden: noch nichts gesendet → keine Rückmeldung
  pr('Vor dem Senden keine Rückmeldung', bestaetigt(u2) === '');
  u2.klick(); signal2('geld'); await warte(900);
  pr('Eigene Übergabe übernommen → "✓ … an die Kasse weitergegeben"', /^✓ \d\d:\d\d: 50,00\s€ vom PC-Manager übernommen und an die Kasse weitergegeben\.$/.test(bestaetigt(u2)), bestaetigt(u2));
  u2.setze({ kind: 'count', payload: { countId: 'Z-7', total: 812.4 } });
  u2.klick(); signal2('zaehlung'); await warte(900);
  pr('Zählung übernommen → "✓ Zählung … übernommen"', /Zählung über 812,40\s€ vom PC-Manager übernommen/.test(bestaetigt(u2)), bestaetigt(u2));
  signal2('einstellungen'); await warte(50);
  pr('Signal "einstellungen" → Messwerte neu laden', u2.log.some((x) => x[0] === 'messwerte'));

  const h = lies('money-butler/index.html');
  pr('Eingebunden nach der Communicator-Brücke', h.indexOf('kc-communicator-bridge.js') < h.indexOf('../shared/kc-direkte-leitung.js?build=1.0.0') && h.includes('kc-direkte-leitung-mb.js?build=1.0.0'));
  pr('Schulungs-Money-Butler (ohne Anmeldung) bleibt ohne Leitung', !lies('schulung/money-butler/index.html').includes('direkte-leitung'));
  console.log(fehler ? `\n${fehler} FEHLER` : '\nAlles OK'); process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
