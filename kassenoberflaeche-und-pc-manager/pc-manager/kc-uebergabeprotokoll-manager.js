// Archiv der Übergabeprotokolle im PC-Manager.
//
// Hier enden BEIDE Wege, die es für einen Beleg gibt:
//   1. Der Money Butler meldet jeden erzeugten Beleg sofort an den Manager-Dienst.
//   2. Lag der Dienst still (der Money Butler läuft bewusst auch ohne Netz), steht der Beleg
//      nur auf dem Papier - sein QR-Code wird hier gescannt oder als Text eingefügt.
// Gelesen und geprüft wird in beiden Fällen mit demselben Modul (shared/kc-uebergabeprotokoll.js),
// damit ein gültiger Beleg nicht auf dem einen Weg angenommen und auf dem anderen abgelehnt wird.
(function (global) {
  'use strict';

  const modul = global.KCUebergabeprotokoll;
  const el = (id) => document.getElementById(id);
  if (!modul || !el('mgrProtokolle')) return;

  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' €';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const TYP = {opening: 'Anfangsbestand', topup: 'Nachfüllung', count: 'Abendzählung'};
  const wertName = (w) => (Number(w) >= 5 ? `${Number(w)} € Schein` : Number(w) >= 1 ? `${Number(w)} €` : `${Math.round(Number(w) * 100)} ct`);
  const datum = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? String(iso || '') : d.toLocaleString('de-DE');
  };

  function meldung(text, art) {
    const feld = el('mgrProtokollMeldung');
    feld.textContent = text;
    feld.className = 'kcprot-meldung ' + (art === 'fehler' ? 'kcprot-fehler' : 'kcprot-ok');
    feld.hidden = !text;
  }

  function stueckelung(lose, rollen) {
    const zeilen = [];
    Object.keys(lose || {}).map(Number).sort((a, b) => b - a).forEach((w) => {
      const anzahl = Number(lose[w] || 0);
      if (anzahl > 0) zeilen.push(`${anzahl}× ${wertName(w)}`);
    });
    Object.keys(rollen || {}).map(Number).sort((a, b) => b - a).forEach((w) => {
      const anzahl = Number(rollen[w] || 0);
      if (anzahl > 0) zeilen.push(`${anzahl} Rolle${anzahl === 1 ? '' : 'n'} ${wertName(w)}`);
    });
    return zeilen.length ? zeilen.join(' · ') : '—';
  }

  function zeichne(liste, quelle) {
    const ziel = el('mgrProtokolle');
    if (!liste.length) {
      ziel.innerHTML = `<p class="kcbs-leer">Noch keine Übergabeprotokolle vorhanden.</p>
        <p class="kcprot-quelle">${quelle === 'dienst' ? 'Stand aus dem Manager-Dienst.' : 'Der Manager-Dienst ist nicht erreichbar - angezeigt wird der Verlauf dieses Geräts.'}</p>`;
      return;
    }
    ziel.innerHTML = liste.map((beleg) => {
      const teile = modul.anteile(beleg);
      const anteilZeilen = teile ? teile.map((t) => `
        <tr><th>${esc(t.kasse)}</th><td>${esc(stueckelung(t.lose, t.rollen))}</td><td class="kcprot-betrag">${geld(t.summe)}</td></tr>`).join('') : '';
      return `<details class="kcprot-beleg">
        <summary>
          <span class="kcprot-nummer">${esc(String(beleg.id).slice(0, 8).toUpperCase())}</span>
          <span class="kcprot-art">${beleg.art === 'kassette' ? 'Geldkassette' : 'Einzelübergabe'} · ${esc(TYP[beleg.typ] || beleg.typ || '')}</span>
          <span class="kcprot-datum">${esc(beleg.datum || '')}</span>
          <strong class="kcprot-betrag">${geld(beleg.summe)}</strong>
        </summary>
        <table class="kcprot-tabelle">
          <tr><th>Inhalt gesamt</th><td>${esc(stueckelung(beleg.lose, beleg.rollen))}</td><td class="kcprot-betrag">${geld(beleg.summe)}</td></tr>
          ${anteilZeilen}
          <tr><th>Kassen</th><td colspan="2">${esc((beleg.kassen || []).join(', '))}</td></tr>
          <tr><th>Erstellt</th><td colspan="2">${esc(datum(beleg.erstellt))}${beleg.empfangen ? ' · im Manager seit ' + esc(datum(beleg.empfangen)) : ''}${beleg.quelle ? ' · ' + esc(beleg.quelle) : ''}</td></tr>
          ${beleg.notiz ? `<tr><th>Notiz</th><td colspan="2">${esc(beleg.notiz)}</td></tr>` : ''}
          ${beleg.tid ? `<tr><th>Übergabe-ID</th><td colspan="2"><code>${esc(beleg.tid)}</code></td></tr>` : ''}
        </table>
      </details>`;
    }).join('') + `<p class="kcprot-quelle">${quelle === 'dienst' ? `${liste.length} Beleg${liste.length === 1 ? '' : 'e'} aus dem Manager-Dienst.` : 'Der Manager-Dienst ist nicht erreichbar - angezeigt wird der Verlauf dieses Geräts.'}</p>`;
  }

  async function laden() {
    const {liste, quelle} = await modul.laden();
    zeichne(liste, quelle);
  }

  // Nachtragen vom Papier: erst lesen und prüfen, dann melden. Schlägt die Prüfung fehl, wird
  // GAR NICHTS gespeichert - ein beschädigter Beleg gehört nicht ins Archiv.
  async function uebernehmen() {
    const eingabe = el('mgrProtokollEingabe');
    const text = (eingabe.value || '').trim();
    if (!text) { meldung('Bitte den Beleg-Code einscannen oder einfügen.', 'fehler'); return; }
    let beleg;
    try { beleg = modul.lesen(text); }
    catch (err) { meldung(err.message, 'fehler'); return; }
    const gemeldet = await modul.melden(beleg, 'nachgetragen');
    eingabe.value = '';
    meldung(gemeldet
      ? `Beleg ${String(beleg.id).slice(0, 8).toUpperCase()} über ${geld(beleg.summe)} wurde ins Archiv übernommen.`
      : `Beleg ${String(beleg.id).slice(0, 8).toUpperCase()} ist gültig, der Manager-Dienst antwortet aber nicht - der Beleg liegt vorerst nur auf diesem Gerät.`,
      gemeldet ? 'ok' : 'fehler');
    laden();
  }

  el('mgrProtokollUebernehmen').addEventListener('click', uebernehmen);
  el('mgrProtokollAktualisieren').addEventListener('click', () => { meldung(''); laden(); });
  // Ein Handscanner tippt den Code und schliesst mit Enter ab - das soll direkt übernehmen.
  el('mgrProtokollEingabe').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); uebernehmen(); } });

  laden();
})(window);
