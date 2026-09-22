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
  let gewaehltesDatum = heuteIso();

  function heuteIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function verschiebeTag(iso, delta) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().slice(0, 10);
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
      standEl.textContent = letzterAbruf
        ? `Stand: ${letzterAbruf.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
        : 'Noch keine Verbindung zum Dienstplan.';
    }
  }

  function oeffne() {
    gewaehltesDatum = heuteIso();
    document.getElementById('dienstplanDialog')?.showModal();
    aktualisiere();
  }

  function verdrahte() {
    const btn = document.getElementById('dienstplanBtn');
    if (btn) btn.onclick = oeffne;
    const zurueck = document.getElementById('dienstplanZurueckBtn');
    if (zurueck) zurueck.onclick = () => { gewaehltesDatum = verschiebeTag(gewaehltesDatum, -1); rendere(); };
    const vor = document.getElementById('dienstplanVorBtn');
    if (vor) vor.onclick = () => { gewaehltesDatum = verschiebeTag(gewaehltesDatum, 1); rendere(); };
    const heuteBtn = document.getElementById('dienstplanHeuteBtn');
    if (heuteBtn) heuteBtn.onclick = () => { gewaehltesDatum = heuteIso(); rendere(); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahte);
  else verdrahte();

  setInterval(aktualisiere, POLL_MS);

  global.KCDienstplanKasse = { oeffnen: oeffne, aktualisieren: aktualisiere };
})(window);
