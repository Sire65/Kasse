// Bedienung der zentralen Datenhaltung im Manager.
//
// Der Browser spricht NICHT mit der Cloud - er stößt nur den Companion an, der den
// Dienstschlüssel örtlich hält. Deshalb gehen alle Wege über 127.0.0.1:47392.
(function (global) {
  'use strict';
  const el = (id) => document.getElementById(id);
  const DIENST = 'http://127.0.0.1:47392';

  const melde = (text, art) => {
    const f = el('zdMeldung');
    if (f) { f.textContent = text; f.className = `zd-meldung zd-${art || ''}`; }
  };

  async function zustand() {
    try {
      const z = await (await fetch(`${DIENST}/zentral/zustand`, {signal: AbortSignal.timeout(8000)})).json();
      const f = el('zdZustand');
      if (!z.eingerichtet) {
        f.className = 'zd-zustand zd-warn';
        f.innerHTML = '<strong>Noch nicht eingerichtet.</strong> Im Ordner der Synchronisierung die Datei '
          + '<code>zentral-zugang.beispiel.json</code> nach <code>zentral-zugang.json</code> kopieren '
          + 'und den Dienstschlüssel eintragen. Er bleibt auf diesem Rechner.';
        document.querySelectorAll('.zd-karte button').forEach((b) => b.disabled = true);
        return;
      }
      if (z.fehler) { f.className = 'zd-zustand zd-warn'; f.textContent = `Zentrale nicht erreichbar: ${z.fehler}`; return; }
      f.className = 'zd-zustand zd-gut';
      f.innerHTML = `<strong>Verbunden.</strong> Zentral hinterlegt: ${z.personen} Person(en), ${z.zeiten} Zeitbuchung(en).`;
      document.querySelectorAll('.zd-karte button').forEach((b) => b.disabled = false);
    } catch (e) {
      el('zdZustand').className = 'zd-zustand zd-warn';
      el('zdZustand').textContent = 'Der Sync-Dienst läuft nicht. Bitte das Markttag-Fenster starten.';
      document.querySelectorAll('.zd-karte button').forEach((b) => b.disabled = true);
    }
  }

  async function personenAbholen() {
    melde('Personen werden abgeholt …', '');
    try {
      const {personen} = await (await fetch(`${DIENST}/zentral/personen`, {signal: AbortSignal.timeout(15000)})).json();
      if (!personen?.length) { melde('Zentral sind keine Personen hinterlegt.', 'warn'); return; }
      // In dieselbe Speicherstelle schreiben, die die Zeiterfassung nutzt - zusammenführen,
      // nicht ersetzen: von Hand angelegte Personen dürfen nicht verlorengehen.
      const vorhanden = JSON.parse(localStorage.getItem('kcm_time_clock_people_v1') || '[]');
      const pseudonyme = JSON.parse(localStorage.getItem('kcm_pseudonyms_v1') || '{}');
      let neu = 0, aktualisiert = 0;
      personen.forEach((p) => {
        const treffer = vorhanden.find((x) => (p.credential && x.credential === p.credential)
          || String(x.displayName || '').toLowerCase() === String(p.displayName).toLowerCase());
        // Die Zentrale liefert die Mitgliedsart mit (membership_type: regular|honorary|
        // guest|employee). Vorher stand hier fest 'member' und die Angabe wurde verworfen -
        // ein Gast landete als Vollmitglied in der Zeiterfassung.
        const art = String(p.membershipType || p.membership_type || p.type || '').trim().toLowerCase();
        const personenart = (art === 'guest' || art === 'employee' || art === 'helper'
          || art === 'gast' || art === 'aushilfe') ? 'helper' : 'member';
        const satz = {id: treffer?.id || `z_${p.personId}`, type: personenart, displayName: p.displayName,
          credential: p.credential, birthCode: p.birthCode, active: p.active,
          createdAt: treffer?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()};
        if (treffer) { Object.assign(treffer, satz, {id: treffer.id}); aktualisiert++; }
        else { vorhanden.push(satz); neu++; }
        if (p.credential && p.pseudonym) pseudonyme[p.credential] = p.pseudonym;
      });
      localStorage.setItem('kcm_time_clock_people_v1', JSON.stringify(vorhanden));
      localStorage.setItem('kcm_pseudonyms_v1', JSON.stringify(pseudonyme));
      melde(`${neu} neu angelegt, ${aktualisiert} aktualisiert. Unter Zeiterfassung sichtbar.`, 'gut');
    } catch (e) { melde(`Abholen fehlgeschlagen: ${e.message}`, 'warn'); }
  }

  async function zeitenMelden() {
    melde('Arbeitszeiten werden gemeldet …', '');
    try {
      const ereignisse = JSON.parse(localStorage.getItem('kcm_time_clock_events_v1') || '[]');
      const personen = JSON.parse(localStorage.getItem('kcm_time_clock_people_v1') || '[]');
      if (!ereignisse.length) { melde('Es liegen keine Zeitbuchungen vor.', 'warn'); return; }
      // Zuordnung über die Mitgliedsnummer - nie über den Namen.
      const personZuId = {};
      personen.forEach((p) => { if (p.credential) personZuId[p.id] = personZuId[p.credential] = p.credential; });
      const mitNummer = ereignisse.map((e) => ({...e, credential: personen.find((p) => p.id === e.personId)?.credential || ''}));
      const antwort = await (await fetch(`${DIENST}/zentral/zeiten`, {method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ereignisse: mitNummer, personZuId: zuordnungUeberNummer(personen)}),
        signal: AbortSignal.timeout(20000)})).json();
      if (antwort.fehler) { melde(`Melden fehlgeschlagen: ${antwort.fehler}`, 'warn'); return; }
      melde(`${antwort.gemeldet} Zeitbuchung(en) gemeldet`
        + (antwort.uebersprungen ? `, ${antwort.uebersprungen} übersprungen (Person zentral nicht bekannt).` : '.'), 'gut');
      zustand();
    } catch (e) { melde(`Melden fehlgeschlagen: ${e.message}`, 'warn'); }
  }

  // Der Companion braucht die zentrale Personenkennung. Er kennt sie aus der Zentrale; hier
  // wird die Mitgliedsnummer mitgegeben, über die er zuordnet.
  function zuordnungUeberNummer(personen) {
    const m = {};
    personen.forEach((p) => { if (p.credential) { m[p.id] = p.credential; m[p.credential] = p.credential; } });
    return m;
  }

  async function pseudonymeSchreiben() {
    melde('Pseudonyme werden hochgeschrieben …', '');
    try {
      const pseudonyme = JSON.parse(localStorage.getItem('kcm_pseudonyms_v1') || '{}');
      const antwort = await (await fetch(`${DIENST}/zentral/pseudonyme`, {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pseudonyme}),
        signal: AbortSignal.timeout(15000)})).json();
      if (antwort.fehler) { melde(`Fehlgeschlagen: ${antwort.fehler}`, 'warn'); return; }
      melde(`${antwort.geschrieben} Pseudonym(e) zentral hinterlegt.`, 'gut');
    } catch (e) { melde(`Fehlgeschlagen: ${e.message}`, 'warn'); }
  }

  function starten() {
    if (!el('zdZustand')) return;
    el('zdPersonen').onclick = personenAbholen;
    el('zdZeiten').onclick = zeitenMelden;
    el('zdPseudonyme').onclick = pseudonymeSchreiben;
    zustand();
  }
  document.querySelectorAll('[data-view="zentral"]').forEach((b) =>
    b.addEventListener('click', () => setTimeout(starten, 80)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
  global.KCZentral = {zustand, personenAbholen, zeitenMelden, pseudonymeSchreiben};
})(window);
