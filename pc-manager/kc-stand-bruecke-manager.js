// KC PC-Manager – Karte „Verbindung nach Hause (Supabase)“ unter „Verbindung prüfen“ (KS-04).
//   Am Mini-PC (Stand): einmal „Diesen PC als Stand anmelden“ – danach meldet die Stand-Brücke im
//                       Manager-Dienst Buchungen und Übersichten selbst nach Supabase.
//   Zu Hause (Fernmodus): zeigt, welcher Stand gelesen wird, und wie aktuell er ist.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const dauer = (s) => (s == null ? '–' : s < 120 ? `${s} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`);

  async function lokal(pfad, methode = 'GET', daten) {
    const a = await fetch(`/kc-kassen-start/${pfad}`, { method: methode, cache: 'no-store',
      headers: methode === 'POST' ? { 'Content-Type': 'application/json', 'X-KC-Aktion': '1' } : {}, body: daten ? JSON.stringify(daten) : undefined });
    return { ok: a.ok, status: a.status, daten: await a.json().catch(() => ({})) };
  }

  function karte() {
    const ansicht = document.querySelector('[data-view-panel="verbindung"]');
    if (!ansicht || el('kcStandBrueckeKarte')) return el('kcStandBrueckeKarte');
    const k = document.createElement('article');
    k.className = 'secure-card'; k.id = 'kcStandBrueckeKarte';
    k.innerHTML = '<h3>Verbindung nach Hause (Supabase)</h3><div id="kcSbInhalt" class="vb-hinweis">Wird geprüft …</div><div id="kcSbKnoepfe" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>';
    const nach = ansicht.querySelector('#vbKassenZettel')?.closest('article');
    if (nach && nach.nextSibling) ansicht.insertBefore(k, nach.nextSibling); else ansicht.appendChild(k);
    return k;
  }

  async function zeichne() {
    if (!karte()) return;
    const inhalt = el('kcSbInhalt'), knoepfe = el('kcSbKnoepfe');
    const modus = global.KCFernmodus ? await global.KCFernmodus.bestimmeModus() : 'lokal';
    if (modus === 'fern') {
      const st = global.KCFernmodus.gewaehlterStand(), info = global.KCFernmodus.standInfo() || {};
      inhalt.innerHTML = st
        ? `Dieser PC ist <strong>zu Hause</strong> und liest den Stand <strong>„${esc(st.name)}“</strong> über Supabase. Zuletzt gemeldet vor <strong>${dauer(info.sekundenSeitMeldung)}</strong>.`
        : 'Dieser PC ist <strong>zu Hause</strong>. Bitte unten rechts den Stand auswählen.';
      knoepfe.innerHTML = st ? '<button type="button" id="kcSbAndererStand">Anderen Stand wählen</button>' : '';
      if (el('kcSbAndererStand')) el('kcSbAndererStand').onclick = () => { localStorage.removeItem('kc_fernmodus_stand_v1'); location.reload(); };
      return;
    }
    const s = await lokal('stand-status').catch(() => ({ ok: false, daten: {} }));
    if (!s.ok) { inhalt.textContent = 'Der Kassen-Start auf diesem PC antwortet nicht – läuft das schwarze Fenster?'; knoepfe.innerHTML = ''; return; }
    const d = s.daten;
    if (!d.eingerichtet) {
      inhalt.innerHTML = 'Dieser PC sendet <strong>nichts</strong> nach Hause. Soll der PC-Manager zu Hause die Buchungen dieses Stands sehen, '
        + 'einmal hier den PC als Stand anmelden (dazu oben bei Supabase als Admin angemeldet sein).';
      knoepfe.innerHTML = '<button type="button" class="primary" id="kcSbAnmelden">🌐 Diesen PC als Stand anmelden</button>';
      el('kcSbAnmelden').onclick = anmelden;
      return;
    }
    const zustand = d.verbunden === true ? '<span style="color:#167447;font-weight:700">verbunden</span>'
      : d.verbunden === false ? '<span style="color:#b42318;font-weight:700">gestört – wird nachgereicht</span>' : 'wird geprüft';
    inhalt.innerHTML = `Stand <strong>„${esc(d.standName)}“</strong> · Verbindung nach Hause: ${zustand}`
      + (d.rueckstand ? ` · ${d.rueckstand} Ereignis(se) warten` : '')
      + (d.letzterErfolg ? ` · zuletzt gesendet ${esc(new Date(d.letzterErfolg).toLocaleTimeString('de-DE'))}` : '')
      + (d.meldung ? `<div class="warnung" style="margin-top:8px;color:#b42318"><strong>${esc(d.meldung.titel)}</strong><br>Ursache: ${esc(d.meldung.ursache)}<ol style="margin:4px 0 0 18px">${(d.meldung.loesung || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : '');
    knoepfe.innerHTML = '<button type="button" class="danger" id="kcSbAbmelden">Stand abmelden</button>';
    el('kcSbAbmelden').onclick = () => abmelden(d.standId);
  }

  async function anmelden() {
    const sb = global.KCSupabase;
    if (!sb || !sb.istAngemeldet || !sb.istAngemeldet()) { alert('Bitte zuerst oben im PC-Manager bei Supabase anmelden (Admin-Konto).'); return; }
    const name = prompt('Name des Stands (erscheint zu Hause):', 'Weihnachtsmarkt');
    if (!name) return;
    let neu;
    try { neu = await sb.rufeFunktionAuf('kc_stand_anlegen', { p_name: name }); }
    catch (e) {
      alert(/nur_fuer_admins/.test(e.message) ? 'Anmelden nicht möglich: Ihr Supabase-Konto ist kein Admin des Vereins.\n\nLösung: mit einem Admin-Konto anmelden.'
        : /kc_stand_anlegen|function|404/i.test(e.message) ? 'Supabase kennt die Stand-Brücke noch nicht.\n\nLösung (Betreuer): supabase/migrations/20261113_kc_stand_bruecke.sql einspielen.'
        : `Anmelden fehlgeschlagen: ${e.message}\n\nLösung: Internet prüfen und erneut versuchen.`);
      return;
    }
    const a = await lokal('stand-einrichten', 'POST', { url: sb.konfig.url, publishableKey: sb.konfig.publishableKey, standId: neu.standId, geheimnis: neu.geheimnis, name: neu.name });
    if (!a.ok) { alert(`Der Stand wurde angelegt, aber dieser PC konnte ihn nicht übernehmen (${a.daten.fehler || a.status}).\n\nLösung: schwarzes Fenster prüfen und erneut „Diesen PC als Stand anmelden“.`); return; }
    global.KCManagerMessages?.success?.(`Stand „${neu.name}“ angemeldet – Buchungen gehen ab jetzt auch nach Hause.`);
    zeichne();
  }

  async function abmelden(standId) {
    if (!confirm('Stand abmelden?\n\nDanach sendet dieser PC nichts mehr nach Hause. Am Stand wird normal weiter kassiert.')) return;
    try { if (global.KCSupabase?.istAngemeldet?.()) await global.KCSupabase.rufeFunktionAuf('kc_stand_abmelden', { p_stand: standId }); } catch (e) { /* lokal trotzdem abmelden */ }
    await lokal('stand-abmelden', 'POST', {});
    zeichne();
  }

  function init() { zeichne(); setInterval(() => { if (document.querySelector('[data-view-panel="verbindung"]:not([hidden])')) zeichne(); }, 10000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  global.KCStandBrueckeManager = { zeichne, anmelden };
})(window);
