// Bargeld-Statistik: welche Stückelung wurde über die Zeit tatsächlich gebraucht?
//
// ZWECK (User): Planungshilfe für den nächsten Weihnachtsmarkt. Vor dem Markt muss jemand
// entscheiden, wie viel Wechselgeld in welcher Stückelung besorgt wird - wie viele 2-Euro-
// Rollen, wie viele 10er-Scheine. Bisher gab es dafür nur das Bauchgefühl: die Stückelung
// steckte zwar in jeder Übergabe, wurde aber nirgends aufbewahrt, gespeichert war nur die
// Summe.
//
// EIN Modul für BEIDE Stellen (eigenständiger Money Butler und PC-Manager). Beide zeigen
// dieselben Zahlen und dieselbe Darstellung - zwei getrennte Auswertungen würden über kurz
// oder lang auseinanderlaufen, und dann weiß niemand mehr, welche stimmt.
//
// DATENQUELLE ist der Manager-Dienst (Loopback 47392). Läuft er nicht, wird auf den lokalen
// Verlauf des jeweiligen Geräts zurückgegriffen - der eigenständige Money Butler arbeitet
// bewusst auch ganz ohne Netz.
(function (global) {
  'use strict';

  const DIENST_PORT = 47392;
  const LOKAL_KEY = 'kc_bargeld_uebergaben_v1';

  const geld = (v) => Number(v || 0).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' \u20ac';
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const nummer = (v) => Number(v || 0).toLocaleString('de-DE');

  // Beschriftung eines Geldwerts: über 1 Euro sind es Scheine, darunter Münzen.
  function wertName(wert) {
    const w = Number(wert);
    return w >= 5 ? `${w} \u20ac Schein`
      : w >= 1 ? `${w} \u20ac`
      : `${Math.round(w * 100)} ct`;
  }
  const TYP = {opening: 'Anfangsbestand', topup: 'Nachfüllung', count: 'Abendzählung'};

  // --- Lokaler Verlauf ------------------------------------------------------------------
  // Jede erzeugte Übergabe wird zusätzlich auf dem Gerät selbst festgehalten. Das ist die
  // Rückfallebene: ohne laufenden Manager-Dienst gäbe es sonst gar keine Statistik.
  function lokalLesen() {
    try { return JSON.parse(localStorage.getItem(LOKAL_KEY) || '[]'); } catch (e) { return []; }
  }
  function lokalMerken(uebergabe) {
    if (!uebergabe || !uebergabe.transferId) return;
    const liste = lokalLesen().filter((x) => x.transferId !== uebergabe.transferId);
    liste.unshift(uebergabe);
    try { localStorage.setItem(LOKAL_KEY, JSON.stringify(liste.slice(0, 500))); } catch (e) { /* Speicher voll - Statistik ist nachrangig */ }
  }

  // Übergabe an den Manager-Dienst melden UND lokal merken.
  //
  // Bewusst ohne await an der Aufrufstelle: die Übergabe selbst (QR-Code, WLAN-Versand) darf
  // nicht darauf warten, ob die Statistik geschrieben werden konnte. Am Stand zählt das
  // Wechselgeld, nicht die Auswertung.
  async function melden(uebergabe, quelle) {
    lokalMerken(uebergabe);
    try {
      await fetch(`http://127.0.0.1:${DIENST_PORT}/bargeld/uebergabe`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({uebergabe, quelle: quelle || 'qr'}),
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch (e) { return false; }
  }

  async function laden() {
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST_PORT}/bargeld/uebergaben`,
        {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      if (!antwort.ok) throw new Error(String(antwort.status));
      const liste = (await antwort.json()).uebergaben || [];
      return {liste, quelle: 'dienst'};
    } catch (e) {
      return {liste: lokalLesen(), quelle: 'lokal'};
    }
  }

  // --- Auswertung -----------------------------------------------------------------------
  // Scheine/lose Münzen und Rollen werden GETRENNT gezählt. Beides zusammenzuwerfen wäre für
  // die Planung wertlos: 40 lose 50-Cent-Stücke sind etwas anderes als eine 50-Cent-Rolle,
  // gekauft wird in Rollen.
  function auswerten(liste, filter) {
    const gefiltert = (liste || []).filter((u) => {
      if (filter?.typ && filter.typ !== 'alle' && u.type !== filter.typ) return false;
      if (filter?.kasse && filter.kasse !== 'alle' && u.registerId !== filter.kasse) return false;
      if (filter?.von && String(u.effectiveDate || u.time || '').slice(0, 10) < filter.von) return false;
      if (filter?.bis && String(u.effectiveDate || u.time || '').slice(0, 10) > filter.bis) return false;
      return true;
    });
    const stueck = new Map();     // Wert -> Anzahl loser Scheine/Münzen
    const rollen = new Map();     // Wert -> Anzahl Rollen
    const jeTag = new Map();      // Datum -> Summe
    let summe = 0, loseSumme = 0, rollenSumme = 0;

    for (const u of gefiltert) {
      summe += Number(u.total || 0);
      loseSumme += Number(u.looseTotal || 0);
      rollenSumme += Number(u.rollTotal || 0);
      const tag = String(u.effectiveDate || u.time || '').slice(0, 10);
      jeTag.set(tag, (jeTag.get(tag) || 0) + Number(u.total || 0));
      const lose = u.looseBreakdown && Object.keys(u.looseBreakdown).length ? u.looseBreakdown : (u.breakdown || {});
      for (const [wert, eintrag] of Object.entries(lose)) {
        const anzahl = Number(eintrag?.count ?? eintrag?.anzahl ?? eintrag ?? 0);
        if (anzahl > 0) stueck.set(Number(wert), (stueck.get(Number(wert)) || 0) + anzahl);
      }
      for (const [wert, eintrag] of Object.entries(u.coinRolls || {})) {
        const anzahl = Number(eintrag?.rolls ?? eintrag?.rollen ?? 0);
        if (anzahl > 0) rollen.set(Number(wert), (rollen.get(Number(wert)) || 0) + anzahl);
      }
    }
    const sortiert = (map) => [...map].sort((a, b) => b[0] - a[0]);
    return {
      anzahl: gefiltert.length, summe, loseSumme, rollenSumme,
      stueck: sortiert(stueck), rollen: sortiert(rollen),
      jeTag: [...jeTag].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      uebergaben: gefiltert,
    };
  }

  // --- Darstellung ----------------------------------------------------------------------
  // Balken als reine CSS-Breite statt Diagrammbibliothek: es geht um "wovon viel, wovon
  // wenig", und das Programm soll keine weitere Abhängigkeit bekommen.
  function balkenTabelle(zeilen, einheit) {
    if (!zeilen.length) return '<p class="kcbs-leer">Für diesen Zeitraum liegen keine Angaben vor.</p>';
    const groesste = Math.max(...zeilen.map((z) => z[1]));
    return `<table class="kcbs-tabelle"><tbody>${zeilen.map(([wert, anzahl]) => `
      <tr><th>${esc(wertName(wert))}</th>
        <td class="kcbs-zahl">${nummer(anzahl)} ${esc(einheit)}</td>
        <td class="kcbs-balkenzelle"><span class="kcbs-balken" style="width:${Math.max(2, Math.round(anzahl / groesste * 100))}%"></span></td>
        <td class="kcbs-zahl">${geld(wert * anzahl * (einheit === 'Rollen' ? (rollInhalt(wert) || 1) : 1))}</td></tr>`).join('')}
    </tbody></table>`;
  }
  // Münzen je Rolle - dieselben Zahlen wie auf dem echten Rollenpapier.
  function rollInhalt(wert) {
    return ({2: 25, 1: 25, 0.5: 40, 0.2: 40, 0.1: 40, 0.05: 50, 0.02: 50, 0.01: 50})[Number(wert)] || 0;
  }

  function zeichne(ziel, daten, quelle) {
    if (!ziel) return;
    ziel.innerHTML = `
      <div class="kcbs-zahlen">
        <div class="kcbs-zahl-karte"><span>Übergaben</span><strong>${nummer(daten.anzahl)}</strong></div>
        <div class="kcbs-zahl-karte"><span>Summe insgesamt</span><strong>${geld(daten.summe)}</strong></div>
        <div class="kcbs-zahl-karte"><span>Davon lose</span><strong>${geld(daten.loseSumme)}</strong></div>
        <div class="kcbs-zahl-karte"><span>Davon Rollen</span><strong>${geld(daten.rollenSumme)}</strong></div>
      </div>
      <h4>Scheine und lose Münzen</h4>
      ${balkenTabelle(daten.stueck, 'Stück')}
      <h4>Münzrollen</h4>
      ${balkenTabelle(daten.rollen, 'Rollen')}
      <h4>Je Markttag</h4>
      ${daten.jeTag.length ? `<table class="kcbs-tabelle"><tbody>${daten.jeTag.map(([tag, wert]) => `
        <tr><th>${esc(tag ? new Date(tag).toLocaleDateString('de-DE') : 'ohne Datum')}</th>
          <td class="kcbs-zahl">${geld(wert)}</td>
          <td class="kcbs-balkenzelle"><span class="kcbs-balken" style="width:${Math.max(2, Math.round(wert / Math.max(...daten.jeTag.map((x) => x[1])) * 100))}%"></span></td></tr>`).join('')}
        </tbody></table>` : '<p class="kcbs-leer">Noch keine Markttage erfasst.</p>'}
      <p class="kcbs-quelle">${quelle === 'dienst'
        ? 'Stand aus dem Manager – alle Kassen und Geräte zusammen.'
        : 'Der Manager-Dienst ist nicht erreichbar. Angezeigt wird der Verlauf dieses Geräts.'}</p>`;
  }

  global.KCBargeldStatistik = {
    melden, laden, auswerten, zeichne, lokalLesen, wertName, rollInhalt, TYP,
  };
})(window);
