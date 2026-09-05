(function (global) {
  'use strict';
  const VERSION = '0.3.0', CONFIG_KEY = 'kcm_time_clock_config_v1', PEOPLE_KEY = 'kcm_time_clock_people_v1', EVENTS_KEY = 'kcm_time_clock_events_v1';
  // Teil B der Dienstzeiten: die Kassen melden ihre Buchungen laufend an den Manager-Dienst
  // (Loopback 47392, /zeiterfassung/melden). Bisher landeten sie dort in der Datenbank und
  // BLIEBEN LIEGEN - diese Seite kannte nur den Weg ueber eine von Hand ausgetauschte Datei.
  // Ab jetzt holt sie sich den Stand selbst ab. Der Dateiweg bleibt daneben bestehen, als
  // Rueckfallebene fuer den Fall, dass der Dienst nicht laeuft.
  const DIENST_PORT = 47392;
  let letzterAbruf = null, abrufLaeuft = false, abrufTakt = null;
  const core = global.KCTimeClockCore;
  if (!core) return;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  let config = { enabled: false, eventId: 'WM-2026', allowBirthCode: true, allowManualTime: true };
  Object.assign(config, read(CONFIG_KEY, {}));
  let people = read(PEOPLE_KEY, []), events = read(EVENTS_KEY, []);

  // --- Teilnahme je Veranstaltung ---------------------------------------------------------
  // Anlass: ein Mitglied ist weggezogen und steht fuer den Weihnachtsmarkt nicht zur Verfuegung.
  // Es bleibt aber VEREINSMITGLIED - "inaktiv" waere daher falsch und wuerde auch die
  // Vereinsverwaltung verfaelschen. Die Teilnahme haengt an der VERANSTALTUNG, nicht an der
  // Mitgliedschaft: derselbe Mensch kann beim Sommerfest dabei sein und beim Weihnachtsmarkt
  // nicht. Deshalb wird der Status je Veranstaltung gefuehrt.
  const TEILNAHME_KEY = 'kcm_event_participation_v1';
  // Mitgliedsart der Verwaltung -> Personenart der Zeiterfassung ('member' | 'helper').
  // Gleiche Tabelle wie in der Verwaltung (js/70_personenstatus_uebersetzung.js) und in
  // convert-kng-members.js. Wer kein Vereinsmitglied ist, ist hier Helfer.
  const ART_JE_MITGLIEDSART = {
    aktiv: 'member', active: 'member', regular: 'member',
    passiv: 'member', inactive: 'member',
    ehrenmitglied: 'member', honorary: 'member',
    gast: 'helper', guest: 'helper',
    aushilfe: 'helper', employee: 'helper',
    member: 'member', helper: 'helper',
  };

  function personenart(eintrag) {
    const roh = String(eintrag?.type || eintrag?.memberType || eintrag?.mitgliedsart || eintrag?.role || '')
      .trim().toLowerCase();
    if (!roh) return 'member';
    return ART_JE_MITGLIEDSART[roh] || 'helper';
  }

  const TEILNAHME = [
    {wert: 'ja',        text: 'Nimmt teil'},
    {wert: 'offen',     text: 'Teilnahme noch ungeklärt'},
    {wert: 'nein',      text: 'Für diese Veranstaltung nicht verfügbar'},
    {wert: 'ausgenommen', text: 'Von der Planung ausgenommen'},
  ];
  let teilnahme = read(TEILNAHME_KEY, {});
  const speichereTeilnahme = () => { try { localStorage.setItem(TEILNAHME_KEY, JSON.stringify(teilnahme)); } catch (e) {} };
  const veranstaltung = () => String(config.eventId || 'ohne-veranstaltung');
  const teilnahmeVon = (person) => teilnahme[veranstaltung()]?.[schluessel(person)]?.status || 'ja';
  const bemerkungVon = (person) => teilnahme[veranstaltung()]?.[schluessel(person)]?.note || '';
  function setzeTeilnahme(person, status, note) {
    const v = veranstaltung(), k = schluessel(person);
    teilnahme[v] = teilnahme[v] || {};
    teilnahme[v][k] = {status, note: note ?? bemerkungVon(person), updatedAt: new Date().toISOString()};
    speichereTeilnahme();
  }
  // Zuordnung Mitgliedsnummer -> Pseudonym. Bewusst als eigener Speicher neben den Personen und
  // NICHT im gemeinsamen Zeiterfassungs-Kern: der Kern wird von Kasse und Manager zugleich
  // benutzt und bleibt deshalb unangetastet.
  // Der Klarname bleibt ausschliesslich hier im Manager. Ins Kassenpaket wandert nur das
  // Pseudonym (siehe kassenPaket weiter unten) - an der Kasse soll kein Klarname auftauchen.
  const PSEUDO_KEY = 'kcm_pseudonyms_v1';
  let pseudonyme = read(PSEUDO_KEY, {});
  const speicherePseudonyme = () => localStorage.setItem(PSEUDO_KEY, JSON.stringify(pseudonyme));
  const schluessel = person => String(person?.credential || person?.id || '').trim();
  const pseudonymVon = person => String(pseudonyme[schluessel(person)] || '').trim();
  // Was die Kasse zu sehen bekommt: Pseudonym, ersatzweise die Mitgliedsnummer - nie der Klarname.
  const kassenName = person => pseudonymVon(person) || schluessel(person) || person?.id || 'Unbekannt';
  function kassenPaket() {
    // Wer fuer diese Veranstaltung von der Planung ausgenommen ist, gehoert nicht auf die
    // Kasse: er kann sich dort nicht anmelden und taucht in keiner Auswahl auf. Die
    // Mitgliedschaft bleibt davon unberuehrt - es gilt nur fuer diese Veranstaltung.
    const dabei = people.filter((x) => teilnahmeVon(x) !== 'ausgenommen');
    const paket = core.makeConfigPackage(config, dabei);
    paket.people = (paket.people || []).map((person, index) => ({...person, displayName: kassenName(dabei[index] || person)}));
    return paket;
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const save = () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  };
  const tell = (message, tone = 'ok') => {
    const node = document.getElementById('tcManagerStatus');
    if (node) { node.textContent = message; node.className = `tc-status ${tone}`; }
    global.KCNotificationCore?.notify?.({ message, type: tone === 'ok' ? 'success' : 'warning' });
  };
  // Wandelt die einzelnen Kommen/Gehen-Ereignisse in Zeilen um, wie der eigenstaendige
  // Dienstplan sie einliest: eine Zeile je abgeschlossenem Aufenthalt, mit Datum, Kommen und
  // Gehen als ORTSZEIT. Der bisherige Export lieferte nur Summen (Stunden je Person) - damit
  // kann der Dienstplan nichts anfangen, er braucht die Einzelzeiten fuer den Soll-Ist-Abgleich.
  //
  // OFFENE BUCHUNGEN (Kommen ohne Gehen) werden BEWUSST weggelassen: der Dienstplan verwirft
  // solche Zeilen ohnehin ("Gehen fehlt/ungueltig"). Sie werden gezaehlt und gemeldet, damit
  // niemand glaubt, eine Buchung sei verschwunden.
  const zweistellig = (n) => String(n).padStart(2, '0');
  const alsDatum = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${zweistellig(d.getMonth() + 1)}-${zweistellig(d.getDate())}`; };
  const alsUhrzeit = (iso) => { const d = new Date(iso); return `${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`; };

  // Zeilen für den Dienstplan-Export.
  //
  // BEFUND (User): "ein Mitglied kann morgens vergessen sich einzubuchen und bucht nur den
  // Feierabend, ein anderes bucht sich morgens ein und bucht nicht den Feierabend. Das sind ja
  // dann die Problemfälle, die beim Einlesen in den Istplan aufgedeckt werden sollen."
  // Genau richtig - und genau die wurden vorher HERAUSGEFILTERT: unvollständige Paare kamen
  // nicht in den Export, ein "Gehen" ohne vorheriges "Kommen" verschwand sogar spurlos (es
  // wurde nicht einmal mitgezählt). Der Planer bekam nur die schöne Hälfte zu sehen.
  //
  // KC DP3 ist für den anderen Fall gebaut: sein Importer (src/adapters/timeclock-import.js)
  // prüft jede Zeile einzeln und hängt ihr Mängel an ("Kommen fehlt/ungültig", "Gehen
  // fehlt/ungültig") - er bricht NICHT ab. Deshalb gehen jetzt ALLE Buchungen mit, die halben
  // mit leerem Feld. Der Planer sieht sie dort als Nacharbeit.
  //
  // Die MITGLIEDSNUMMER wandert ebenfalls mit: DP3 ordnet bevorzugt darüber zu und rät dann
  // nicht mehr über den Namen. Sie fehlte im Export bisher komplett.
  function dienstplanZeilen(alleEreignisse = [], alleLeute = []) {
    const namen = new Map((alleLeute || []).map((person) => [person.id, person.displayName || person.id]));
    const nummern = new Map((alleLeute || []).map((person) => [person.id, String(person.credential || '').trim()]));
    const jePerson = new Map();
    for (const ereignis of [...alleEreignisse].filter((e) => !e.voidedAt).sort((a, b) => new Date(a.effectiveAt) - new Date(b.effectiveAt))) {
      if (!jePerson.has(ereignis.personId)) jePerson.set(ereignis.personId, []);
      jePerson.get(ereignis.personId).push(ereignis);
    }
    const zeilen = [], luecken = [];
    const bauen = (personId, status, kommen, gehen) => {
      const bezug = kommen || gehen;
      const zeile = {
        memberNo: nummern.get(personId) || '',
        personId,
        name: namen.get(personId) || personId,
        date: alsDatum(bezug.effectiveAt),
        start: kommen ? alsUhrzeit(kommen.effectiveAt) : '',
        end: gehen ? alsUhrzeit(gehen.effectiveAt) : '',
        breakMinutes: 0,
        status,
      };
      zeilen.push(zeile);
      if (status !== 'vollstaendig') luecken.push({...zeile});
      return zeile;
    };
    for (const [personId, liste] of jePerson) {
      let gekommen = null;
      for (const ereignis of liste) {
        if (ereignis.kind === 'in') {
          // Zweites "Kommen" ohne Gehen dazwischen: das erste bleibt als Lücke stehen.
          if (gekommen) bauen(personId, 'nur_kommen', gekommen, null);
          gekommen = ereignis;
          continue;
        }
        if (ereignis.kind === 'out') {
          if (gekommen) { bauen(personId, 'vollstaendig', gekommen, ereignis); gekommen = null; }
          else bauen(personId, 'nur_gehen', null, ereignis);   // früher: still verworfen
        }
      }
      if (gekommen) bauen(personId, 'nur_kommen', gekommen, null);
    }
    const fertig = zeilen.filter((z) => z.status === 'vollstaendig');
    return { zeilen, fertig, luecken, offen: luecken.length };
  }

  const download = (name, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const link = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:name});
    link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  function mount() {
    const operation = document.getElementById('nav-operation');
    if (operation && !document.querySelector('[data-view="timeclock"]')) {
      const button = document.createElement('button');
      button.className = 'nav'; button.type = 'button'; button.dataset.view = 'timeclock'; button.textContent = 'Zeiterfassung';
      operation.append(button);
      button.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.dataset.viewPanel === 'timeclock'));
        document.querySelectorAll('.nav').forEach(nav => nav.classList.toggle('active', nav === button));
        render();
      });
    }
    const main = document.querySelector('main.content');
    if (!main || document.querySelector('[data-view-panel="timeclock"]')) return;
    const section = document.createElement('section');
    section.className = 'view'; section.dataset.viewPanel = 'timeclock';
    section.innerHTML = `
      <div class="page-head"><div><h1>Zeiterfassung</h1><p>Schnelles Kommen/Gehen an der Kasse und Ist-Zeiten für den Dienstplan.</p></div></div>
      <div class="tc-grid">
        <article class="panel"><h3>Freigabe für Kassen</h3>
          <label class="check">Stechuhr an den Kassen anzeigen <input id="tcEnabled" type="checkbox"></label>
          <label>Veranstaltungs-ID<input id="tcEventId" maxlength="64"></label>
          <label class="check">Geburtstagscode TTMMJJ zulassen <input id="tcBirthEnabled" type="checkbox"></label>
          <label class="check">Uhrzeitkorrektur zulassen <input id="tcManualEnabled" type="checkbox"></label>
          <div class="tc-actions"><button id="tcSaveConfig" class="primary">Einstellungen speichern</button><button id="tcExportConfig">Kassenpaket erstellen</button><button type="button" id="tcImportMembersBtn" title="Mitgliederliste aus dem Vereins-Verwaltungsprogramm einlesen">Mitglieder einlesen</button><input type="file" id="tcImportMembers" accept=".json" hidden></div>
        </article>
        <article class="panel"><h3>Mitglied / Aushilfe anlegen</h3>
          <div class="form-grid">
            <label>Name (bleibt im Manager)<input id="tcName" maxlength="100"></label><label>Pseudonym f\u00fcr die Kasse<input id="tcPseudonym" maxlength="60" placeholder="z.\u00a0B. Einhorn"></label><label>Art<select id="tcType"><option value="member">Mitglied</option><option value="helper">Aushilfe</option></select></label>
            <label>Geburtstagscode TTMMJJ<input id="tcBirth" inputmode="numeric" maxlength="6"></label><label>Stundensatz (optional)<input id="tcRate" type="number" min="0" step=".01"></label>
            <label>Gültig von<input id="tcFrom" type="datetime-local"></label><label>Gültig bis<input id="tcUntil" type="datetime-local"></label>
          </div><button id="tcAddPerson" class="primary">Person und Zugang anlegen</button>
        </article>
        <article class="panel tc-wide"><h3>Zugänge</h3><div class="table-card"><table class="tc-table"><thead><tr><th>Name (nur hier)</th><th>Pseudonym an der Kasse</th><th>Art</th><th>Gültigkeit</th><th>QR-/ID-Code</th><th></th></tr></thead><tbody id="tcPeopleBody"></tbody></table></div></article>
        <article class="panel"><h3>Von den Kassen gemeldet</h3>
          <p>Die Kassen melden Kommen und Gehen automatisch hierher. Diese Seite holt den Stand
             beim Öffnen und danach alle 30 Sekunden ab – es muss nichts mehr von Hand übertragen werden.</p>
          <div class="tc-actions"><button type="button" id="tcAbrufJetzt" class="primary">Jetzt abrufen</button></div>
          <p id="tcAbrufStand" class="tc-status">Noch nicht abgerufen.</p>
        </article>
        <article class="panel"><h3>Kassendaten einlesen (Rückfallweg)</h3><p>Nur nötig, wenn der Manager-Dienst nicht lief. Doppelte Ereignisse werden anhand ihrer ID ignoriert.</p>
          <input id="tcDeltaFile" type="file" accept=".json,.kctime"><button id="tcImportDelta">Ist-Zeiten übernehmen</button>
        </article>
        <article class="panel"><h3>Dienstplan-Schnittstelle</h3><p>Exportiert ALLE Buchungen – auch unvollständige. Wer das Einbuchen oder den Feierabend vergessen hat,
           erscheint im Dienstplan als Nacharbeit, statt still zu verschwinden.</p>
          <button id="tcExportRoster">Ist-Zeiten für Dienstplan exportieren</button>
        </article>
        <!-- Die Lücken gehören abends auf den Schirm, wo man sie noch klären kann - nicht erst
             Tage später im Istplan. -->
        <article class="panel tc-wide"><h3>Unvollständige Buchungen</h3>
          <p>Fehlt das Kommen oder das Gehen, kann die Zeit nicht berechnet werden. Diese Zeilen gehen
             trotzdem in den Export und müssen im Dienstplan ergänzt werden.</p>
          <div id="tcLuecken"></div>
        </article>
        <article class="panel tc-wide"><h3>Aktueller Stand</h3><div id="tcKpi" class="tc-kpi"></div><div class="table-card"><table class="tc-table"><thead><tr><th>Person</th><th>Status</th><th>Stunden</th><th>Vergütungsart</th></tr></thead><tbody id="tcSummaryBody"></tbody></table></div></article>
        <article class="panel tc-wide"><h3>Letzte Buchungen</h3>
          <p>Neueste zuerst. Der Grund steht dabei – beim Gehen kann an der Kasse angegeben werden,
             warum die Schicht anders lief als geplant; genau das gehört später in den Istplan.</p>
          <div class="table-card"><table class="tc-table"><thead><tr><th>Zeit</th><th>Person</th><th>Kommen/Gehen</th><th>Grund</th><th>Kasse</th><th>Erfasst über</th></tr></thead><tbody id="tcEventsBody"></tbody></table></div>
        </article>
      </div><p id="tcManagerStatus" class="tc-status">Bereit.</p>`;
    main.append(section);
    bind();
    render();
  }
  function bind() {
    document.getElementById('tcSaveConfig').onclick = () => {
      config = {...config, enabled:tcEnabled.checked, eventId:tcEventId.value.trim() || 'WM-2026', allowBirthCode:tcBirthEnabled.checked, allowManualTime:tcManualEnabled.checked};
      save(); tell('Zeiterfassungs-Einstellungen wurden erfolgreich gespeichert.');
    };
    // Mitgliederliste einlesen.
    //
    // Zweck: die Leute muessen nicht einzeln ueber das Formular angelegt werden. Die Datei
    // stammt aus dem Vereins-Verwaltungsprogramm und bringt Mitgliedsnummer, Name,
    // Geburtstagscode und - falls vorhanden - das Pseudonym mit.
    //
    // ZUSAMMENFUEHREN STATT ERSETZEN: vorhandene Personen werden anhand der Mitgliedsnummer
    // wiedererkannt und aktualisiert. Wer schon da ist, wird nicht doppelt angelegt, und ein
    // im Manager von Hand vergebenes Pseudonym bleibt erhalten, wenn die Datei keines mitbringt.
    // Niemand wird durch das Einlesen geloescht - Loeschen bleibt eine bewusste Handlung.
    document.getElementById('tcImportMembersBtn')?.addEventListener('click',
      () => document.getElementById('tcImportMembers')?.click());
    document.getElementById('tcImportMembers')?.addEventListener('change', async (event) => {
      const datei = event.target.files?.[0];
      if (!datei) return;
      try {
        const inhalt = JSON.parse(await datei.text());
        const liste = Array.isArray(inhalt) ? inhalt
          : Array.isArray(inhalt.people) ? inhalt.people
          : Array.isArray(inhalt.mitglieder) ? inhalt.mitglieder : null;
        if (!liste) throw new Error('In der Datei ist keine Personenliste zu finden.');
        const mitgebrachtePseudonyme = inhalt.pseudonyme || {};
        let neuAngelegt = 0, aktualisiert = 0, uebersprungen = 0;
        const ueberschrieben = [];
        liste.forEach((eintrag) => {
          const nummer = String(eintrag.credential || eintrag.memberNo || eintrag.mitgliedsnummer || '').trim();
          const name = String(eintrag.displayName || eintrag.name || '').trim();
          if (!name) { uebersprungen++; return; }
          const person = core.normalizePerson({
            id: eintrag.id || `m_${nummer || name}`.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            // Personenart: 'helper' kommt entweder direkt oder als Mitgliedsart aus der
            // Verwaltung ("Gast", "Aushilfe"). Vorher wurde jeder andere Wert stumm zu
            // 'member' - damit stand ein Gast anschliessend als Vollmitglied in der
            // Zeiterfassung. Ein unbekannter Wert gilt jetzt als Helfer, nicht als Mitglied.
            type: personenart(eintrag),
            displayName: name,
            credential: nummer,
            birthCode: String(eintrag.birthCode || eintrag.geburtstagscode || '').replace(/\D/g, '').slice(0, 6),
            active: eintrag.active !== false,
          });
          // Wiedererkennen in drei Stufen. Die dritte ist neu und behebt einen echten Fehler:
          // eine von Hand angelegte Person hat keine Mitgliedsnummer. Beim Einlesen wurde sie
          // deshalb nicht gefunden und ein ZWEITER Eintrag angelegt - so entstand ein Mitglied
          // doppelt, einmal nur mit Vornamen und einmal vollstaendig. Deshalb wird zusaetzlich
          // ueber den Namen abgeglichen, wenn keine Nummer hinterlegt ist.
          const namensgleich = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
          // ACHTUNG: schluessel() liefert ersatzweise die interne Kennung, die es IMMER gibt.
          // Fuer "hat noch keine Mitgliedsnummer" muss deshalb das Feld selbst geprueft werden,
          // sonst greift der Namensabgleich nie - genau daran ist der erste Versuch gescheitert.
          const ohneNummer = (x) => !String(x.credential || '').trim();
          const vorhanden = people.find((x) => (nummer && schluessel(x) === nummer))
            || people.find((x) => x.id === person.id)
            || people.find((x) => ohneNummer(x) && namensgleich(x.displayName, name))
            // Auch der Fall "nur Vorname von Hand angelegt": passt der Vorname und ist keine
            // Nummer hinterlegt, wird der Eintrag vervollstaendigt statt verdoppelt.
            || people.find((x) => ohneNummer(x) && namensgleich(x.displayName, name.split(' ')[0]));
          if (vorhanden) { Object.assign(vorhanden, person, {id: vorhanden.id}); aktualisiert++; }
          else { people.push(person); neuAngelegt++; }
          // Bringt die Datei ein Pseudonym mit, GILT ES - die Datei ist die gepflegte Quelle.
          // Ein hier von Hand geaendertes Pseudonym wird dadurch ersetzt. Das passiert aber
          // nicht stillschweigend: unten wird gemeldet, wie viele geaendert wurden, damit eine
          // versehentlich verlorene Handkorrektur auffaellt.
          const ps = String(eintrag.pseudonym || mitgebrachtePseudonyme[nummer] || '').trim();
          if (ps && nummer) {
            if (pseudonyme[nummer] && pseudonyme[nummer] !== ps) ueberschrieben.push(`${pseudonyme[nummer]} → ${ps}`);
            pseudonyme[nummer] = ps;
          }
        });
        speicherePseudonyme(); save(); render();
        const ohnePseudonym = people.filter((x) => !pseudonymVon(x)).length;
        const ohneNummer = people.filter((x) => !schluessel(x)).length;
        tell(`${neuAngelegt} neu angelegt, ${aktualisiert} aktualisiert`
          + (uebersprungen ? `, ${uebersprungen} ohne Namen übersprungen` : '')
          + `. ${ohnePseudonym ? `Noch ${ohnePseudonym} ohne Pseudonym. ` : ''}`
          + `${ohneNummer ? `${ohneNummer} ohne Mitgliedsnummer – dort funktioniert der Ausweisscan nicht. ` : ''}`
          + `${ueberschrieben.length ? `${ueberschrieben.length} Pseudonym(e) durch die Datei ersetzt: ${ueberschrieben.slice(0, 5).join(', ')}` : ''}`,
          (ohnePseudonym || ohneNummer || ueberschrieben.length) ? 'warn' : '');
      } catch (fehler) {
        tell(`Die Datei konnte nicht gelesen werden: ${fehler.message}`, 'warn');
      } finally {
        event.target.value = '';   // damit dieselbe Datei erneut gewaehlt werden kann
      }
    });

    document.getElementById('tcExportConfig').onclick = () => {
      download(`Zeiterfassung_${config.eventId}_Kassenpaket.json`, kassenPaket());
      const ohne = people.filter(person => !pseudonymVon(person)).length;
      tell(ohne
        ? `Kassenpaket erstellt - ohne Klarnamen. Achtung: für ${ohne} Person(en) ist noch kein Pseudonym hinterlegt, dort steht an der Kasse die Mitgliedsnummer.`
        : 'Kassenpaket erstellt - es enthält nur Pseudonyme, keine Klarnamen.',
        ohne ? 'warn' : '');
    };
    document.getElementById('tcAddPerson').onclick = () => {
      try {
        if (!tcName.value.trim()) throw new Error('Bitte einen Namen eingeben.');
        const helper = tcType.value === 'helper';
        if (helper && (!tcFrom.value || !tcUntil.value)) throw new Error('Aushilfen benötigen Beginn und Ende der Gültigkeit.');
        const person = core.normalizePerson({displayName:tcName.value, type:tcType.value, birthCode:tcBirth.value, hourlyPaid:helper || Number(tcRate.value)>0, hourlyRate:tcRate.value || null, validFrom:tcFrom.value || null, validUntil:tcUntil.value || null});
        people.push(person);
        const gewaehlt = document.getElementById('tcPseudonym').value.trim();
        if (gewaehlt) { pseudonyme[schluessel(person)] = gewaehlt; speicherePseudonyme(); }
        save(); render();
        document.getElementById('tcPseudonym').value = '';
        tell(`${helper ? 'Aushilfe' : 'Mitglied'} „${person.displayName}“ wurde angelegt${gewaehlt ? ` und erscheint an der Kasse als „${gewaehlt}“` : ' - bitte noch ein Pseudonym für die Kasse eintragen'}.`);
      } catch (error) { tell(error.message, 'warn'); }
    };
    // Pseudonym direkt in der Zeile aendern - kein zweites Formular, keine Speichern-Taste.
    document.getElementById('tcPeopleBody').addEventListener('change', event => {
      // Teilnahme je Veranstaltung: gilt NUR fuer die aktuelle Veranstaltung und laesst die
      // Mitgliedschaft unberuehrt. "Von der Planung ausgenommen" ist die staerkste Stufe -
      // die Person wird nicht eingeplant und geht auch nicht ins Kassenpaket.
      const auswahl = event.target.closest('[data-teilnahme-fuer]');
      if (auswahl) {
        const person = people.find((x) => x.id === auswahl.dataset.teilnahmeFuer);
        if (person) {
          setzeTeilnahme(person, auswahl.value);
          const text = TEILNAHME.find((t) => t.wert === auswahl.value)?.text || auswahl.value;
          tell(`„${person.displayName}“ für ${veranstaltung()}: ${text}. Die Vereinsmitgliedschaft bleibt unverändert.`);
          render();
        }
        return;
      }
      const notiz = event.target.closest('[data-teilnahme-notiz]');
      if (notiz) {
        const person = people.find((x) => x.id === notiz.dataset.teilnahmeNotiz);
        if (person) setzeTeilnahme(person, teilnahmeVon(person), notiz.value.trim());
        return;
      }
      const feld = event.target.closest('[data-pseudo-fuer]');
      if (!feld) return;
      const key = feld.dataset.pseudoFuer, wert = feld.value.trim();
      if (wert) pseudonyme[key] = wert; else delete pseudonyme[key];
      speicherePseudonyme();
      tell(wert ? `An der Kasse erscheint ${key} jetzt als „${wert}“.` : `Für ${key} ist kein Pseudonym mehr hinterlegt - an der Kasse steht dann die Mitgliedsnummer.`, wert ? '' : 'warn');
    });
    document.getElementById('tcPeopleBody').onclick = event => {
      // SPERREN ist der Regelfall: die Person bleibt mit ihren Zeiten erhalten, kann sich aber
      // nicht mehr anmelden. Wer aufhoert, wird gesperrt - nicht geloescht, sonst fehlen
      // rueckwirkend die Stunden.
      const sperren = event.target.closest('[data-remove]');
      if (sperren) {
        const person = people.find(item => item.id === sperren.dataset.remove);
        if (!person || !confirm(`Zugang von „${person.displayName}“ sperren? Die erfassten Zeiten bleiben erhalten.`)) return;
        person.active = false; person.updatedAt = new Date().toISOString(); save(); render();
        tell(`Zugang von „${person.displayName}“ wurde gesperrt.`);
        return;
      }
      // WIEDER FREISCHALTEN - das fehlte bisher ganz: eine einmal gesperrte Person blieb
      // dauerhaft gesperrt, auch wenn sie nur versehentlich erwischt wurde.
      const frei = event.target.closest('[data-reactivate]');
      if (frei) {
        const person = people.find(item => item.id === frei.dataset.reactivate);
        if (!person) return;
        person.active = true; person.updatedAt = new Date().toISOString(); save(); render();
        tell(`Zugang von „${person.displayName}“ ist wieder freigeschaltet.`);
        return;
      }
      // ENDGUELTIG LOESCHEN - nur fuer Fehleintraege, etwa eine beim Einlesen entstandene
      // Dublette. Bewusst mit deutlicher Rueckfrage und nur, wenn keine Zeiten daran haengen:
      // sonst wuerden Stunden verschwinden, die jemand tatsaechlich gearbeitet hat.
      const loeschen = event.target.closest('[data-delete]');
      if (loeschen) {
        const person = people.find(item => item.id === loeschen.dataset.delete);
        if (!person) return;
        const eigeneZeiten = events.filter(e => e.personId === person.id && !e.voidedAt).length;
        if (eigeneZeiten) {
          tell(`„${person.displayName}“ hat ${eigeneZeiten} erfasste Zeitbuchung(en) und kann nicht gelöscht werden. `
             + 'Bitte stattdessen sperren – dann bleiben die Stunden erhalten.', 'warn');
          return;
        }
        if (!confirm(`„${person.displayName}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
        people = people.filter(item => item.id !== person.id);
        const key = schluessel(person);
        if (key && pseudonyme[key]) { delete pseudonyme[key]; speicherePseudonyme(); }
        save(); render();
        tell(`„${person.displayName}“ wurde gelöscht.`);
      }
    };
    document.getElementById('tcImportDelta').onclick = async () => {
      try {
        const file = tcDeltaFile.files[0]; if (!file) throw new Error('Bitte eine Kassendatei auswählen.');
        const payload = JSON.parse(await file.text());
        if (payload.schema !== 'KC_TIME_CLOCK_EVENT_DELTA_V1' || !Array.isArray(payload.events)) throw new Error('Die Datei ist kein Zeiterfassungs-Delta.');
        const merged = core.mergeEvents(events, payload.events); events = merged.events; save(); render();
        tell(`${merged.added} neue Zeitereignisse wurden übernommen; Dubletten wurden ignoriert.`);
      } catch (error) { tell(error.message, 'warn'); }
    };
    document.getElementById('tcAbrufJetzt').onclick = async () => {
      zeigeAbrufStand('Wird abgerufen …', '');
      const neue = await holeGemeldeteZeiten(true);
      if (neue !== null) tell(neue ? `${neue} neue Zeitbuchung(en) von den Kassen übernommen.` : 'Es lagen keine neuen Zeitbuchungen vor.');
    };
    holeGemeldeteZeiten(false);
    starteAbrufTakt();
    document.getElementById('tcExportRoster').onclick = () => {
      const zeilen = dienstplanZeilen(events, people);
      // BEIDE Formate in EINER Datei: "actuals" bleibt unveraendert fuer alles, was den Export
      // bisher schon nutzt. "rows" ist neu und genau das, was der eigenstaendige Dienstplan
      // (KC DP2, timeclock-import.js) einliest - der sucht die Datensaetze unter "rows" oder
      // als reine Liste, mit "actuals" allein hat er nichts anfangen koennen.
      download(`Dienstplan_Istzeiten_${config.eventId}.json`, {
        schema:'KC_DUTY_ROSTER_ACTUALS_V1', version:'0.3.0', eventId:config.eventId,
        createdAt:new Date().toISOString(),
        actuals:core.summarize(events, people),
        // ALLE Buchungen, auch die halben - DP3 weist sie dem Planer als Nacharbeit aus.
        rows: zeilen.zeilen,
      });
      const nurKommen = zeilen.luecken.filter((z) => z.status === 'nur_kommen').length;
      const nurGehen = zeilen.luecken.filter((z) => z.status === 'nur_gehen').length;
      tell(zeilen.offen
        ? `Dienstplan-Istzeiten exportiert: ${zeilen.zeilen.length} Buchung(en) – davon ${zeilen.fertig.length} vollständig, ${nurKommen} ohne Gehen, ${nurGehen} ohne Kommen. Die unvollständigen sind MIT exportiert und müssen im Istplan nachgearbeitet werden.`
        : `Dienstplan-Istzeiten exportiert: ${zeilen.fertig.length} vollständige Buchung(en), keine Lücken.`,
        zeilen.offen ? 'warn' : undefined);
      zeigeLuecken();
    };
  }
  // Lueckenliste im Manager: dieselben Zeilen, die im Export als Nacharbeit landen.
  function zeigeLuecken() {
    const ziel = document.getElementById('tcLuecken');
    if (!ziel) return;
    const {luecken} = dienstplanZeilen(events, people);
    if (!luecken.length) {
      ziel.innerHTML = '<p class="tc-ok">Keine Lücken – alle Buchungen haben Kommen und Gehen.</p>';
      return;
    }
    const text = {nur_kommen: 'Gehen fehlt', nur_gehen: 'Kommen fehlt'};
    ziel.innerHTML = `<div class="table-card"><table class="tc-table"><thead><tr>
      <th>Person</th><th>Mitgliedsnummer</th><th>Datum</th><th>Kommen</th><th>Gehen</th><th>Fehlt</th></tr></thead><tbody>`
      + luecken.map((z) => `<tr class="tc-luecke"><td>${esc(z.name)}</td><td>${esc(z.memberNo || '—')}</td>`
        + `<td>${esc(z.date)}</td><td>${esc(z.start || '—')}</td><td>${esc(z.end || '—')}</td>`
        + `<td><strong>${esc(text[z.status] || z.status)}</strong></td></tr>`).join('')
      + '</tbody></table></div>';
  }

  // Zeiten vom Manager-Dienst abholen und mit dem lokalen Bestand zusammenfuehren.
  //
  // ZUSAMMENFUEHREN, NICHT ERSETZEN: der Kern erkennt jede Buchung an ihrer Kennung wieder,
  // Dubletten fallen weg. Deshalb ist es ungefaehrlich, denselben Stand mehrfach abzuholen -
  // und deshalb darf die Kasse ihre Buchungen auch beliebig oft melden.
  async function holeGemeldeteZeiten(vomBenutzer) {
    if (abrufLaeuft) return;
    abrufLaeuft = true;
    try {
      const antwort = await fetch(`http://127.0.0.1:${DIENST_PORT}/zeiterfassung/liste`,
        {signal: AbortSignal.timeout(4000), cache: 'no-store'});
      if (!antwort.ok) throw new Error(`Dienst antwortet mit ${antwort.status}`);
      const gemeldet = (await antwort.json()).zeiten || [];
      const zusammen = core.mergeEvents(events, gemeldet);
      events = zusammen.events;
      letzterAbruf = new Date();
      if (zusammen.added || vomBenutzer) { save(); render(); }
      zeigeAbrufStand(`${gemeldet.length} Buchung(en) beim Manager, davon ${zusammen.added} neu übernommen.`, zusammen.added ? 'gut' : '');
      return zusammen.added;
    } catch (fehler) {
      zeigeAbrufStand('Der Manager-Dienst ist nicht erreichbar. Läuft das Markttag-Fenster, '
        + 'und ist diese Seite über 127.0.0.1 geöffnet? Die Kassen behalten ihre Zeiten so lange '
        + 'bei sich und melden sie automatisch nach.', 'warn');
      return null;
    } finally { abrufLaeuft = false; }
  }
  function zeigeAbrufStand(text, art) {
    const feld = document.getElementById('tcAbrufStand');
    if (!feld) return;
    const zeit = letzterAbruf ? ` (zuletzt ${letzterAbruf.toLocaleTimeString('de-DE')})` : '';
    feld.textContent = text + zeit;
    feld.className = 'tc-status' + (art === 'warn' ? ' warn' : art === 'gut' ? ' ok' : '');
  }
  // Alle 30 Sekunden nachsehen, solange die Zeiterfassungsseite offen ist. Im Hintergrund
  // laufen zu lassen bringt nichts und kostet nur Anfragen.
  function starteAbrufTakt() {
    if (abrufTakt) return;
    abrufTakt = setInterval(() => {
      const sichtbar = document.querySelector('[data-view-panel="timeclock"]')?.classList.contains('active');
      if (sichtbar) holeGemeldeteZeiten(false);
    }, 30000);
  }

  function render() {
    const $ = id => document.getElementById(id);
    if (!$('tcEnabled')) return;
    $('tcEnabled').checked = config.enabled; $('tcEventId').value = config.eventId; $('tcBirthEnabled').checked = config.allowBirthCode; $('tcManualEnabled').checked = config.allowManualTime;
    $('tcPeopleBody').innerHTML = people.map(person => `<tr><td>${esc(person.displayName)}</td><td><input class="tc-pseudo-feld" data-pseudo-fuer="${esc(schluessel(person))}" value="${esc(pseudonymVon(person))}" placeholder="${esc(schluessel(person))}" maxlength="60"></td><td>${person.type === 'helper' ? 'Aushilfe' : 'Mitglied'}${person.active ? '' : ' · gesperrt'}</td><td>${person.validUntil ? `${new Date(person.validFrom).toLocaleString('de-DE')} – ${new Date(person.validUntil).toLocaleString('de-DE')}` : 'dauerhaft'}</td><td class="tc-code">${esc(person.credential)}</td>
      <td class="tc-teilnahme">
        <select data-teilnahme-fuer="${esc(person.id)}" title="Gilt nur für die aktuelle Veranstaltung – die Vereinsmitgliedschaft bleibt unberührt">
          ${TEILNAHME.map((t) => `<option value="${t.wert}" ${teilnahmeVon(person) === t.wert ? 'selected' : ''}>${t.text}</option>`).join('')}
        </select>
        <input type="text" data-teilnahme-notiz="${esc(person.id)}" value="${esc(bemerkungVon(person))}"
               placeholder="Bemerkung, z. B. weggezogen" maxlength="80">
      </td><td class="tc-aktionen">${person.active
        ? `<button data-remove="${esc(person.id)}" title="Kann sich nicht mehr anmelden, erfasste Zeiten bleiben erhalten">Sperren</button>`
        : `<button data-reactivate="${esc(person.id)}" class="tc-frei" title="Zugang wieder freischalten">Freischalten</button>`}
      <button data-delete="${esc(person.id)}" class="tc-loeschen" title="Endgültig löschen – nur möglich, solange keine Zeiten erfasst sind">Löschen</button></td></tr>`)
      .join('') || '<tr><td colspan="6">Noch keine Zugänge angelegt.</td></tr>';
    const summary = core.summarize(events, people);
    $('tcSummaryBody').innerHTML = summary.map(row => `<tr><td>${esc(row.displayName)}</td><td>${row.present ? 'Anwesend' : 'Abgemeldet'}</td><td>${row.hours.toFixed(2)}</td><td>${row.hourlyPaid ? `Stundenbasis${row.hourlyRate != null ? ` · ${row.hourlyRate.toFixed(2)} €` : ''}` : 'Mitglied'}</td></tr>`).join('') || '<tr><td colspan="4">Noch keine Zeitereignisse importiert.</td></tr>';
    $('tcKpi').innerHTML = `<span>${summary.filter(x=>x.present).length} anwesend</span><span>${events.length} Ereignisse</span><span>${people.filter(x=>x.type==='helper'&&x.active).length} aktive Aushilfen</span>`;
    zeigeLuecken();
    // Einzelbuchungen, neueste zuerst. Hier steht der Klarname - das ist der Manager.
    const namen = new Map(people.map((x) => [x.id, x.displayName]));
    const QUELLE = {qr: 'Ausweis-QR', birth: 'Geburtstagscode', id: 'Kennung', manager: 'Manager'};
    const letzte = [...events].sort((a, b) => new Date(b.effectiveAt) - new Date(a.effectiveAt)).slice(0, 60);
    $('tcEventsBody').innerHTML = letzte.map((e) => {
      const grund = [e.shiftReason, e.correctionReason].filter(Boolean).join(' · ');
      return `<tr${e.voidedAt ? ' class="tc-storniert"' : ''}>
        <td>${new Date(e.effectiveAt).toLocaleString('de-DE', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
        <td>${esc(namen.get(e.personId) || e.personId)}</td>
        <td>${e.kind === 'in' ? 'Kommen' : 'Gehen'}</td>
        <td>${esc(grund)}</td>
        <td>${esc(e.registerId || '')}</td>
        <td>${esc(QUELLE[e.source] || e.source || '')}</td></tr>`;
    }).join('') || '<tr><td colspan="6">Noch keine Buchungen eingegangen.</td></tr>';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  // dienstplanZeilen wird mit herausgegeben, damit der Dienstplan-Export pruefbar ist, ohne
  // dafuer QR-Codes scannen zu muessen - genau die Faelle (nur Kommen / nur Gehen) lassen
  // sich von Hand kaum zuverlaessig herstellen.
  global.KCTimeClockManager = {version:VERSION, refresh:render, dienstplanZeilen};
})(window);
