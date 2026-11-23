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
    k.innerHTML = '<h3>Verbindung nach Hause (Supabase)</h3><div id="kcSbInhalt" class="vb-hinweis">Wird geprüft …</div><div id="kcSbRouter" style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0"></div><div id="kcSbUpdate" style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0"></div><div id="kcSbKnoepfe" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"></div>';
    const nach = ansicht.querySelector('#vbKassenZettel')?.closest('article');
    if (nach && nach.nextSibling) ansicht.insertBefore(k, nach.nextSibling); else ansicht.appendChild(k);
    return k;
  }


  // ---------- 4G-Datenverbrauch (Router am Stand) ----------
  const GB = 1024 * 1024 * 1024;
  const gbText = (b) => (b == null || !Number.isFinite(Number(b)) ? '–' : (Number(b) / GB).toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' GB');
  function verbrauchHtml(r) {
    if (!r) return '';
    const gesamt = Number(r.gesamtBytes), vol = Number(r.volumenGB) || (r.limitBytes ? Number(r.limitBytes) / GB : 0);
    const anteil = vol && Number.isFinite(gesamt) ? Math.min(100, Math.round(gesamt / GB / vol * 100)) : null;
    const farbe = anteil == null ? '#0b315d' : anteil >= 90 ? '#b42318' : anteil >= 80 ? '#b45309' : '#167447';
    return `<div style="font-weight:700;color:${farbe};font-size:1.05rem">📶 4G-Verbrauch: ${gbText(r.gesamtBytes)}${vol ? ` von ${vol.toLocaleString('de-DE')} GB` : ''}${anteil != null ? ` (${anteil} %)` : ''}</div>`
      + (anteil != null ? `<div style="height:8px;border-radius:5px;background:#e2e8f0;margin:6px 0;overflow:hidden"><div style="height:100%;width:${anteil}%;background:${farbe}"></div></div>` : '')
      + `<div class="hint" style="font-size:.85rem">${r.zeit ? `Stand ${esc(new Date(r.zeit).toLocaleString('de-DE'))}` : 'noch nicht gelesen'}${r.anbieter ? ` · ${esc(r.anbieter)}` : ''}${anteil != null && anteil >= 80 ? ' · <strong>Volumen fast aufgebraucht – nachbuchen!</strong>' : ''}</div>`
      + (r.fehler ? `<div style="color:#b42318;margin-top:4px">Router zuletzt nicht lesbar: ${esc(r.fehler)}</div>` : '');
  }
  async function zeichneRouter(modus) {
    const ort = el('kcSbRouter'); if (!ort) return;
    if (ort.contains(document.activeElement) && /INPUT/.test(document.activeElement.tagName)) return; // nicht beim Tippen neu zeichnen
    if (modus === 'fern') {
      const info = (global.KCFernmodus.standInfo() || {}).info || {};
      ort.innerHTML = info.router ? verbrauchHtml(info.router) : '<div class="hint">📶 4G-Verbrauch: am Stand noch nicht eingerichtet (dort im PC-Manager unter „Verbindung prüfen“ das Router-Passwort eintragen).</div>';
      return;
    }
    const s = await lokal('router-status').catch(() => ({ ok: false, daten: {} }));
    if (!s.ok) { ort.innerHTML = ''; return; }
    const d = s.daten;
    if (!d.eingerichtet) {
      ort.innerHTML = '<div style="font-weight:700">📶 4G-Verbrauch anzeigen (einmalig einrichten)</div>'
        + '<div class="hint" style="margin:4px 0 8px">Der PC liest dann alle 15 Minuten den Zähler des TP-Link-Routers und zeigt ihn hier und zu Hause an. Das Passwort bleibt nur auf diesem PC.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
        + '<label>Router-Admin-Passwort<br><input type="password" id="kcRtPass" autocomplete="off" style="min-width:200px"></label>'
        + '<label>Datenvolumen (GB)<br><input type="number" id="kcRtVol" value="100" min="1" style="width:90px"></label>'
        + '<label>Router-Adresse<br><input id="kcRtAdr" value="192.168.1.1" style="width:130px"></label>'
        + '<button type="button" class="primary" id="kcRtSpeichern">Speichern und testen</button></div><div id="kcRtMeldung" style="margin-top:6px"></div>';
      el('kcRtSpeichern').onclick = async () => {
        const knopf = el('kcRtSpeichern'), m = el('kcRtMeldung');
        knopf.disabled = true; m.style.color = '#0b315d'; m.textContent = '⏳ Melde mich am Router an und lese den Zähler … (bis 30 s)';
        const a = await lokal('router-einrichten', 'POST', { passwort: el('kcRtPass').value, volumenGB: el('kcRtVol').value, adresse: el('kcRtAdr').value }).catch((e) => ({ ok: false, daten: { fehler: e.message } }));
        knopf.disabled = false;
        if (!a.ok) {
          m.style.color = '#b42318';
          const f = String(a.daten.fehler || a.status);
          m.innerHTML = `<strong>Nicht geklappt:</strong> ${esc(f)}<br><span class="hint">Tipp: Ist die Router-Seite gerade im Browser geöffnet? Dort zuerst abmelden – der Router lässt nur eine Anmeldung zu. Bleibt der Fehler, diesen Text an Claude schicken.</span>`;
          return;
        }
        el('kcRtPass').value = '';
        global.KCManagerMessages?.success?.('4G-Verbrauch eingerichtet.');
        zeichneRouter('lokal');
      };
      return;
    }
    ort.innerHTML = verbrauchHtml({ ...(d.letzter || {}), volumenGB: d.volumenGB, fehler: d.fehler ? d.fehler.text : null })
      + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button type="button" id="kcRtJetzt">Jetzt aktualisieren</button><button type="button" id="kcRtVolAendern">Datenvolumen ändern</button><button type="button" id="kcRtNeu">Router-Passwort neu eintragen</button></div>';
    el('kcRtJetzt').onclick = async () => { el('kcRtJetzt').disabled = true; el('kcRtJetzt').textContent = '⏳ wird gelesen …'; await lokal('router-jetzt', 'POST', {}); zeichneRouter('lokal'); };
    el('kcRtVolAendern').onclick = async () => { const v = prompt('Datenvolumen des Tarifs in GB:', d.volumenGB || 100); if (v) { await lokal('router-volumen', 'POST', { volumenGB: v }); zeichneRouter('lokal'); } };
    el('kcRtNeu').onclick = async () => { if (confirm('Gespeichertes Router-Passwort löschen und neu eintragen?')) { await lokal('router-entfernen', 'POST', {}); zeichneRouter('lokal'); } };
  }
  async function zeichne() {
    if (!karte()) return;
    const inhalt = el('kcSbInhalt'), knoepfe = el('kcSbKnoepfe');
    const modus = global.KCFernmodus ? await global.KCFernmodus.bestimmeModus() : 'lokal';
    zeichneRouter(modus).catch(() => {});
    zeichneUpdate(modus).catch(() => {});
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

  // ---------- Programm-Version und Updates (Selbst-Update, Marktsperre) ----------
  const datum = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE') : '');
  function updateHtml(u, wo) {
    if (!u || !u.verwaltet) return `<div class="hint">🧩 Programm-Version ${wo}: ${esc((u && u.version) || 'unbekannt')} (ohne Selbst-Update gestartet).</div>`;
    let t = `<div style="font-weight:700">🧩 Programm-Version ${wo}: ${esc(u.version || 'unbekannt')}</div>`;
    if (u.neueVersion) {
      t += `<div style="margin-top:4px;color:#7c2d12">Neue Version bereit: <strong>${esc(u.neueVersion)}</strong>`;
      if (u.freigabeBis) t += ' – <strong>freigegeben</strong>: wird beim nächsten Start des Kassen-PCs installiert (schwarzes Fenster schließen und „KC Kasse starten“ doppelklicken, oder morgen früh von selbst).';
      else if (u.sperre && u.sperre.aktiv) t += ` – <strong>Marktsperre</strong> bis ${datum(u.sperre.bis)}: wird erst nach Freigabe installiert.`;
      t += '</div>';
    } else if (u.hinweis && u.hinweis !== 'aktuell') t += `<div class="hint" style="margin-top:4px">${esc(u.hinweis)}</div>`;
    else t += '<div class="hint" style="margin-top:4px">Aktuell.' + (u.sperre && u.sperre.aktiv ? ` Marktsperre bis ${datum(u.sperre.bis)}: neue Versionen nur nach Freigabe.` : '') + '</div>';
    if (u.letzterRueckfall && u.letzterRueckfall.version) t += `<div style="margin-top:4px;color:#b42318">⚠ Version ${esc(u.letzterRueckfall.version)} startete nicht – es läuft automatisch die vorige Version.</div>`;
    if (u.neueVersion && u.sperre && u.sperre.aktiv && !u.freigabeBis) t += '<button type="button" id="kcSbUpdateFrei" style="margin-top:8px">⬆️ Update für heute freigeben</button>';
    return t;
  }
  async function zeichneUpdate(modus) {
    const ort = el('kcSbUpdate'); if (!ort) return;
    const hier = await lokal('update-status').catch(() => ({ ok: false, daten: {} }));
    if (modus === 'fern') {
      const info = (global.KCFernmodus.standInfo() || {}).info || {};
      ort.innerHTML = (info.update ? updateHtml(info.update, 'am Stand') : '<div class="hint">🧩 Programm-Version am Stand: noch nicht gemeldet (alter Stand-PC ohne Selbst-Update).</div>')
        + (hier.ok ? `<div class="hint" style="margin-top:6px">Dieser PC zu Hause: ${esc(hier.daten.version || 'unbekannt')}</div>` : '');
      const b = el('kcSbUpdateFrei');
      if (b) b.onclick = async () => {
        if (!confirm('Update für den Kassen-PC am Stand freigeben?\n\nEs wird beim nächsten Start des Kassen-PCs installiert. Startet die neue Version nicht, läuft automatisch die vorige weiter.')) return;
        b.disabled = true; b.textContent = '⏳ wird an den Stand gesendet …';
        try { await global.KCFernmodus.auftrag('/update/freigeben', {}); } catch (e) { alert(`Nicht gesendet: ${e.message}`); }
        zeichneUpdate(modus);
      };
      return;
    }
    if (!hier.ok) { ort.innerHTML = ''; return; }
    ort.innerHTML = updateHtml(hier.daten, 'auf diesem PC');
    const b = el('kcSbUpdateFrei');
    if (b) b.onclick = async () => {
      if (!confirm('Update für heute freigeben?\n\nEs wird beim nächsten Start dieses PCs installiert. Startet die neue Version nicht, läuft automatisch die vorige weiter.')) return;
      const a = await lokal('update-freigeben', 'POST', {}).catch((e) => ({ ok: false, daten: { fehler: e.message } }));
      if (!a.ok) alert(`Freigabe nicht möglich: ${a.daten.fehler || a.status}`);
      else global.KCManagerMessages?.success?.('Update freigegeben – wird beim nächsten Start installiert.');
      zeichneUpdate(modus);
    };
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
  global.KCStandBrueckeManager = { zeichne, anmelden, zeichneRouter, verbrauchHtml, zeichneUpdate, updateHtml };
})(window);
