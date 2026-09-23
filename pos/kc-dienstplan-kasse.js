// Dienstplan-Ansicht an der Kasse - frei zugaenglich fuer ALLE Kollegen (kein PIN-Bereich).
// Die Kasse fragt nur ihren lokalen Companion; dieser haelt den letzten erfolgreich synchronisierten
// Sollplan persistent vor. Auf der Kasse erscheinen ausschliesslich Pseudonyme.
(function (global) {
  'use strict';
  const POLL_MS = 60000;
  const PLAN_TIMEZONE = 'Europe/Berlin';
  const URL_DIENSTPLAN = (global.KCSyncConnection?.buildUrl('/kc-sync-dienstplan')) || 'http://127.0.0.1:47391/kc-sync-dienstplan';

  let schichten = [];
  let letzterAbruf = null;
  let planStand = null;
  let letzteSynchronisierung = null;
  let planRevision = 0;
  let gewaehltesDatum = heuteIso();

  function datumInZeitzone(date = new Date()) {
    const teile = new Intl.DateTimeFormat('de-DE', {
      timeZone: PLAN_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const wert = (typ) => teile.find((p) => p.type === typ)?.value;
    return `${wert('year')}-${wert('month')}-${wert('day')}`;
  }

  function heuteIso() {
    return datumInZeitzone();
  }

  function verschiebeTag(iso, delta) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  function formatiereDatum(iso) {
    const d = new Date(iso + 'T12:00:00Z');
    const heute = heuteIso();
    const morgen = verschiebeTag(heute, 1);
    const text = d.toLocaleDateString('de-DE', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' });
    if (iso === heute) return `Heute · ${text}`;
    if (iso === morgen) return `Morgen · ${text}`;
    return text;
  }

  function formatiereZeitpunkt(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('de-DE', {
      timeZone: PLAN_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' Uhr';
  }

  async function aktualisiere() {
    try {
      const res = await fetch(URL_DIENSTPLAN, { cache: 'no-store' });
      if (!res.ok) throw new Error('dienstplan-' + res.status);
      const daten = await res.json();
      schichten = Array.isArray(daten?.schichten) ? daten.schichten : [];
      planRevision = Number(daten?.revision || 0);
      planStand = daten?.updatedAt || null;
      letzteSynchronisierung = daten?.fetchedAt || null;
      letzterAbruf = new Date();
    } catch (e) {
      // Der bereits geladene/persistierte Stand bleibt sichtbar. Nur wenn selbst der lokale
      // Companion nicht erreichbar ist, kann kein neuer Cache gelesen werden.
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
      const standText = formatiereZeitpunkt(planStand);
      const syncText = formatiereZeitpunkt(letzteSynchronisierung);
      const teile = [];
      if (standText) teile.push(`Planstand: ${standText}`);
      if (syncText) teile.push(`Sync: ${syncText}`);
      if (planRevision > 0) teile.push(`Rev. ${planRevision}`);
      standEl.textContent = teile.length
        ? teile.join(' · ')
        : (letzterAbruf ? 'Noch kein synchronisierter Dienstplan vorhanden.' : 'Noch keine Verbindung zum Dienstplan.');
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

  global.KCDienstplanKasse = { oeffnen, aktualisieren: aktualisiere, heuteIso };
})(window);
