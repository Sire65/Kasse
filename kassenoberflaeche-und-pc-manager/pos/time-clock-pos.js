// Zeiterfassung an der Kasse - Kommen und Gehen per Mitgliedsausweis.
//
// GRUNDREGEL: an der Kasse gibt es KEINE Klarnamen. Weder beim Verkaufen noch beim Stempeln.
// Anne heisst hier ueberall "Einhorn". Die Zuordnung Klarname <-> Pseudonym liegt
// ausschliesslich im PC-Manager; zur Kasse wandert nur das Pseudonym. Beim Uebernehmen einer
// Personenliste wird ein evtl. mitgelieferter Klarname deshalb aktiv ersetzt (siehe
// anzeigenameFuer/uebernimmPersonen) - er wird hier gar nicht erst gespeichert.
//
// VERBINDUNG ZUM VERKAUF: eine Person, nicht zwei Listen. Die Mitgliedsnummer ist die Klammer -
// die Bedienerprofile der Kasse fuehren sie bereits mit (Einhorn = KC-0007), und der
// Mitgliedsausweis traegt im QR genau dieselbe Nummer. Wer sich einstempelt, wird dadurch
// automatisch zum gebuchten Bediener; beim Ausstempeln faellt die Kasse auf "Team" zurueck
// (falsch auf Team gebucht ist harmlos, falsch auf eine Person nicht).
//
// UHRZEIT: der Vorschlag wird auf die volle halbe Stunde gerundet - wer um 10:50 scannt, bekommt
// 11:00 vorgeschlagen, wer um 16:05 geht, bekommt 16:00. Danebenliegend vier grosse Knoepfe
// (-15/-5/+5/+15) zum Nachstellen; bewusst Knoepfe statt Drehrad, das laesst sich am Stand mit
// kalten Fingern zuverlaessiger treffen. Der tatsaechliche Scanzeitpunkt bleibt in jedem Fall
// unveraendert als recordedAt erhalten, die angepasste Zeit steht daneben als effectiveAt.
(function (global) {
  'use strict';
  const VERSION = '0.2.0', CONFIG_KEY = 'kc_time_clock_config_v1', PEOPLE_KEY = 'kc_time_clock_people_v1', EVENTS_KEY = 'kc_time_clock_events_v1';
  // 10.09.2026 (Betreiber: "Kasse 3 in der Nebenhuette bleibt eine normale Kasse, soll aber
  // sofort zum Einchecken bereitstehen"): rein GERAETE-lokal (localStorage, nicht Teil von
  // config/registers) - bewusst NICHT ueber den PC-Manager verteilt, jedes Tablet entscheidet
  // das fuer sich selbst.
  const AUTOSTART_KEY = 'kc_time_clock_autostart_v1';
  const core = global.KCTimeClockCore;
  if (!core) return;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  let config = read(CONFIG_KEY, {enabled:false,eventId:'WM-2026',allowBirthCode:true,allowManualTime:true});
  let people = read(PEOPLE_KEY, []), events = read(EVENTS_KEY, []);
  let selected = null, source = 'id', erfasstAm = null, vorschlag = null, gerundeterVorschlag = null;
  let schichtgrund = '';
  // Gruende beim GEHEN. Bewusst sechs Stueck in zwei Reihen - genug fuer den echten Betrieb,
  // wenig genug, dass man sie ohne Lesen trifft. Beim Kommen gibt es bewusst keine Gruende:
  // dort stimmt die gerundete Zeit fast immer, und jeder Knopf mehr macht das Fenster langsamer.
  const GEH_GRUENDE = ['Krank geworden', 'Fr\u00fcher entlassen', 'Abl\u00f6sung zu sp\u00e4t', 'Eigener Wunsch', 'L\u00e4nger geblieben', 'Abbau', 'Notfall'];
  const testAccess = global.KC_RUNTIME_FLAGS?.candidateTestAccess === true;
  const registerId = () => document.getElementById('registerName')?.textContent?.trim() || 'KASSE-01';
  const save = () => localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  const el = id => document.getElementById(id);
  const uhr = d => new Date(d).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
  const message = (text, tone = '') => {
    const node = el('tcPosMessage');
    if (node) { node.textContent = text; node.className = `tc-pos-message ${tone}`; }
  };

  // ---- Pseudonyme -----------------------------------------------------------------------
  // Bedienerprofile der Kasse holen (normalizeOperatorProfiles ist in app.js eine echte
  // function-Deklaration und haengt daher an window - anders als state/PRODUCTS, die mit
  // const/let deklariert sind und NICHT erreichbar waeren).
  function bedienerprofile() {
    try { return typeof global.normalizeOperatorProfiles === 'function' ? global.normalizeOperatorProfiles() : []; }
    catch (e) { return []; }
  }
  function profilZuMitgliedsnummer(memberNo) {
    if (!memberNo) return null;
    return bedienerprofile().find(p => p.memberNo && String(p.memberNo).trim() === String(memberNo).trim()) || null;
  }
  function teamProfil() {
    const alle = bedienerprofile();
    return alle.find(p => String(p.name).toLowerCase() === 'team') || alle[0] || null;
  }
  // Was an der Kasse angezeigt wird: Pseudonym, sonst die Mitgliedsnummer - niemals ein Klarname.
  function anzeigenameFuer(person) {
    const profil = profilZuMitgliedsnummer(person && person.credential);
    if (profil) return profil.name;
    return String((person && (person.credential || person.id)) || 'Unbekannt');
  }

  // ---- Uhrzeit --------------------------------------------------------------------------
  const VIERTEL_STUNDE = 15 * 60000;
  // 09.09.2026 (Betreiber, nach ausfuehrlichem Gespraech - loest den BEFUND vom 31.08.2026
  // bewusst ab, siehe identify() weiter unten): "Der Abgleich mit dem Dienstplan findet
  // HINTERHER in DP2 statt, hier brauchen wir nur einen guten, bedienerfreundlichen Weg." Die
  // Kasse kennt keinen Dienstplan (den kennt nur DP2/DP3) - sie kann also nicht wissen, ob 11:00
  // die geplante Schichtzeit ist. Was sie aber leisten kann, ohne zu raten: NIEMALS von sich aus
  // eine Zeit vorschlagen, die dem Mitglied unbeabsichtigt Minuten schenkt. Deshalb richtungs-
  // abhaengig, nicht auf die naeheste Marke: beim KOMMEN wird auf die naechste Viertelstunde
  // AUFgerundet (10:46 -> 11:00, nicht 10:45) - wer frueh da ist, bekommt die frueheren Minuten
  // nicht automatisch gutgeschrieben. Beim GEHEN wird ABgerundet (15:10 -> 15:00) - wer ein
  // paar Minuten laenger braucht, um abzuschliessen, bekommt dafuer keine Mehrarbeit gutgeschrieben.
  // Eine ECHTE laengere Anwesenheit (z.B. Abloesung kommt 30 Minuten spaeter) wird dadurch NICHT
  // verschluckt: das Drehrad bleibt frei bedienbar, und weicht die am Ende gebuchte Zeit von
  // diesem fairen Vorschlag ab, verlangt korrekturgrund() weiterhin eine Begruendung (jetzt
  // gegen den fairen Vorschlag gemessen, nicht mehr gegen die reine Scan-Sekunde).
  function rundeGerecht(zeitpunkt, richtung) {
    const ms = new Date(zeitpunkt).getTime();
    return richtung === 'in'
      ? new Date(Math.ceil(ms / VIERTEL_STUNDE) * VIERTEL_STUNDE)
      : new Date(Math.floor(ms / VIERTEL_STUNDE) * VIERTEL_STUNDE);
  }
  // ---- Drehfeld ------------------------------------------------------------------------
  // Zwei Rollen (Stunde / Minute in 5er-Schritten), die man mit dem Finger dreht. Die Mitte ist
  // durch ein farbiges Band markiert, dort steht der gewaehlte Wert. Antippen springt ebenfalls
  // dorthin - wer nicht scrollen mag, tippt einfach die Zahl an.
  const MINUTENSCHRITT = 5;
  let radBereit = false, radStumm = false;

  function baueRad(knoten, werte, formatiere) {
    knoten.innerHTML = '<div class="tc-fuell"></div>'
      + werte.map(v => `<div class="tc-wert" data-wert="${v}">${formatiere(v)}</div>`).join('')
      + '<div class="tc-fuell"></div>';
  }
  function radHoehe(knoten) {
    const erster = knoten.querySelector('.tc-wert');
    return erster ? erster.getBoundingClientRect().height : 64;
  }
  function setzeRad(knoten, wert) {
    const ziel = knoten.querySelector(`.tc-wert[data-wert="${wert}"]`);
    if (!ziel) return;
    radStumm = true;
    knoten.scrollTop = ziel.offsetTop - (knoten.clientHeight - ziel.clientHeight) / 2;
    markiereRad(knoten);
    setTimeout(() => { radStumm = false; }, 120);
  }
  function radWert(knoten) {
    const hoehe = radHoehe(knoten);
    const index = Math.round(knoten.scrollTop / hoehe);
    const werte = [...knoten.querySelectorAll('.tc-wert')];
    const treffer = werte[Math.max(0, Math.min(werte.length - 1, index))];
    return treffer ? Number(treffer.dataset.wert) : 0;
  }
  function markiereRad(knoten) {
    const aktiv = radWert(knoten);
    knoten.querySelectorAll('.tc-wert').forEach(w => w.classList.toggle('aktiv', Number(w.dataset.wert) === aktiv));
  }
  function radGedreht() {
    if (radStumm || !radBereit) return;
    const stunde = radWert(el('tcPosStunde'));
    const minute = radWert(el('tcPosMinute'));
    const neuerWert = new Date(vorschlag);
    neuerWert.setHours(stunde, minute, 0, 0);
    vorschlag = neuerWert;
    markiereRad(el('tcPosStunde')); markiereRad(el('tcPosMinute'));
    zeigeZeit();
  }
  function bereiteRaederVor() {
    const stundeRad = el('tcPosStunde'), minuteRad = el('tcPosMinute');
    if (!stundeRad || !minuteRad) return;
    const zweistellig = v => String(v).padStart(2, '0');
    baueRad(stundeRad, Array.from({length:24}, (_, i) => i), zweistellig);
    baueRad(minuteRad, Array.from({length: 60 / MINUTENSCHRITT}, (_, i) => i * MINUTENSCHRITT), zweistellig);
    [stundeRad, minuteRad].forEach(rad => {
      let zeitgeber = null;
      rad.addEventListener('scroll', () => {
        markiereRad(rad);
        clearTimeout(zeitgeber);
        zeitgeber = setTimeout(radGedreht, 90);
      });
      // Antippen statt scrollen
      rad.addEventListener('click', ereignis => {
        const wert = ereignis.target.closest('.tc-wert');
        if (!wert) return;
        setzeRad(rad, Number(wert.dataset.wert));
        setTimeout(radGedreht, 140);
      });
    });
  }
  function zeigeRaeder() {
    const d = new Date(vorschlag);
    const minuteGerundet = Math.round(d.getMinutes() / MINUTENSCHRITT) * MINUTENSCHRITT % 60;
    radBereit = false;
    setzeRad(el('tcPosStunde'), d.getHours());
    setzeRad(el('tcPosMinute'), minuteGerundet);
    setTimeout(() => { radBereit = true; }, 200);
  }

  function zeigeZeit() {
    // 09.09.2026 (Betreiber: "es muss eine Frage kommen - es ist 10:46, soll ich 11:00 als
    // Eincheckzeit buchen?"): der Hinweistext ist jetzt ausdrücklich als Frage formuliert, mit
    // der echten Scanzeit UND dem fairen Vorschlag nebeneinander - der große Knopf darunter ist
    // die Antwort "Ja" (antippen bucht genau diese Zeit); wer nicht einverstanden ist, verstellt
    // vorher am Drehrad.
    const knopf = el('tcPosCommit');
    const richtung = knopf?.dataset.kind === 'in' ? 'Kommen' : 'Gehen';
    const hinweis = el('tcPosZeitHinweis');
    if (hinweis) {
      const gleich = new Date(vorschlag).getTime() === new Date(erfasstAm).getTime();
      hinweis.textContent = gleich
        ? `Es ist ${uhr(erfasstAm)} Uhr.`
        : `Es ist ${uhr(erfasstAm)} Uhr. Soll ich ${uhr(vorschlag)} Uhr als ${richtung}-Zeit buchen?`;
    }
    if (knopf) {
      knopf.textContent = `${richtung.toUpperCase()} um ${uhr(vorschlag)} buchen${schichtgrund ? ` · ${schichtgrund}` : ''}`;
    }
  }

  // ---- Gruende beim Gehen ----------------------------------------------------------------
  function zeigeGruende(kind) {
    const feld = el('tcPosGruende');
    if (!feld) return;
    schichtgrund = '';
    if (kind !== 'out') { feld.hidden = true; feld.innerHTML = ''; return; }
    feld.hidden = false;
    feld.innerHTML = '<span class="tc-gruende-frage">Grund (optional)</span>'
      + GEH_GRUENDE.map(g => `<button type="button" class="tc-grund" data-grund="${g}">${g}</button>`).join('');
    feld.querySelectorAll('.tc-grund').forEach(knopf => {
      knopf.onclick = () => {
        // Nochmal antippen hebt die Auswahl wieder auf - kein Zurueck-Knopf noetig.
        const gleich = schichtgrund === knopf.dataset.grund;
        schichtgrund = gleich ? '' : knopf.dataset.grund;
        feld.querySelectorAll('.tc-grund').forEach(x => x.classList.toggle('aktiv', !gleich && x === knopf));
        zeigeZeit();
      };
    });
  }
  // Der Kern verlangt bei mehr als 5 Minuten Abweichung einen Korrekturgrund. Das ist richtig
  // und bleibt so - nur wird der Grund hier automatisch und wahrheitsgemaess gesetzt, statt das
  // Personal am Stand tippen zu lassen. Der echte Scanzeitpunkt bleibt ohnehin als recordedAt
  // erhalten, die Nachvollziehbarkeit wird also nicht schwaecher, sondern nur bequemer.
  function korrekturgrund() {
    // 09.09.2026: misst jetzt gegen den FAIREN Vorschlag (rundeGerecht), nicht mehr gegen die
    // reine Scan-Sekunde - sonst haette jede ganz normale, faire Rundung (bis zu 15 Minuten)
    // faelschlich einen Grund verlangt. Ein Grund wird nur noch verlangt, wenn am Drehrad
    // WEITER von diesem fairen Vorschlag weg verstellt wurde (z.B. Abloesung kam spaeter).
    if (!gerundeterVorschlag) return '';
    const abweichungVonFair = Math.round((new Date(vorschlag) - new Date(gerundeterVorschlag)) / 60000);
    if (Math.abs(abweichungVonFair) <= 5) return '';
    return `An der Kasse angepasst (erfasst ${uhr(erfasstAm)}, fairer Vorschlag ${uhr(gerundeterVorschlag)}).`;
  }

  // ---- Oberflaeche ----------------------------------------------------------------------
  function mount() {
    const header = document.querySelector('.header-status');
    if (!header || el('timeClockBtn')) return;
    const button = document.createElement('button');
    button.id = 'timeClockBtn'; button.type = 'button'; button.className = 'header-tool-button time-clock-button';
    button.title = 'Kommen oder Gehen erfassen'; button.setAttribute('aria-label', button.title); button.textContent = '\u25F7';
    header.insertBefore(button, el('menuBtn'));

    const dialog = document.createElement('dialog');
    dialog.id = 'timeClockDialog';
    dialog.innerHTML = `<form method="dialog" class="dialog-card tc-karte">
      <h2 class="tc-titel">Kommen &amp; Gehen</h2>

      <section id="tcPosSchritt1" class="tc-schritt">
        <p class="tc-anleitung">Mitgliedsausweis scannen.<br><span class="tc-klein">Ausweis vergessen? Geburtstag als sechsstellige Zahl eingeben (TTMMJJ).</span></p>
        <input id="tcPosCredential" class="tc-eingabe" autocomplete="off" inputmode="text" placeholder="Ausweis scannen oder TTMMJJ">
        <button type="button" id="tcPosIdentify" class="tc-knopf-gross">Weiter</button>
      </section>

      <section id="tcPosSchritt2" class="tc-schritt" hidden>
        <div class="tc-person"><span id="tcPosPseudonym" class="tc-pseudonym"></span><span id="tcPosRichtung" class="tc-richtung"></span></div>
        <div class="tc-drehfeld">
          <div class="tc-band" aria-hidden="true"></div>
          <div class="tc-rad" id="tcPosStunde" role="listbox" aria-label="Stunde" tabindex="0"></div>
          <div class="tc-doppelpunkt">:</div>
          <div class="tc-rad" id="tcPosMinute" role="listbox" aria-label="Minute" tabindex="0"></div>
        </div>
        <p id="tcPosZeitHinweis" class="tc-zeithinweis"></p>
        <div id="tcPosGruende" class="tc-gruende" hidden></div>
        <button type="button" id="tcPosCommit" class="tc-knopf-gross tc-knopf-buchen"></button>
        <button type="button" id="tcPosZurueck" class="tc-knopf-flach">Andere Person</button>
      </section>

      <p id="tcPosMessage" class="tc-pos-message">Bereit.</p>
      <p id="tcPosOffen" class="tc-offen"></p>

      <section id="tcPosTestSetup" class="tc-pos-message warn" hidden><strong>Candidate-Testzugang anlegen</strong><p>Nur f\u00fcr diesen Teststand. Mitgliedsnummer und sechsstelligen Geburtstagscode TTMMJJ eingeben.</p><label>Mitgliedsnummer<input id="tcPosTestName" value="KC-0007"></label><label>Testcode TTMMJJ<input id="tcPosTestBirth" inputmode="numeric" maxlength="6" placeholder="TTMMJJ"></label><button type="button" id="tcPosCreateTest">Testzugang speichern</button></section>

      <label class="tc-pos-autostart"><input type="checkbox" id="tcPosAutostart"> Diese Kasse öffnet dieses Fenster künftig sofort beim Start</label>
      <div class="tc-pos-actions"><button value="cancel">Abbrechen</button></div>
    </form>`;
    document.body.append(dialog);

    button.onclick = () => { zurueckZuSchritt1(); dialog.showModal(); setTimeout(() => el('tcPosCredential').focus(), 50); };
    el('tcPosCredential').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); identify(); } };
    el('tcPosIdentify').onclick = identify;
    el('tcPosZurueck').onclick = zurueckZuSchritt1;
    el('tcPosCommit').onclick = commit;
    bereiteRaederVor();

    el('tcPosTestSetup').hidden = !testAccess || people.length > 0;
    el('tcPosCreateTest').onclick = () => {
      try {
        if (!/^\d{6}$/.test(el('tcPosTestBirth').value)) throw new Error('Bitte den Geburtstag als sechsstelligen Code TTMMJJ eingeben.');
        const memberNo = el('tcPosTestName').value.trim() || 'KC-0007';
        const person = core.normalizePerson({id:'TEST-HJK', displayName:memberNo, birthCode:el('tcPosTestBirth').value, credential:memberNo});
        people = [...people.filter(x => x.id !== person.id), person];
        config = Object.assign({}, config, {enabled:true, allowBirthCode:true});
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
        applyConfig();
        el('tcPosTestSetup').hidden = true;
        message(`Testzugang f\u00fcr ${anzeigenameFuer(person)} wurde angelegt. Jetzt ${person.birthCode} eingeben.`, 'ok');
        el('tcPosCredential').value = person.birthCode; el('tcPosCredential').focus();
      } catch (error) { message(error.message, 'warn'); }
    };
    // 09.09.2026 (Betreiber: "hoechstens noch Abbrechen"): den Export-Knopf aus diesem Fenster
    // entfernt - eine Verwaltungsfunktion, die im taeglichen Kommen/Gehen nichts zu suchen hat.
    // Die Faehigkeit (core.makeEventDelta) bleibt im Kern bestehen, falls sie spaeter an
    // passenderer Stelle (z.B. Kassenfunktionen) wieder gebraucht wird.
    applyConfig();
    zeigeOffeneZeiten();
    document.getElementById('importKCExchangeFile')?.addEventListener('change', importConfig, true);
    // 10.09.2026: Haekchen zeigt/speichert die geraetelokale Einstellung.
    const autostartBox = el('tcPosAutostart');
    if (autostartBox) {
      autostartBox.checked = localStorage.getItem(AUTOSTART_KEY) === '1';
      autostartBox.onchange = () => { try { localStorage.setItem(AUTOSTART_KEY, autostartBox.checked ? '1' : '0'); } catch (e) { /* voll */ } };
    }
    // Ist die Einstellung auf DIESEM Geraet aktiv und die Stechuhr ueberhaupt eingerichtet
    // (derselbe Massstab wie applyConfig() fuer den Knopf selbst), oeffnet sich das Fenster
    // sofort - ABER erst NACHDEM "KASSE STARTEN" tatsaechlich angetippt wurde. Wichtig: NICHT
    // am hidden-Attribut des Tors selbst festmachen - das steht in der Roh-HTML von Anfang an
    // auf "hidden" und wird erst von app.js zur rechten Zeit umgeschaltet; je nachdem, welches
    // der beiden Skripte beim Laden zuerst dran ist, haette das Auslesen hier zu frueh den
    // "schon vorbei"-Fall vorgetaeuscht. Stattdessen der echte Tipp auf den Knopf selbst - das
    // ist eindeutig, unabhaengig von der Ladereihenfolge.
    if (localStorage.getItem(AUTOSTART_KEY) === '1' && el('timeClockBtn') && !el('timeClockBtn').hidden) {
      let schonGeoeffnet = false;
      const oeffnen = () => { if (schonGeoeffnet) return; schonGeoeffnet = true; setTimeout(() => el('timeClockBtn').click(), 200); };
      const knopf = document.getElementById('fullscreenGateBtn');
      if (knopf) knopf.addEventListener('click', oeffnen, { once: true });
      // Zusaetzliche Rueckfalltuer: laeuft die Kasse als installierte App/PWA, zeigt sich das
      // Tor unter Umstaenden nie (kein Klick zum Abwarten) - kurz nach dem Laden einmal
      // nachsehen, ob die Kasse (am echten Bildschirmplatz des Tors gemessen, nicht am rohen
      // hidden-Attribut) schon ohne Tor bedienbar ist. Das schonGeoeffnet-Merkfeld verhindert,
      // dass beide Wege (echter Klick UND diese Rueckfalltuer) das Fenster doppelt oeffnen.
      setTimeout(() => { const tor = document.getElementById('fullscreenGate'); if (!tor || tor.hidden) oeffnen(); }, 150);
    }
  }

  function zurueckZuSchritt1() {
    selected = null; erfasstAm = null; vorschlag = null; gerundeterVorschlag = null; schichtgrund = '';
    if (el('tcPosSchritt1')) el('tcPosSchritt1').hidden = false;
    if (el('tcPosSchritt2')) el('tcPosSchritt2').hidden = true;
    if (el('tcPosCredential')) { el('tcPosCredential').value = ''; el('tcPosCredential').focus(); }
    if (el('tcPosCommit')) el('tcPosCommit').disabled = false;
    message('Bereit.');
  }

  /* BEFUND 31.08.2026: die Uhrtaste war IMMER sichtbar. Die Bedingung liess neben der
     Freigabe aus dem PC-Manager auch das Erprobungskennzeichen candidateTestAccess gelten,
     und das steht in shared/runtime-flags.js auf true. Auf einer frisch eingerichteten
     Kasse ohne jede Zeiterfassungs-Konfiguration stand die Taste damit im Kopf und
     oeffnete ein Fenster ohne eine einzige hinterlegte Person.
     JETZT: sichtbar, wenn der PC-Manager die Funktion freigegeben hat ODER wenn wirklich
     Personen hinterlegt sind (dann wurde sie offensichtlich eingerichtet). Das
     Erprobungskennzeichen allein reicht nicht mehr. */
  function applyConfig() {
    const button = el('timeClockBtn');
    if (button) button.hidden = !config.enabled && !(Array.isArray(people) && people.length);
  }

  // Personenliste uebernehmen. Ein mitgelieferter Klarname wird hier bewusst NICHT gespeichert -
  // an der Kasse steht ausschliesslich das Pseudonym (bzw. die Mitgliedsnummer, falls fuer die
  // Nummer noch kein Bedienerprofil hinterlegt ist).
  function uebernimmPersonen(liste) {
    return (liste || []).map(core.normalizePerson).map(person => Object.assign({}, person, {displayName: anzeigenameFuer(person)}));
  }

  async function importConfig(event) {
    const file = event.target.files && event.target.files[0]; if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.schema !== 'KC_TIME_CLOCK_CONFIG_V1') return;
      config = payload.config || config;
      people = uebernimmPersonen(payload.people);
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
      applyConfig();
      global.KCNotificationCore?.notify?.({message:'Zeiterfassung und Zug\u00e4nge wurden \u00fcbernommen.', type:'success'});
    } catch {}
  }

  // Erkennt das echte Koecheclub-QR-Format der Mitgliedsausweise (aus dem Verwaltungsprogramm):
  // "KNG|<Vereinsname>|<Mitgliedsnummer>|<interne ID>", z.B. "KNG|Koecheclub Werne|KC-0001|m_kc_0001".
  // Liefert die Mitgliedsnummer zurueck, gegen die abgeglichen wird - nicht die komplette
  // Zeichenkette, damit z.B. ein kuenftig geaenderter Vereinsname nichts kaputt macht.
  function parseKngQr(raw) {
    // Die Mitgliedsnummer wird aus dem GANZEN Code gezogen, nicht aus dem dritten Feld hinter
    // einem "|". Grund: ein Handscanner ist eine Tastatur; steht sein Tastaturlayout auf einer
    // anderen Sprache als das Tablet, kommt genau dieses Zeichen falsch an - und der Ausweis
    // waere unbrauchbar, obwohl die Nummer sauber gelesen wurde.
    const treffer = String(raw || '').match(/KC-\d{3,5}/i);
    if (treffer) return treffer[0].toUpperCase();
    if (!/^KNG\b/i.test(String(raw || ''))) return null;
    const memberNo = raw.split('|')[2] && raw.split('|')[2].trim();
    return memberNo || null;
  }

  // BEFUND beim Bauen der Mitgliedsausweise: Die Stechuhr erkannte nur den KNG-Ausweis oder
  // die eingetippte Mitgliedsnummer. Der QR-Code auf dem Mitgliedsausweis - derselbe, mit dem
  // man sich an der KASSE anmeldet - wurde hier abgewiesen. Ein Ausweis, der an einem Gerät
  // funktioniert und am anderen nicht, ist am Stand nicht erklärbar.
  //
  // Es wird bewusst nur ÜBERSETZT, nicht neu zugeordnet: aus der Bedienerkennung wird die
  // Mitgliedsnummer, und ab da läuft alles wie bisher.
  function parseBedienerQr(raw) {
    // Gross-/Kleinschreibung spielt keine Rolle: manche Scanner senden alles in Grossbuchstaben,
    // und ein eingeschaltetes Caps Lock am Tablet tut dasselbe.
    const s = String(raw || '').trim();
    // Gleiche Toleranz wie an der Kasse: mehrere Trennzeichen duerfen nicht stoeren
    // (gescannt wurde beim Betreiber "KCOPE1::team").
    if (!/^KCOPE1[\s:\-_.,;]*/i.test(s)) return null;
    const id = s.replace(/^KCOPE1[\s:\-_.,;]*/i, '').trim().toLowerCase();
    const profil = bedienerprofile().find(p => String(p.id).toLowerCase() === id);
    return (profil && profil.memberNo) ? String(profil.memberNo) : null;
  }

  function identify() {
    const raw = el('tcPosCredential').value.trim();
    const kngMemberNo = parseKngQr(raw) || parseBedienerQr(raw);
    const credential = kngMemberNo || raw;
    source = kngMemberNo ? 'qr' : /^\d{6}$/.test(raw) ? 'birth' : raw.startsWith('TC-') ? 'qr' : 'id';
    if (source === 'birth' && !config.allowBirthCode) return message('Geburtstagscode ist an dieser Kasse nicht freigegeben.', 'warn');
    const result = core.identify(people, credential);
    if (!result.ok) return message(kngMemberNo ? `Ausweis erkannt (${kngMemberNo}), aber keine passende Person hinterlegt.` : result.message, 'warn');

    selected = result.person;
    const zustand = core.currentState(events, selected.id);
    erfasstAm = new Date();
    // 09.09.2026: der faire, richtungsabhängige Vorschlag (siehe rundeGerecht oben) ist wieder
    // der Ausgangswert - das Drehrad bleibt weiterhin frei bedienbar für echte Abweichungen.
    gerundeterVorschlag = rundeGerecht(erfasstAm, zustand.nextKind);
    vorschlag = gerundeterVorschlag;

    el('tcPosPseudonym').textContent = anzeigenameFuer(selected);
    el('tcPosRichtung').textContent = zustand.nextKind === 'in' ? 'kommt' : 'geht';
    el('tcPosCommit').dataset.kind = zustand.nextKind;
    el('tcPosCommit').disabled = false;
    el('tcPosSchritt1').hidden = true;
    el('tcPosSchritt2').hidden = false;
    // Ohne Freigabe fuer manuelle Zeiten bleibt das Drehfeld gesperrt.
    el('tcPosSchritt2').querySelectorAll('.tc-rad').forEach(r => r.classList.toggle('gesperrt', !config.allowManualTime));
    zeigeGruende(zustand.nextKind);
    zeigeRaeder();
    zeigeZeit();
    message(zustand.nextKind === 'in' ? '' : `Angemeldet seit ${uhr(zustand.last.effectiveAt)}.`);
  }

  // Nach dem Stempeln den gebuchten Bediener mitziehen: wer kommt, verkauft ab jetzt unter
  // seinem Pseudonym; wer geht, gibt an "Team" zurueck.
  function setzeBediener(person, kind) {
    try {
      // 09.09.2026 (Betreiber): "Kommen soll den Verkäufer nicht automatisch umschalten - am
      // Markttag läuft ohnehin fast alles über Team, eine Umschaltung bei jedem Kommen/Gehen
      // verkompliziert es in der Hektik." Die Fähigkeit bleibt eingebaut (für eine spätere
      // Entscheidung oder einen Schalter im PC-Manager), ist aber standardmäßig AUS. Ein
      // einzelner Schalter für beide Richtungen - "nur Kommen automatisch, Gehen nicht" wäre
      // ein halbes Verhalten (Gehen würfe sonst ohne ersichtlichen Grund auf Team zurück).
      // BEFUND beim Testen: "state" ist in app.js ein const auf oberster Ebene und haengt NICHT
      // an window - global.state waere hier immer undefined. Deshalb wie kc-schulung.js direkt
      // aus dem gespeicherten Kassenstand lesen (saveMaster() schreibt ihn synchron dorthin).
      let einAus = false; try { einAus = JSON.parse(global.localStorage.getItem('kc_master_v040') || '{}').stechuhrWechseltBediener === true; } catch (e) { einAus = false; }
      if (!einAus) return null;
      const ziel = kind === 'in' ? profilZuMitgliedsnummer(person && person.credential) : teamProfil();
      if (ziel && typeof global.confirmOperator === 'function') global.confirmOperator(ziel, 'qr');
      return ziel ? ziel.name : null;
    } catch (e) { return null; }
  }

  function commit() {
    try {
      if (!selected) throw new Error('Bitte zuerst den Ausweis scannen.');
      const kind = el('tcPosCommit').dataset.kind;
      const event = core.createEvent({
        personId: selected.id, personType: selected.type, kind,
        recordedAt: erfasstAm, effectiveAt: vorschlag,
        registerId: registerId(), eventId: config.eventId, source,
        correctionReason: korrekturgrund(),
        shiftReason: schichtgrund,
      }, events);
      events.push(event); save();
      zeigeOffeneZeiten();   // sofort auffrischen - auch wenn die Meldung gleich fehlschlaegt
      meldeZeiten();         // sofort melden; schlaegt es fehl, holt es der Zeittakt nach
      const pseudonym = anzeigenameFuer(selected);
      // KC Sync Live-Monitor: siehe kc-sync-live-event.js. NICHT awaited.
      // Bewusst das Pseudonym, nicht der Klarname - der ist hier ohnehin nicht vorhanden.
      if (global.KCSyncLiveEvent) global.KCSyncLiveEvent.send('staff', {registerId:event.registerId, personName:pseudonym, kind:event.kind, effectiveAt:event.effectiveAt, shiftReason:event.shiftReason || ''});
      const bediener = setzeBediener(selected, kind);
      const aktion = kind === 'in' ? 'Kommen' : 'Gehen';
      message(`${pseudonym}: ${aktion} um ${uhr(event.effectiveAt)} gespeichert.${event.shiftReason ? ` Grund: ${event.shiftReason}.` : ''}${bediener ? ` Bediener jetzt ${bediener}.` : ''}`, 'ok');
      el('tcPosCommit').disabled = true;
      setTimeout(() => { const d = el('timeClockDialog'); if (d) d.close(); }, 1400);
    } catch (error) { message(error.message, 'warn'); }
  }

  // ---- Laufende Meldung an den Manager ---------------------------------------------------
  // GRUNDSATZ: Stunden duerfen nicht verloren gehen.
  // Bisher lagen die Zeiten ausschliesslich hier auf dem Tablet und mussten von Hand als Datei
  // exportiert und im Manager eingelesen werden. Vergisst das jemand am Markttag, sind die
  // Stunden weg.
  // Jetzt werden sie laufend gemeldet - aber HIER NICHT GELOESCHT. Gemerkt wird nur, welche
  // Buchungen der Manager bestaetigt hat. Dadurch liegen die Zeiten immer an zwei Stellen.
  // Geht eine Bestaetigung verloren, wird dieselbe Buchung einfach nochmal gemeldet; der
  // Manager erkennt sie an ihrer Kennung und legt sie kein zweites Mal an.
  const GEMELDET_KEY = 'kc_time_clock_gemeldet_v1';
  // Die Sammelstelle des Managers laeuft auf einem eigenen, festen Port (47392) - NICHT auf dem
  // Port des Kassen-Companions, den buildUrl() liefert. Der Rechner ist derselbe, nur der Port
  // unterscheidet sich. Fruehere Meldungen gingen an den Companion und liefen dort ins Leere.
  function managerUrl(pfad) {
    const host = global.KCSyncConnection?.config?.host || '127.0.0.1';
    return `http://${host}:47392${pfad}`;
  }
  const URL_MELDEN = managerUrl('/zeiterfassung/melden');
  let gemeldet = new Set(read(GEMELDET_KEY, []));

  function offeneEreignisse() {
    return events.filter(e => e && e.id && !gemeldet.has(e.id));
  }

  async function meldeZeiten() {
    const offen = offeneEreignisse();
    if (!offen.length) return {gemeldet: 0, offen: 0};
    try {
      // Ueber den gemeinsamen Meldeweg (siehe kc-meldeweg.js): erst der zuverlaessige Kanal
      // ueber den Kassen-Companion - der funktioniert auch vom Tablet aus -, ersatzweise der
      // alte, nur-lokale Weg.
      const ergebnisWeg = await global.KCMeldeweg.melde('time_clock', '/zeiterfassung/melden',
        {registerId: registerId(), ereignisse: offen});
      if (!ergebnisWeg.ok) { zeigeOffeneZeiten(); return {gemeldet: 0, offen: offen.length}; }
      // Ueber den Companion bestaetigt die Outbox die Uebernahme aller mitgegebenen Buchungen;
      // der alte Weg meldet einzeln zurueck, was angekommen ist.
      const ergebnis = ergebnisWeg.weg === 'companion'
        ? {angekommen: offen.map((e) => e.id)}
        : (ergebnisWeg.antwort || {angekommen: []});
      (ergebnis.angekommen || []).forEach(id => gemeldet.add(id));
      localStorage.setItem(GEMELDET_KEY, JSON.stringify([...gemeldet]));
      zeigeOffeneZeiten();
      return {gemeldet: (ergebnis.angekommen || []).length, offen: offeneEreignisse().length};
    } catch (e) {
      // Kein Netz, Manager aus - kein Problem: beim naechsten Versuch erneut. Die Anzeige muss
      // aber auch dann stimmen, sonst steht faelschlich "alles angekommen".
      zeigeOffeneZeiten();
      return {gemeldet: 0, offen: offen.length};
    }
  }

  // Sichtbar machen, wie viele Buchungen noch nicht beim Manager sind - damit niemand am
  // Markttag im Glauben nach Hause geht, alles sei uebertragen.
  function zeigeOffeneZeiten() {
    const anzeige = el('tcPosOffen');
    if (!anzeige) return;
    const offen = offeneEreignisse().length;
    anzeige.textContent = offen === 0
      ? `Alle ${events.length} Zeitbuchungen sind beim Manager angekommen.`
      : `${offen} von ${events.length} Zeitbuchungen noch nicht übertragen – sie bleiben gespeichert und werden automatisch nachgemeldet.`;
    anzeige.className = `tc-offen ${offen === 0 ? 'ok' : 'warn'}`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  // Alle 30 Sekunden nachmelden, was noch offen ist.
  setInterval(meldeZeiten, 30000);
  setTimeout(meldeZeiten, 6000);
  global.KCTimeClockPOS = {
    version: VERSION, applyConfig,
    // Fuer Pruefungen und spaetere Bausteine erreichbar gemacht:
    anzeigenameFuer, rundeGerecht, uebernimmPersonen, profilZuMitgliedsnummer, teamProfil,
    meldeZeiten, offeneEreignisse: () => offeneEreignisse().map(e => e.id),
    gehGruende: () => GEH_GRUENDE.slice(), gewaehlterGrund: () => schichtgrund,
    personen: () => people.map(p => Object.assign({}, p)), ereignisse: () => events.map(e => Object.assign({}, e)),
  };
})(window);
