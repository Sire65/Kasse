// Dienstplan-Ansicht an der Kasse - frei zugaenglich fuer ALLE Kollegen (kein PIN-Bereich),
// genau der Zweck: schnell nachschauen koennen, wer wann kommt. Blaetterpfeile fuer die
// naechsten Tage.
//
// DATENWEG: wie schon bei der Anwesenheits-Ampel (kc-team-praesenz.js) - die Kasse fragt
// ihren EIGENEN, lokalen Companion, der die Daten vom PC-Manager holt. Kein Netz/kein
// Companion (z.B. Schulungsversion, die sich absichtlich nie koppelt) -> die Liste bleibt
// leer und sagt das auch so, statt einen veralteten Stand vorzutaeuschen.
(function (global) {
  'use strict';
  const POLL_MS = 60000;
  const URL_DIENSTPLAN = (global.KCSyncConnection?.buildUrl('/kc-sync-dienstplan')) || 'http://127.0.0.1:47391/kc-sync-dienstplan';

  let schichten = [];
  let letzterAbruf = null;
  let quellStand = null;
  let cacheStand = null;
  let revision = 0;
  let gewaehltesDatum = heuteIso();

  function lokalesIsoDatum(datum = new Date()) {
    const y = datum.getFullYear();
    const m = String(datum.getMonth() + 1).padStart(2, '0');
    const d = String(datum.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function heuteIso() {
    return lokalesIsoDatum();
  }

  function verschiebeTag(iso, delta) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return lokalesIsoDatum(d);
  }

  function formatiereDatum(iso) {
    const d = new Date(iso + 'T12:00:00');
    const heute = heuteIso();
    const morgen = verschiebeTag(heute, 1);
    const text = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' });
    if (iso === heute) return `Heute · ${text}`;
    if (iso === morgen) return `Morgen · ${text}`;
    return text;
  }

  // NUR in der Schulungsversion (koppelt sich laut obigem Kommentar absichtlich nie): fuer
  // Vorfuehrungen/Praesentationen ein erfundener Beispielplan ueber ein paar Tage, statt der
  // leeren Liste. Frei erfundene Namen, keine echten Kollegen. Die echte Kasse (pos/) bleibt
  // unveraendert bei "Noch kein Dienstplan verfuegbar" - dort waere ein erfundener Stand
  // genau die Vortaeuschung, die vermieden werden soll.
  function pseudoSchichten() {
    const tag = (delta) => verschiebeTag(heuteIso(), delta);
    return [
      { date: tag(0), pseudonym: 'Anna', area: 'Kasse', start: '10:00', end: '14:00' },
      { date: tag(0), pseudonym: 'Ben', area: 'Theke', start: '14:00', end: '19:00' },
      { date: tag(0), pseudonym: 'Chris', area: 'Küche', start: '11:00', end: '18:00' },
      { date: tag(1), pseudonym: 'Dana', area: 'Kasse', start: '10:00', end: '15:00' },
      { date: tag(1), pseudonym: 'Anna', area: 'Ausschank', start: '15:00', end: '20:00' },
      { date: tag(1), pseudonym: 'Erik', area: 'Küche', start: '11:00', end: '18:00' },
      { date: tag(2), pseudonym: 'Ben', area: 'Kasse', start: '10:00', end: '14:00' },
      { date: tag(2), pseudonym: 'Chris', area: 'Theke', start: '14:00', end: '19:00' },
      { date: tag(2), pseudonym: 'Dana', area: 'Küche', start: '11:00', end: '18:00' },
      // Betreiber (22.09.2026): Beispiel fuer Bereitschaft - eigene Zeile, andersfarbig markiert.
      { date: tag(0), pseudonym: 'Hans', area: 'Bereitschaft', start: '16:00', end: '18:00' },
    ];
  }
  async function aktualisiere() {
    try {
      const res = await fetch(URL_DIENSTPLAN, { cache: 'no-store' });
      if (!res.ok) throw new Error('dienstplan-' + res.status);
      const daten = await res.json();
      schichten = Array.isArray(daten?.schichten) ? daten.schichten : [];
      quellStand = daten?.sourceUpdatedAt || daten?.managerUpdatedAt || null;
      cacheStand = daten?.cachedAt || null;
      revision = Number(daten?.revision || 0);
      letzterAbruf = new Date();
    } catch (e) {
      // Companion/Manager nicht erreichbar: Vorfuehrdaten einsetzen, aber nur falls noch nie
      // ein echter Stand geladen wurde - kam vorher schon ein echter Plan an, bleibt der
      // stehen statt durch Beispieldaten ersetzt zu werden.
      if (!letzterAbruf) schichten = pseudoSchichten();
    }
    rendere();
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function rendere() {
    const el = (id) => document.getElementById(id);
    const datumEl = el('dienstplanDatumText');
    const listeEl = el('dienstplanListe');
    const standEl = el('dienstplanStand');
    if (!listeEl) return;

    if (datumEl) datumEl.textContent = formatiereDatum(gewaehltesDatum);
    knoepfeSetzen();

    const zeilenHeute = schichten
      .filter((s) => s.date === gewaehltesDatum)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)));

    listeEl.innerHTML = zeilenHeute.length
      ? zeilenHeute
          .map((s) => {
            const istBereitschaft = String(s.area || '').trim().toLowerCase() === 'bereitschaft';
            return `<div class="dienstplan-zeile${istBereitschaft ? ' bereitschaft' : ''}">
              <span><b>${esc(s.pseudonym)}</b>${s.area ? `<small>${esc(s.area)}${istBereitschaft ? '<span class="dienstplan-bereitschaft-tag">Bereitschaft</span>' : ''}</small>` : ''}</span>
              <span class="dienstplan-zeit">${esc(s.start)}–${esc(s.end)}</span>
            </div>`;
          })
          .join('')
      : `<div class="dienstplan-leer">${schichten.length ? 'Für diesen Tag ist niemand eingeplant.' : 'Noch kein Dienstplan verfügbar.'}</div>`;

    if (standEl) {
      const quelle = quellStand ? new Date(quellStand) : null;
      const cache = cacheStand ? new Date(cacheStand) : null;
      if (quelle && !Number.isNaN(quelle.getTime())) {
        standEl.textContent = `Planstand: ${quelle.toLocaleDateString('de-DE')} · ${quelle.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · Rev. ${revision}`;
      } else if (cache && !Number.isNaN(cache.getTime())) {
        standEl.textContent = `Zwischengespeicherter Plan · ${cache.toLocaleDateString('de-DE')} · ${cache.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
      } else {
        standEl.textContent = letzterAbruf
          ? `Dienstplan abgerufen: ${letzterAbruf.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
          : 'Noch keine Verbindung zum Dienstplan.';
      }
    }
  }

  // 21.11.2026 (Betreiber: "einheitlich und bedienerfreundlich", wie beim Programm): Blaettern ueber die
  // Tage, an denen jemand eingeplant ist; dazu erster/letzter Tag. Ohne Plan wird kalendarisch geblaettert.
  function eintragTage() { return [...new Set(schichten.map((s) => s.date).filter(Boolean))].sort(); }
  function zielTag(art) {
    const t = eintragTage(), g = gewaehltesDatum;
    if (!t.length) return art === 'vor' ? verschiebeTag(g, -1) : art === 'nach' ? verschiebeTag(g, 1) : null;
    if (art === 'erst') return t[0];
    if (art === 'letzt') return t[t.length - 1];
    if (art === 'vor') return [...t].reverse().find((d) => d < g) || null;
    if (art === 'nach') return t.find((d) => d > g) || null;
    return null;
  }
  function knoepfeSetzen() {
    const setze = (id, art) => { const b = document.getElementById(id); if (!b) return; const z = zielTag(art); b.disabled = !z || z === gewaehltesDatum; };
    setze('dienstplanErsterBtn', 'erst'); setze('dienstplanZurueckBtn', 'vor'); setze('dienstplanVorBtn', 'nach'); setze('dienstplanLetzterBtn', 'letzt');
    const h = document.getElementById('dienstplanHeuteBtn'); if (h) h.disabled = gewaehltesDatum === heuteIso();
  }
  function springe(art) { const z = zielTag(art); if (z) { gewaehltesDatum = z; rendere(); } }

  // 26.11.2026 (Betreiber: „bau das ein mit dem nächsten Tag“): Ist heute niemand eingeplant (z. B. vor dem Markt), öffnet das Fenster
  // gleich beim nächsten Tag mit Dienstplan - wie die Programm-Anzeige. „Heute“ führt weiterhin zum heutigen Tag.
  function naechsterDiensttag(ab = heuteIso()) {
    const t = eintragTage();
    if (!t.length || t.includes(ab)) return ab;
    return t.find((d) => d > ab) || ab;
  }
  async function oeffne() {
    gewaehltesDatum = naechsterDiensttag();
    document.getElementById('dienstplanDialog')?.showModal();
    const vorher = gewaehltesDatum;
    await aktualisiere();
    // erst nach dem Abruf ist der Plan da (oder neu) - noch einmal springen, solange niemand selbst geblättert hat
    if (gewaehltesDatum === vorher) { const z = naechsterDiensttag(); if (z !== gewaehltesDatum) { gewaehltesDatum = z; rendere(); } }
  }

  function verdrahte() {
    const btn = document.getElementById('dienstplanBtn');
    if (btn) btn.onclick = oeffne;
    [['dienstplanErsterBtn', 'erst'], ['dienstplanZurueckBtn', 'vor'], ['dienstplanVorBtn', 'nach'], ['dienstplanLetzterBtn', 'letzt']]
      .forEach(([id, art]) => { const b = document.getElementById(id); if (b) b.onclick = () => springe(art); });
    const heuteBtn = document.getElementById('dienstplanHeuteBtn');
    if (heuteBtn) heuteBtn.onclick = () => { gewaehltesDatum = heuteIso(); rendere(); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahte);
  else verdrahte();

  setInterval(aktualisiere, POLL_MS);

  global.KCDienstplanKasse = { oeffnen: oeffne, aktualisieren: aktualisiere };
})(window);
