// KC Verkäufe abholen – PC-Manager (26.11.2026, Betreiber: „Ja bau das ein, aber super vorsichtig“, KC-MANAGER-VERKAEUFE-ABHOLEN).
//
// Die Verkäufe kommen über den sicheren Weg (Tablet -> Mini-PC/schwarzes Fenster -> Manager-Dienst) längst vollständig an
// (received_events, Endpunkt /verkaeufe-abholen seit 10.09.2026) - der PC-Manager hat sie nur nie abgeholt. Die Auswertungen
// (Dashboard, Umsatz- und Kundenanalyse, Mengen und Bestand) füllten sich deshalb nur per Datei-Import (.kcsales).
//
// Hier: beim Öffnen und dann jede Minute abholen, plus Knopf „Jetzt holen“. Übernommen wird über
// KCManagerVerkaeufe.uebernehmen (app.js) - dieselbe Zusammenführung wie der Datei-Import, doppelte werden übersprungen.
// VORSICHT:
//  - Der Manager-Dienst löscht empfangene Buchungen nie (auch alte Tests/Märkte). Darum zählen nur Buchungen ab dem Datum
//    „Verkäufe zählen ab“ (Vorgabe: Marktbeginn aus kc-wm2026-programm.js, änderbar, gespeichert in kcm_verkaeufe_ab).
//  - Fehler (Dienst nicht erreichbar) nur als ruhige Statuszeile, kein Fenster - die Kasse bucht davon unabhängig weiter.
//  - Nie zwei Abholungen gleichzeitig.
(function (global) {
  'use strict';
  const DIENST = 'http://127.0.0.1:47392';
  const AB_KEY = 'kcm_verkaeufe_ab';
  const TAKT_MS = 60000;
  const UEBERLAPPUNG_MS = 5 * 60000; // beim schlanken Nachholen 5 Min. zurück - Doppelte fängt die Zusammenführung ab
  const VORGABE_AB = global.KC_WM2026_PROGRAMM?.ZEITRAUM?.von || '2026-12-04';

  let laeuft = false, letzteAbfrage = null, letzteNachricht = null;

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uhr = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const datumDe = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}.${m}.${y}`; };
  function abDatum() {
    let v = null; try { v = localStorage.getItem(AB_KEY); } catch (e) { /* ohne Speicher: Vorgabe */ }
    return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : VORGABE_AB;
  }

  function zeige(text, art) {
    letzteNachricht = { text, art };
    document.querySelectorAll('.kc-vab-stand').forEach((f) => { f.textContent = text; f.className = 'kc-vab-stand' + (art ? ' ' + art : ''); });
  }

  async function holen({ manuell = false } = {}) {
    if (laeuft) return null;
    if (!global.KCManagerVerkaeufe?.uebernehmen) { zeige('Verkäufe abholen: PC-Manager noch nicht bereit', 'warn'); return null; }
    laeuft = true;
    document.querySelectorAll('.kc-vab-knopf').forEach((b) => { b.disabled = true; });
    try {
      const url = new URL(DIENST + '/verkaeufe-abholen');
      if (letzteAbfrage) url.searchParams.set('seit', new Date(Date.parse(letzteAbfrage) - UEBERLAPPUNG_MS).toISOString());
      const antwort = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      const daten = await antwort.json();
      if (!daten || !Array.isArray(daten.verkaeufe)) throw new Error('unerwartete Antwort');
      const ab = abDatum();
      const r = global.KCManagerVerkaeufe.uebernehmen(daten.verkaeufe, ab);
      if (daten.abgefragtUm) letzteAbfrage = daten.abgefragtUm;
      const text = `Verkäufe von den Kassen: zuletzt geholt ${uhr(new Date())} · ${r.neu} neu` + (manuell ? ` · ${r.vorhanden} schon vorhanden` : '') + ` · gezählt ab ${datumDe(ab)}`;
      zeige(text, 'ok');
      if (manuell) global.KCManagerMessages?.[r.neu ? 'success' : 'info']?.(r.neu ? `${r.neu} neue Verkäufe übernommen.` : 'Keine neuen Verkäufe - alles ist schon im PC-Manager.');
      return r;
    } catch (err) {
      const text = `Verkäufe von den Kassen: Manager-Dienst nicht erreichbar (${uhr(new Date())}) – läuft das schwarze Fenster? Neuer Versuch in 1 Minute.`;
      zeige(text, 'warn');
      if (manuell) global.KCManagerMessages?.warning?.('Verkäufe konnten nicht geholt werden: Manager-Dienst nicht erreichbar. Die Kassen buchen trotzdem sicher weiter.');
      return null;
    } finally {
      laeuft = false;
      document.querySelectorAll('.kc-vab-knopf').forEach((b) => { b.disabled = false; });
    }
  }

  function leiste() {
    const box = document.createElement('div');
    box.className = 'kc-vab-leiste';
    box.innerHTML = `<span class="kc-vab-stand">Verkäufe von den Kassen: werden geholt …</span>`
      + `<label>Verkäufe zählen ab <input type="date" class="kc-vab-ab" value="${esc(abDatum())}"></label>`
      + `<button type="button" class="kc-vab-knopf">⟳ Jetzt holen</button>`;
    box.querySelector('.kc-vab-knopf').onclick = () => holen({ manuell: true });
    box.querySelector('.kc-vab-ab').onchange = (e) => {
      const v = e.target.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { e.target.value = abDatum(); return; }
      try { localStorage.setItem(AB_KEY, v); } catch (err) { /* nur für diese Sitzung */ }
      document.querySelectorAll('.kc-vab-ab').forEach((f) => { f.value = v; });
      letzteAbfrage = null; // neu ab dem gewählten Datum: einmal alles prüfen
      holen({ manuell: true });
    };
    if (letzteNachricht) { const f = box.querySelector('.kc-vab-stand'); f.textContent = letzteNachricht.text; f.className = 'kc-vab-stand ' + (letzteNachricht.art || ''); }
    return box;
  }

  function einbauen() {
    for (const name of ['dashboard', 'sales']) {
      const panel = document.querySelector(`[data-view-panel="${name}"]`);
      if (!panel || panel.querySelector('.kc-vab-leiste')) continue;
      const kopf = panel.querySelector('.page-head');
      if (kopf) kopf.after(leiste()); else panel.prepend(leiste());
    }
    if (!document.getElementById('kcVabStil')) {
      const st = document.createElement('style'); st.id = 'kcVabStil';
      st.textContent = '.kc-vab-leiste{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:0 0 14px;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;font-size:14px}'
        + '.kc-vab-stand{flex:1 1 320px;color:#334155}.kc-vab-stand.ok{color:#166534}.kc-vab-stand.warn{color:#b45309}'
        + '.kc-vab-leiste label{display:flex;align-items:center;gap:6px;margin:0}.kc-vab-leiste input[type=date]{padding:4px 6px}'
        + '.kc-vab-knopf{padding:6px 12px;border-radius:8px;border:1px solid #1769aa;background:#1769aa;color:#fff;font-weight:600;cursor:pointer}.kc-vab-knopf:disabled{opacity:.6;cursor:wait}';
      document.head.append(st);
    }
  }

  function start() {
    einbauen();
    setTimeout(() => holen(), 2500);
    setInterval(() => holen(), TAKT_MS);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  global.KCVerkaeufeAbholen = { holen, abDatum, VORGABE_AB };
})(window);
