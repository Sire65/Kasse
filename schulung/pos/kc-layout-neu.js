// Neues Kassenlayout - Beschriftungen.
//
// Im neuen Layout stehen die sechs Sondertasten als 3x2-Feld nebeneinander und sind deshalb
// schmaler als vorher. Die langen Beschriftungen ("PFANDRUECKGABE", "BAR DIREKT / PASSEND
// ABRECHNEN") passen dort nicht mehr hinein und wuerden abgeschnitten - genau das, was
// abgestellt werden soll.
//
// Statt die Texte im HTML zu aendern (das wuerde auch das alte Layout betreffen, das
// unveraendert bleiben soll), werden sie hier nur dann getauscht, wenn das neue Layout aktiv
// ist. Die Originaltexte werden vorher gesichert und beim Zurueckschalten wieder eingesetzt.
// Dadurch ist der Umschalter in beide Richtungen verlustfrei.
(function (global) {
  'use strict';

  // Kurzfassungen. Bewusst so gewaehlt, dass die Bedeutung eindeutig bleibt: "PFAND" statt
  // "PFANDRUECKGABE" ist am Stand genauso klar, "BAR" statt "BAR DIREKT / PASSEND ABRECHNEN"
  // ebenfalls - die ausfuehrliche Erklaerung steht weiterhin in der Kurzinfo des Knopfes.
  const KURZ = {
    depositBtn: '\u267B PFAND',
    tipBtn: '\uD83D\uDC9D TRINKGELD',
    complaintBtn: '\u21A9 REKLAMATION',
    accountChargeBtn: '\uD83D\uDCC4 KONTO',
    staffBtn: '\uD83D\uDC65 PERSONAL',
    moreBtn: '\u2022\u2022\u2022 MEHR',
  };
  const original = {};

  // WICHTIG: nur schreiben, wenn sich der Text tatsaechlich aendert.
  // Grund: unten beobachtet ein MutationObserver den Zahlknopf. Wuerde hier bei jedem Aufruf
  // neu geschrieben, loeste das Schreiben selbst wieder eine Aenderung aus, die den Beobachter
  // erneut ausloest - eine Endlosschleife, die den Browser zum Absturz bringt. Genau das ist
  // beim Testen passiert: sobald ein Artikel in den Bon kam, wurde der Zahlknopf neu
  // beschriftet und die Kasse ist abgestuerzt.
  function setzeText(id, text) {
    const knopf = document.getElementById(id);
    if (!knopf) return;
    if (knopf.textContent === text) return;
    if (!(id in original)) original[id] = knopf.textContent;
    knopf.textContent = text;
  }
  function stelleHer(id) {
    const knopf = document.getElementById(id);
    if (!knopf || !(id in original)) return;
    if (knopf.textContent === original[id]) return;
    knopf.textContent = original[id];
  }

  function anwenden() {
    const aktiv = document.body.classList.contains('kc-layout-neu');
    Object.keys(KURZ).forEach(id => (aktiv ? setzeText(id, KURZ[id]) : stelleHer(id)));

    // Zahlknopf: nur "BAR" auf dem Knopf, der QR-Code bleibt darunter unveraendert.
    // Die Beschriftung wird an anderer Stelle laufend neu gesetzt (je nach Zahlart), deshalb
    // wird hier nur die Darstellung umgestellt und nichts ueberschrieben, was danach wieder
    // zurueckgesetzt wuerde - siehe CSS-Regel fuer .pay-label small im neuen Layout.
    const titel = document.getElementById('payModeTitle');
    if (titel) {
      if (aktiv) {
        // Immer den zuletzt von der Kasse gesetzten Text merken, nicht nur den allerersten:
        // die Beschriftung wechselt im Betrieb mit der Zahlart. Wuerde nur der erste Wert
        // gemerkt, stuende beim Zurueckschalten auf das alte Layout eine veraltete
        // Beschriftung auf dem Knopf.
        if (titel.textContent !== 'BAR') original.payModeTitle = titel.textContent;
        if (titel.textContent !== 'BAR') titel.textContent = 'BAR';
      } else if ('payModeTitle' in original && titel.textContent !== original.payModeTitle) {
        titel.textContent = original.payModeTitle;
      }
    }
    const undo = document.getElementById('undoCashBtn');
    if (undo) {
      const klein = undo.querySelector('small');
      if (klein) {
        if (aktiv) {
          if (klein.textContent !== 'ZUR\u00dcCK') {
            original.undoCashBtn = klein.textContent;
            klein.textContent = 'ZUR\u00dcCK';
          }
        } else if ('undoCashBtn' in original && klein.textContent !== original.undoCashBtn) {
          klein.textContent = original.undoCashBtn;
        }
      }
    }
  }

  // Auf das Umschalten reagieren: die Klasse am body wird an anderer Stelle gesetzt
  // (applySettings in app.js). Ein Beobachter ist hier zuverlaessiger als ein Aufruf an einer
  // festen Stelle, weil die Klasse auch beim Start und beim Uebernehmen von Stammdaten wechselt.
  // ---- Zahlenblock: Wert auf dem aktiven Modusknopf -------------------------------------
  // Die eigene Anzeigezeile des Zahlenblocks entfaellt im neuen Layout zugunsten groesserer
  // Zifferntasten (30px mit Zeile, 37px ohne). Damit trotzdem jederzeit erkennbar ist, was
  // gerade eingetippt wird, wird der Wert auf den aktiven Modusknopf geschrieben.
  const MODUS_TEXT = {cash: '\uD83D\uDCB6 Bargeld', quantity: '\u00D7 Menge', discount: '% Rabatt'};

  function keypadWertSpiegeln() {
    if (!document.body.classList.contains('kc-layout-neu')) return;
    const wert = document.getElementById('keypadDisplay');
    document.querySelectorAll('.keypad-mode-row button[data-keypad-mode]').forEach(knopf => {
      const m = knopf.dataset.keypadMode;
      const grund = MODUS_TEXT[m];
      if (!grund) return;
      const aktiv = knopf.classList.contains('active');
      const text = aktiv && wert ? `${grund} ${String(wert.textContent || '').trim()}` : grund;
      if (knopf.textContent !== text) knopf.textContent = text;
    });
  }

  // ---- Schmaler Umschalter im Mehr-Fenster ----------------------------------------------
  // Der Schalter in den Einstellungen liegt hinter dem Admin-Zugang (Logo gedrueckt halten).
  // Zum Ausprobieren am Tablet ist das zu umstaendlich - deshalb hier zusaetzlich ein
  // schmaler Umschalter direkt im Mehr-Fenster, neben Stossbetrieb und Training.
  // Er schreibt in dieselbe Einstellung, damit beide Wege dasselbe bewirken.
  function ansichtSchalterVerdrahten() {
    const knopf = document.getElementById('layoutQuickToggle');
    if (!knopf || knopf.dataset.verdrahtet) return;
    knopf.dataset.verdrahtet = '1';
    const auffrischen = () => {
      const an = document.body.classList.contains('kc-layout-neu');
      knopf.classList.toggle('an', an);
      knopf.setAttribute('aria-pressed', String(an));
      const text = knopf.querySelector('.kc-ansicht-text');
      if (text) text.textContent = global.KCAnsicht
        ? `Ansicht: ${global.KCAnsicht.aktuelle().name}`
        : (an ? 'Neue Ansicht: AN' : 'Neue Ansicht: AUS');
    };
    knopf.onclick = () => {
      // Seit es EINEN Umschalter gibt, laeuft auch dieser Knopf darueber - sonst waeren es
      // wieder zwei Wege mit unterschiedlichem Verhalten.
      if (global.KCAnsicht) { global.KCAnsicht.weiter(); auffrischen(); return; }
      const neu = !document.body.classList.contains('kc-layout-neu');
      // In die gespeicherte Einstellung schreiben, damit die Wahl einen Neustart uebersteht
      // und mit dem Schalter in den Einstellungen uebereinstimmt.
      try {
        const master = JSON.parse(localStorage.getItem('kc_master_v040') || '{}');
        master.neuesLayout = neu;
        localStorage.setItem('kc_master_v040', JSON.stringify(master));
      } catch (e) { /* Speicher gesperrt - die Umschaltung wirkt dann nur bis zum Neustart */ }
      document.body.classList.toggle('kc-layout-neu', neu);
      auffrischen();
    };
    new MutationObserver(auffrischen).observe(document.body, {attributes: true, attributeFilter: ['class']});
    auffrischen();
  }

  // ---- Deutliche Warnung, wenn die Kasse ohne Manager laeuft ----------------------------
  // GEFAHR: ohne Manager gibt es nur EINE Kopie jeder Buchung - die auf diesem Tablet. Geht das
  // Geraet verloren oder loescht jemand die Browserdaten, sind die Verkaeufe des Tages weg.
  // Bisher war das nur an einer grauen LED erkennbar; jemand kann so einen halben Markttag
  // verkaufen, ohne zu merken, dass nichts gesichert wird. Deshalb ein Hinweis, den man nicht
  // uebersieht - erst nach einer Anlaufzeit, damit er beim Starten nicht faelschlich aufblitzt.
  // --- Hinweis "Datensicherung unterbrochen" ------------------------------------------------
  // BEFUND (User am Stand): der Hinweis leuchtete alle paar Minuten mitten im Betrieb auf und
  // stoerte den Bezahlvorgang. Ursache: "Verstanden" entfernte nur den Balken, merkte sich das
  // Wegklicken aber NICHT - 15 Sekunden spaeter war er wieder da. Ausserdem erschien er auch
  // mitten in einem laufenden Bon.
  // JETZT: (1) "Verstanden" schweigt fuer den Rest des Markttages, (2) waehrend ein Bon offen
  // ist oder ein Fenster aussteht, erscheint gar nichts, (3) kommt die Verbindung zurueck, wird
  // das Schweigen aufgehoben - eine spaetere Stoerung meldet sich also wieder einmal.
  const RUHE_SCHLUESSEL = 'kc_ohne_manager_ruhe_v1';
  let ohneManagerSeit = null;

  const heuteAlsText = () => new Date().toISOString().slice(0, 10);
  function ruhtHeute() {
    try { return localStorage.getItem(RUHE_SCHLUESSEL) === heuteAlsText(); } catch (e) { return false; }
  }
  function ruheSetzen() {
    try { localStorage.setItem(RUHE_SCHLUESSEL, heuteAlsText()); } catch (e) { /* ohne Speicher bleibt es beim Sitzungsverhalten */ }
  }
  function ruheAufheben() {
    try { localStorage.removeItem(RUHE_SCHLUESSEL); } catch (e) { /* nicht kritisch */ }
  }
  // Ein Bon ist offen, sobald etwas im Einkaufswagen liegt - oder ein Fenster geoeffnet ist.
  function kasseGeradeBeschaeftigt() {
    const wagen = document.getElementById('cartList');
    if (wagen && wagen.children.length > 0) return true;
    if (document.querySelector('dialog[open]')) return true;
    return false;
  }
  function warnungOhneManager() {
    if (!document.body.classList.contains('kc-layout-neu')) return;
    const zustand = document.querySelector('#kcLedBlock [data-led="manager"] .kc-led-zustand');
    const verbunden = zustand && /gut/.test(zustand.className);
    if (verbunden) {
      ohneManagerSeit = null;
      ruheAufheben();
      document.getElementById('kcOhneManager')?.remove();
      return;
    }
    if (ohneManagerSeit === null) { ohneManagerSeit = Date.now(); return; }
    if (Date.now() - ohneManagerSeit < 45000) return;   // 45s Anlaufzeit
    if (ruhtHeute()) return;                            // heute schon zur Kenntnis genommen
    if (kasseGeradeBeschaeftigt()) return;              // niemals mitten im Bezahlvorgang
    if (document.getElementById('kcOhneManager')) return;
    const balken = document.createElement('div');
    balken.id = 'kcOhneManager';
    balken.className = 'kc-ohne-manager';
    balken.innerHTML = '<strong>\u26A0 Datensicherung unterbrochen</strong>'
      + '<span>Die Kasse funktioniert weiter, aber alle Buchungen liegen NUR auf diesem Ger\u00e4t. '
      + 'Geht es verloren, sind die Daten weg. Bitte pr\u00fcfen, ob das Markttag-Fenster l\u00e4uft.</span>'
      + '<button type="button">Verstanden - heute nicht mehr zeigen</button>';
    balken.querySelector('button').onclick = () => { ruheSetzen(); balken.remove(); };
    document.body.appendChild(balken);
  }

  function starten() {
    anwenden();
    setInterval(warnungOhneManager, 15000);
    ansichtSchalterVerdrahten();
    keypadWertSpiegeln();
    const wert = document.getElementById('keypadDisplay');
    if (wert) new MutationObserver(keypadWertSpiegeln).observe(wert, {childList: true, characterData: true, subtree: true});
    document.querySelectorAll('.keypad-mode-row button[data-keypad-mode]')
      .forEach(k => k.addEventListener('click', () => setTimeout(keypadWertSpiegeln, 40)));
    ledBlockAufbauen();
    ledsAktualisieren();
    setInterval(ledsAktualisieren, 4000);
    new MutationObserver(() => { anwenden(); ledBlockAufbauen(); ledsAktualisieren(); })
      .observe(document.body, {attributes: true, attributeFilter: ['class']});
    // Der Zahlknopf-Titel wird beim Wechsel der Zahlart neu geschrieben - danach erneut kuerzen.
    const titel = document.getElementById('payModeTitle');
    if (titel) new MutationObserver(anwenden).observe(titel, {childList: true, characterData: true, subtree: true});
  }

  // ---- Verbindungs-LEDs -----------------------------------------------------------------
  // Drei getrennte Gruppen statt zwei doppelt belegter: KASSE (lokale Datenbank),
  // MANAGER (KC Sync im Netz), CLOUD (Supabase). Jede mit Zustand oben und Aktivitaet unten.
  // Die Zustaende werden von den vorhandenen Anzeigen abgelesen, die im HTML erhalten bleiben -
  // es wird also nichts neu erfunden, nur getrennt und lesbar dargestellt.
  const LED_GRUPPEN = [
    {schluessel: 'kasse',   name: 'Ger\u00e4t',  titel: 'Speicherung auf diesem Ger\u00e4t'},
    {schluessel: 'manager', name: 'Sicherung', titel: 'Laufende Datensicherung'},
    {schluessel: 'cloud',   name: 'Online',  titel: 'Online-Sicherung'},
  ];

  function ledBlockAufbauen() {
    const leiste = document.querySelector('.header-status');
    // FEHLER, den der Betrieb gezeigt hat: der Block wurde AUCH im alten Layout eingebaut.
    // Dort ist kein Platz dafuer vorgesehen - er hat die Kopfzeile auseinandergedrueckt und
    // die Versionszelle mit den LED-Kuerzeln vermischt. Er gehoert ausschliesslich ins neue
    // Layout; wird zurueckgeschaltet, verschwindet er wieder.
    if (!document.body.classList.contains('kc-layout-neu')) {
      document.getElementById('kcLedBlock')?.remove();
      return;
    }
    if (!leiste || document.getElementById('kcLedBlock')) return;
    const block = document.createElement('div');
    block.id = 'kcLedBlock';
    block.className = 'kc-led-block';
    block.innerHTML = LED_GRUPPEN.map(g => `
      <div class="kc-led-gruppe" data-led="${g.schluessel}" title="${g.titel}">
        <span class="kc-led-punkt kc-led-zustand"></span>
        <span class="kc-led-punkt kc-led-aktivitaet"></span>
        <span class="kc-led-name">${g.name}</span>
      </div>`).join('');
    // Vor dem Menue einsortieren, damit die Werkzeugknoepfe rechts zusammenbleiben.
    leiste.insertBefore(block, document.getElementById('menuBtn'));
  }

  function ledsAktualisieren() {
    const block = document.getElementById('kcLedBlock');
    if (!block) return;
    const setze = (schluessel, zustand, aktiv, titel) => {
      const g = block.querySelector(`[data-led="${schluessel}"]`);
      if (!g) return;
      g.querySelector('.kc-led-zustand').className = `kc-led-punkt kc-led-zustand ${zustand}`;
      g.querySelector('.kc-led-aktivitaet').className = `kc-led-punkt kc-led-aktivitaet ${aktiv}`;
      if (titel) g.title = titel;
    };
    // Kasse: die lokale Datenbank. Laeuft die Kasse ueberhaupt, wird lokal gespeichert.
    const lokalOk = typeof global.readTransactions === 'function';
    setze('kasse', lokalOk ? 'gut' : 'aus', lokalOk ? 'gut' : '',
      lokalOk ? 'Speicherung auf diesem Ger\u00e4t l\u00e4uft' : 'Speicherung auf diesem Ger\u00e4t nicht m\u00f6glich');
    // Manager: Zustand von der vorhandenen Sync-Anzeige uebernehmen.
    const syncZustand = document.querySelector('#kcSyncStatusLeds .kc-sync-led-status');
    const syncAktiv = document.querySelector('#kcSyncStatusLeds .kc-sync-led-activity');
    // Zustands-LED: gruen/gelb/rot wie im Bestand.
    const anKlasse = el => {
      if (!el) return 'aus';
      const k = String(el.className);
      if (/gruen|green|ok|verbunden|online/i.test(k)) return 'gut';
      if (/gelb|amber|warn/i.test(k)) return 'warn';
      if (/rot|red|offline|getrennt/i.test(k)) return 'aus';
      return '';   // noch kein Zustand bekannt - grau, nicht rot
    };
    // FEHLER, den der Betrieb gezeigt hat: die Aktivitaets-LED wurde rot dargestellt, sobald
    // gerade nichts blitzte. Sie kennt aber gar keinen Fehlerzustand - sie blitzt beim
    // Datenverkehr auf und ist sonst neutral. Rot bedeutet bei den anderen Gruppen "kaputt"
    // und hat hier genau die Verwirrung ausgeloest, die eine Anzeige vermeiden soll.
    const aktivitaet = el => (el && /kc-led-aktiv/.test(String(el.className))) ? 'gut' : '';
    setze('manager', anKlasse(syncZustand), aktivitaet(syncAktiv), syncZustand?.title || '');
    // Cloud: Supabase. Ist sie nicht eingerichtet, bleibt die Gruppe grau statt rot -
    // "nicht eingerichtet" ist kein Fehler und soll am Stand keinen Alarm ausloesen.
    const sup = document.querySelector('.supabase-led-group');
    const supTitel = sup?.title || '';
    const eingerichtet = !/nicht eingerichtet/i.test(supTitel);
    setze('cloud', eingerichtet ? 'gut' : '', eingerichtet ? 'gut' : '', supTitel);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starten);
  else starten();
  global.KCLayoutNeu = {anwenden, ledsAktualisieren, keypadWertSpiegeln, kurzfassungen: () => Object.assign({}, KURZ)};
})(window);
