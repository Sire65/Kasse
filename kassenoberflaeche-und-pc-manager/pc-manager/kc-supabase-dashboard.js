// KC PC-Manager – Supabase-Überwachungs-Dashboard (KC Core + KC Futura Academy).
// Nutzt dieselbe Sitzung wie die Supabase-LED in der Kopfzeile (kc-manager-supabase-status.js).
(function (global) {
  'use strict';
  const SUPABASE_URL = 'https://ptblnpiroqftcvlsrhac.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_SqXIeGN-clcZ4gjmpLdSww_4DLfyy24';
  const STORAGE_KEY = 'kc_manager_supabase_session_v1';

  function session() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; } }

  async function ladeDaten() {
    if (!global.KCSupabase?.istAngemeldet()) throw new Error('nicht_angemeldet');
    return global.KCSupabase.rufeFunktionAuf('kc_core_dashboard_data', {});
  }

  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function formatBytes(b) { return (b / 1024 / 1024).toFixed(1) + ' MB'; }
  function ampelFarbe(prozent, warnung, kritisch) {
    if (prozent >= kritisch) return '#b91c1c';
    if (prozent >= warnung) return '#b45309';
    return '#166534';
  }
  function zeitAgo(iso) {
    if (!iso) return 'nie';
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'gerade eben';
    if (diffMin < 60) return `vor ${diffMin} Min.`;
    return `vor ${Math.round(diffMin / 60)} Std.`;
  }

  function karteHtml(p) {
    const warnung = 75, kritisch = 90; // Standardwerte aus der Einrichtung (siehe kc_core_system_health)
    const prozent = Number(p.database_percent || 0);
    const farbe = p.status !== 'OK' ? '#b91c1c' : ampelFarbe(prozent, warnung, kritisch);
    return `
      <div class="kc-dash-card">
        <div class="kc-dash-card-head"><span class="kc-dash-led" style="background:${farbe};"></span><b>${p.project_role || p.project_code}</b></div>
        <div class="kc-dash-row"><span>Status</span><b style="color:${farbe};">${p.status}${p.last_error ? ' - ' + p.last_error : ''}</b></div>
        <div class="kc-dash-row"><span>Datenbank</span><b>${formatBytes(p.database_bytes || 0)} (${prozent.toFixed(2)} %)</b></div>
        <div class="kc-dash-bar"><i style="width:${Math.min(100, prozent)}%;background:${farbe};"></i></div>
        <div class="kc-dash-row"><span>Auth-Nutzer</span><b>${p.auth_users ?? '—'}</b></div>
        <div class="kc-dash-row"><span>Storage-Objekte</span><b>${p.storage_objects ?? '—'}</b></div>
        <div class="kc-dash-row"><span>Fehlversuche</span><b>${p.consecutive_failures ?? 0}</b></div>
        <div class="kc-dash-row"><span>Letzter Check</span><b>${zeitAgo(p.last_check_at)}</b></div>
      </div>`;
  }

  async function render() {
    const ziel = document.getElementById('kcSupabaseDashboardBody');
    if (!ziel) return;
    ziel.innerHTML = '<p class="kc-live-empty">Wird geladen …</p>';
    try {
      const daten = await ladeDaten();
      if (!Array.isArray(daten) || !daten.length) { ziel.innerHTML = '<p class="kc-live-empty">Keine Daten - bitte oben rechts bei Supabase anmelden (Admin-Konto nötig).</p>'; return; }
      ziel.innerHTML = `<div class="kc-dash-grid">${daten.map(karteHtml).join('')}</div>`;
    } catch (e) {
      ziel.innerHTML = `<p class="kc-live-empty">Konnte nicht geladen werden: ${esc(klartext(e.message))}</p>`;
    }
  }

  // ---- Takte der Hintergrundaufträge -----------------------------------------------------
  //
  // Neon (kostenloser Tarif) schläft erst nach fünf Minuten ohne Verbindung ein, und diese
  // Frist lässt sich dort nicht verkürzen. Ein Weckvorgang kostet deshalb rund fünf Minuten
  // Laufzeit bei kleinster Größe (0,25 CU) - das sind etwa 0,022 CU-Stunden. Aus dieser einen
  // Zahl ergibt sich die ganze Hochrechnung unten.
  const CU_JE_WECKUNG = 0.022;
  const MONATSGUTHABEN = 100;

  // BEFUND 02.09.2026: hier stand "Konnte nicht geladen werden: permission denied for schema
  // kc_private" - eine rohe Postgres-Meldung, mit der am Bildschirm niemand etwas anfangen kann.
  // URSACHE: anders als das Dashboard darunter fragten diese beiden nicht nach, ob ueberhaupt
  // jemand angemeldet ist. Ohne Anmeldung fragt der Browser als "anon" an; die Datenbank laesst
  // die Funktion zwar aufrufen, verweigert aber den internen Bereich dahinter. Der Satz, der
  // dabei herauskommt, beschreibt die Technik und nicht die Lage - die Lage ist schlicht:
  // nicht angemeldet.
  async function ladeTakte() {
    if (!global.KCSupabase?.istAngemeldet()) throw new Error('nicht_angemeldet');
    return global.KCSupabase.rufeFunktionAuf('kc_core_takte', {});
  }
  async function setzeTakt(jobname, takt) {
    if (!global.KCSupabase?.istAngemeldet()) throw new Error('nicht_angemeldet');
    return global.KCSupabase.rufeFunktionAuf('kc_core_takt_setzen', {p_jobname: jobname, p_takt: takt});
  }
  // Sicherheitsnetz fuer den Fall, dass die Datenbank den Zugang aus einem anderen Grund
  // verweigert (z. B. angemeldet, aber ohne Adminrecht): auch dann kein Postgres-Kauderwelsch.
  function klartext(nachricht) {
    const roh = String(nachricht || '');
    if (roh === 'nicht_angemeldet') return 'Bitte oben rechts bei Supabase anmelden.';
    if (/permission denied|not authorized|insufficient_privilege/i.test(roh)) {
      return 'Die Datenbank hat den Zugriff verweigert. Meist ist niemand angemeldet - oben rechts '
           + 'bei Supabase anmelden. Erscheint es auch angemeldet, fehlt diesem Konto das Adminrecht. '
           + '(Diese Seite ist nur eine Uebersicht - Kassieren und Abschluesse laufen ohne sie.)';
    }
    return roh;
  }

  // Auswahl fest im Programm - dieselben Werte wie in der Datenbank hinterlegt. Bewusst keine
  // freie Cron-Eingabe: ein Tippfehler dort kann still dafür sorgen, dass ein Auftrag gar
  // nicht mehr läuft, und das fällt erst auf, wenn Daten fehlen.
  const TAKTE = [
    {schluessel: '15min',   text: 'alle 15 Minuten',           proTag: 96},
    {schluessel: '30min',   text: 'alle 30 Minuten',           proTag: 48},
    {schluessel: 'stuendl', text: 'stündlich',                 proTag: 24},
    {schluessel: '2std',    text: 'alle 2 Stunden',            proTag: 12},
    {schluessel: '6std',    text: 'alle 6 Stunden',            proTag: 4},
    {schluessel: 'nachts',  text: 'einmal nachts (3:15 Uhr)',  proTag: 1},
  ];

  // Weckvorgänge zählen, nicht Aufträge: laufen mehrere Gruppen im selben Takt, teilen sie
  // sich einen Weckvorgang. Genau das war der Fehler im alten Zustand - vier Gruppen mit
  // jeweils fünf Minuten Versatz ergaben lückenlos wachgehaltene Rechenzeit.
  function hochrechnung(zeilen) {
    const jeTakt = new Map();
    zeilen.filter((z) => z.weckt_neon && z.aktiv).forEach((z) => {
      const takt = TAKTE.find((t) => t.schluessel === z.takt_schluessel);
      jeTakt.set(z.takt_schluessel || z.cron, takt ? takt.proTag : null);
    });
    let proTag = 0, unbekannt = false;
    jeTakt.forEach((wert) => { if (wert === null) unbekannt = true; else proTag += wert; });
    const stunden = proTag * 30.4 * CU_JE_WECKUNG;
    return {proTag, stunden, unbekannt};
  }

  async function rendereTakte() {
    const ziel = document.getElementById('kcTakteBody');
    if (!ziel) return;
    ziel.innerHTML = '<p class="kc-live-empty">Wird geladen …</p>';
    try {
      const zeilen = await ladeTakte();
      if (!Array.isArray(zeilen) || !zeilen.length) {
        ziel.innerHTML = '<p class="kc-live-empty">Keine Angaben – bitte oben rechts bei Supabase anmelden (Admin-Konto nötig).</p>';
        return;
      }
      const r = hochrechnung(zeilen);
      const anteil = Math.min(100, Math.round(r.stunden / MONATSGUTHABEN * 100));
      const farbe = anteil >= 90 ? '#b91c1c' : anteil >= 70 ? '#b45309' : '#166534';
      ziel.innerHTML = `
        <div class="kc-takt-summe" style="border-color:${farbe}">
          <b style="color:${farbe}">Hochrechnung: rund ${r.stunden.toFixed(0)} von ${MONATSGUTHABEN} Rechenstunden im Monat (${anteil} %)</b>
          <small>${r.proTag} Weckvorgänge am Tag${r.unbekannt ? ' · ein Takt ist von Hand gesetzt und lässt sich hier nicht hochrechnen' : ''}
            · Rest bleibt als Reserve für Nachsehen und unvorhergesehene Zugriffe</small>
        </div>
        <table class="kcbs-tabelle"><thead><tr>
          <th>Auftrag</th><th>Wirkung</th><th>Takt</th><th>Zuletzt gelaufen</th></tr></thead><tbody>
        ${zeilen.map((z) => `<tr>
          <td><b>${esc(z.anzeigename)}</b><br><small>${esc(z.beschreibung || '')}</small></td>
          <td>${z.weckt_neon ? 'weckt die Spiegel-Datenbank' : 'nur Supabase, kostet nichts'}</td>
          <td>${z.weckt_neon
            ? `<select data-takt-fuer="${esc(z.jobname)}">
                 ${TAKTE.map((t) => `<option value="${t.schluessel}" ${t.schluessel === z.takt_schluessel ? 'selected' : ''}>${t.text}</option>`).join('')}
                 ${z.takt_schluessel ? '' : `<option value="" selected>von Hand: ${esc(z.cron)}</option>`}
               </select>`
            : `<span class="kc-takt-fest">${esc(z.cron)}</span>`}</td>
          <td>${zeitAgo(z.letzter_lauf)}${z.letzter_status && z.letzter_status !== 'succeeded' ? ` · <b style="color:#b91c1c">${esc(z.letzter_status)}</b>` : ''}</td>
        </tr>`).join('')}
        </tbody></table>
        <p id="kcTaktMeldung" class="kc-live-empty"></p>`;

      ziel.querySelectorAll('[data-takt-fuer]').forEach((auswahl) => {
        auswahl.addEventListener('change', async () => {
          const meldung = document.getElementById('kcTaktMeldung');
          const jobname = auswahl.dataset.taktFuer;
          if (!auswahl.value) return;
          meldung.textContent = 'Wird umgestellt …';
          try {
            await setzeTakt(jobname, auswahl.value);
            meldung.textContent = 'Umgestellt. Die neue Hochrechnung steht oben.';
            rendereTakte();
          } catch (e) {
            meldung.textContent = `Konnte nicht umgestellt werden: ${klartext(e.message)}`;
            rendereTakte();
          }
        });
      });
    } catch (e) {
      ziel.innerHTML = `<p class="kc-live-empty">Konnte nicht geladen werden: ${esc(klartext(e.message))}</p>`;
    }
  }

  function initSeite() {
    const section = document.querySelector('[data-view-panel="supabase-dashboard"]');
    if (section) return;
    const nav = document.querySelector('[data-nav-group="masterdata"] .nav-submenu') || document.querySelector('.nav-submenu');
    if (!nav) return;
    const btn = document.createElement('button');
    btn.className = 'nav'; btn.type = 'button'; btn.dataset.view = 'supabase-dashboard';
    btn.textContent = 'Supabase-Überwachung';
    nav.appendChild(btn);

    const neu = document.createElement('section');
    neu.className = 'view'; neu.dataset.viewPanel = 'supabase-dashboard'; neu.hidden = true;
    neu.innerHTML = `
      <div class="page-head"><div><h1>Supabase-Überwachung</h1><p>KC Core und KC Futura Academy - Status, Datenbank-Belegung, Warnschwellen.</p></div>
      <button type="button" id="kcSupabaseDashRefresh" class="primary">🔄 Jetzt prüfen</button></div>
      <div id="kcSupabaseDashboardBody"><p class="kc-live-empty">Noch nicht geladen.</p></div>
      <h2 class="kc-takt-titel">Takte der Hintergrundaufträge</h2>
      <p class="kc-takt-hinweis">Wie oft die Spiegelung nach Neon läuft. Jeder Anstoß hält die
         Spiegel-Datenbank rund fünf Minuten wach – deshalb kostet nicht die Datenmenge,
         sondern die <b>Häufigkeit</b>. Am günstigsten laufen alle Gruppen zur selben Minute:
         ein Weckvorgang statt vier.</p>
      <div id="kcTakteBody"><p class="kc-live-empty">Noch nicht geladen.</p></div>
    `;
    document.querySelector('.content')?.appendChild(neu);

    btn.onclick = () => {
      document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x === btn));
      document.querySelectorAll('.view').forEach((x) => { const active = x.dataset.viewPanel === 'supabase-dashboard'; x.classList.toggle('active', active); x.hidden = !active; });
      render(); rendereTakte();
    };
    document.getElementById('kcSupabaseDashRefresh').addEventListener('click', () => { render(); rendereTakte(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSeite);
  else initSeite();
})(window);
