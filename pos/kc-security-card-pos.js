// Security Card auf der Kasse - Startcode einlesen.
//
// SO SIEHT ES FÜR DAS TEAM AUS: Tablet an, Kasse auf. Ist das Netz da, kommt der Schlüssel von
// allein und es passiert gar nichts Sichtbares. Fehlt das Netz, steht ein schlichtes Feld da:
// "Startkarte scannen". Karte aus der Kassette davorhalten - fertig. Kein Menü, keine Frage,
// kein Wort darüber, was dahintersteckt.
//
// GESCANNT WIRD MIT DEM BLUETOOTH-SCANNER, der ohnehin am Stand liegt: er tippt wie eine
// Tastatur, und die Kasse hört auf der ganzen Oberfläche mit - genau wie bei Bediener-Ausweis
// und Bargeldübergabe. Die Kamera wäre der schlechtere Weg: sie ist im Browser nur über eine
// gesicherte Adresse freigegeben und würde beim ersten Mal eine Berechtigungsfrage stellen -
// also genau die Erklärung erzwingen, die hier niemand geben soll.
//
// RÜCKFALL: Ist der Scanner leer oder defekt, kann die achtstellige Zahl von der Karte
// eingetippt werden. Beide Wege führen zum selben Schlüssel (siehe shared/kc-security-card.js).
(function (global) {
  'use strict';

  const KARTENSCHLUESSEL_KEY = 'kc_kartenschluessel_v1';
  const DATENSCHLUESSEL_KEY = 'kc_datenschluessel_sitzung_v1';

  const registerId = () => global.KCSyncConnection?.config?.registerId
    || (() => { try { return JSON.parse(localStorage.getItem('kc_master_v040') || '{}').registerId; } catch (e) { return null; } })();
  const kartenschluessel = () => localStorage.getItem(KARTENSCHLUESSEL_KEY) || '';

  let datenschluessel = null, aktuelleAusgabe = null, neueAusgabe = null;
  const istBereit = () => !!datenschluessel;

  // Der Schlüssel bleibt in der Sitzung, nicht auf der Platte: ein weggenommenes Tablet, das
  // neu startet, hat ihn nicht mehr. Innerhalb des Markttags stört das nicht - die Kasse läuft
  // durch, und beim Neustart kommt er wieder übers Netz oder per Karte.
  const AUSGABE_KEY = 'kc_schluessel_ausgabe_v1';
  function setze(schluessel, weg, ausgabe) {
    datenschluessel = schluessel;
    // Wechselt die Ausgabenummer, ist ein NEUER Schlüssel im Einsatz. Das wird ausdrücklich
    // vermerkt: sonst fällt niemandem auf, dass ab heute anders verschlüsselt wird - und
    // Verkäufe früherer Tage brauchen weiterhin ihren alten Schlüssel.
    if (ausgabe) {
      const vorher = Number(localStorage.getItem(AUSGABE_KEY) || 0);
      if (vorher && vorher !== Number(ausgabe)) neueAusgabe = {von: vorher, auf: Number(ausgabe)};
      try { localStorage.setItem(AUSGABE_KEY, String(ausgabe)); } catch (e) { /* egal */ }
      aktuelleAusgabe = Number(ausgabe);
    }
    try { sessionStorage.setItem(DATENSCHLUESSEL_KEY, schluessel); } catch (e) { /* egal */ }
    global.KCSecurityCardPos?.beiFreigabe?.forEach((f) => { try { f(schluessel); } catch (e) {} });
    meldeStart(weg);
    verstecke();
  }

  // Start melden - fürs Protokoll im Manager: welche Kasse, wann, und auf welchem Weg
  // freigeschaltet. Läuft über den bestehenden Live-Kanal und ist an der Kasse unsichtbar.
  // Der Schlüssel selbst wird NIE mitgemeldet.
  function meldeStart(weg) {
    try {
      global.KCSyncLiveEvent?.send?.('kasse_start', {
        registerId: registerId(),
        freigabe: weg || 'unbekannt',      // netz | karte | code | sitzung
        ausgabe: aktuelleAusgabe,
        schluesselWechsel: neueAusgabe ? `${neueAusgabe.von} → ${neueAusgabe.auf}` : null,
        zeit: new Date().toISOString(),
        geraet: navigator.userAgent.slice(0, 90),
      });
    } catch (e) { /* Protokoll ist nachrangig - der Betrieb geht vor */ }
  }

  async function versucheKarte(text) {
    const id = registerId(), schluessel = kartenschluessel();
    if (!id || !schluessel) throw new Error('Dieses Gerät ist noch nicht eingerichtet.');
    return global.KCSecurityCard.leseQr(text, id, schluessel);
  }
  // Telefonweg: nur der durchgesagte Code, ganz ohne Karte. Genau der Fall, für den er da ist -
  // Karte weg, kein Netz, jemand ruft an.
  async function versucheCode(code) {
    const schluessel = kartenschluessel();
    if (!schluessel) throw new Error('Dieses Gerät ist noch nicht eingerichtet.');
    return global.KCSecurityCard.leseCode(code, schluessel);
  }

  // ---- Anzeige ------------------------------------------------------------------------
  // Bewusst wortkarg. "Startkarte" sagt nichts darüber, wozu sie dient.
  let overlay = null, letzterCode = null;

  // BEFUND aus dem Durchlauf: das Startprüfungs-Fenster liegt mit höherer Ebene über allem.
  // Die Startkarten-Abfrage saß unsichtbar dahinter - am Stand hätte jemand vor einer Kasse
  // gestanden, die scheinbar nichts tut. Die PIN-Sperre wartet aus demselben Grund ab; hier
  // wird es genauso gemacht: erst zeigen, wenn das Startfenster weg ist.
  // Das Startfenster erscheint ERST, wenn seine Prüfungen durch sind - also einige Sekunden
  // nach dem Laden. Ein einmaliger Blick zu Beginn geht deshalb ins Leere: die Startkarten-
  // Abfrage stand dann schon da und wurde eine Sekunde später verdeckt. Hier wird sein ganzer
  // Lebenslauf abgewartet: erscheinen und wieder verschwinden. Kommt es gar nicht, geht es
  // nach 15 Sekunden trotzdem weiter - die Kasse soll nie ewig warten.
  function wartenBisStartfensterWeg() {
    return new Promise((fertig) => {
      const beginn = Date.now();
      let gesehen = false;
      const pruefe = () => {
        const da = !!document.getElementById('kcStartupOk');
        if (da) gesehen = true;
        if (gesehen && !da) { fertig(); return; }
        if (!gesehen && Date.now() - beginn > 15000) { fertig(); return; }
        setTimeout(pruefe, 300);
      };
      pruefe();
    });
  }

  async function zeige() {
    if (overlay) return;
    await wartenBisStartfensterWeg();
    if (overlay || istBereit()) return;
    overlay = document.createElement('div');
    overlay.id = 'kcStartkarteOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(9,18,32,.93);z-index:99998;'
      + 'display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px 30px;max-width:430px;text-align:center">
        <div style="font-size:2.6rem;line-height:1">🗝️</div>
        <h2 style="margin:8px 0 4px;font-size:1.35rem;color:#0f2744">Startkarte scannen</h2>
        <p style="margin:0 0 16px;color:#44546a;font-size:.92rem;line-height:1.45">
          Die Karte liegt in der Kassette. Einfach vor den Scanner halten.</p>
        <div style="border-top:1px solid #e2e8f0;padding-top:14px">
          <p style="margin:0 0 8px;color:#5a6b7c;font-size:.84rem">Keine Karte zur Hand? Code eingeben:</p>
          <input id="kcStartkartePin" maxlength="14" placeholder="1-004-8F2K" autocapitalize="characters"
            style="width:190px;padding:11px;font-size:1.15rem;text-align:center;border:1px solid #c3cede;border-radius:8px;
                   font-family:ui-monospace,'Courier New',monospace;text-transform:uppercase">
          <button id="kcStartkarteOk" type="button"
            style="margin-left:8px;padding:11px 18px;border:0;border-radius:8px;background:#166534;color:#fff;font-weight:800">OK</button>
          <p id="kcStartkarteFehler" style="margin:10px 0 0;color:#b91c1c;font-size:.85rem;min-height:1.1em"></p>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#kcStartkarteOk').addEventListener('click', async () => {
      const feld = overlay.querySelector('#kcStartkartePin');
      const fehler = overlay.querySelector('#kcStartkarteFehler');
      try {
        const ergebnis = await versucheCode(feld.value);
        setze(ergebnis.datenschluessel, 'code', ergebnis.ausgabe);
      } catch (e) { fehler.textContent = 'Der Code passt nicht zu diesem Gerät.'; feld.value = ''; }
    });
  }
  function verstecke() { overlay?.remove(); overlay = null; }

  // ---- Scanner ------------------------------------------------------------------------
  // Eigener Mitschnitt, weil die Sperre offen ist, solange kein Schlüssel da ist - der normale
  // Scanner-Mitschnitt der Kasse läuft dann noch nicht.
  let puffer = '', zeitgeber = null;
  document.addEventListener('keydown', async (e) => {
    if (!overlay) return;
    clearTimeout(zeitgeber);
    // BEFUND aus dem Test: hier wurde der Scanner ausgeblendet, sobald das PIN-Feld den Fokus
    // hatte. Wer erst ins Feld getippt und sich dann doch für die Karte entschieden hat, stand
    // vor einer Kasse, die auf den Scan gar nicht mehr reagierte - am Stand genau die Sorte
    // Rätsel, die hier niemand lösen soll. Es wird jetzt immer mitgehört; die Eingabe im Feld
    // stört nicht, weil der Mitschnitt nach 130 ms von selbst verfällt und nur eine Zeichenfolge
    // mit der Kennung als Karte gilt.
    if (e.key === 'Enter') {
      const code = puffer.trim(); puffer = '';
      const fehler = overlay.querySelector('#kcStartkarteFehler');
      if (code.startsWith(global.KCSecurityCard.KENNUNG)) {
        letzterCode = code;
        try {
          const ergebnis = await versucheKarte(code);
        setze(ergebnis.datenschluessel, 'karte', ergebnis.ausgabe);
        } catch (err) {
          // Häufigster Fall: die Karte gehört zu einer anderen Kasse. Das sagt man auch so -
          // ohne zu verraten, zu welcher.
          fehler.textContent = 'Diese Karte passt nicht zu diesem Gerät.';
        }
        return;
      }
      // Enter im PIN-Feld bestätigt die eingetippte Zahl - so, wie man es erwartet.
      if (document.activeElement?.id === 'kcStartkartePin') overlay.querySelector('#kcStartkarteOk')?.click();
      return;
    }
    if (e.key.length === 1) puffer += e.key;
    zeitgeber = setTimeout(() => { puffer = ''; }, 130);
  });

  // ---- Start --------------------------------------------------------------------------
  async function starte() {
    // 1. Schon in dieser Sitzung freigegeben?
    const ausSitzung = (() => { try { return sessionStorage.getItem(DATENSCHLUESSEL_KEY); } catch (e) { return null; } })();
    if (ausSitzung) { datenschluessel = ausSitzung; meldeStart('sitzung'); return; }

    // 2. Über das Netz - der Normalfall am Stand. Passiert unsichtbar.
    try {
      const bauen = global.KCSyncConnection?.buildUrl;
      if (typeof bauen === 'function') {
        const antwort = await fetch(bauen('/kc-sync-datenschluessel'), {signal: AbortSignal.timeout(3000)});
        if (antwort.ok) {
          const daten = await antwort.json();
          if (daten?.datenschluessel) { setze(daten.datenschluessel, 'netz', daten.ausgabe); return; }
        }
      }
    } catch (e) { /* kein Netz - dann eben die Karte */ }

    // 3. Ohne Netz: Karte.
    if (kartenschluessel()) zeige();
    // Ist das Gerät noch gar nicht eingerichtet, wird nichts angezeigt - dann läuft die Kasse
    // wie bisher unverschlüsselt weiter, statt am Marktmorgen zu blockieren.
  }

  global.KCSecurityCardPos = {
    istBereit, schluessel: () => datenschluessel, ausgabe: () => aktuelleAusgabe,
    wechsel: () => neueAusgabe, zeige, verstecke, setze,
    beiFreigabe: [],
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starte);
  else starte();
})(window);
