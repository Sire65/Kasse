// Echter Fund 20.11.2026: Supabase speichert Cloud-Übergaben als jsonb und sortiert die Felder um.
// Die Prüfsumme des Money Butler (über die ursprüngliche Reihenfolge) ließ sich im PC-Manager deshalb
// nicht nachrechnen - jede Übergabe blieb "pending_manager". Dieser Test spielt genau das nach.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const quelle = fs.readFileSync(path.join(root, 'pc-manager/kc-money-butler-cloud-intake.js'), 'utf8');
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,"0")}
const isBusinessDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
// jsonb-Reihenfolge: kürzere Schlüssel zuerst, dann alphabetisch (wie Postgres)
const jsonbOrdnen = (o) => Array.isArray(o) ? o.map(jsonbOrdnen) : (o && typeof o === 'object')
  ? Object.fromEntries(Object.keys(o).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map((k) => [k, jsonbOrdnen(o[k])])) : o;
let fehler = 0; const ok = (b, t) => { console.log((b ? 'OK    ' : 'FEHLER ') + t); if (!b) fehler++; };

function lauf(cashPayload, amount) {
  const marks = [], queued = [], store = {};
  const items = [{ id: 'row-1', status: 'pending_manager', amount, payload: { cashPayload } }];
  class Client { constructor() {} async _request(fn, body) {
    if (body.action === 'cash_transfer_list') return { items };
    if (body.action === 'cash_transfer_mark') { marks.push(body.status); return { ok: true }; }
    if (body.action === 'cash_count_list') return { items: [] };
    return {};
  } }
  const win = { KCSupabase: { holeZugriffsToken: () => 'tok' }, KCCommunicationClient: Client, document: { getElementById: () => null, addEventListener() {} } };
  const ctx = vm.createContext({ window: win, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    checksum, isBusinessDate, queueCashTransferPayload: async (p) => { queued.push(p); }, console: { warn() {}, info() {}, log() {} },
    setInterval: () => 0, setTimeout: () => 0, Date, JSON, Math, Number, String, Array, Error, Object });
  vm.runInContext(quelle, ctx);
  return win.KCMoneyButlerCloudIntake.poll().then(() => ({ marks, queued, fehler: store.kcm_money_butler_cloud_last_error_v1 }));
}

(async () => {
  const original = { format: 'KC_CASH_TRANSFER', version: 4, type: 'opening', registerId: 'KASSE-01', effectiveDate: '2026-11-20',
    total: 127.11, breakdown: { 50: 1, 2: 26, 1: 25 }, transferId: '6cfdded3-5d37-4eda-9d7b-c0874f49118a', note: '', time: '2026-11-20T16:45:57.992Z' };
  original.checksum = checksum(JSON.stringify(original));
  const ausDb = jsonbOrdnen(JSON.parse(JSON.stringify(original)));
  ok(JSON.stringify(ausDb) !== JSON.stringify(original), 'Datenbank-Fassung hat andere Feldreihenfolge (Ausgangslage nachgestellt)');
  const r = await lauf(ausDb, '127.11');
  ok(r.queued.length === 1, 'Umsortierte Übergabe wird an die Kasse weitergegeben');
  ok(r.marks.join(',') === 'manager_received,handed_to_register', 'Status wird auf übernommen/weitergegeben gesetzt');
  const r2 = await lauf(ausDb, '99.00');
  ok(r2.queued.length === 0 && /stimmen nicht/.test(r2.fehler || ''), 'Betrag Spalte ≠ Datensatz wird weiterhin abgelehnt');
  const ohne = { ...ausDb }; delete ohne.checksum;
  const r3 = await lauf(ohne, '127.11');
  ok(r3.queued.length === 0 && /fehlt/.test(r3.fehler || ''), 'Fehlende Prüfsumme wird weiterhin abgelehnt');
  const r4 = await lauf(JSON.parse(JSON.stringify(original)), '127.11');
  ok(r4.queued.length === 1, 'Originalreihenfolge funktioniert weiterhin');
  console.log(fehler ? `\n${fehler} FEHLER` : '\nMoney Butler Cloud (jsonb-Reihenfolge): alles bestanden');
  process.exit(fehler ? 1 : 0);
})();
